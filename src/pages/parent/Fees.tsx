import React, { useEffect, useMemo, useState } from 'react';
import { FiDollarSign, FiCheckCircle, FiAlertCircle, FiClock, FiPrinter, FiX, FiUser, FiChevronDown, FiChevronRight, FiCalendar } from 'react-icons/fi';
import client from '../../api/client';
import { formatINR, formatDate, getInitials } from '../../utils/helpers';

export default function ParentFees() {
  const [children, setChildren] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string>(() => localStorage.getItem('selectedChildId') || '');
  const [ledger, setLedger] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [upcomingDues, setUpcomingDues] = useState<any[]>([]);

  useEffect(() => {
    client.get('/parent/children').then(r => {
      const list = r.data || [];
      setChildren(list);
      if (list.length > 0 && (!selectedId || !list.find((c: any) => c.student_id === selectedId))) {
        setSelectedId(list[0].student_id);
      }
    }).catch(() => {}).finally(() => setLoading(false));
    client.get('/parent/upcoming-dues', { params: { days: 10 } })
      .then(r => setUpcomingDues(r.data?.records || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    localStorage.setItem('selectedChildId', selectedId);
    setLedgerLoading(true);
    client.get(`/parent/child/${selectedId}/fee-ledger`)
      .then(r => setLedger(r.data))
      .catch(() => setLedger(null))
      .finally(() => setLedgerLoading(false));
  }, [selectedId]);

  const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];
  const selectedChild = children.find(c => c.student_id === selectedId);

  // Highest overdue across items (for warning banner)
  const maxOverdue = useMemo(() => {
    if (!ledger?.items) return 0;
    return Math.max(0, ...ledger.items.map((i: any) => i.days_overdue || 0));
  }, [ledger]);

  const printReceipt = () => window.print();

  if (loading) return <div className="spinner-container"><div className="spinner" /></div>;

  return (
    <div>
      {/* Print stylesheet */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .receipt-print, .receipt-print * { visibility: visible; }
          .receipt-print { position: absolute; top: 0; left: 0; width: 100%; padding: 24px; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="page-header"><h1>💰 Fee Status</h1></div>

      {children.length === 0 ? (
        <div className="card"><div className="empty-state">
          <FiUser size={28} style={{ color: 'var(--gray-300)' }} />
          <h3>No children linked</h3>
          <p>Contact the school admin to link your children to your account.</p>
        </div></div>
      ) : (
        <>
          {/* Child switcher */}
          <div className="card" style={{ marginBottom: 16, padding: 12 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {children.map((c: any, i) => {
                const active = c.student_id === selectedId;
                return (
                  <button key={c.student_id} onClick={() => setSelectedId(c.student_id)} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
                    background: active ? 'var(--primary-50)' : '#fff',
                    border: active ? '2px solid var(--primary-500)' : '1px solid var(--gray-200)',
                    borderRadius: 'var(--radius-md)', cursor: 'pointer',
                  }}>
                    <div className="avatar" style={{ background: colors[i % colors.length], width: 28, height: 28, fontSize: '0.75rem' }}>{getInitials(`${c.first_name || ''} ${c.last_name || ''}`)}</div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{c.first_name} {c.last_name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)' }}>{c.class_name}{c.section_name ? ` - ${c.section_name}` : ''}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Upcoming dues across all children — global reminder */}
          {upcomingDues.length > 0 && (
            <div className="card" style={{ marginBottom: 16, border: '1px solid var(--warning-200, #fde68a)', background: 'var(--warning-50, #fffbeb)' }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--warning-100, #fef3c7)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <FiCalendar style={{ color: 'var(--warning-700, #b45309)' }} />
                <h3 style={{ margin: 0, fontSize: '0.92rem', color: 'var(--warning-800, #92400e)' }}>Upcoming Dues — next 10 days</h3>
              </div>
              <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {upcomingDues.map((d: any, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: '#fff', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                    <div>
                      <strong>{d.student_name}</strong> ({d.class_name}) — {d.fee_type}
                      <span style={{ color: 'var(--gray-500)' }}> · {d.installment_label}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span style={{ fontWeight: 700 }}>{formatINR(d.balance)}</span>
                      <span style={{ padding: '2px 8px', borderRadius: 12, background: d.days_until_due <= 3 ? 'var(--danger-50)' : 'var(--warning-100, #fef3c7)', color: d.days_until_due <= 3 ? 'var(--danger-700)' : 'var(--warning-700, #b45309)', fontSize: '0.72rem', fontWeight: 700 }}>
                        {d.days_until_due === 0 ? 'Today' : `Due in ${d.days_until_due}d`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ledgerLoading ? (
            <div className="card"><div className="spinner-container"><div className="spinner" /></div></div>
          ) : !ledger ? (
            <div className="card"><div className="empty-state"><p>Could not load fee details.</p></div></div>
          ) : (
            <>
              {/* Overdue warning banner */}
              {maxOverdue > 0 && (
                <div style={{
                  padding: '12px 16px', marginBottom: 16,
                  background: 'var(--danger-50)', border: '1px solid var(--danger-200)',
                  borderRadius: 'var(--radius-md)', display: 'flex', gap: 10, alignItems: 'center',
                }}>
                  <FiAlertCircle size={20} style={{ color: 'var(--danger-600)' }} />
                  <div style={{ flex: 1, fontSize: '0.88rem', color: 'var(--danger-700)' }}>
                    <strong>Fee overdue!</strong> {selectedChild?.first_name} has fees overdue by up to <strong>{maxOverdue} day{maxOverdue === 1 ? '' : 's'}</strong>.
                    Please clear pending amount of <strong>{formatINR(ledger.summary.total_balance)}</strong> at the earliest.
                  </div>
                </div>
              )}

              {/* Summary cards */}
              <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 16 }}>
                <div className="stat-card blue">
                  <div className="stat-icon blue"><FiDollarSign /></div>
                  <div className="stat-info">
                    <span className="label">Total Fees</span>
                    <span className="value">{formatINR(ledger.summary.total_amount)}</span>
                    <span className="change" style={{ color: 'var(--text-secondary)' }}>{ledger.summary.structures_count} items</span>
                  </div>
                </div>
                <div className="stat-card green">
                  <div className="stat-icon green"><FiCheckCircle /></div>
                  <div className="stat-info">
                    <span className="label">Paid</span>
                    <span className="value">{formatINR(ledger.summary.total_paid)}</span>
                    <span className="change" style={{ color: 'var(--text-secondary)' }}>
                      {ledger.summary.total_amount > 0
                        ? `${Math.round((ledger.summary.total_paid / ledger.summary.total_amount) * 100)}%`
                        : '0%'}
                    </span>
                  </div>
                </div>
                <div className="stat-card amber">
                  <div className="stat-icon amber"><FiAlertCircle /></div>
                  <div className="stat-info">
                    <span className="label">Balance</span>
                    <span className="value" style={{ color: ledger.summary.total_balance > 0 ? 'var(--danger-600)' : 'var(--success-600)' }}>
                      {formatINR(ledger.summary.total_balance)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Fee items */}
              <div className="card" style={{ marginBottom: 16 }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)' }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Fee Breakdown</h3>
                </div>
                <div className="card-body no-padding">
                  {ledger.items.length === 0 ? (
                    <div className="empty-state"><p>No fee structures applicable for this class yet.</p></div>
                  ) : (
                    <table className="data-table">
                      <thead><tr><th></th><th>Fee Type</th><th>Period / Total</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead>
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
                                    {it.period}{hasInstallments && ` • ${(it.installments || []).length} × ${formatINR(it.installment_amount)}`}
                                  </div>
                                </td>
                                <td>{formatINR(it.amount)}</td>
                                <td style={{ color: 'var(--success-600)' }}>{formatINR(it.paid)}</td>
                                <td style={{ fontWeight: 700, color: it.balance > 0 ? 'var(--danger-600)' : 'var(--gray-400)' }}>{formatINR(it.balance)}</td>
                                <td>
                                  {it.status === 'PAID' && <span className="badge" style={{ background: 'var(--success-50)', color: 'var(--success-700)' }}><FiCheckCircle size={10} /> Paid</span>}
                                  {it.status === 'PARTIAL' && <span className="badge" style={{ background: 'var(--amber-50, #fef3c7)', color: 'var(--warning-700, #b45309)' }}><FiClock size={10} /> Partial</span>}
                                  {it.status === 'PENDING' && <span className="badge" style={{ background: 'var(--danger-50)', color: 'var(--danger-700)' }}><FiAlertCircle size={10} /> Pending</span>}
                                </td>
                              </tr>
                              {expanded && hasInstallments && (it.installments || []).map((ins: any) => (
                                <tr key={`${it.fee_structure_id}-${ins.sequence}`} style={{ background: 'var(--gray-50)' }}>
                                  <td></td>
                                  <td style={{ paddingLeft: 28, fontSize: '0.82rem' }}>↳ {ins.label}
                                    <div style={{ fontSize: '0.7rem', color: 'var(--gray-500)' }}>Due {formatDate(ins.due_date)}
                                      {ins.days_overdue > 0 && <span style={{ marginLeft: 4, color: 'var(--danger-600)', fontWeight: 700 }}>({ins.days_overdue}d overdue)</span>}
                                    </div>
                                  </td>
                                  <td style={{ fontSize: '0.82rem' }}>{formatINR(ins.amount)}</td>
                                  <td style={{ fontSize: '0.82rem', color: 'var(--success-600)' }}>{formatINR(ins.paid)}</td>
                                  <td style={{ fontSize: '0.82rem', fontWeight: 700, color: ins.balance > 0 ? 'var(--danger-600)' : 'var(--gray-400)' }}>{formatINR(ins.balance)}</td>
                                  <td>
                                    {ins.status === 'PAID' && <span className="badge" style={{ background: 'var(--success-50)', color: 'var(--success-700)' }}><FiCheckCircle size={10} /> Paid</span>}
                                    {ins.status === 'PARTIAL' && <span className="badge" style={{ background: 'var(--amber-50, #fef3c7)', color: 'var(--warning-700, #b45309)' }}><FiClock size={10} /> Partial</span>}
                                    {ins.status === 'PENDING' && <span className="badge" style={{ background: 'var(--danger-50)', color: 'var(--danger-700)' }}><FiAlertCircle size={10} /> Pending</span>}
                                  </td>
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
              <div className="card">
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)' }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Payment History ({ledger.payment_history.length})</h3>
                </div>
                <div className="card-body no-padding">
                  {ledger.payment_history.length === 0 ? (
                    <div className="empty-state"><p>No payments recorded yet.</p></div>
                  ) : (
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
                                <button className="btn-icon" title="View receipt" onClick={() => setReceipt({ ...p, student: ledger.student, fee_type: fs?.fee_type })}>
                                  <FiPrinter size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Info note */}
              <div style={{ padding: '10px 14px', marginTop: 16, fontSize: '0.82rem', color: 'var(--gray-500)', textAlign: 'center' }}>
                Visit the school office to pay pending fees. Online payment will be available soon.
              </div>
            </>
          )}
        </>
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
              <button className="btn btn-primary" style={{ width: 'auto' }} onClick={printReceipt}><FiPrinter /> Print</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
