import { toast } from '../../utils/toast';
import React, { useState, useEffect, useMemo } from 'react';
import {
  FiPlus, FiSearch, FiEdit2, FiTrash2, FiDownload, FiFilter, FiTrendingDown,
  FiCalendar, FiTag, FiUser, FiTruck, FiCheck, FiX, FiDollarSign, FiAlertCircle,
  FiChevronLeft, FiChevronRight,
} from 'react-icons/fi';
import client from '../../api/client';
import { formatINR, formatDate, getInitials } from '../../utils/helpers';

const OP_CATEGORIES = [
  'Teacher Conveyance', 'Staff Refreshments', 'Housekeeping',
  'Labour', 'Stationery', 'Maintenance', 'Others',
];
const ALL_CATEGORIES = [...OP_CATEGORIES, 'Salary'];

const CAT_COLORS: Record<string, string> = {
  'Teacher Conveyance': '#6366f1',
  'Staff Refreshments': '#f59e0b',
  'Housekeeping': '#10b981',
  'Labour': '#ef4444',
  'Stationery': '#0ea5e9',
  'Maintenance': '#8b5cf6',
  'Salary': '#14b8a6',
  'Others': '#6b7280',
};

const emptyForm = { title: '', category: OP_CATEGORIES[0], amount: '', date: new Date().toISOString().split('T')[0], notes: '' };

type Tab = 'overview' | 'salary' | 'operational';

