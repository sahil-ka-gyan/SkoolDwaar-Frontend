import React, { useEffect, useState } from 'react';
import { FiTruck, FiPhone, FiMapPin, FiUser, FiInfo } from 'react-icons/fi';
import client from '../../api/client';
import { getInitials } from '../../utils/helpers';

export default function ParentTransport() {
  const [children, setChildren] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string>(() => localStorage.getItem('selectedChildId') || '');
  const [transport, setTransport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    client.get('/parent/children').then(r => {
      const list = r.data || [];
      setChildren(list);
      if (list.length > 0 && (!selectedId || !list.find((c: any) => c.student_id === selectedId))) {
        setSelectedId(list[0].student_id);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    localStorage.setItem('selectedChildId', selectedId);
    setDetailLoading(true);
    client.get(`/parent/child/${selectedId}/transport`)
      .then(r => setTransport(r.data || null))
      .catch(() => setTransport(null))
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];
  const selected = children.find(c => c.student_id === selectedId);

  if (loading) return <div className="spinner-container"><div className="spinner" /></div>;

  let stops: string[] = [];
  if (transport?.stops) {
    try { stops = JSON.parse(transport.stops); } catch { stops = [transport.stops]; }
  }

  const noTransport = transport && (transport.message === 'No transport assigned' || !transport.bus_number);

  return (
    <div>
      <div className="page-header"><h1>🚌 Transport Details</h1></div>

      {children.length === 0 ? (
        <div className="card"><div className="empty-state"><FiUser size={28} style={{ color: 'var(--gray-300)' }} /><h3>No children linked</h3></div></div>
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

          {detailLoading ? (
            <div className="card"><div className="spinner-container"><div className="spinner" /></div></div>
          ) : !transport || noTransport ? (
            <div className="card">
              <div className="empty-state">
                <FiTruck size={32} style={{ color: 'var(--gray-300)' }} />
                <h3>No bus transport for {selected?.first_name}</h3>
                <p>{selected?.first_name} is not assigned to any bus route. No transport fees will be charged.</p>
                <p style={{ marginTop: 8, fontSize: '0.82rem', color: 'var(--gray-500)' }}>Contact the school office to add bus transport.</p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Bus + Driver card */}
              <div className="card">
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)' }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem' }}>🚌 Bus & Driver</h3>
                </div>
                <div style={{ padding: 16 }}>
                  <div style={{ marginBottom: 14, padding: 12, background: 'var(--primary-50)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--primary-700)' }}>Bus Number</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary-700)' }}>{transport.bus_number}</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 8, fontSize: '0.9rem' }}>
                    <div style={{ color: 'var(--gray-500)' }}>Driver Name:</div>
                    <div style={{ fontWeight: 600 }}>{transport.driver_name || '—'}</div>
                    <div style={{ color: 'var(--gray-500)' }}>Driver Phone:</div>
                    <div style={{ fontWeight: 600 }}>
                      {transport.driver_phone ? (
                        <a href={`tel:${transport.driver_phone}`} style={{ color: 'var(--primary-600)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <FiPhone size={13} /> {transport.driver_phone}
                        </a>
                      ) : '—'}
                    </div>
                  </div>
                  {transport.driver_phone && (
                    <a href={`tel:${transport.driver_phone}`} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 14, padding: '10px', background: 'var(--success-500)', color: '#fff', borderRadius: 'var(--radius-md)', textDecoration: 'none', fontWeight: 600 }}>
                      <FiPhone /> Call Driver
                    </a>
                  )}
                </div>
              </div>

              {/* Route + Pickup card */}
              <div className="card">
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)' }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem' }}>📍 Route & Pickup</h3>
                </div>
                <div style={{ padding: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 8, fontSize: '0.9rem', marginBottom: 14 }}>
                    <div style={{ color: 'var(--gray-500)' }}>Route Name:</div>
                    <div style={{ fontWeight: 600 }}>{transport.route_name || '—'}</div>
                    <div style={{ color: 'var(--gray-500)' }}>Your Stop:</div>
                    <div style={{ fontWeight: 700, color: 'var(--primary-600)' }}>
                      <FiMapPin size={13} style={{ verticalAlign: -2 }} /> {transport.pickup_stop || '—'}
                    </div>
                  </div>

                  {stops.length > 0 && (
                    <>
                      <div style={{ fontSize: '0.78rem', color: 'var(--gray-500)', fontWeight: 600, marginBottom: 8 }}>All Stops on this route:</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {stops.map((s: string, i: number) => {
                          const isYours = s === transport.pickup_stop;
                          return (
                            <div key={i} style={{
                              padding: '6px 10px',
                              background: isYours ? 'var(--primary-50)' : 'var(--gray-50)',
                              border: isYours ? '1.5px solid var(--primary-500)' : '1px solid var(--gray-200)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.85rem',
                              fontWeight: isYours ? 700 : 400,
                              color: isYours ? 'var(--primary-700)' : 'var(--gray-700)',
                              display: 'flex', alignItems: 'center', gap: 8,
                            }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>#{i + 1}</span>
                              {s} {isYours && <span style={{ marginLeft: 'auto', fontSize: '0.7rem' }}>★ your stop</span>}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Info note */}
          {transport && !noTransport && (
            <div style={{ marginTop: 16, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'flex-start', background: 'var(--gray-50)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', color: 'var(--gray-600)' }}>
              <FiInfo size={14} style={{ color: 'var(--gray-500)', flexShrink: 0, marginTop: 2 }} />
              <span>Please reach the pickup stop 5 minutes before scheduled time. For any transport-related issues, call the driver directly or contact the school office.</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
