import React, { useEffect, useMemo, useState } from 'react';
import {
  FiChevronLeft, FiChevronRight, FiBookOpen, FiCalendar,
  FiUser, FiPaperclip, FiInbox, FiImage,
} from 'react-icons/fi';
import DiaryImageGrid, { DiaryImageItem } from './DiaryImageGrid';

export interface DiaryEntry {
  id: string;
  subject_id: string;
  subject_name?: string | null;
  teacher_name?: string | null;
  entry_date: string;
  period_number?: number | null;
  period_label?: string | null;
  classwork?: string | null;
  homework?: string | null;
  homework_due_date?: string | null;
  remarks?: string | null;
  remarks_date?: string | null;
  attachment_url?: string | null;
  attachments?: DiaryImageItem[] | null;
  color?: string | null;
  section_label?: string | null;
}

export interface DiaryDay {
  date: string;
  entries: DiaryEntry[];
}

interface Props {
  days: DiaryDay[];
  loading?: boolean;
  ownerName: string;          // student name shown on the cover
  ownerSub?: string;          // e.g. class · section
  schoolName?: string;
  emptyHint?: string;
}

const monthName = (iso: string) => {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

export default function DiaryBook({
  days, loading, ownerName, ownerSub, schoolName, emptyHint,
}: Props) {
  const [pageIdx, setPageIdx] = useState(0);
  const [flipping, setFlipping] = useState<'next' | 'prev' | null>(null);

  // Reset when data shrinks
  useEffect(() => {
    if (pageIdx >= days.length && days.length > 0) setPageIdx(0);
  }, [days.length, pageIdx]);

  const current = days[pageIdx];
  const prev = pageIdx > 0;
  const next = pageIdx < days.length - 1;

  const flip = (dir: 'next' | 'prev') => {
    setFlipping(dir);
    setTimeout(() => {
      setPageIdx(p => dir === 'next' ? Math.min(p + 1, days.length - 1) : Math.max(p - 1, 0));
      setFlipping(null);
    }, 320);
  };

  // Subject summary for left page
  const subjectSummary = useMemo(() => {
    if (!current) return [];
    const m = new Map<string, { name: string; color: string; count: number; hasHomework: boolean }>();
    current.entries.forEach(e => {
      const key = e.subject_id;
      const prev = m.get(key);
      const next = {
        name: e.subject_name || 'Subject',
        color: e.color || '#6366f1',
        count: (prev?.count || 0) + 1,
        hasHomework: prev?.hasHomework || !!e.homework,
      };
      m.set(key, next);
    });
    return Array.from(m.values());
  }, [current]);

  if (loading) {
    return <div className="card"><div className="spinner-container"><div className="spinner" /></div></div>;
  }

  if (days.length === 0) {
    return (
      <div className="diary-book-shell">
        <div className="diary-book-cover">
          <div className="diary-book-cover-inner">
            <FiBookOpen size={42} />
            <h1>My Daily Diary</h1>
            <div className="diary-cover-name">{ownerName}</div>
            {ownerSub && <div className="diary-cover-sub">{ownerSub}</div>}
            {schoolName && <div className="diary-cover-school">{schoolName}</div>}
          </div>
        </div>
        <div className="card" style={{ marginTop: 20 }}>
          <div className="empty-state">
            <FiInbox size={32} style={{ color: 'var(--gray-300)' }} />
            <h3>The diary is empty</h3>
            <p>{emptyHint || 'No entries yet — once teachers post, they will appear here.'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="diary-book-shell">
      {/* Date navigator strip */}
      <div className="diary-date-strip">
        <button className="diary-strip-arrow" disabled={!prev} onClick={() => flip('prev')}>
          <FiChevronLeft />
        </button>
        <div className="diary-date-pills">
          {days.map((d, i) => (
            <button
              key={d.date}
              className={`diary-date-pill ${i === pageIdx ? 'active' : ''}`}
              onClick={() => setPageIdx(i)}
              title={monthName(d.date)}
            >
              <span className="diary-pill-day">{new Date(d.date + 'T00:00:00').getDate()}</span>
              <span className="diary-pill-mon">
                {new Date(d.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short' })}
              </span>
              <span className="diary-pill-count">{d.entries.length}</span>
            </button>
          ))}
        </div>
        <button className="diary-strip-arrow" disabled={!next} onClick={() => flip('next')}>
          <FiChevronRight />
        </button>
      </div>

      {/* Book spread */}
      <div className="diary-book-spread">
        <div className={`diary-book-page ${flipping === 'next' ? 'flip-left' : ''} ${flipping === 'prev' ? 'flip-right' : ''}`}>
          {/* Left page — date + summary */}
          <div className="diary-page-left">
            <div className="diary-page-corner-top"></div>
            <div className="diary-page-date-block">
              <FiCalendar />
              <div>
                <div className="diary-day-num">
                  {new Date(current.date + 'T00:00:00').getDate()}
                </div>
                <div className="diary-month">
                  {new Date(current.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'long' }).toUpperCase()}
                  {' · '}
                  {new Date(current.date + 'T00:00:00').getFullYear()}
                </div>
                <div className="diary-weekday">
                  {new Date(current.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long' })}
                </div>
              </div>
            </div>

            <div className="diary-summary-block">
              <div className="diary-summary-title">Today's subjects</div>
              {subjectSummary.length === 0 ? (
                <div className="diary-summary-empty">No subjects yet</div>
              ) : (
                <ul className="diary-subject-list">
                  {subjectSummary.map((s, idx) => (
                    <li key={idx}>
                      <span className="diary-subject-dot" style={{ background: s.color }} />
                      <span className="diary-subject-name">{s.name}</span>
                      {s.hasHomework && <span className="diary-hw-pill">HW</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="diary-owner-footer">
              <FiUser />
              <div>
                <div className="diary-owner-name">{ownerName}</div>
                {ownerSub && <div className="diary-owner-sub">{ownerSub}</div>}
              </div>
            </div>
            <div className="diary-page-corner-bottom"></div>
          </div>

          {/* Right page — entries */}
          <div className="diary-page-right">
            <div className="diary-page-header-right">
              <h2>Diary Entries</h2>
              <span className="diary-page-counter">Page {pageIdx + 1} of {days.length}</span>
            </div>
            <div className="diary-entries-scroll">
              {current.entries.length === 0 ? (
                <div className="empty-state">
                  <p>No entries on this day.</p>
                </div>
              ) : (
                current.entries.map(e => (
                  <article key={e.id} className="diary-paper-entry" style={{ '--accent': e.color || '#6366f1' } as React.CSSProperties}>
                    <header className="diary-paper-head">
                      <div>
                        <div className="diary-paper-subject" style={{ color: e.color || '#6366f1' }}>
                          {e.subject_name || 'Subject'}
                        </div>
                        <div className="diary-paper-period">
                          {e.period_label || (e.period_number ? `Period ${e.period_number}` : '—')}
                          {e.teacher_name ? ` · ${e.teacher_name}` : ''}
                        </div>
                      </div>
                    </header>

                    {e.classwork && (
                      <div className="diary-paper-block">
                        <div className="diary-paper-label">📚 Classwork</div>
                        <p className="diary-handwritten">{e.classwork}</p>
                      </div>
                    )}
                    {e.homework && (
                      <div className="diary-paper-block homework">
                        <div className="diary-paper-label">
                          📝 Homework
                          {e.homework_due_date && <span className="diary-due">· due {e.homework_due_date}</span>}
                        </div>
                        <p className="diary-handwritten">{e.homework}</p>
                      </div>
                    )}
                    {e.remarks && (
                      <div className="diary-paper-block remarks">
                        <div className="diary-paper-label">
                          💡 Remarks
                          {e.remarks_date && <span className="diary-due">· for {e.remarks_date}</span>}
                        </div>
                        <p className="diary-handwritten">{e.remarks}</p>
                      </div>
                    )}
                    {Array.isArray(e.attachments) && e.attachments.length > 0 && (() => {
                      const imgCount = e.attachments.filter(a => a.kind !== 'file').length;
                      const fileCount = e.attachments.length - imgCount;
                      const parts: string[] = [];
                      if (imgCount > 0) parts.push(`${imgCount} image${imgCount > 1 ? 's' : ''}`);
                      if (fileCount > 0) parts.push(`${fileCount} file${fileCount > 1 ? 's' : ''}`);
                      return (
                        <div className="diary-paper-block images">
                          <div className="diary-paper-label">
                            <FiImage style={{ verticalAlign: '-2px', marginRight: 4 }} />
                            {parts.join(' · ')}
                            <span className="diary-due">· {imgCount > 0 ? 'tap to zoom' : 'tap to download'}</span>
                          </div>
                          <DiaryImageGrid
                            images={e.attachments}
                            entryDate={e.entry_date}
                            subjectName={e.subject_name || undefined}
                          />
                        </div>
                      );
                    })()}
                    {e.attachment_url && (
                      <a className="diary-paper-attachment" href={e.attachment_url} target="_blank" rel="noreferrer">
                        <FiPaperclip /> External link
                      </a>
                    )}
                  </article>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Page-flip side arrows */}
        <button className="diary-side-arrow left" disabled={!prev} onClick={() => flip('prev')}>
          <FiChevronLeft />
        </button>
        <button className="diary-side-arrow right" disabled={!next} onClick={() => flip('next')}>
          <FiChevronRight />
        </button>
      </div>
    </div>
  );
}