export default function Expenses() {
  const [tab, setTab] = useState<Tab>('overview');
  const [expenses, setExpenses] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Operational tab state
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Salary tab state
  const today = new Date();
  const [salaryMonth, setSalaryMonth] = useState<string>(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
  const [salaryStatus, setSalaryStatus] = useState<any>(null);
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [payTarget, setPayTarget] = useState<any>(null);
  const [payAmount, setPayAmount] = useState('');
  const [bulkPaying, setBulkPaying] = useState(false);

  useEffect(() => { fetchSummary(); fetchExpenses(); }, []);
  useEffect(() => { fetchExpenses(); }, [catFilter, fromDate, toDate]);
  useEffect(() => { if (tab === 'salary') loadSalaryStatus(); }, [tab, salaryMonth]);

  const fetchSummary = () => {
    client.get('/expenses/summary').then(r => setSummary(r.data)).catch(() => {});
  };
  const fetchExpenses = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (catFilter) params.set('category', catFilter);
    if (fromDate) params.set('from_date', fromDate);
    if (toDate) params.set('to_date', toDate);
    await client.get(`/expenses?${params}`).then(r => setExpenses(r.data || [])).catch(() => {});
    setLoading(false);
  };
  const loadSalaryStatus = async () => {
    setSalaryLoading(true);
    try {
      const r = await client.get('/expenses/salary-status', { params: { month: salaryMonth } });
      setSalaryStatus(r.data);
    } catch { setSalaryStatus(null); }
    setSalaryLoading(false);
  };

  // ── Operational CRUD ─────────────────────────────────────────────────────
  const openAdd = () => { setForm({ ...emptyForm }); setEditId(null); setShowModal(true); };
  const openEdit = (exp: any) => {
    setForm({ title: exp.title, category: exp.category, amount: exp.amount, date: exp.date, notes: exp.notes || '' });
    setEditId(exp.id);
    setShowModal(true);
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, amount: parseFloat(form.amount as string) };
      if (editId) await client.patch(`/expenses/${editId}`, payload);
      else await client.post('/expenses', payload);
      setShowModal(false);
      fetchSummary(); fetchExpenses();
    } catch {}
    setSaving(false);
  };
  const handleDelete = async (id: string) => {
    await client.delete(`/expenses/${id}`).catch(() => {});
    setDeleteId(null);
    fetchSummary(); fetchExpenses();
  };

  // ── Salary actions ────────────────────────────────────────────────────────
  const openPay = (r: any) => { setPayTarget(r); setPayAmount(String(r.amount_expected || '')); };
  const confirmPay = async () => {
    if (!payTarget) return;
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    try {
      await client.post('/expenses/pay-salary', {
        kind: payTarget.kind, target_id: payTarget.target_id,
        month: salaryMonth, amount: amt,
      });
      setPayTarget(null);
      loadSalaryStatus();
      fetchSummary(); fetchExpenses();
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Error'); }
  };
  const bulkPay = async () => {
    if (!confirm(`Pay all unpaid staff for ${salaryMonth}?`)) return;
    setBulkPaying(true);
    try {
      const r = await client.post('/expenses/pay-salary/bulk', null, { params: { month: salaryMonth } });
      toast.success(`Paid ${r.data.paid_count} staff. ${(r.data.failed || []).length} failed.`);
      loadSalaryStatus();
      fetchSummary(); fetchExpenses();
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Error'); }
    setBulkPaying(false);
  };

  // ── Filtered operational list (excludes Salary) ──────────────────────────
  const operationalExpenses = useMemo(() => {
    let list = expenses.filter(e => e.category !== 'Salary');
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e => `${e.title} ${e.category}`.toLowerCase().includes(q));
    }
    return list;
  }, [expenses, search]);

  const grouped: Record<string, any[]> = useMemo(() => {
    const g: Record<string, any[]> = {};
    operationalExpenses.forEach(e => { (g[e.date] = g[e.date] || []).push(e); });
    return g;
  }, [operationalExpenses]);
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  // ── Overview metrics ─────────────────────────────────────────────────────
  const exportCSV = () => {
    const rows = [
      ['Date', 'Title', 'Category', 'Amount', 'Notes'],
      ...expenses.map((e: any) => [e.date, e.title, e.category, e.amount, (e.notes || '').replace(/,/g, ' ')]),
    ];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'expenses.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // Academic session: Apr → Mar. Determine current session start year.
  const sessionStartYear = useMemo(() => {
    const now = new Date();
    return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1; // 0=Jan...3=Apr
  }, []);
  const sessionLabel = `${sessionStartYear}-${sessionStartYear + 1}`;

  const monthOptions = useMemo(() => {
    // 12 months: Apr (sessionStartYear) → Mar (sessionStartYear+1)
    const opts: string[] = [];
    for (let i = 0; i < 12; i++) {
      const monthIdx = 3 + i; // 3 = April
      const y = sessionStartYear + Math.floor(monthIdx / 12);
      const m = (monthIdx % 12) + 1;
      opts.push(`${y}-${String(m).padStart(2, '0')}`);
    }
    return opts;
  }, [sessionStartYear]);
  const monthLabel = (m: string) => {
    const [y, mo] = m.split('-');
    return new Date(parseInt(y), parseInt(mo) - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  };

  const salaryRows = salaryStatus?.rows || [];
  const teachers = salaryRows.filter((r: any) => r.kind === 'TEACHER');
  const drivers = salaryRows.filter((r: any) => r.kind === 'DRIVER');

  return (
    <div>
      <div className="page-header">
        <h1>💸 Expenses</h1>
        <div className="actions">
          <button className="btn btn-secondary btn-sm" onClick={exportCSV}><FiDownload /> Export</button>
          {tab === 'operational' && (
            <button className="btn btn-primary btn-sm" onClick={openAdd} style={{ width: 'auto' }}>
              <FiPlus /> Add Expense
            </button>
          )}
        </div>
      </div>

      {/* Top summary cards (always visible) */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '1rem' }}>
        <div className="stat-card blue"><div className="stat-icon blue"><FiTrendingDown /></div><div className="stat-info"><span className="label">Today</span><span className="value">{formatINR(summary?.today ?? 0)}</span></div></div>
        <div className="stat-card amber"><div className="stat-icon amber"><FiCalendar /></div><div className="stat-info"><span className="label">This Week</span><span className="value">{formatINR(summary?.this_week ?? 0)}</span></div></div>
        <div className="stat-card rose"><div className="stat-icon rose"><FiCalendar /></div><div className="stat-info"><span className="label">This Month</span><span className="value">{formatINR(summary?.this_month ?? 0)}</span></div></div>
        <div className="stat-card green"><div className="stat-icon green"><FiTag /></div><div className="stat-info"><span className="label">This Year</span><span className="value">{formatINR(summary?.this_year ?? 0)}</span></div></div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>Overview</button>
        <button className={`tab ${tab === 'salary' ? 'active' : ''}`} onClick={() => setTab('salary')}>💰 Salary Disbursement</button>
        <button className={`tab ${tab === 'operational' ? 'active' : ''}`} onClick={() => setTab('operational')}>Operational Expenses</button>
      </div>

      {/* ─── OVERVIEW TAB ─── */}
      {tab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Salary vs Operational split */}
          <div className="card">
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem' }}>This Month — Salary vs Operational</h3>
            </div>
            <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <div style={{ padding: 16, background: 'var(--success-50)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.82rem', color: 'var(--gray-600)', fontWeight: 600 }}>💰 Salaries</div>
                  <FiDollarSign style={{ color: '#14b8a6' }} />
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#14b8a6', marginTop: 4 }}>{formatINR(summary?.salary_this_month ?? 0)}</div>
              </div>
              <div style={{ padding: 16, background: 'var(--primary-50)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.82rem', color: 'var(--gray-600)', fontWeight: 600 }}>🛠️ Operational</div>
                  <FiTag style={{ color: 'var(--primary-600)' }} />
                </div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary-600)', marginTop: 4 }}>{formatINR(summary?.operational_this_month ?? 0)}</div>
              </div>
              <div style={{ padding: 16, background: 'var(--gray-50)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.82rem', color: 'var(--gray-600)', fontWeight: 600 }}>📊 All Time</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--gray-700)', marginTop: 4 }}>{formatINR(summary?.all_time ?? 0)}</div>
              </div>
            </div>
          </div>

          {/* By-category bars */}
          {summary?.by_category && Object.keys(summary.by_category).length > 0 && (
            <div className="card">
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Category Breakdown — This Month</h3>
              </div>
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(() => {
                  const maxAmt = Math.max(...Object.values(summary.by_category).map((v: any) => Number(v) || 0));
                  return Object.entries(summary.by_category)
                    .sort((a, b) => Number(b[1]) - Number(a[1]))
                    .map(([cat, amt]: any) => (
                      <div key={cat}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, color: 'var(--gray-700)' }}>
                            <span style={{ display: 'inline-block', width: 8, height: 8, background: CAT_COLORS[cat] || '#888', borderRadius: 2, marginRight: 6 }} />
                            {cat}
                          </span>
                          <span style={{ fontWeight: 700, color: CAT_COLORS[cat] || '#888' }}>{formatINR(amt)}</span>
                        </div>
                        <div style={{ background: 'var(--gray-100)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                          <div style={{ width: `${(Number(amt) / maxAmt) * 100}%`, height: '100%', background: CAT_COLORS[cat] || '#888' }} />
                        </div>
                      </div>
                    ));
                })()}
              </div>
            </div>
          )}

          {/* Recent expenses (5 most recent) */}
          <div className="card">
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Recent Expenses</h3>
            </div>
            <div className="card-body no-padding">
              {expenses.length === 0 ? (
                <div className="empty-state"><p>No expenses yet.</p></div>
              ) : (
                <table className="data-table">
                  <thead><tr><th>Date</th><th>Title</th><th>Category</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
                  <tbody>
                    {expenses.slice(0, 10).map((e: any) => (
                      <tr key={e.id}>
                        <td style={{ fontSize: '0.82rem' }}>{formatDate(e.date)}</td>
                        <td style={{ fontWeight: 600 }}>{e.title}</td>
                        <td><span className="badge" style={{ background: (CAT_COLORS[e.category] || '#888') + '18', color: CAT_COLORS[e.category] || '#888' }}>{e.category}</span></td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--danger-600)' }}>{formatINR(e.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── SALARY DISBURSEMENT TAB ─── */}
      {tab === 'salary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Month picker — stepper + pill timeline */}
          {(() => {
            const shiftMonth = (delta: number) => {
              const [y, m] = salaryMonth.split('-').map(Number);
              const m0 = m - 1 + delta;
              const ny = y + Math.floor(m0 / 12);
              const nm = ((m0 % 12) + 12) % 12 + 1;
              setSalaryMonth(`${ny}-${String(nm).padStart(2, '0')}`);
            };
            return (
              <div className="card" style={{ padding: 14 }}>
                {/* Session label */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--gray-400)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Session</span>
                    <span style={{
                      padding: '3px 10px', borderRadius: 'var(--radius-full)',
                      background: 'var(--primary-50)', color: 'var(--primary-700)',
                      fontSize: '0.78rem', fontWeight: 700, border: '1px solid var(--primary-200)',
                    }}>
                      {sessionLabel}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>(Apr – Mar)</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  {/* Stepper */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => shiftMonth(-1)} style={{
                      width: 36, height: 36, borderRadius: '50%',
                      border: '1px solid var(--gray-200)', background: '#fff',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--gray-600)',
                    }} title="Previous month">
                      <FiChevronLeft size={18} />
                    </button>
                    <div style={{ minWidth: 160, textAlign: 'center' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Showing</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--gray-800)', lineHeight: 1.2 }}>{monthLabel(salaryMonth)}</div>
                    </div>
                    <button onClick={() => shiftMonth(1)} style={{
                      width: 36, height: 36, borderRadius: '50%',
                      border: '1px solid var(--gray-200)', background: '#fff',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--gray-600)',
                    }} title="Next month">
                      <FiChevronRight size={18} />
                    </button>
                  </div>
                  <button className="btn btn-primary" disabled={bulkPaying || (salaryStatus?.unpaid_count ?? 0) === 0} onClick={bulkPay} style={{ padding: '8px 16px' }}>
                    <FiDollarSign /> Pay All Unpaid ({salaryStatus?.unpaid_count ?? 0})
                  </button>
                </div>

                {/* Pill timeline */}
                <div style={{ display: 'flex', gap: 6, marginTop: 14, overflowX: 'auto', paddingBottom: 4 }}>
                  {monthOptions.map(m => {
                    const active = m === salaryMonth;
                    const today = new Date();
                    const isCurrent = m === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
                    return (
                      <button
                        key={m}
                        onClick={() => setSalaryMonth(m)}
                        style={{
                          padding: '6px 14px', borderRadius: 'var(--radius-full)', cursor: 'pointer',
                          fontSize: '0.78rem', fontWeight: 700, whiteSpace: 'nowrap',
                          border: '1.5px solid ' + (active ? 'var(--primary-500)' : 'var(--gray-200)'),
                          background: active ? 'var(--primary-500)' : '#fff',
                          color: active ? '#fff' : 'var(--gray-600)',
                          transition: 'all .12s',
                          position: 'relative',
                        }}
                      >
                        {monthLabel(m)}
                        {isCurrent && !active && (
                          <span style={{
                            position: 'absolute', top: -3, right: -3,
                            width: 8, height: 8, borderRadius: '50%', background: 'var(--success-500)',
                            border: '2px solid #fff',
                          }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Summary */}
          {salaryStatus && (
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              <div className="stat-card blue"><div className="stat-icon blue"><FiDollarSign /></div><div className="stat-info"><span className="label">Total Expected</span><span className="value">{formatINR(salaryStatus.total_expected)}</span></div></div>
              <div className="stat-card green"><div className="stat-icon green"><FiCheck /></div><div className="stat-info"><span className="label">Paid</span><span className="value">{formatINR(salaryStatus.total_paid)}</span><span className="change" style={{ color: 'var(--text-secondary)' }}>{salaryStatus.paid_count} of {salaryStatus.rows.length}</span></div></div>
              <div className="stat-card red"><div className="stat-icon red"><FiAlertCircle /></div><div className="stat-info"><span className="label">Balance</span><span className="value">{formatINR(salaryStatus.total_balance)}</span><span className="change" style={{ color: 'var(--text-secondary)' }}>{salaryStatus.unpaid_count} unpaid</span></div></div>
              <div className="stat-card amber"><div className="stat-icon amber"><FiCalendar /></div><div className="stat-info"><span className="label">Month</span><span className="value" style={{ fontSize: '1.2rem' }}>{monthLabel(salaryMonth)}</span></div></div>
            </div>
          )}

          {/* Teachers + Drivers sections */}
          {salaryLoading ? (
            <div className="card"><div className="spinner-container"><div className="spinner" /></div></div>
          ) : !salaryStatus ? null : (
            <>
              <div className="card">
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)' }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem' }}>👩‍🏫 Teachers ({teachers.length})</h3>
                </div>
                <div className="card-body no-padding">
                  {teachers.length === 0 ? <div className="empty-state"><p>No teachers.</p></div> : (
                    <table className="data-table">
                      <thead><tr><th>Teacher</th><th>Department</th><th>Salary</th><th>Status</th><th>Action</th></tr></thead>
                      <tbody>
                        {teachers.map((r: any, i: number) => (
                          <tr key={r.target_id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div className="avatar" style={{ background: ['#6366f1', '#10b981', '#f59e0b'][i % 3], width: 30, height: 30, fontSize: '0.7rem' }}>{getInitials(r.name)}</div>
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{r.name}</div>
                                  <div style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>{r.employee_id}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ fontSize: '0.85rem', color: 'var(--gray-600)' }}>{r.subtitle}</td>
                            <td style={{ fontWeight: 700, color: 'var(--success-600)' }}>{formatINR(r.amount_expected)}</td>
                            <td>
                              {r.is_paid
                                ? <span className="badge badge-success"><FiCheck size={10} /> Paid · {formatDate(r.paid_on)}</span>
                                : <span className="badge badge-warning"><FiAlertCircle size={10} /> Unpaid</span>}
                            </td>
                            <td>
                              {!r.is_paid && (
                                <button className="btn btn-primary btn-sm" style={{ padding: '4px 12px' }} onClick={() => openPay(r)}>
                                  <FiDollarSign size={12} /> Pay Now
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              <div className="card">
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)' }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem' }}>🚌 Drivers ({drivers.length})</h3>
                </div>
                <div className="card-body no-padding">
                  {drivers.length === 0 ? <div className="empty-state"><p>No drivers.</p></div> : (
                    <table className="data-table">
                      <thead><tr><th>Driver</th><th>Bus</th><th>Salary</th><th>Status</th><th>Action</th></tr></thead>
                      <tbody>
                        {drivers.map((r: any) => (
                          <tr key={r.target_id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div className="avatar" style={{ background: '#7c3aed', width: 30, height: 30, fontSize: '0.7rem' }}><FiTruck size={14} /></div>
                                <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{r.name}</div>
                              </div>
                            </td>
                            <td style={{ fontSize: '0.85rem' }}><span className="badge badge-neutral">{r.subtitle}</span></td>
                            <td style={{ fontWeight: 700, color: 'var(--success-600)' }}>{formatINR(r.amount_expected)}</td>
                            <td>
                              {r.is_paid
                                ? <span className="badge badge-success"><FiCheck size={10} /> Paid · {formatDate(r.paid_on)}</span>
                                : <span className="badge badge-warning"><FiAlertCircle size={10} /> Unpaid</span>}
                            </td>
                            <td>
                              {!r.is_paid && (
                                <button className="btn btn-primary btn-sm" style={{ padding: '4px 12px' }} onClick={() => openPay(r)}>
                                  <FiDollarSign size={12} /> Pay Now
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── OPERATIONAL TAB ─── */}
      {tab === 'operational' && (
        <div>
          <div className="filter-bar" style={{ flexWrap: 'wrap', gap: '.75rem', marginBottom: '1.25rem' }}>
            <div style={{ position: 'relative', flex: '1 1 220px' }}>
              <FiSearch style={{ position: 'absolute', left: '.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
              <input type="text" placeholder="Search expenses..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '2.2rem', width: '100%' }} />
            </div>
            <select value={catFilter} onChange={e => setCatFilter(e.target.value)} style={{ flex: '1 1 160px', minWidth: 0 }}>
              <option value="">All Categories</option>
              {OP_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ flex: '1 1 140px' }} />
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ flex: '1 1 140px' }} />
            {(catFilter || fromDate || toDate) && (
              <button className="btn btn-secondary btn-sm" onClick={() => { setCatFilter(''); setFromDate(''); setToDate(''); }}>
                <FiFilter /> Clear
              </button>
            )}
          </div>

          {loading ? (
            <div className="spinner-container"><div className="spinner" /></div>
          ) : sortedDates.length === 0 ? (
            <div className="card"><div className="empty-state"><FiTrendingDown size={32} /><h3>No expenses found</h3><p>Add your first operational expense</p></div></div>
          ) : sortedDates.map(d => {
            const dayTotal = grouped[d].reduce((s: number, e: any) => s + (e.amount || 0), 0);
            const dt = new Date(d + 'T00:00:00');
            const dayLabel = dt.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            return (
              <div key={d} className="card" style={{ marginBottom: '1rem' }}>
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{dayLabel}</h3>
                  <span style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>
                    Total <strong style={{ color: 'var(--danger-600)' }}>{formatINR(dayTotal)}</strong> · {grouped[d].length} item{grouped[d].length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="card-body no-padding">
                  <table className="data-table">
                    <tbody>
                      {grouped[d].map((exp: any) => (
                        <tr key={exp.id}>
                          <td style={{ width: 40 }}>
                            <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: (CAT_COLORS[exp.category] || '#6b7280') + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', color: CAT_COLORS[exp.category] || '#6b7280' }}>
                              <FiTrendingDown />
                            </div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{exp.title}</div>
                            {exp.notes && <div style={{ fontSize: '0.78rem', color: 'var(--gray-400)' }}>{exp.notes}</div>}
                          </td>
                          <td>
                            <span className="badge" style={{ background: (CAT_COLORS[exp.category] || '#6b7280') + '18', color: CAT_COLORS[exp.category] || '#6b7280', fontSize: '0.75rem' }}>{exp.category}</span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--danger-600)', fontSize: '1rem' }}>{formatINR(exp.amount)}</td>
                          <td style={{ width: 80, textAlign: 'right' }}>
                            <button className="btn-icon" onClick={() => openEdit(exp)} title="Edit" style={{ color: 'var(--primary-600)' }}><FiEdit2 size={15} /></button>
                            <button className="btn-icon" onClick={() => setDeleteId(exp.id)} title="Delete" style={{ color: 'var(--danger-500)', marginLeft: 4 }}><FiTrash2 size={15} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Modals ─── */}

      {/* Add/Edit operational expense */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header"><h3>{editId ? 'Edit Expense' : 'Add Expense'}</h3><button className="btn-icon" onClick={() => setShowModal(false)}><FiX /></button></div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Title *</label>
                  <input className="form-input" placeholder="e.g. Office stationery purchase" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label>Category *</label>
                    <select className="form-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                      {OP_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Amount (₹) *</label>
                    <input className="form-input" type="number" min="0" step="0.01" required value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group"><label>Date *</label><input className="form-input" type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
                <div className="form-group"><label>Notes</label><textarea className="form-input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
                <p style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>Salary disbursements should be done from the Salary Disbursement tab.</p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : (editId ? 'Save' : 'Add Expense')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay salary modal */}
      {payTarget && (
        <div className="modal-overlay" onClick={() => setPayTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header"><h3>Pay Salary — {payTarget.name}</h3><button className="btn-icon" onClick={() => setPayTarget(null)}><FiX /></button></div>
            <div className="modal-body">
              <div style={{ padding: 12, background: 'var(--gray-50)', borderRadius: 'var(--radius-md)', marginBottom: 12, fontSize: '0.85rem' }}>
                <div><strong>{payTarget.name}</strong> ({payTarget.subtitle})</div>
                <div style={{ marginTop: 4, color: 'var(--gray-600)' }}>Month: <strong>{monthLabel(salaryMonth)}</strong></div>
                <div style={{ marginTop: 2, color: 'var(--gray-600)' }}>Expected: <strong>{formatINR(payTarget.amount_expected)}</strong></div>
              </div>
              <div className="form-group">
                <label>Amount Paid (₹) *</label>
                <input className="form-input" type="number" min="1" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
                <p style={{ fontSize: '0.72rem', color: 'var(--gray-400)', marginTop: 3 }}>Can adjust for bonus / deduction</p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setPayTarget(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmPay}><FiDollarSign /> Confirm Payment</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => setDeleteId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="modal-header"><h3>Delete Expense</h3><button className="btn-icon" onClick={() => setDeleteId(null)}><FiX /></button></div>
            <div className="modal-body"><p>Are you sure? This cannot be undone.</p></div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDelete(deleteId)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
