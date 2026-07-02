import { toast } from '../utils/toast';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FiSend, FiSearch, FiUser, FiPlus, FiX, FiMessageCircle, FiPhone, FiLayers } from 'react-icons/fi';
import client from '../api/client';
import { getInitials } from '../utils/helpers';

const ROLE_COLOR: Record<string, string> = {
  SCHOOL_ADMIN: '#6366f1',
  TEACHER: '#10b981',
  PARENT: '#f59e0b',
  SUPER_ADMIN: '#0ea5e9',
};
const ROLE_LABEL: Record<string, string> = {
  SCHOOL_ADMIN: 'Admin',
  TEACHER: 'Teacher',
  PARENT: 'Parent',
  SUPER_ADMIN: 'Super Admin',
};

export default function ChatPanel() {
  const [threads, setThreads] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [activeOther, setActiveOther] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [parentClassFilter, setParentClassFilter] = useState<string>(''); // class_name selected for parent filter
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadAll();
    const t = setInterval(loadAll, 5000); // poll
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (activeThreadId) {
      loadMessages(activeThreadId);
      const t = setInterval(() => loadMessages(activeThreadId), 4000);
      return () => clearInterval(t);
    }
  }, [activeThreadId]);

  useEffect(() => {
    // Auto-scroll to bottom on new messages
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const loadAll = async () => {
    try {
      const [tr, cr] = await Promise.all([
        client.get('/chat/threads'),
        client.get('/chat/contacts'),
      ]);
      setThreads(tr.data || []);
      setContacts(cr.data || []);
    } catch {}
    setLoading(false);
  };

  const loadMessages = async (tid: string) => {
    try {
      const r = await client.get(`/chat/threads/${tid}/messages`);
      setMessages(r.data || []);
      // Refresh threads after read (unread counts update)
      const tr = await client.get('/chat/threads');
      setThreads(tr.data || []);
      window.dispatchEvent(new Event('sidebar:refresh-badges'));
    } catch {}
  };

  const openThreadWith = async (targetUserId: string, otherInfo: any) => {
    try {
      const r = await client.post('/chat/threads', { target_user_id: targetUserId });
      setActiveThreadId(r.data.id);
      setActiveOther(otherInfo);
      setShowNewChat(false);
      setContactSearch('');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Could not open chat');
    }
  };

  const selectThread = (t: any) => {
    setActiveThreadId(t.thread_id);
    setActiveOther(t.other);
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeThreadId || !content.trim()) return;
    const text = content.trim();
    setContent('');
    try {
      const r = await client.post(`/chat/threads/${activeThreadId}/messages`, { content: text });
      setMessages(prev => [...prev, r.data]);
      // Refresh thread previews
      const tr = await client.get('/chat/threads');
      setThreads(tr.data || []);
      window.dispatchEvent(new Event('sidebar:refresh-badges'));
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to send');
      setContent(text);
    }
  };

  const filteredThreads = useMemo(() => {
    if (!search.trim()) return threads;
    const q = search.toLowerCase();
    return threads.filter(t =>
      `${t.other?.name || ''} ${ROLE_LABEL[t.other?.role] || ''} ${t.last_message || ''}`
        .toLowerCase().includes(q)
    );
  }, [threads, search]);

  // Build the list of classes available to filter parents by
  const parentClassOptions = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach(c => {
      if (c.role === 'PARENT' && Array.isArray(c.children)) {
        c.children.forEach((k: any) => { if (k?.class_name) set.add(k.class_name); });
      }
    });
    // Stable-ish order: numeric Class N first, then alphabetic
    return Array.from(set).sort((a, b) => {
      const na = parseInt(a.replace(/\D/g, ''), 10);
      const nb = parseInt(b.replace(/\D/g, ''), 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
  }, [contacts]);

  // Group contacts by role for the New Chat modal, with parent class filter + text search.
  const groupedContacts = useMemo(() => {
    const q = contactSearch.trim().toLowerCase();
    const matchesText = (c: any) => {
      if (!q) return true;
      const haystack = `${c.name} ${c.subtitle || ''} ${c.phone || ''} ` +
        (Array.isArray(c.children) ? c.children.map((k: any) => `${k.name} ${k.class_name || ''} ${k.admission_no || ''}`).join(' ') : '');
      return haystack.toLowerCase().includes(q);
    };
    const matchesParentClass = (c: any) => {
      if (c.role !== 'PARENT' || !parentClassFilter) return true;
      const kids = Array.isArray(c.children) ? c.children : [];
      return kids.some((k: any) => k.class_name === parentClassFilter);
    };
    const filtered = contacts.filter(c => matchesText(c) && matchesParentClass(c));
    const groups: Record<string, any[]> = {};
    filtered.forEach(c => {
      const k = c.display_role || c.role;
      (groups[k] = groups[k] || []).push(c);
    });
    return groups;
  }, [contacts, contactSearch, parentClassFilter]);

  const fmt = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="chat-panel-grid" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, alignItems: 'stretch', minHeight: '70vh' }}>
      {/* ── Left: Threads ── */}
      <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 12, borderBottom: '1px solid var(--gray-100)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
              Chats <span style={{ fontSize: '0.78rem', color: 'var(--gray-400)', fontWeight: 500 }}>({threads.length})</span>
            </div>
            {(() => {
              const totalUnread = threads.reduce((s, t) => s + (t.unread || 0), 0);
              return totalUnread > 0 && (
                <span style={{ background: 'var(--primary-500)', color: '#fff', fontSize: '0.7rem', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>
                  {totalUnread} unread
                </span>
              );
            })()}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button className="btn btn-primary btn-sm" style={{ padding: '6px 10px', flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={() => setShowNewChat(true)} title="Start new chat">
              <FiPlus /> New chat
            </button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div className="spinner-container"><div className="spinner" /></div>
          ) : filteredThreads.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--gray-400)', fontSize: '0.85rem' }}>
              <FiMessageCircle size={28} style={{ color: 'var(--gray-300)', marginBottom: 8 }} />
              <div>No conversations yet</div>
              <div style={{ marginTop: 6, fontSize: '0.78rem' }}>Click + to start one</div>
            </div>
          ) : filteredThreads.map(t => {
            const isActive = activeThreadId === t.thread_id;
            const role = t.other?.role || 'OTHER';
            return (
              <div key={t.thread_id} onClick={() => selectThread(t)} style={{
                padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--gray-100)',
                display: 'flex', alignItems: 'center', gap: 10,
                background: isActive ? 'var(--primary-50)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--primary-500)' : '3px solid transparent',
              }}>
                <div className="avatar" style={{ background: ROLE_COLOR[role] || '#888', width: 38, height: 38, fontSize: '0.78rem' }}>
                  {getInitials(t.other?.name || '?')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.other?.name || 'Unknown'}</div>
                    {t.unread > 0 && (
                      <span style={{ background: 'var(--primary-500)', color: '#fff', fontSize: '0.65rem', padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>{t.unread}</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ color: ROLE_COLOR[role] || '#888', fontWeight: 600 }}>{t.other?.display_role || ROLE_LABEL[role] || role}</span>
                    {t.last_message && <span> · {t.last_message}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right: Messages ── */}
      <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
        {!activeThreadId || !activeOther ? (
          <div className="empty-state" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <FiMessageCircle size={36} style={{ color: 'var(--gray-300)' }} />
            <h3>Select a conversation</h3>
            <p>Pick a chat from the left or start a new one</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="avatar" style={{ background: ROLE_COLOR[activeOther.role] || '#888', width: 38, height: 38, fontSize: '0.78rem' }}>
                {getInitials(activeOther.name || '?')}
              </div>
              <div>
                <div style={{ fontWeight: 700 }}>{activeOther.name}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--gray-500)' }}>
                  <span style={{ color: ROLE_COLOR[activeOther.role] || '#888', fontWeight: 600 }}>{activeOther.display_role || ROLE_LABEL[activeOther.role] || activeOther.role}</span>
                  {activeOther.subtitle && <span> · {activeOther.subtitle}</span>}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 16, background: 'var(--gray-50)' }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--gray-400)', fontSize: '0.85rem', marginTop: 40 }}>
                  Say hello 👋
                </div>
              ) : messages.map((m: any) => (
                <div key={m.id} style={{
                  display: 'flex', justifyContent: m.is_mine ? 'flex-end' : 'flex-start',
                  marginBottom: 8,
                }}>
                  <div style={{
                    maxWidth: '72%', padding: '8px 12px',
                    background: m.is_mine ? 'var(--primary-500)' : '#fff',
                    color: m.is_mine ? '#fff' : 'var(--gray-800)',
                    borderRadius: m.is_mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    border: m.is_mine ? 'none' : '1px solid var(--gray-200)',
                    fontSize: '0.88rem', lineHeight: 1.4,
                  }}>
                    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.content}</div>
                    <div style={{ fontSize: '0.66rem', marginTop: 4, opacity: m.is_mine ? 0.85 : 0.6, textAlign: 'right' }}>
                      {fmt(m.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Composer */}
            <form onSubmit={send} style={{ padding: 12, borderTop: '1px solid var(--gray-100)', display: 'flex', gap: 8 }}>
              <input
                type="text" placeholder="Type a message..." value={content} onChange={e => setContent(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn btn-primary" disabled={!content.trim()} style={{ padding: '6px 16px' }}>
                <FiSend /> Send
              </button>
            </form>
          </>
        )}
      </div>

      {/* New chat modal */}
      {showNewChat && (
        <div className="modal-overlay" onClick={() => setShowNewChat(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3>Start a Conversation</h3>
              <button className="btn-icon" onClick={() => { setShowNewChat(false); setParentClassFilter(''); setContactSearch(''); }}><FiX /></button>
            </div>
            <div className="modal-body">
              {/* Search */}
              <div style={{ position: 'relative', marginBottom: 10 }}>
                <FiSearch style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                <input type="text" placeholder="Search by parent name, child name, phone, or admission no…" value={contactSearch} onChange={e => setContactSearch(e.target.value)} style={{ paddingLeft: '2.2rem', width: '100%' }} />
              </div>

              {/* Parent class filter — only when parents are in the contact list */}
              {parentClassOptions.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <FiLayers size={12} /> Filter parents by class:
                  </span>
                  <button
                    onClick={() => setParentClassFilter('')}
                    style={{
                      padding: '4px 10px', borderRadius: 999,
                      border: '1px solid ' + (!parentClassFilter ? 'var(--primary-500)' : 'var(--gray-200)'),
                      background: !parentClassFilter ? 'var(--primary-50)' : '#fff',
                      color: !parentClassFilter ? 'var(--primary-700)' : 'var(--gray-600)',
                      fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer',
                    }}
                  >All classes</button>
                  {parentClassOptions.map(cn => {
                    const active = parentClassFilter === cn;
                    return (
                      <button key={cn} onClick={() => setParentClassFilter(cn)} style={{
                        padding: '4px 10px', borderRadius: 999,
                        border: '1px solid ' + (active ? 'var(--primary-500)' : 'var(--gray-200)'),
                        background: active ? 'var(--primary-50)' : '#fff',
                        color: active ? 'var(--primary-700)' : 'var(--gray-600)',
                        fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                      }}>{cn}</button>
                    );
                  })}
                </div>
              )}

              <div style={{ maxHeight: 440, overflowY: 'auto' }}>
                {Object.keys(groupedContacts).length === 0 ? (
                  <p style={{ color: 'var(--gray-400)', fontSize: '0.85rem', textAlign: 'center', padding: 20 }}>
                    {parentClassFilter ? `No parents found for ${parentClassFilter}.` : 'No contacts available.'}
                  </p>
                ) : Object.entries(groupedContacts).map(([role, list]: any) => (
                  <div key={role} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: ROLE_COLOR[list[0]?.role] || '#888', textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.05em' }}>
                      {role.replace(/_/g, ' ')} ({list.length})
                    </div>
                    {list.map((c: any) => {
                      const isParent = c.role === 'PARENT';
                      const kids: any[] = Array.isArray(c.children) ? c.children : [];
                      // When a class filter is active, prioritize the matching child first
                      const sortedKids = parentClassFilter
                        ? [...kids].sort((a, b) =>
                            (a.class_name === parentClassFilter ? -1 : 1) -
                            (b.class_name === parentClassFilter ? -1 : 1))
                        : kids;
                      return (
                        <div key={c.id} onClick={() => openThreadWith(c.id, c)} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 12px', cursor: 'pointer', borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--gray-100)', marginBottom: 6,
                          background: '#fff',
                        }}>
                          <div className="avatar" style={{ background: ROLE_COLOR[c.role] || '#888', width: 36, height: 36, fontSize: '0.72rem', flexShrink: 0 }}>
                            {getInitials(c.name)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{c.name}</div>
                              {c.phone && (
                                <span style={{
                                  fontSize: '0.7rem', fontWeight: 600, color: 'var(--gray-600)',
                                  display: 'inline-flex', alignItems: 'center', gap: 3,
                                  background: 'var(--gray-50)', padding: '1px 7px', borderRadius: 6,
                                  border: '1px solid var(--gray-200)',
                                }}>
                                  <FiPhone size={10} /> {c.phone}
                                </span>
                              )}
                            </div>
                            {isParent && sortedKids.length > 0 ? (
                              <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {sortedKids.map((k: any, i: number) => {
                                  const highlight = parentClassFilter && k.class_name === parentClassFilter;
                                  return (
                                    <span key={i} style={{
                                      fontSize: '0.7rem', fontWeight: 600,
                                      padding: '2px 8px', borderRadius: 999,
                                      background: highlight ? '#fef3c7' : 'var(--primary-50)',
                                      border: '1px solid ' + (highlight ? '#fbbf24' : 'var(--primary-100)'),
                                      color: highlight ? '#92400e' : 'var(--primary-700)',
                                    }}>
                                      {k.name}
                                      {k.class_name && (
                                        <span style={{ color: 'var(--gray-500)', fontWeight: 500 }}>
                                          {' · '}{k.class_name}{k.section_name ? `-${k.section_name}` : ''}
                                        </span>
                                      )}
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              !isParent && c.subtitle && (
                                <div style={{ fontSize: '0.72rem', color: 'var(--gray-500)', marginTop: 2 }}>{c.subtitle}</div>
                              )
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
