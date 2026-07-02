import { toast } from '../../utils/toast';
import React, { useState, useEffect, useMemo } from 'react';
import {
  FiTruck, FiPlus, FiMapPin, FiEdit2, FiTrash2, FiX,
  FiPhone, FiUser, FiUsers, FiDollarSign, FiLayers, FiCheck,
} from 'react-icons/fi';
import client from '../../api/client';
import { formatINR, formatDate } from '../../utils/helpers';

const emptyBus   = { bus_number: '', driver_name: '', driver_phone: '', driver_license: '', capacity: '' };
const emptyRoute = { route_name: '', bus_id: '', stops: '' };
const emptyPlan  = { class_id: '', tenure_months: 3, amount: '', due_date: '' };

const TENURE_OPTIONS = [
  { months: 3,  label: '3 Months',       color: '#0ea5e9' },
  { months: 6,  label: '6 Months',       color: '#f59e0b' },
  { months: 12, label: '12 Months (Full Year)', color: '#10b981' },
];

type MainTab = 'buses' | 'routes' | 'fee-plans' | 'assignments';

export default function Transport() {
  const [buses, setBuses]           = useState<any[]>([]);
  const [routes, setRoutes]         = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [students, setStudents]     = useState<any[]>([]);
  const [classes, setClasses]       = useState<any[]>([]);
  const [feePlans, setFeePlans]     = useState<any[]>([]);   // transport fee structures
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState<MainTab>('buses');

  // Assign student modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({ student_id: '', bus_route_id: '', pickup_stop: '', tenure_months: 3 });
  const [assignStudentSearch, setAssignStudentSearch] = useState('');

  // Fee plan modal
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editPlan, setEditPlan]           = useState<any>(null);
  const [planForm, setPlanForm]           = useState({ ...emptyPlan });

  const [showBusModal, setShowBusModal]     = useState(false);
  const [editBus, setEditBus]               = useState<any>(null);
  const [busForm, setBusForm]               = useState({ ...emptyBus });

  const [showRouteModal, setShowRouteModal] = useState(false);
  const [editRoute, setEditRoute]           = useState<any>(null);
  const [routeForm, setRouteForm]           = useState({ ...emptyRoute });

  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; type: 'bus' | 'route' | 'plan' } | null>(null);
  const [saving, setSaving] = useState(false);

  // Assignment filters
  const [filterBusId, setFilterBusId]     = useState('');
  const [filterRouteId, setFilterRouteId] = useState('');

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = () => {
    setLoading(true);
    Promise.all([
      client.get('/transport/buses').then(r => setBuses(Array.isArray(r.data) ? r.data : [])).catch(() => {}),
      client.get('/transport/routes').then(r => setRoutes(Array.isArray(r.data) ? r.data : [])).catch(() => {}),
      client.get('/transport/assignments').then(r => setAssignments(Array.isArray(r.data) ? r.data : [])).catch(() => {}),
      client.get('/students').then(r => setStudents(Array.isArray(r.data) ? r.data : [])).catch(() => {}),
      client.get('/classes').then(r => setClasses(Array.isArray(r.data) ? r.data : [])).catch(() => {}),
      client.get('/fees/structures', { params: { requires_transport: true } }).then(r => setFeePlans(Array.isArray(r.data) ? r.data : [])).catch(() => {}),
    ]).finally(() => setLoading(false));
  };

  // ── Assignment modal helpers ─────────────────────────────────────────────
  const openAssignModal = () => {
    setAssignForm({ student_id: '', bus_route_id: routes[0]?.id || '', pickup_stop: '', tenure_months: 3 });
    setAssignStudentSearch('');
    setShowAssignModal(true);
  };

  const selectedRouteStops: string[] = useMemo(() => {
    const r = routes.find((rt: any) => rt.id === assignForm.bus_route_id);
    if (!r) return [];
    try { return JSON.parse(r.stops || '[]'); } catch { return []; }
  }, [routes, assignForm.bus_route_id]);

  const unassignedStudents = useMemo(
    () => students.filter((s: any) => !assignments.find((a: any) => a.student_id === s.id)),
    [students, assignments]
  );

  const filteredAssignments = useMemo(() => {
    return assignments.filter((a: any) => {
      if (filterRouteId && a.bus_route_id !== filterRouteId) return false;
      if (filterBusId) {
        // match via route → bus
        const route = routes.find((r: any) => r.id === a.bus_route_id);
        if (!route || route.bus_id !== filterBusId) return false;
      }
      return true;
    });
  }, [assignments, filterBusId, filterRouteId, routes]);

  const assignFilteredStudents = useMemo(() => {
    const q = assignStudentSearch.trim().toLowerCase();
    if (!q) return unassignedStudents.slice(0, 8);
    return unassignedStudents.filter((s: any) =>
      `${s.first_name || ''} ${s.last_name || ''} ${s.admission_no || ''} ${s.phone || ''}`.toLowerCase().includes(q)
    ).slice(0, 12);
  }, [unassignedStudents, assignStudentSearch]);

  const pickedStudent = useMemo(
    () => students.find((s: any) => s.id === assignForm.student_id),
    [students, assignForm.student_id]
  );

  // Fee plans for the picked student's class, indexed by tenure_months
  const studentFeePlans = useMemo(() => {
    if (!pickedStudent?.class_id) return {};
    return feePlans
      .filter((p: any) => p.class_id === pickedStudent.class_id && p.transport_tenure_months != null)
      .reduce((acc: any, p: any) => { acc[p.transport_tenure_months] = p; return acc; }, {});
  }, [feePlans, pickedStudent]);

  const saveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await client.post('/transport/assign', assignForm);
      setShowAssignModal(false);
      fetchAll();
      toast.success('Student assigned to transport');
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Error'); }
    setSaving(false);
  };

  const unassignStudent = async (aid: string) => {
    if (!confirm('Remove this student from transport? Their transport fee will also be removed from the ledger.')) return;
    await client.delete(`/transport/assignments/${aid}`).catch(() => {});
    fetchAll();
  };

  // ── Fee Plans CRUD ───────────────────────────────────────────────────────
  const openAddPlan = () => {
    setPlanForm({ ...emptyPlan, class_id: classes[0]?.id || '', due_date: new Date().toISOString().split('T')[0] });
    setEditPlan(null);
    setShowPlanModal(true);
  };
  const openEditPlan = (p: any) => {
    setPlanForm({ class_id: p.class_id, tenure_months: p.transport_tenure_months, amount: String(p.amount), due_date: p.due_date });
    setEditPlan(p);
    setShowPlanModal(true);
  };
  const savePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const tenureLabel = TENURE_OPTIONS.find(t => t.months === planForm.tenure_months)?.label || `${planForm.tenure_months}m`;
      const payload = {
        fee_type: `Transport (${planForm.tenure_months}m)`,
        amount: parseFloat(planForm.amount),
        due_date: planForm.due_date,
        period: 'One-time',
        class_id: planForm.class_id,
        requires_transport: true,
        transport_tenure_months: planForm.tenure_months,
      };
      if (editPlan) await client.patch(`/fees/structures/${editPlan.id}`, payload);
      else await client.post('/fees/structures', payload);
      setShowPlanModal(false);
      fetchAll();
      toast.success(editPlan ? 'Plan updated' : 'Transport plan created');
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Error saving plan'); }
    setSaving(false);
  };
  const deletePlan = async (id: string) => {
    await client.delete(`/fees/structures/${id}`).catch(() => {});
    setDeleteConfirm(null);
    fetchAll();
  };

  // ── Bus CRUD ─────────────────────────────────────────────────────────────
  const openAddBus = () => { setBusForm({ ...emptyBus }); setEditBus(null); setShowBusModal(true); };
  const openEditBus = (b: any) => {
    setBusForm({ bus_number: b.bus_number, driver_name: b.driver_name, driver_phone: b.driver_phone, driver_license: b.driver_license || '', capacity: b.capacity ? String(b.capacity) : '' });
    setEditBus(b); setShowBusModal(true);
  };
  const saveBus = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload: any = { ...busForm };
      if (payload.capacity) payload.capacity = parseInt(payload.capacity); else delete payload.capacity;
      if (editBus) await client.patch(`/transport/buses/${editBus.id}`, payload);
      else await client.post('/transport/buses', payload);
      setShowBusModal(false); fetchAll();
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Error saving bus'); }
    setSaving(false);
  };
  const deleteBus = async (id: string) => { await client.delete(`/transport/buses/${id}`).catch(() => {}); setDeleteConfirm(null); fetchAll(); };

  // ── Route CRUD ───────────────────────────────────────────────────────────
  const openAddRoute  = () => { setRouteForm({ ...emptyRoute, bus_id: buses[0]?.id || '' }); setEditRoute(null); setShowRouteModal(true); };
  const openEditRoute = (r: any) => {
    let stopsStr = r.stops;
    try { stopsStr = JSON.parse(r.stops).join(', '); } catch {}
    setRouteForm({ route_name: r.route_name, bus_id: r.bus_id, stops: stopsStr });
    setEditRoute(r); setShowRouteModal(true);
  };
  const saveRoute = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const stops = routeForm.stops.split(',').map(s => s.trim()).filter(Boolean);
      const payload = { route_name: routeForm.route_name, bus_id: routeForm.bus_id, stops };
      if (editRoute) await client.patch(`/transport/routes/${editRoute.id}`, payload);
      else await client.post('/transport/routes', payload);
      setShowRouteModal(false); fetchAll();
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Error saving route'); }
    setSaving(false);
  };
  const deleteRoute = async (id: string) => { await client.delete(`/transport/routes/${id}`).catch(() => {}); setDeleteConfirm(null); fetchAll(); };

  const busNameById = (id: string) => buses.find(b => b.id === id)?.bus_number || id;
  const classNameById = (id: string) => classes.find((c: any) => c.id === id)?.name || id;

  // Group fee plans by class for display
  const plansGroupedByClass = useMemo(() => {
    const g: Record<string, any[]> = {};
    feePlans.forEach((p: any) => { (g[p.class_id] = g[p.class_id] || []).push(p); });
    return g;
  }, [feePlans]);

  const hasPlanForTenure = (classId: string, months: number) =>
    (plansGroupedByClass[classId] || []).some(p => p.transport_tenure_months === months);

  return (
    <div>
      <div className="page-header">
        <h1>Transport Management</h1>
        <div className="actions">
          {tab === 'buses'       && <button className="btn btn-primary btn-sm" style={{ width: 'auto' }} onClick={openAddBus}><FiPlus /> Add Bus</button>}
          {tab === 'routes'      && <button className="btn btn-primary btn-sm" style={{ width: 'auto' }} onClick={openAddRoute} disabled={buses.length === 0}><FiPlus /> Add Route</button>}
          {tab === 'fee-plans'   && <button className="btn btn-primary btn-sm" style={{ width: 'auto' }} onClick={openAddPlan}><FiPlus /> Add Fee Plan</button>}
          {tab === 'assignments' && <button className="btn btn-primary btn-sm" style={{ width: 'auto' }} onClick={openAssignModal} disabled={routes.length === 0}><FiPlus /> Assign Student</button>}
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'buses'       ? 'active' : ''}`} onClick={() => setTab('buses')}>Buses ({buses.length})</button>
        <button className={`tab ${tab === 'routes'      ? 'active' : ''}`} onClick={() => setTab('routes')}>Routes ({routes.length})</button>
        <button className={`tab ${tab === 'fee-plans'   ? 'active' : ''}`} onClick={() => setTab('fee-plans')}>
          <FiDollarSign size={13} style={{ marginRight: 4 }} />Fee Plans ({feePlans.length})
        </button>
        <button className={`tab ${tab === 'assignments' ? 'active' : ''}`} onClick={() => setTab('assignments')}>Student Assignments ({assignments.length})</button>
      </div>

      {/* ─── BUSES ─── */}
      {tab === 'buses' && (
        <div className="card">
          <div className="card-body no-padding">
            {loading ? <div className="spinner-container"><div className="spinner" /></div>
              : buses.length === 0 ? (
                <div className="empty-state"><FiTruck size={32} style={{ color: 'var(--gray-300)' }} /><h3>No buses added</h3><p>Add your first school bus to start managing transport</p></div>
              ) : (
                <div className="data-table-wrapper">
                  <table className="data-table">
                    <thead><tr><th>Bus Number</th><th>Driver</th><th>Phone</th><th>License</th><th>Capacity</th><th>Actions</th></tr></thead>
                    <tbody>
                      {buses.map(b => (
                        <tr key={b.id}>
                          <td><span className="badge badge-primary" style={{ fontSize: '0.9rem', padding: '4px 12px' }}>{b.bus_number}</span></td>
                          <td><div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><FiUser size={13} style={{ color: 'var(--gray-400)' }} />{b.driver_name || '—'}</div></td>
                          <td style={{ fontSize: '0.85rem' }}><FiPhone size={12} style={{ marginRight: 4 }} />{b.driver_phone || '—'}</td>
                          <td style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>{b.driver_license || '—'}</td>
                          <td>{b.capacity ? <span className="badge badge-info">{b.capacity} seats</span> : '—'}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="btn-icon" onClick={() => openEditBus(b)}><FiEdit2 size={14} /></button>
                              <button className="btn-icon" style={{ color: 'var(--danger-500)' }} onClick={() => setDeleteConfirm({ id: b.id, type: 'bus' })}><FiTrash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </div>
        </div>
      )}

      {/* ─── ROUTES ─── */}
      {tab === 'routes' && (
        <div className="card">
          <div className="card-body no-padding">
            {loading ? <div className="spinner-container"><div className="spinner" /></div>
              : routes.length === 0 ? (
                <div className="empty-state"><FiMapPin size={32} style={{ color: 'var(--gray-300)' }} /><h3>No routes defined</h3><p>{buses.length === 0 ? 'Add buses first, then define routes' : 'Add routes for your buses'}</p></div>
              ) : (
                <div className="data-table-wrapper">
                  <table className="data-table">
                    <thead><tr><th>Route Name</th><th>Assigned Bus</th><th>Stops</th><th>Actions</th></tr></thead>
                    <tbody>
                      {routes.map(r => {
                        let stops: string[] = [];
                        try { stops = JSON.parse(r.stops || '[]'); } catch { stops = [r.stops]; }
                        return (
                          <tr key={r.id}>
                            <td style={{ fontWeight: 600 }}>{r.route_name}</td>
                            <td><span className="badge badge-neutral">{busNameById(r.bus_id)}</span></td>
                            <td>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {stops.map((s: string, i: number) => (
                                  <span key={i} style={{ padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--gray-100)', fontSize: '0.75rem', color: 'var(--gray-600)' }}>{s}</span>
                                ))}
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button className="btn-icon" onClick={() => openEditRoute(r)}><FiEdit2 size={14} /></button>
                                <button className="btn-icon" style={{ color: 'var(--danger-500)' }} onClick={() => setDeleteConfirm({ id: r.id, type: 'route' })}><FiTrash2 size={14} /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
          </div>
        </div>
      )}

      {/* ─── FEE PLANS ─── */}
      {tab === 'fee-plans' && (
        <div>
          {/* Info banner */}
          <div style={{ background: 'linear-gradient(135deg, #eff6ff, #f0fdf4)', border: '1px solid #bfdbfe', borderRadius: 'var(--radius-lg)', padding: '14px 18px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <FiDollarSign style={{ color: '#2563eb', marginTop: 2, flexShrink: 0 }} />
            <div style={{ fontSize: '0.85rem', color: '#1e3a5f' }}>
              <strong>How Transport Fee Plans work:</strong> Create one fee plan per class per tenure (3 months, 6 months, 12 months). When you assign a student to transport for a specific tenure, the matching fee plan is <em>automatically charged</em> in the student's fee ledger — no manual entry needed.
            </div>
          </div>

          {feePlans.length === 0 && classes.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <FiDollarSign size={32} style={{ color: 'var(--gray-300)' }} />
                <h3>No transport fee plans yet</h3>
                <p>Click "Add Fee Plan" to set up pricing for 3-month, 6-month, and 12-month transport subscriptions per class.</p>
              </div>
            </div>
          ) : classes.map((cls: any) => { const clsId = cls.id; const plans = plansGroupedByClass[clsId] || []; return (
            <div key={clsId} className="card" style={{ marginBottom: 12 }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FiLayers style={{ color: 'var(--primary-500)' }} />
                  {classNameById(clsId)}
                </h3>
                <div style={{ display: 'flex', gap: 6 }}>
                  {TENURE_OPTIONS.map(opt => (
                    <span key={opt.months} style={{
                      padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '0.7rem', fontWeight: 600,
                      background: hasPlanForTenure(clsId, opt.months) ? `${opt.color}20` : 'var(--gray-100)',
                      color: hasPlanForTenure(clsId, opt.months) ? opt.color : 'var(--gray-400)',
                      border: `1px solid ${hasPlanForTenure(clsId, opt.months) ? `${opt.color}60` : 'var(--gray-200)'}`,
                      display: 'flex', alignItems: 'center', gap: 3,
                    }}>
                      {hasPlanForTenure(clsId, opt.months) && <FiCheck size={9} />}
                      {opt.months}m
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                {TENURE_OPTIONS.map(opt => {
                  const plan = (plans as any[]).find((p: any) => p.transport_tenure_months === opt.months);
                  return (
                    <div key={opt.months} style={{
                      border: plan ? `2px solid ${opt.color}40` : '2px dashed var(--gray-200)',
                      borderRadius: 'var(--radius-lg)', padding: 14,
                      background: plan ? `${opt.color}08` : 'var(--gray-50)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: plan ? opt.color : 'var(--gray-400)' }}>
                          {opt.label}
                        </span>
                        {plan && (
                          <div style={{ display: 'flex', gap: 3 }}>
                            <button className="btn-icon" style={{ width: 26, height: 26 }} onClick={() => openEditPlan(plan)}><FiEdit2 size={12} /></button>
                            <button className="btn-icon" style={{ width: 26, height: 26, color: 'var(--danger-500)' }} onClick={() => setDeleteConfirm({ id: plan.id, type: 'plan' })}><FiTrash2 size={12} /></button>
                          </div>
                        )}
                      </div>
                      {plan ? (
                        <>
                          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: opt.color }}>{formatINR(plan.amount)}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--gray-500)', marginTop: 3 }}>One-time · Due from {formatDate(plan.due_date)}</div>
                        </>
                      ) : (
                        <div>
                          <div style={{ fontSize: '0.82rem', color: 'var(--gray-400)', marginBottom: 8 }}>No plan set</div>
                          <button className="btn btn-secondary btn-sm" style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                            onClick={() => { setPlanForm({ class_id: clsId, tenure_months: opt.months, amount: '', due_date: new Date().toISOString().split('T')[0] }); setEditPlan(null); setShowPlanModal(true); }}>
                            <FiPlus size={11} /> Set price
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ); })}
        </div>
      )}

      {/* ─── STUDENT ASSIGNMENTS ─── */}
      {tab === 'assignments' && (
        <div>
          {/* Filter bar */}
          {assignments.length > 0 && (
            <div className="filter-bar" style={{ marginBottom: 10 }}>
              <select value={filterBusId} onChange={e => { setFilterBusId(e.target.value); setFilterRouteId(''); }} style={{ minWidth: 180 }}>
                <option value="">All Buses</option>
                {buses.map((b: any) => <option key={b.id} value={b.id}>{b.bus_number} — {b.driver_name}</option>)}
              </select>
              <select value={filterRouteId} onChange={e => setFilterRouteId(e.target.value)} style={{ minWidth: 200 }}>
                <option value="">All Routes</option>
                {routes
                  .filter((r: any) => !filterBusId || r.bus_id === filterBusId)
                  .map((r: any) => <option key={r.id} value={r.id}>{r.route_name}</option>)}
              </select>
              {(filterBusId || filterRouteId) && (
                <button className="btn btn-secondary btn-sm" onClick={() => { setFilterBusId(''); setFilterRouteId(''); }}>Clear filters</button>
              )}
              <span style={{ fontSize: '0.82rem', color: 'var(--gray-500)', marginLeft: 'auto' }}>
                {filteredAssignments.length} of {assignments.length} students
              </span>
            </div>
          )}
          <div className="card">
          <div className="card-body no-padding">
            {loading ? <div className="spinner-container"><div className="spinner" /></div>
              : assignments.length === 0 ? (
                <div className="empty-state"><FiUsers size={32} style={{ color: 'var(--gray-300)' }} /><h3>No transport assignments</h3><p>{routes.length === 0 ? 'Add routes first, then assign students.' : 'Click "Assign Student" to add a student to a bus route.'}</p></div>
              ) : filteredAssignments.length === 0 ? (
                <div className="empty-state"><FiUsers size={32} style={{ color: 'var(--gray-300)' }} /><h3>No matching students</h3><p>Try clearing the filters above.</p></div>
              ) : (
                <div className="data-table-wrapper">
                  <table className="data-table">
                    <thead><tr><th>Student</th><th>Class</th><th>Pickup Stop</th><th>Route</th><th>Bus / Driver</th><th>Plan</th><th>Service Window</th><th>Actions</th></tr></thead>
                    <tbody>
                      {filteredAssignments.map((a: any) => {
                        let remainingText = '—';
                        let status: 'active' | 'expired' | 'ongoing' = 'ongoing';
                        let tenureMonths = null;
                        if (a.start_date && a.end_date) {
                          const end = new Date(a.end_date);
                          const start = new Date(a.start_date);
                          const today = new Date();
                          const diff = Math.round((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                          tenureMonths = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30));
                          if (diff < 0) { remainingText = `Expired ${Math.abs(diff)}d ago`; status = 'expired'; }
                          else { remainingText = `${diff} days left`; status = 'active'; }
                        }
                        return (
                          <tr key={a.id}>
                            <td>
                              <div style={{ fontWeight: 700 }}>{a.student_name}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>{a.admission_no}</div>
                            </td>
                            <td><span className="badge badge-neutral">{a.class_name}{a.section_name ? ` - ${a.section_name}` : ''}</span></td>
                            <td style={{ fontSize: '0.85rem' }}>{a.pickup_stop}</td>
                            <td style={{ fontSize: '0.85rem' }}>{a.route_name}</td>
                            <td style={{ fontSize: '0.85rem' }}>
                              <div style={{ fontWeight: 600 }}>{a.bus_number}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--gray-500)' }}>{a.driver_name}</div>
                            </td>
                            <td>
                              {tenureMonths ? (
                                <span style={{ padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '0.72rem', fontWeight: 700,
                                  background: tenureMonths === 3 ? '#e0f2fe' : tenureMonths === 6 ? '#fef3c7' : '#dcfce7',
                                  color: tenureMonths === 3 ? '#0284c7' : tenureMonths === 6 ? '#b45309' : '#15803d',
                                }}>
                                  {tenureMonths}m
                                </span>
                              ) : '—'}
                            </td>
                            <td style={{ fontSize: '0.78rem' }}>
                              {a.start_date && a.end_date ? (
                                <>
                                  <div>{a.start_date} → {a.end_date}</div>
                                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: status === 'expired' ? 'var(--danger-600)' : 'var(--success-600)' }}>{remainingText}</div>
                                </>
                              ) : <span style={{ color: 'var(--gray-400)' }}>Ongoing</span>}
                            </td>
                            <td>
                              <button className="btn-icon" title="Unassign" style={{ color: 'var(--danger-500)' }} onClick={() => unassignStudent(a.id)}><FiTrash2 size={14} /></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
          </div>
          </div>{/* close outer wrapper div */}
        </div>
      )}

      {/* ════ MODALS ════ */}

      {/* Assign student modal */}
      {showAssignModal && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header"><h3>Assign Student to Transport</h3><button className="btn-icon" onClick={() => setShowAssignModal(false)}><FiX /></button></div>
            <form onSubmit={saveAssignment}>
              <div className="modal-body">
                {/* Student picker */}
                <div className="form-group">
                  <label>Student * <span style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>({unassignedStudents.length} not yet on transport)</span></label>
                  {pickedStudent ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--primary-50)', border: '1px solid var(--primary-200)', borderRadius: 'var(--radius-md)' }}>
                      <FiUser size={14} style={{ color: 'var(--primary-600)' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{pickedStudent.first_name} {pickedStudent.last_name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--gray-500)' }}>
                          {pickedStudent.admission_no} • {pickedStudent.class_name || '—'}{pickedStudent.section_name ? ` - ${pickedStudent.section_name}` : ''}
                        </div>
                      </div>
                      <button type="button" className="btn-icon" onClick={() => { setAssignForm(p => ({ ...p, student_id: '' })); setAssignStudentSearch(''); }}><FiX size={14} /></button>
                    </div>
                  ) : (
                    <div style={{ position: 'relative' }}>
                      <input className="form-input" placeholder="Search by name or admission no..." value={assignStudentSearch} onChange={e => setAssignStudentSearch(e.target.value)} />
                      {(assignStudentSearch || assignFilteredStudents.length > 0) && (
                        <div style={{ marginTop: 4, border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)', maxHeight: 200, overflowY: 'auto', background: '#fff', position: 'absolute', width: '100%', zIndex: 10, boxShadow: 'var(--shadow-md)' }}>
                          {assignFilteredStudents.length === 0 ? (
                            <div style={{ padding: 10, fontSize: '0.82rem', color: 'var(--gray-400)' }}>No matching students</div>
                          ) : assignFilteredStudents.map((s: any) => (
                            <div key={s.id} onClick={() => setAssignForm(p => ({ ...p, student_id: s.id }))}
                              style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--gray-100)' }}>
                              <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{s.first_name} {s.last_name}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--gray-500)' }}>
                                {s.admission_no} · {s.class_name || 'No class'}{s.section_name ? ` - ${s.section_name}` : ''}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Route + pickup */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label>Bus Route *</label>
                    <select className="form-input" required value={assignForm.bus_route_id} onChange={e => setAssignForm(p => ({ ...p, bus_route_id: e.target.value, pickup_stop: '' }))}>
                      <option value="">Select route...</option>
                      {routes.map((r: any) => <option key={r.id} value={r.id}>{r.route_name} ({busNameById(r.bus_id)})</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Pickup / Drop Stop *</label>
                    <select className="form-input" required value={assignForm.pickup_stop} onChange={e => setAssignForm(p => ({ ...p, pickup_stop: e.target.value }))} disabled={!assignForm.bus_route_id}>
                      <option value="">{assignForm.bus_route_id ? 'Select stop...' : 'Pick route first'}</option>
                      {selectedRouteStops.map((s: string) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                {/* Tenure picker — shows fee amount from plan */}
                <div className="form-group">
                  <label>Transport Tenure *</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {TENURE_OPTIONS.map(opt => {
                      const plan = studentFeePlans[opt.months];
                      const isSelected = assignForm.tenure_months === opt.months;
                      return (
                        <button type="button" key={opt.months} onClick={() => setAssignForm(p => ({ ...p, tenure_months: opt.months }))} style={{
                          padding: '12px 8px', textAlign: 'center',
                          background: isSelected ? `${opt.color}15` : '#fff',
                          border: isSelected ? `2px solid ${opt.color}` : '1.5px solid var(--gray-200)',
                          borderRadius: 'var(--radius-lg)', cursor: 'pointer',
                          transition: 'all .15s',
                        }}>
                          <div style={{ fontWeight: 700, fontSize: '0.88rem', color: isSelected ? opt.color : 'var(--gray-700)' }}>{opt.months} Months</div>
                          {plan ? (
                            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: opt.color, marginTop: 4 }}>{formatINR(plan.amount)}</div>
                          ) : (
                            <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)', marginTop: 4 }}>
                              {pickedStudent?.class_id ? 'No plan set' : 'Select student first'}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {pickedStudent?.class_id && Object.keys(studentFeePlans).length === 0 && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--warning-600)', marginTop: 6, background: 'var(--warning-50)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--warning-100)' }}>
                      ⚠️ No transport fee plans found for <strong>{pickedStudent.class_name}</strong>. Go to <strong>Fee Plans</strong> tab to set them up first.
                    </p>
                  )}
                  <p style={{ fontSize: '0.72rem', color: 'var(--gray-400)', marginTop: 6 }}>
                    Transport starts from current month. The matching fee will appear automatically in the student's fee ledger.
                  </p>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAssignModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: 'auto' }}>{saving ? 'Saving...' : 'Assign & Apply Fee'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Fee Plan modal */}
      {showPlanModal && (
        <div className="modal-overlay" onClick={() => setShowPlanModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>{editPlan ? 'Edit Transport Fee Plan' : 'Add Transport Fee Plan'}</h3>
              <button className="btn-icon" onClick={() => setShowPlanModal(false)}><FiX /></button>
            </div>
            <form onSubmit={savePlan}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Class *</label>
                  <select className="form-input" required value={planForm.class_id} onChange={e => setPlanForm(p => ({ ...p, class_id: e.target.value }))}>
                    <option value="">Select class...</option>
                    {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Tenure *</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {TENURE_OPTIONS.map(opt => (
                      <button type="button" key={opt.months} onClick={() => setPlanForm(p => ({ ...p, tenure_months: opt.months }))} style={{
                        flex: 1, padding: '8px 4px', textAlign: 'center',
                        background: planForm.tenure_months === opt.months ? `${opt.color}15` : '#fff',
                        border: planForm.tenure_months === opt.months ? `2px solid ${opt.color}` : '1.5px solid var(--gray-200)',
                        borderRadius: 'var(--radius-md)', cursor: 'pointer',
                        fontWeight: planForm.tenure_months === opt.months ? 700 : 500,
                        color: planForm.tenure_months === opt.months ? opt.color : 'var(--gray-700)',
                        fontSize: '0.82rem',
                      }}>
                        {opt.months}m
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label>Fee Amount (₹) *</label>
                  <input className="form-input" type="number" required min="1" step="1" placeholder="e.g. 6000"
                    value={planForm.amount} onChange={e => setPlanForm(p => ({ ...p, amount: e.target.value }))} />
                  <p style={{ fontSize: '0.72rem', color: 'var(--gray-400)', marginTop: 3 }}>One-time charge for the full tenure. No installments.</p>
                </div>
                <div className="form-group">
                  <label>First Due Date *</label>
                  <input className="form-input" type="date" required value={planForm.due_date} onChange={e => setPlanForm(p => ({ ...p, due_date: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPlanModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: 'auto' }}>{saving ? 'Saving...' : (editPlan ? 'Save Changes' : 'Add Plan')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bus modal */}
      {showBusModal && (
        <div className="modal-overlay" onClick={() => setShowBusModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-header"><h3>{editBus ? 'Edit Bus' : 'Add Bus'}</h3><button className="btn-icon" onClick={() => setShowBusModal(false)}><FiX /></button></div>
            <form onSubmit={saveBus}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group"><label>Bus Number *</label><input className="form-input" required placeholder="DL-1AB-2234" value={busForm.bus_number} onChange={e => setBusForm(p => ({ ...p, bus_number: e.target.value }))} /></div>
                  <div className="form-group"><label>Seating Capacity</label><input className="form-input" type="number" min="1" placeholder="42" value={busForm.capacity} onChange={e => setBusForm(p => ({ ...p, capacity: e.target.value }))} /></div>
                  <div className="form-group"><label>Driver Name *</label><input className="form-input" required placeholder="Ramesh Kumar" value={busForm.driver_name} onChange={e => setBusForm(p => ({ ...p, driver_name: e.target.value }))} /></div>
                  <div className="form-group"><label>Driver Phone *</label><input className="form-input" required placeholder="9876543210" value={busForm.driver_phone} onChange={e => setBusForm(p => ({ ...p, driver_phone: e.target.value }))} /></div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Driver License No.</label><input className="form-input" placeholder="DL-04201100023" value={busForm.driver_license} onChange={e => setBusForm(p => ({ ...p, driver_license: e.target.value }))} /></div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowBusModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: 'auto' }}>{saving ? 'Saving...' : (editBus ? 'Save Changes' : 'Add Bus')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Route modal */}
      {showRouteModal && (
        <div className="modal-overlay" onClick={() => setShowRouteModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-header"><h3>{editRoute ? 'Edit Route' : 'Add Route'}</h3><button className="btn-icon" onClick={() => setShowRouteModal(false)}><FiX /></button></div>
            <form onSubmit={saveRoute}>
              <div className="modal-body">
                <div className="form-group"><label>Route Name *</label><input className="form-input" required placeholder="Route A — Rohini Sector 9" value={routeForm.route_name} onChange={e => setRouteForm(p => ({ ...p, route_name: e.target.value }))} /></div>
                <div className="form-group">
                  <label>Assign Bus *</label>
                  <select className="form-input" required value={routeForm.bus_id} onChange={e => setRouteForm(p => ({ ...p, bus_id: e.target.value }))}>
                    <option value="">Select bus...</option>
                    {buses.map(b => <option key={b.id} value={b.id}>{b.bus_number} — {b.driver_name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Stops (comma separated) *</label>
                  <textarea className="form-input" rows={3} required placeholder="Stop 1, Stop 2, Stop 3, School" value={routeForm.stops} onChange={e => setRouteForm(p => ({ ...p, stops: e.target.value }))} />
                  <p style={{ fontSize: '0.72rem', color: 'var(--gray-400)', marginTop: 3 }}>Enter stop names separated by commas. Include School as the last stop.</p>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowRouteModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: 'auto' }}>{saving ? 'Saving...' : (editRoute ? 'Save Changes' : 'Add Route')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <div className="modal-header">
              <h3>Delete {deleteConfirm.type === 'bus' ? 'Bus' : deleteConfirm.type === 'route' ? 'Route' : 'Fee Plan'}</h3>
              <button className="btn-icon" onClick={() => setDeleteConfirm(null)}><FiX /></button>
            </div>
            <div className="modal-body">
              <p>Are you sure? This cannot be undone.
                {deleteConfirm.type === 'plan' && ' Students already assigned with this tenure will no longer see this fee.'}
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() =>
                deleteConfirm.type === 'bus' ? deleteBus(deleteConfirm.id) :
                deleteConfirm.type === 'route' ? deleteRoute(deleteConfirm.id) :
                deletePlan(deleteConfirm.id)
              }>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
