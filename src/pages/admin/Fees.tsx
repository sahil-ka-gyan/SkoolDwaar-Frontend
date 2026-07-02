import { toast } from '../../utils/toast';
import React, { useState, useEffect, useMemo } from 'react';
import { FiPlus, FiDollarSign, FiEdit2, FiTrash2, FiX, FiSearch, FiPrinter, FiPhone, FiDownload, FiUser, FiCheckCircle, FiAlertCircle, FiClock, FiChevronDown, FiChevronRight, FiCalendar } from 'react-icons/fi';
import client from '../../api/client';
import { formatINR, formatDate } from '../../utils/helpers';

const FEE_PERIODS = ['Monthly', 'Quarterly', 'Half-Yearly', 'Yearly', 'One-time'];
const FEE_TYPES = ['Tuition Fee', 'Admission Fee', 'Library Fee', 'Lab Fee', 'Sports Fee', 'Exam Fee', 'Books & Uniform', 'Miscellaneous'];

const emptyStruct = { fee_type: FEE_TYPES[0], period: 'Quarterly', amount: '', due_date: '', class_id: '' };

type Tab = 'collect' | 'structures' | 'reports';

export default function Fees() {
  const [tab, setTabState] = useState<Tab>('collect');
  const setTab = (t: Tab) => {
    setTabState(t);
    if (t === 'collect' && selectedStudentId) loadLedger(selectedStudentId);
    if (t !== 'collect') refreshAll();
  };
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [structures, setStructures] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [defaulters, setDefaulters] = useState<any[]>([]);
  const [studentStatus, setStudentStatus] = useState<{ counts: any; records: any[] } | null>(null);
  const [statusSubtab, setStatusSubtab] = useState<'all' | 'paid' | 'partial' | 'pending'>('pending');

  // Collect-tab state
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [ledger, setLedger] = useState<any>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [upcomingDues, setUpcomingDues] = useState<any[]>([]);

  // Modals
  const [showStructModal, setShowStructModal] = useState(false);
  const [editStruct, setEditStruct] = useState<any>(null);
  const [structForm, setStructForm] = useState({ ...emptyStruct });
  const [structClassFilter, setStructClassFilter] = useState('');

  const [payTarget, setPayTarget] = useState<any>(null); // { fee_structure_id, fee_type, balance }
  const [payForm, setPayForm] = useState({ amount_paid: '', payment_method: 'Cash', payment_date: new Date().toISOString().split('T')[0] });
  const [receipt, setReceipt] = useState<any>(null); // shown after successful payment

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [defaultersClassFilter, setDefaultersClassFilter] = useState('');

  useEffect(() => {
    client.get('/classes').then(r => setClasses(r.data || [])).catch(() => {});
    client.get('/students').then(r => setStudents(r.data || [])).catch(() => {});
    refreshAll();
  }, []);

  const refreshAll = () => {
    client.get('/fees/structures', { params: { requires_transport: false } }).then(r => setStructures(r.data || [])).catch(() => {});
    client.get('/fees/collection-summary').then(r => setSummary(r.data || null)).catch(() => {});
    client.get('/fees/defaulters').then(r => setDefaulters(r.data?.records || [])).catch(() => {});
    client.get('/fees/student-status').then(r => setStudentStatus(r.data || null)).catch(() => {});
    client.get('/fees/upcoming-dues', { params: { days: 10 } }).then(r => setUpcomingDues(r.data?.records || [])).catch(() => {});
  };

  // ── Ledger ────────────────────────────────────────────────────────────────
  const loadLedger = async (studentId: string) => {
    setLedgerLoading(true);
    setSelectedStudentId(studentId);
    try {
      const r = await client.get(`/fees/student/${studentId}/ledger`);
      setLedger(r.data);
    } catch { setLedger(null); }
    setLedgerLoading(false);
  };

  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students.slice(0, 12);
    const q = studentSearch.toLowerCase();
    return students.filter((s: any) =>
      `${s.first_name || ''} ${s.last_name || ''} ${s.admission_no || ''} ${s.phone || ''}`.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [studentSearch, students]);

  // ── Fee Structure CRUD ────────────────────────────────────────────────────
  const openAddStruct = () => { setStructForm({ ...emptyStruct }); setEditStruct(null); setShowStructModal(true); };
  const openEditStruct = (s: any) => {
    setStructForm({
      fee_type: s.fee_type,
      period: s.period || 'One-time',
      amount: String(s.amount),
      due_date: s.due_date,
      class_id: s.class_id,
    });
    setEditStruct(s);
    setShowStructModal(true);
  };
  const saveStruct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        fee_type: structForm.fee_type,
        period: structForm.period,
        amount: parseFloat(structForm.amount),
        due_date: structForm.due_date,
        class_id: structForm.class_id,
        requires_transport: false,
        transport_tenure_months: null,
      };
      if (editStruct) await client.patch(`/fees/structures/${editStruct.id}`, payload);
      else await client.post('/fees/structures', payload);
      setShowStructModal(false);
      refreshAll();
      if (selectedStudentId) loadLedger(selectedStudentId);
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Error'); }
    setSaving(false);
  };
  const deleteFeeStruct = async () => {
    if (!deleteId) return;
    await client.delete(`/fees/structures/${deleteId}`).catch(() => {});
    setDeleteId(null);
    refreshAll();
    if (selectedStudentId) loadLedger(selectedStudentId);
  };

  // ── Payment ────────────────────────────────────────────────────────────────
  const openPayModal = (item: any) => {
    setPayTarget(item);
    setPayForm({ amount_paid: String(item.balance), payment_method: 'Cash', payment_date: new Date().toISOString().split('T')[0] });
  };
  const savePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !payTarget) return;
    setSaving(true);
    try {
      const res = await client.post('/fees/payments', {
        student_id: selectedStudentId,
        fee_structure_id: payTarget.fee_structure_id,
        amount_paid: parseFloat(payForm.amount_paid),
        payment_method: payForm.payment_method,
        payment_date: payForm.payment_date,
      });
      // Build receipt
      setReceipt({
        ...res.data,
        student: ledger?.student,
        fee_type: payTarget.fee_type,
      });
      setPayTarget(null);
      await loadLedger(selectedStudentId);
      refreshAll();
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Error recording payment'); }
    setSaving(false);
  };

  const printReceipt = () => { window.print(); };

  const classNameById = (id: string) => classes.find((c: any) => c.id === id)?.name || id;

  // Defaulter filter
  const filteredDefaulters = defaultersClassFilter
    ? defaulters.filter(d => {
        const cls = classes.find((c: any) => c.name === d.class_name);
        return cls?.id === defaultersClassFilter;
      })
    : defaulters;

  const exportDefaultersCSV = () => {
    let rows = studentStatus?.records || [];
    if (statusSubtab !== 'all') {
      const map: any = { pending: 'PENDING', partial: 'PARTIAL', paid: 'PAID' };
      rows = rows.filter(r => r.status === map[statusSubtab]);
    }
    if (defaultersClassFilter) {
      const cls = classes.find((c: any) => c.id === defaultersClassFilter);
      if (cls) rows = rows.filter(r => r.class_name === cls.name);
    }
    const csvRows = [
      ['Name', 'Admission No', 'Class', 'Father', 'Phone', 'Total', 'Paid', 'Balance', 'Status', 'Days Overdue'],
      ...rows.map(d => [d.name, d.admission_no, d.class_name, d.father_name || '', d.phone || '', d.total_amount, d.paid, d.balance, d.status, d.days_overdue]),
    ];
    const csv = csvRows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `students-${statusSubtab}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // Structures grouped by class
  const structuresGrouped = useMemo(() => {
    const g: Record<string, any[]> = {};
    structures.forEach((s: any) => {
      (g[s.class_id] = g[s.class_id] || []).push(s);
    });
    return g;
  }, [structures]);

  const visibleStructureClasses = structClassFilter ? [structClassFilter] : Object.keys(structuresGrouped);

  return (
    <div>
      {/* Print stylesheet: hide app chrome, show only receipt */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .receipt-print, .receipt-print * { visibility: visible; }
          .receipt-print { position: absolute; top: 0; left: 0; width: 100%; padding: 24px; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="page-header">
        <h1>Fee Management</h1>
        <div className="actions">
          {tab === 'structures' && <button className="btn btn-primary btn-sm" style={{ width: 'auto' }} onClick={openAddStruct}><FiPlus /> Add Fee Structure</button>}
        </div>
      </div>

      {/* Stat cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '1rem' }}>
        <div className="stat-card green">
          <div className="stat-icon green"><FiDollarSign /></div>
          <div className="stat-info"><span className="label">This Month</span><span className="value">{formatINR(summary?.month_total || 0)}</span></div>
        </div>
        <div className="stat-card blue">
          <div className="stat-icon blue"><FiDollarSign /></div>
          <div className="stat-info"><span className="label">Today's Collection</span><span className="value">{formatINR(summary?.today_total || 0)}</span></div>
        </div>
        <div className="stat-card amber">
          <div className="stat-icon amber"><FiAlertCircle /></div>
          <div className="stat-info"><span className="label">Pending Dues</span><span className="value">{formatINR(defaulters.reduce((a, d) => a + d.balance, 0))}</span></div>
        </div>
        <div className="stat-card red">
          <div className="stat-icon red"><FiUser /></div>
          <div className="stat-info"><span className="label">Defaulters</span><span className="value">{defaulters.length}</span></div>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'collect' ? 'active' : ''}`} onClick={() => setTab('collect')}>Collect Fees</button>
        <button className={`tab ${tab === 'structures' ? 'active' : ''}`} onClick={() => setTab('structures')}>Fee Structures</button>
        <button className={`tab ${tab === 'reports' ? 'active' : ''}`} onClick={() => setTab('reports')}>Reports</button>
      </div>

      {/* ─── COLLECT FEES TAB ─── */}
      {tab === 'collect' && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, alignItems: 'flex-start' }}>
          {/* Left — student search list */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: 12, borderBottom: '1px solid var(--gray-100)', position: 'relative' }}>
              <FiSearch style={{ position: 'absolute', left: 22, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
              <input
                type="text" placeholder="Search by name, admission no, phone..." value={studentSearch}
                onChange={e => setStudentSearch(e.target.value)}
                style={{ paddingLeft: '2.2rem', width: '100%' }}
              />
            </div>
            <div style={{ maxHeight: 'calc(100vh - 320px)', overflowY: 'auto' }}>
              {filteredStudents.length === 0 ? (
                <p style={{ padding: 16, color: 'var(--gray-400)', fontSize: '0.85rem', textAlign: 'center' }}>No students found</p>
              ) : filteredStudents.map((s: any) => (
                <div key={s.id} onClick={() => loadLedger(s.id)} style={{
                  padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--gray-100)',
                  background: selectedStudentId === s.id ? 'var(--primary-50)' : 'transparent',
                  borderLeft: selectedStudentId === s.id ? '3px solid var(--primary-500)' : '3px solid transparent',
                }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{s.first_name} {s.last_name}</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--gray-400)' }}>{s.admission_no} • {s.phone || 'no phone'}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — ledger */}
          <div>
            {!selectedStudentId ? (
              <div className="card"><div className="empty-state"><FiUser size={32} style={{ color: 'var(--gray-300)' }} /><h3>Select a student</h3><p>Search and click a student from the left to view fee ledger</p></div></div>
            ) : ledgerLoading ? (
              <div className="card"><div className="spinner-container"><div className="spinner" /></div></div>
            ) : !ledger ? (
              <div className="card"><div className="empty-state"><h3>Could not load ledger</h3></div></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Student header */}
                <div className="card" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '1.15rem' }}>{ledger.student.first_name} {ledger.student.last_name}</h2>
                      <div style={{ fontSize: '0.82rem', color: 'var(--gray-500)', marginTop: 4 }}>
                        Admission #{ledger.student.admission_no}
                        {ledger.student.class_name && <> • {ledger.student.class_name}{ledger.student.section_name ? ` - ${ledger.student.section_name}` : ''}</>}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--gray-500)', marginTop: 2 }}>
                        Father: {ledger.student.father_name || '—'} • {ledger.student.phone || '—'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <div style={{ textAlign: 'right' }}><div style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>Total</div><div style={{ fontWeight: 700 }}>{formatINR(ledger.summary.total_amount)}</div></div>
                      <div style={{ textAlign: 'right' }}><div style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>Paid</div><div style={{ fontWeight: 700, color: 'var(--success-600)' }}>{formatINR(ledger.summary.total_paid)}</div></div>
                      <div style={{ textAlign: 'right' }}><div style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>Balance</div><div style={{ fontWeight: 700, color: 'var(--danger-600)' }}>{formatINR(ledger.summary.total_balance)}</div></div>
                    </div>
                  </div>
                </div>

                {/* Fee items table */}
                <div className="card">
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)' }}><h3 style={{ margin: 0, fontSize: '0.95rem' }}>Applicable Fees</h3></div>
                  <div className="card-body no-padding">
                    {ledger.items.length === 0 ? (
                      <div className="empty-state"><p>No fee structures defined for this student's class.</p></div>
                    ) : (
                      <table className="data-table">
                        <thead><tr><th></th><th>Fee Type</th><th>Period / Total</th><th>Paid</th><th>Balance</th><th>Status</th><th>Action</th></tr></thead>
                        <tbody>
                          {ledger.items.map((it: any) => {
                            const expanded = !!expandedItems[it.fee_structure_id];
                            const hasInstallments = (it.installments || []).length > 1;
                            return (
                              <React.Fragment key={it.fee_structure_id}>
                                <tr>
                                  <td style={{ width: 24 }}>
                                    {hasInstallments && (
                                      <button className="btn-icon" style={{ padding: 2 }} onClick={() => setExpandedItems(p => ({ ...p, [it.fee_structure_id]: !expanded }))}>
                                        {expanded ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                                      </button>
                                    )}
                                  </td>
                                  <td style={{ fontWeight: 600 }}>{it.fee_type}
                                    <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)', fontWeight: 400 }}>
                                      {it.period}{hasInstallments && ` • ${(it.installments || []).length} installments × ${formatINR(it.installment_amount)}`}
                                    </div>
                                  </td>
                                  <td>{formatINR(it.amount)}</td>
                                  <td style={{ color: 'var(--success-600)' }}>{formatINR(it.paid)}</td>
                                  <td style={{ fontWeight: 700, color: it.balance > 0 ? 'var(--danger-600)' : 'var(--gray-400)' }}>{formatINR(it.balance)}</td>
                                  <td>
                                    {it.status === 'PAID' && <span className="badge" style={{ background: 'var(--success-50)', color: 'var(--success-700)' }}><FiCheckCircle size={10} /> Paid</span>}
                                    {it.status === 'PARTIAL' && <span className="badge" style={{ background: 'var(--amber-50)', color: 'var(--warning-700)' }}><FiClock size={10} /> Partial</span>}
                                    {it.status === 'PENDING' && <span className="badge" style={{ background: 'var(--danger-50)', color: 'var(--danger-700)' }}><FiAlertCircle size={10} /> Pending</span>}
                                  </td>
                                  <td>
                                    {it.balance > 0
                                      ? <button className="btn btn-primary btn-sm" style={{ padding: '4px 12px' }} onClick={() => openPayModal(it)}>Collect</button>
                                      : <span style={{ fontSize: '0.78rem', color: 'var(--gray-400)' }}>—</span>}
                                  </td>
                                </tr>
                                {expanded && hasInstallments && (it.installments || []).map((ins: any) => (
                                  <tr key={`${it.fee_structure_id}-${ins.sequence}`} style={{ background: 'var(--gray-50)' }}>
                                    <td></td>
                                    <td style={{ paddingLeft: 28, fontSize: '0.82rem', color: 'var(--gray-700)' }}>↳ {ins.label}</td>
                                    <td style={{ fontSize: '0.82rem' }}>
                                      Due {formatDate(ins.due_date)}
                                      {ins.days_overdue > 0 && (
                                        <span style={{ marginLeft: 6, fontSize: '0.7rem', fontWeight: 700, color: 'var(--danger-600)' }}>({ins.days_overdue}d overdue)</span>
                                      )}
                                    </td>
                                    <td style={{ fontSize: '0.82rem', color: 'var(--success-600)' }}>{formatINR(ins.paid)}</td>
                                    <td style={{ fontSize: '0.82rem', fontWeight: 700, color: ins.balance > 0 ? 'var(--danger-600)' : 'var(--gray-400)' }}>{formatINR(ins.balance)}</td>
                                    <td>
                                      {ins.status === 'PAID' && <span className="badge" style={{ background: 'var(--success-50)', color: 'var(--success-700)' }}><FiCheckCircle size={10} /> Paid</span>}
                                      {ins.status === 'PARTIAL' && <span className="badge" style={{ background: 'var(--amber-50)', color: 'var(--warning-700)' }}><FiClock size={10} /> Partial</span>}
                                      {ins.status === 'PENDING' && <span className="badge" style={{ background: 'var(--danger-50)', color: 'var(--danger-700)' }}><FiAlertCircle size={10} /> Pending</span>}
                                    </td>
                                    <td></td>
                                  </tr>
                                ))}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                {/* Payment history */}
                {ledger.payment_history.length > 0 && (
                  <div className="card">
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)' }}><h3 style={{ margin: 0, fontSize: '0.95rem' }}>Payment History</h3></div>
                    <div className="card-body no-padding">
                      <table className="data-table">
                        <thead><tr><th>Receipt No</th><th>Date</th><th>Amount</th><th>Method</th><th>Fee</th><th></th></tr></thead>
                        <tbody>
                          {ledger.payment_history.map((p: any) => {
                            const fs = ledger.items.find((i: any) => i.fee_structure_id === p.fee_structure_id);
                            return (
                              <tr key={p.id}>
                                <td><span className="badge badge-primary">{p.receipt_no}</span></td>
                                <td style={{ fontSize: '0.82rem' }}>{formatDate(p.payment_date)}</td>
                                <td style={{ fontWeight: 700, color: 'var(--success-600)' }}>{formatINR(p.amount_paid)}</td>
                                <td><span className="badge badge-info">{p.payment_method}</span></td>
                                <td style={{ fontSize: '0.82rem', color: 'var(--gray-500)' }}>{fs?.fee_type || '—'}</td>
                                <td>
                                  <button className="btn-icon" title="Print receipt" onClick={() => {
                                    setReceipt({ ...p, student: ledger.student, fee_type: fs?.fee_type });
                                  }}><FiPrinter size={14} /></button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── FEE STRUCTURES TAB ─── */}
      {tab === 'structures' && (
        <div>
          <div className="filter-bar" style={{ marginBottom: 12 }}>
            <select value={structClassFilter} onChange={e => setStructClassFilter(e.target.value)} style={{ minWidth: 200 }}>
              <option value="">All Classes</option>
              {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {structures.length === 0 ? (
            <div className="card"><div className="empty-state"><FiDollarSign size={32} style={{ color: 'var(--gray-300)' }} /><h3>No fee structures yet</h3><p>Define quarterly, yearly or monthly fees per class</p></div></div>
          ) : visibleStructureClasses.length === 0 ? (
            <div className="card"><div className="empty-state"><p>No structures in this class.</p></div></div>
          ) : visibleStructureClasses.map(clsId => (
            <div key={clsId} className="card" style={{ marginBottom: 12 }}>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem' }}>{classNameById(clsId)}</h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--gray-400)' }}>{(structuresGrouped[clsId] || []).length} structure(s)</span>
              </div>
              <div className="card-body no-padding">
                <table className="data-table">
                  <thead><tr><th>Fee Type</th><th>Period</th><th>Per Installment</th><th>Year Total</th><th>First Due</th><th>Actions</th></tr></thead>
                  <tbody>
                    {(structuresGrouped[clsId] || []).map((s: any) => {
                      const periodCount = ((p: string) => {
                        const x = (p || '').toLowerCase();
                        if (x.includes('month')) return 12;
                        if (x.includes('quarter')) return 4;
                        if (x.includes('half')) return 2;
                        return 1;
                      })(s.period);
                      const yearTotal = (s.amount || 0) * periodCount;
                      return (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 600 }}>{s.fee_type}</td>
                        <td><span className="badge badge-neutral">{s.period || 'One-time'}</span></td>
                        <td><span style={{ fontWeight: 600 }}>{formatINR(s.amount)}</span><span style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}> × {periodCount}</span></td>
                        <td><span style={{ fontWeight: 700, color: 'var(--success-600)' }}>{formatINR(yearTotal)}</span></td>
                        <td style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>{formatDate(s.due_date)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn-icon" onClick={() => openEditStruct(s)}><FiEdit2 size={14} /></button>
                            <button className="btn-icon" style={{ color: 'var(--danger-500)' }} onClick={() => setDeleteId(s.id)}><FiTrash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── REPORTS TAB ─── */}
      {tab === 'reports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Upcoming dues — next 10 days */}
          <div className="card">
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem' }}><FiCalendar style={{ verticalAlign: -2, marginRight: 6 }} />Upcoming Dues (next 10 days)</h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--gray-400)' }}>{upcomingDues.length} item(s)</span>
            </div>
            <div className="card-body no-padding">
              {upcomingDues.length === 0 ? (
                <div className="empty-state"><FiCheckCircle size={28} style={{ color: 'var(--success-400)' }} /><p>No fees due in the next 10 days.</p></div>
              ) : (
                <table className="data-table">
                  <thead><tr><th>Student</th><th>Class</th><th>Fee / Installment</th><th>Due Date</th><th>In</th><th>Balance</th><th>Action</th></tr></thead>
                  <tbody>
                    {upcomingDues.map((d: any, i: number) => (
                      <tr key={`${d.student_id}-${i}`}>
                        <td>
                          <div style={{ fontWeight: 700 }}>{d.student_name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>{d.admission_no}</div>
                        </td>
                        <td><span className="badge badge-neutral">{d.class_name}</span></td>
                        <td style={{ fontSize: '0.85rem' }}>
                          <div style={{ fontWeight: 600 }}>{d.fee_type}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--gray-500)' }}>{d.installment_label}</div>
                        </td>
                        <td style={{ fontSize: '0.82rem' }}>{formatDate(d.due_date)}</td>
                        <td>
                          <span style={{ fontWeight: 700, color: d.days_until_due <= 3 ? 'var(--danger-600)' : 'var(--warning-600, #b45309)' }}>
                            {d.days_until_due === 0 ? 'Today' : `${d.days_until_due}d`}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--danger-600)' }}>{formatINR(d.balance)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {d.phone && (
                              <a className="btn-icon" title="WhatsApp reminder" target="_blank" rel="noreferrer" style={{ color: '#25D366' }}
                                href={`https://wa.me/${d.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hello, reminder: ${d.fee_type} (${d.installment_label}) of ${formatINR(d.balance)} is due on ${d.due_date} for ${d.student_name}.`)}`}>
                                <FiPhone size={14} />
                              </a>
                            )}
                            <button className="btn btn-primary btn-sm" style={{ padding: '4px 12px' }} onClick={() => { setTab('collect'); loadLedger(d.student_id); }}>Collect</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Collection breakdown */}
          <div className="card">
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)' }}><h3 style={{ margin: 0, fontSize: '0.95rem' }}>Collection Summary</h3></div>
            <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <div><div style={{ fontSize: '0.74rem', color: 'var(--gray-400)' }}>All-Time Total</div><div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{formatINR(summary?.all_time_total || 0)}</div></div>
              <div><div style={{ fontSize: '0.74rem', color: 'var(--gray-400)' }}>This Month</div><div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--success-600)' }}>{formatINR(summary?.month_total || 0)}</div></div>
              <div><div style={{ fontSize: '0.74rem', color: 'var(--gray-400)' }}>Today</div><div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--primary-600)' }}>{formatINR(summary?.today_total || 0)}</div></div>
              <div><div style={{ fontSize: '0.74rem', color: 'var(--gray-400)' }}>Total Receipts</div><div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{summary?.all_time_count || 0}</div></div>
            </div>
            {summary?.by_method && Object.keys(summary.by_method).length > 0 && (
              <div style={{ padding: '0 16px 16px' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--gray-500)', fontWeight: 600, marginBottom: 6 }}>By Method</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {Object.entries(summary.by_method).map(([m, v]: any) => (
                    <div key={m} style={{ padding: '6px 12px', background: 'var(--gray-50)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
                      <strong>{m}:</strong> {formatINR(v as number)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Student Fee Status (with sub-tabs) */}
          <div className="card">
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Student Fee Status</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={defaultersClassFilter} onChange={e => setDefaultersClassFilter(e.target.value)}>
                  <option value="">All Classes</option>
                  {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button className="btn btn-secondary btn-sm" onClick={exportDefaultersCSV}><FiDownload /> Export</button>
              </div>
            </div>
            {/* Sub-tabs — counts recomputed against the current class filter */}
            {(() => null)()}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--gray-100)', padding: '0 16px', gap: 4 }}>
              {(() => {
                const all = studentStatus?.records || [];
                const cls = defaultersClassFilter ? classes.find((c: any) => c.id === defaultersClassFilter) : null;
                const scoped = cls ? all.filter(r => r.class_name === cls.name) : all;
                const counts = {
                  all: scoped.length,
                  paid: scoped.filter(r => r.status === 'PAID').length,
                  partial: scoped.filter(r => r.status === 'PARTIAL').length,
                  pending: scoped.filter(r => r.status === 'PENDING').length,
                };
                return ([
                  { key: 'pending', label: 'Pending (Unpaid)', count: counts.pending, color: 'var(--danger-600)' },
                  { key: 'partial', label: 'Partial', count: counts.partial, color: 'var(--warning-600)' },
                  { key: 'paid', label: 'Paid', count: counts.paid, color: 'var(--success-600)' },
                  { key: 'all', label: 'All', count: counts.all, color: 'var(--gray-700)' },
                ] as const);
              })().map(st => (
                <button
                  key={st.key}
                  onClick={() => setStatusSubtab(st.key)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: '10px 14px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: statusSubtab === st.key ? st.color : 'var(--gray-500)',
                    borderBottom: statusSubtab === st.key ? `2px solid ${st.color}` : '2px solid transparent',
                    marginBottom: -1,
                  }}
                >
                  {st.label} <span style={{ fontSize: '0.72rem', padding: '2px 6px', background: 'var(--gray-100)', borderRadius: 10, marginLeft: 4 }}>{st.count}</span>
                </button>
              ))}
            </div>

            <div className="card-body no-padding">
              {(() => {
                let rows = studentStatus?.records || [];
                // status filter
                if (statusSubtab !== 'all') {
                  const map = { pending: 'PENDING', partial: 'PARTIAL', paid: 'PAID' } as const;
                  rows = rows.filter(r => r.status === map[statusSubtab]);
                }
                // class filter
                if (defaultersClassFilter) {
                  const cls = classes.find((c: any) => c.id === defaultersClassFilter);
                  if (cls) rows = rows.filter(r => r.class_name === cls.name);
                }
                if (rows.length === 0) {
                  return (
                    <div className="empty-state">
                      {statusSubtab === 'paid' ? <FiCheckCircle size={32} style={{ color: 'var(--success-400)' }} /> : <FiUser size={32} style={{ color: 'var(--gray-300)' }} />}
                      <h3>No students in this category</h3>
                      <p>{statusSubtab === 'pending' ? 'No unpaid students.' : statusSubtab === 'partial' ? 'No partial payments.' : statusSubtab === 'paid' ? 'No fully-paid students yet.' : 'No students to show.'}</p>
                    </div>
                  );
                }
                return (
                  <table className="data-table">
                    <thead><tr><th>Name</th><th>Class</th><th>Phone</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th>Overdue</th><th>Action</th></tr></thead>
                    <tbody>
                      {rows.map(d => (
                        <tr key={d.student_id}>
                          <td>
                            <div style={{ fontWeight: 700 }}>{d.name}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>{d.admission_no} • {d.father_name || '—'}</div>
                          </td>
                          <td><span className="badge badge-neutral">{d.class_name}</span></td>
                          <td style={{ fontSize: '0.85rem' }}>{d.phone || '—'}</td>
                          <td>{formatINR(d.total_amount)}</td>
                          <td style={{ color: 'var(--success-600)' }}>{formatINR(d.paid)}</td>
                          <td style={{ fontWeight: 700, color: d.balance > 0 ? 'var(--danger-600)' : 'var(--gray-400)' }}>{formatINR(d.balance)}</td>
                          <td>
                            {d.status === 'PAID' && <span className="badge" style={{ background: 'var(--success-50)', color: 'var(--success-700)' }}><FiCheckCircle size={10} /> Paid</span>}
                            {d.status === 'PARTIAL' && <span className="badge" style={{ background: 'var(--amber-50, #fef3c7)', color: 'var(--warning-700, #b45309)' }}><FiClock size={10} /> Partial</span>}
                            {d.status === 'PENDING' && <span className="badge" style={{ background: 'var(--danger-50)', color: 'var(--danger-700)' }}><FiAlertCircle size={10} /> Pending</span>}
                          </td>
                          <td>
                            {d.days_overdue > 0 ? (
                              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--danger-600)' }}>{d.days_overdue} day{d.days_overdue === 1 ? '' : 's'}</span>
                            ) : d.status === 'PAID' ? (
                              <span style={{ fontSize: '0.78rem', color: 'var(--gray-400)' }}>—</span>
                            ) : (
                              <span style={{ fontSize: '0.78rem', color: 'var(--gray-500)' }}>On time</span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 4 }}>
                              {d.phone && d.status !== 'PAID' && (
                                <a className="btn-icon" title="WhatsApp reminder" href={`https://wa.me/${d.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hello, this is a reminder that ${d.name} has pending fees of ${formatINR(d.balance)}${d.days_overdue > 0 ? ` (overdue by ${d.days_overdue} days)` : ''}.`)}`} target="_blank" rel="noreferrer" style={{ color: '#25D366' }}>
                                  <FiPhone size={14} />
                                </a>
                              )}
                              <button className="btn btn-primary btn-sm" style={{ padding: '4px 12px' }} onClick={() => { setTab('collect'); loadLedger(d.student_id); }}>
                                {d.status === 'PAID' ? 'View' : 'Collect'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ─── Modals ─── */}

      {/* Add/Edit Fee Structure */}
      {showStructModal && (
        <div className="modal-overlay" onClick={() => setShowStructModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-header"><h3>{editStruct ? 'Edit Fee Structure' : 'Add Fee Structure'}</h3><button className="btn-icon" onClick={() => setShowStructModal(false)}><FiX /></button></div>
            <form onSubmit={saveStruct}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group"><label>Fee Type *</label>
                    <select className="form-input" value={structForm.fee_type} onChange={e => setStructForm(p => ({ ...p, fee_type: e.target.value }))}>
                      {FEE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label>Period *</label>
                    <select className="form-input" value={structForm.period} onChange={e => setStructForm(p => ({ ...p, period: e.target.value }))}>
                      {FEE_PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label>Class *</label>
                    <select className="form-input" required value={structForm.class_id} onChange={e => setStructForm(p => ({ ...p, class_id: e.target.value }))}>
                      <option value="">Select class...</option>
                      {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label>Amount (₹) *</label>
                    <input className="form-input" type="number" required min="0" step="1" placeholder="5000" value={structForm.amount} onChange={e => setStructForm(p => ({ ...p, amount: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Due Date *</label>
                    <input className="form-input" type="date" required value={structForm.due_date} onChange={e => setStructForm(p => ({ ...p, due_date: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <p style={{ fontSize: '0.78rem', color: 'var(--info-600)', background: 'var(--info-50)', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--info-100)' }}>
                      ℹ️ This form is for <strong>academic fees only</strong> (Tuition, Admission, Lab, etc.).<br/>
                      To manage <strong>transport fee plans</strong>, go to <strong>Transport → Fee Plans</strong>.
                    </p>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowStructModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: 'auto' }}>{saving ? 'Saving...' : (editStruct ? 'Save' : 'Add')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment modal */}
      {payTarget && (
        <div className="modal-overlay" onClick={() => setPayTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-header"><h3>Collect — {payTarget.fee_type}</h3><button className="btn-icon" onClick={() => setPayTarget(null)}><FiX /></button></div>
            <form onSubmit={savePayment}>
              <div className="modal-body">
                <div style={{ padding: 12, background: 'var(--gray-50)', borderRadius: 'var(--radius-md)', marginBottom: 12, fontSize: '0.85rem' }}>
                  <div><strong>{ledger?.student.first_name} {ledger?.student.last_name}</strong> ({ledger?.student.admission_no})</div>
                  <div style={{ marginTop: 4, color: 'var(--gray-600)' }}>Balance: <strong style={{ color: 'var(--danger-600)' }}>{formatINR(payTarget.balance)}</strong></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group"><label>Amount Paid (₹) *</label>
                    <input className="form-input" type="number" required min="1" max={payTarget.balance} value={payForm.amount_paid} onChange={e => setPayForm(p => ({ ...p, amount_paid: e.target.value }))} />
                    <p style={{ fontSize: '0.72rem', color: 'var(--gray-400)', marginTop: 3 }}>Partial payments allowed</p>
                  </div>
                  <div className="form-group"><label>Method *</label>
                    <select className="form-input" value={payForm.payment_method} onChange={e => setPayForm(p => ({ ...p, payment_method: e.target.value }))}>
                      <option value="Cash">Cash</option><option value="UPI">UPI</option><option value="Online">Online</option><option value="Cheque">Cheque</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}><label>Date *</label>
                    <input className="form-input" type="date" required value={payForm.payment_date} onChange={e => setPayForm(p => ({ ...p, payment_date: e.target.value }))} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setPayTarget(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: 'auto' }}>{saving ? 'Recording...' : 'Record Payment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt modal */}
      {receipt && (
        <div className="modal-overlay" onClick={() => setReceipt(null)}>
          <div className="modal receipt-print" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header no-print">
              <h3>Payment Receipt</h3>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn-icon" title="Print" onClick={printReceipt}><FiPrinter /></button>
                <button className="btn-icon" onClick={() => setReceipt(null)}><FiX /></button>
              </div>
            </div>
            <div className="modal-body">
              <div style={{ textAlign: 'center', borderBottom: '2px solid var(--gray-200)', paddingBottom: 12, marginBottom: 12 }}>
                <h2 style={{ margin: 0, fontSize: '1.3rem' }}>Fee Receipt</h2>
                <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginTop: 4 }}>Receipt No: <strong>{receipt.receipt_no}</strong></div>
                <div style={{ fontSize: '0.78rem', color: 'var(--gray-400)' }}>{formatDate(receipt.payment_date)}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8, fontSize: '0.9rem' }}>
                <div style={{ color: 'var(--gray-500)' }}>Student:</div>
                <div style={{ fontWeight: 600 }}>{receipt.student?.first_name} {receipt.student?.last_name}</div>
                <div style={{ color: 'var(--gray-500)' }}>Admission #:</div>
                <div>{receipt.student?.admission_no}</div>
                {receipt.student?.class_name && (<>
                  <div style={{ color: 'var(--gray-500)' }}>Class:</div>
                  <div>{receipt.student.class_name}{receipt.student.section_name ? ` - ${receipt.student.section_name}` : ''}</div>
                </>)}
                <div style={{ color: 'var(--gray-500)' }}>Father:</div>
                <div>{receipt.student?.father_name || '—'}</div>
                <div style={{ color: 'var(--gray-500)' }}>Fee Type:</div>
                <div>{receipt.fee_type || '—'}</div>
                <div style={{ color: 'var(--gray-500)' }}>Method:</div>
                <div>{receipt.payment_method}</div>
              </div>
              <div style={{ marginTop: 16, padding: 12, background: 'var(--success-50)', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid var(--success-200)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--success-700)' }}>Amount Paid</div>
                <div style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--success-700)' }}>{formatINR(receipt.amount_paid)}</div>
              </div>
              <div style={{ marginTop: 16, fontSize: '0.72rem', color: 'var(--gray-400)', textAlign: 'center' }}>This is a computer-generated receipt.</div>
            </div>
            <div className="modal-footer no-print">
              <button className="btn btn-secondary" onClick={() => setReceipt(null)}>Close</button>
              <button className="btn btn-primary" style={{ width: 'auto' }} onClick={printReceipt}><FiPrinter /> Print Receipt</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <div className="modal-header"><h3>Delete Fee Structure</h3><button className="btn-icon" onClick={() => setDeleteId(null)}><FiX /></button></div>
            <div className="modal-body"><p>Delete this fee structure? Cannot be undone.</p></div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={deleteFeeStruct}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
