import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Briefcase,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Trophy,
  SortAsc,
  SortDesc,
  LayoutGrid,
  List,
  Search,
  Check,
  X,
  Sparkles,
} from 'lucide-react';
import {
  InternCompany,
  InternStatus,
  STATUS_CONFIG,
  getInternData,
  saveInternData,
  formatCTC,
} from '../data/internData';
import { getInternRoles, saveInternRole } from '../services/api';

type SortKey = 'company' | 'ctc' | 'resumeEnd' | 'myStatus';
type SortDir = 'asc' | 'desc';
type ViewMode = 'table' | 'cards';
type FilterKey = InternStatus | 'active' | 'all';

const STATUS_ORDER: InternStatus[] = ['offered', 'interview_good', 'shortlisted', 'oa_good', 'oa_bad', 'applied', 'not_applied', 'rejected'];

// ─── Tier categorization by CTC ──────────────────────────────────
function getTier(ctc: number, currency: string) {
  if (currency === 'USD') return { label: 'DREAM', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' };
  if (ctc >= 1500000)     return { label: 'DREAM', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' };
  if (ctc >= 500000)      return { label: 'TOP', color: '#34d399', bg: 'rgba(52,211,153,0.1)' };
  if (ctc >= 200000)      return { label: 'GOOD', color: '#818cf8', bg: 'rgba(129,140,248,0.1)' };
  return                         { label: 'CORE', color: '#94a3b8', bg: 'rgba(148,163,184,0.08)' };
}

export const InternTracker: React.FC = () => {
  const [interns, setInterns] = useState<InternCompany[]>([]);
  const [filter, setFilter] = useState<FilterKey>('active');
  const [sortKey, setSortKey] = useState<SortKey>('ctc');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [search, setSearch] = useState('');
  const [showRejected, setShowRejected] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [editInterviewId, setEditInterviewId] = useState<string | null>(null);
  const [interviewDraft, setInterviewDraft] = useState('');
  const [selectedDetail, setSelectedDetail] = useState<InternCompany | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const roles = await getInternRoles();
      if (active) {
        if (roles && roles.length > 0) {
          setInterns(roles);
          saveInternData(roles);
        } else {
          setInterns(getInternData());
        }
      }
    }
    load();
    return () => { active = false; };
  }, []);

  const persist = useCallback((updated: InternCompany[], changedRole?: InternCompany) => {
    setInterns(updated);
    saveInternData(updated);
    if (changedRole) {
      saveInternRole(changedRole);
    }
  }, []);


  // Only ONE company can be SORTED at a time (radio behavior)
  const toggleSorted = (id: string) => {
    const role = interns.find(i => i.id === id);
    if (!role) return;
    const isCurrentlySorted = role.sortingDone;
    const updatedRole = { ...role, sortingDone: !isCurrentlySorted };
    
    const nextList = interns.map(i =>
      i.id === id ? updatedRole : { ...i, sortingDone: false }
    );
    
    setInterns(nextList);
    saveInternData(nextList);
    saveInternRole(updatedRole);
    
    // Clear other sorted items in DB
    interns.forEach(i => {
      if (i.id !== id && i.sortingDone) {
        saveInternRole({ ...i, sortingDone: false });
      }
    });
  };

  const setStatus = (id: string, status: InternStatus) => {
    const role = interns.find(i => i.id === id);
    if (role) {
      const updatedRole = { ...role, myStatus: status };
      persist(interns.map(i => i.id === id ? updatedRole : i), updatedRole);
    }
  };

  const saveNote = (id: string) => {
    const role = interns.find(i => i.id === id);
    if (role) {
      const updatedRole = { ...role, notes: noteDraft };
      persist(interns.map(i => i.id === id ? updatedRole : i), updatedRole);
      setEditId(null);
    }
  };

  const saveInterview = (id: string) => {
    const role = interns.find(i => i.id === id);
    if (role) {
      const updatedRole = { ...role, interviewDate: interviewDraft };
      persist(interns.map(i => i.id === id ? updatedRole : i), updatedRole);
      setEditInterviewId(null);
    }
  };

  const handleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir(k === 'ctc' ? 'desc' : 'asc'); }
  };

  const stats = useMemo(() => ({
    total: interns.length,
    applied: interns.filter(i => ['applied','oa_bad','oa_good','shortlisted','interview_good','offered'].includes(i.myStatus)).length,
    oa_good: interns.filter(i => i.myStatus === 'oa_good').length,
    offer: interns.filter(i => i.myStatus === 'offered').length,
    interview: interns.filter(i => i.myStatus === 'interview_good').length,
    shortlisted: interns.filter(i => i.myStatus === 'shortlisted').length,
    sorted: interns.filter(i => i.sortingDone).length,
    rejected: interns.filter(i => i.myStatus === 'rejected').length,
  }), [interns]);

  const filterCounts = useMemo(() => {
    const counts: Record<FilterKey, number> = {
      active: interns.filter(i => i.myStatus !== 'rejected').length,
      all: interns.length,
      not_applied: interns.filter(i => i.myStatus === 'not_applied').length,
      applied: interns.filter(i => i.myStatus === 'applied').length,
      oa_bad: interns.filter(i => i.myStatus === 'oa_bad').length,
      oa_good: interns.filter(i => i.myStatus === 'oa_good').length,
      shortlisted: interns.filter(i => i.myStatus === 'shortlisted').length,
      interview_good: interns.filter(i => i.myStatus === 'interview_good').length,
      offered: interns.filter(i => i.myStatus === 'offered').length,
      rejected: interns.filter(i => i.myStatus === 'rejected').length,
    };
    return counts;
  }, [interns]);

  const { activeList, rejectedList } = useMemo(() => {
    let filtered = interns.filter(i => {
      if (filter === 'rejected') return i.myStatus === 'rejected';
      if (i.myStatus === 'rejected') return false; // always separate for other tabs
      if (filter === 'all') return true;
      if (filter === 'active') return true;
      return i.myStatus === filter;
    });
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(i => i.company.toLowerCase().includes(q));
    }
    const sorted = [...filtered].sort((a, b) => {
      // Bubble down empty application status: Y (yes) goes on top, empty/other stays at bottom
      const aApplied = a.applicationStatus === 'Y';
      const bApplied = b.applicationStatus === 'Y';
      if (aApplied && !bApplied) return -1;
      if (!aApplied && bApplied) return 1;

      // Internal sorting within the same group
      let cmp = 0;
      if (sortKey === 'ctc') cmp = a.ctc - b.ctc;
      else if (sortKey === 'company') cmp = a.company.localeCompare(b.company);
      else if (sortKey === 'resumeEnd') cmp = (a.resumeEnd || '').localeCompare(b.resumeEnd || '');
      else if (sortKey === 'myStatus') cmp = STATUS_ORDER.indexOf(a.myStatus) - STATUS_ORDER.indexOf(b.myStatus);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return {
      activeList: sorted,
      rejectedList: interns.filter(i => i.myStatus === 'rejected'),
    };
  }, [interns, filter, search, sortKey, sortDir]);

  // ─── Sort Column Header button ──────────────────────────────────
  const SortTh = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th
      onClick={() => handleSort(k)}
      style={{
        padding: '10px 14px', cursor: 'pointer', whiteSpace: 'nowrap',
        textAlign: k === 'ctc' ? 'right' : 'left',
        color: sortKey === k ? '#a5b4fc' : '#475569',
        fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em',
        borderBottom: '1px solid rgba(30,41,59,0.8)',
        background: 'rgba(3,7,18,0.8)',
        userSelect: 'none',
        transition: 'color 0.15s',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {children}
        {sortKey === k && (
          sortDir === 'asc'
            ? <SortAsc size={11} style={{ flexShrink: 0 }} />
            : <SortDesc size={11} style={{ flexShrink: 0 }} />
        )}
      </span>
    </th>
  );

  // ─── Table Row ──────────────────────────────────────────────────
  const renderTableRow = (intern: InternCompany) => {
    const tier = getTier(intern.ctc, intern.currency);
    const isSorted = intern.sortingDone;

    return (
      <tr
        key={intern.id}
        style={{
          background: isSorted ? 'rgba(56,189,248,0.03)' : 'transparent',
          borderBottom: '1px solid rgba(30,41,59,0.5)',
          transition: 'background 0.15s',
        }}
      >
        {/* # */}
        <td style={{ padding: '10px 12px', color: '#334155', fontSize: 11, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
          {intern.id.replace('i', '')}
        </td>

        {/* Company */}
        <td style={{ padding: '10px 14px', minWidth: 180 }}>
          <div
            onClick={() => setSelectedDetail(intern)}
            style={{ fontWeight: 700, fontSize: 13, color: '#e2e8f0', lineHeight: 1.3, cursor: 'pointer' }}
            title="Click to view full role details"
          >
            <span style={{ borderBottom: '1px dashed rgba(226, 232, 240, 0.4)', transition: 'color 0.15s' }}>
              {intern.company}
            </span>
          </div>
          {intern.positionNote && (
            <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{intern.positionNote}</div>
          )}
        </td>

        {/* Tier */}
        <td style={{ padding: '10px 10px', whiteSpace: 'nowrap' }}>
          <span style={{
            fontSize: 9, fontWeight: 800, letterSpacing: '0.07em',
            color: tier.color, background: tier.bg,
            border: `1px solid ${tier.color}30`,
            borderRadius: 20, padding: '2px 7px',
          }}>{tier.label}</span>
        </td>

        {/* CTC */}
        <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
          <span style={{ fontWeight: 800, fontSize: 13, color: '#4ade80', fontFamily: 'Outfit, sans-serif' }}>
            {formatCTC(intern.ctc, intern.currency)}
          </span>
        </td>

        {/* Resume Deadline */}
        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
          <div style={{ fontSize: 11, color: '#fca5a5', fontFamily: 'monospace' }}>{intern.resumeEnd}</div>
        </td>

        {/* Interview */}
        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
          {editInterviewId === intern.id ? (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input
                value={interviewDraft}
                onChange={e => setInterviewDraft(e.target.value)}
                placeholder="dd-mm-yyyy hh:mm"
                style={{
                  background: 'rgba(3,7,18,0.8)', border: '1px solid rgba(99,102,241,0.4)',
                  borderRadius: 6, padding: '3px 7px', color: '#e2e8f0',
                  fontSize: 11, fontFamily: 'monospace', width: 130, outline: 'none',
                }}
              />
              <button onClick={() => saveInterview(intern.id)} style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 5, padding: '3px 6px', cursor: 'pointer', color: '#4ade80', lineHeight: 1 }}>
                <Check size={11} />
              </button>
              <button onClick={() => setEditInterviewId(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#475569', lineHeight: 1 }}>
                <X size={11} />
              </button>
            </div>
          ) : (
            <span
              onClick={() => { setEditInterviewId(intern.id); setInterviewDraft(intern.interviewDate); }}
              style={{ fontSize: 11, color: intern.interviewDate ? '#fdba74' : '#334155', fontFamily: 'monospace', cursor: 'pointer' }}
              title="Click to set interview date"
            >
              {intern.interviewDate || '— set date'}
            </span>
          )}
        </td>

        {/* Status Picker */}
        <td style={{ padding: '8px 10px', minWidth: 150 }}>
          <div style={{ position: 'relative', width: '100%', minWidth: '135px' }}>
            <select
              value={intern.myStatus}
              onChange={e => setStatus(intern.id, e.target.value as InternStatus)}
              style={{
                width: '100%',
                padding: '6px 24px 6px 10px',
                borderRadius: 8,
                background: STATUS_CONFIG[intern.myStatus].bg,
                border: `1px solid ${STATUS_CONFIG[intern.myStatus].border}`,
                color: STATUS_CONFIG[intern.myStatus].color,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                outline: 'none',
                appearance: 'none',
                WebkitAppearance: 'none',
                transition: 'all 0.15s',
              }}
            >
              {(Object.keys(STATUS_CONFIG) as InternStatus[]).map(s => {
                const c = STATUS_CONFIG[s];
                return (
                  <option key={s} value={s} style={{ background: '#0b0f19', color: c.color }}>
                    {c.emoji} {c.label}
                  </option>
                );
              })}
            </select>
            <div style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              pointerEvents: 'none', color: STATUS_CONFIG[intern.myStatus].color, display: 'flex', alignItems: 'center'
            }}>
              <ChevronDown size={11} />
            </div>
          </div>
        </td>

        {/* Notes */}
        <td style={{ padding: '8px 10px', minWidth: 140 }}>
          {editId === intern.id ? (
            <div style={{ display: 'flex', gap: 5, alignItems: 'flex-start' }}>
              <textarea
                value={noteDraft}
                onChange={e => setNoteDraft(e.target.value)}
                rows={2}
                style={{
                  background: 'rgba(3,7,18,0.8)', border: '1px solid rgba(99,102,241,0.4)',
                  borderRadius: 6, padding: '4px 7px', color: '#e2e8f0',
                  fontSize: 11, resize: 'vertical', width: 160, outline: 'none',
                  fontFamily: 'Inter, sans-serif',
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <button onClick={() => saveNote(intern.id)} style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 5, padding: '3px 6px', cursor: 'pointer', color: '#4ade80' }}>
                  <Check size={11} />
                </button>
                <button onClick={() => setEditId(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#475569' }}>
                  <X size={11} />
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => { setEditId(intern.id); setNoteDraft(intern.notes); }}
              style={{
                fontSize: 11, color: intern.notes ? '#94a3b8' : '#2d3748',
                cursor: 'pointer', fontStyle: intern.notes ? 'normal' : 'italic',
                maxWidth: 180, lineHeight: 1.4,
              }}
            >
              {intern.notes || 'add notes…'}
            </div>
          )}
        </td>

        {/* SORTED Button */}
        <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
          <button
            onClick={() => toggleSorted(intern.id)}
            style={{
              padding: '6px 12px', borderRadius: 20,
              border: isSorted ? '1px solid rgba(56,189,248,0.55)' : '1px solid rgba(51,65,85,0.6)',
              background: isSorted
                ? 'linear-gradient(135deg, rgba(56,189,248,0.18), rgba(99,102,241,0.12))'
                : 'rgba(15,23,42,0.5)',
              color: isSorted ? '#38bdf8' : '#334155',
              fontSize: 11, fontWeight: 800, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5,
              boxShadow: isSorted ? '0 0 10px rgba(56,189,248,0.18)' : 'none',
              transition: 'all 0.18s',
              letterSpacing: '0.03em',
            }}
          >
            {isSorted ? <><Trophy size={11} /> SORTED ✓</> : <><CheckCircle2 size={11} /> Done?</>}
          </button>
        </td>
      </tr>
    );
  };

  // ─── Card ──────────────────────────────────────────────────────
  const renderCard = (intern: InternCompany) => {
    const cfg = STATUS_CONFIG[intern.myStatus];
    const tier = getTier(intern.ctc, intern.currency);
    const isSorted = intern.sortingDone;

    return (
      <div
        key={intern.id}
        style={{
          background: isSorted ? 'rgba(56,189,248,0.04)' : 'rgba(15,23,42,0.85)',
          border: `1px solid ${isSorted ? 'rgba(56,189,248,0.38)' : cfg.border}`,
          borderRadius: 16,
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          transition: 'all 0.18s',
          position: 'relative',
        }}
      >
        {/* Tier badge + Sorted indicator */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: tier.color, background: tier.bg, border: `1px solid ${tier.color}30`, borderRadius: 20, padding: '2px 7px', letterSpacing: '0.06em' }}>
                {tier.label}
              </span>
              {intern.positionNote && (
                <span style={{ fontSize: 9, color: '#475569', background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(51,65,85,0.4)', borderRadius: 20, padding: '2px 7px' }}>
                  {intern.positionNote}
                </span>
              )}
            </div>
            <div
              onClick={() => setSelectedDetail(intern)}
              style={{ fontSize: 14, fontWeight: 800, color: '#f1f5f9', lineHeight: 1.3, fontFamily: 'Outfit, sans-serif', cursor: 'pointer' }}
              title="Click to view full details"
            >
              <span style={{ borderBottom: '1px dashed rgba(241, 245, 249, 0.4)' }}>
                {intern.company}
              </span>
            </div>
          </div>
          <span style={{ fontWeight: 800, fontSize: 14, color: '#4ade80', fontFamily: 'Outfit, sans-serif', whiteSpace: 'nowrap' }}>
            {formatCTC(intern.ctc, intern.currency)}
          </span>
        </div>

        {/* Deadline row */}
        <div style={{ background: 'rgba(3,7,18,0.5)', borderRadius: 8, padding: '7px 10px', display: 'flex', gap: 12 }}>
          <div>
            <div style={{ fontSize: 9, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Deadline</div>
            <div style={{ fontSize: 11, color: '#fca5a5', fontFamily: 'monospace', marginTop: 1 }}>{intern.resumeEnd}</div>
          </div>
          {intern.interviewDate && (
            <div>
              <div style={{ fontSize: 9, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Interview</div>
              <div style={{ fontSize: 11, color: '#fdba74', fontFamily: 'monospace', marginTop: 1 }}>{intern.interviewDate}</div>
            </div>
          )}
        </div>

        {/* Status Picker Dropdown */}
        <div style={{ position: 'relative', width: '100%' }}>
          <select
            value={intern.myStatus}
            onChange={e => setStatus(intern.id, e.target.value as InternStatus)}
            style={{
              width: '100%',
              padding: '8px 28px 8px 12px',
              borderRadius: 10,
              background: STATUS_CONFIG[intern.myStatus].bg,
              border: `1px solid ${STATUS_CONFIG[intern.myStatus].border}`,
              color: STATUS_CONFIG[intern.myStatus].color,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              outline: 'none',
              appearance: 'none',
              WebkitAppearance: 'none',
              transition: 'all 0.15s',
            }}
          >
            {(Object.keys(STATUS_CONFIG) as InternStatus[]).map(s => {
              const c = STATUS_CONFIG[s];
              return (
                <option key={s} value={s} style={{ background: '#0b0f19', color: c.color }}>
                  {c.emoji} {c.label}
                </option>
              );
            })}
          </select>
          <div style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            pointerEvents: 'none', color: STATUS_CONFIG[intern.myStatus].color, display: 'flex', alignItems: 'center'
          }}>
            <ChevronDown size={13} />
          </div>
        </div>

        {/* Notes inline */}
        {editId === intern.id ? (
          <div style={{ display: 'flex', gap: 5 }}>
            <textarea
              value={noteDraft}
              onChange={e => setNoteDraft(e.target.value)}
              rows={2}
              placeholder="Notes…"
              style={{
                flex: 1, background: 'rgba(3,7,18,0.8)', border: '1px solid rgba(99,102,241,0.4)',
                borderRadius: 8, padding: '6px 9px', color: '#e2e8f0',
                fontSize: 12, resize: 'vertical', outline: 'none', fontFamily: 'Inter, sans-serif',
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button onClick={() => saveNote(intern.id)} style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 6, padding: '5px 7px', cursor: 'pointer', color: '#4ade80' }}>
                <Check size={12} />
              </button>
              <button onClick={() => setEditId(null)} style={{ background: 'transparent', border: '1px solid rgba(51,65,85,0.4)', borderRadius: 6, padding: '5px 7px', cursor: 'pointer', color: '#475569' }}>
                <X size={12} />
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => { setEditId(intern.id); setNoteDraft(intern.notes); }}
            style={{
              padding: '6px 10px', borderRadius: 8,
              border: '1px dashed rgba(51,65,85,0.5)',
              color: intern.notes ? '#64748b' : '#1e293b',
              fontSize: 11, cursor: 'pointer', fontStyle: intern.notes ? 'normal' : 'italic',
            }}
          >
            {intern.notes || '+ notes'}
          </div>
        )}

        {/* SORTED button footer */}
        <button
          onClick={() => toggleSorted(intern.id)}
          style={{
            padding: '8px', borderRadius: 10, fontWeight: 800, fontSize: 11,
            border: isSorted ? '1px solid rgba(56,189,248,0.5)' : '1px solid rgba(51,65,85,0.6)',
            background: isSorted
              ? 'linear-gradient(135deg, rgba(56,189,248,0.15), rgba(99,102,241,0.08))'
              : 'rgba(15,23,42,0.4)',
            color: isSorted ? '#38bdf8' : '#334155',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            boxShadow: isSorted ? '0 0 12px rgba(56,189,248,0.15)' : 'none',
            transition: 'all 0.18s', letterSpacing: '0.03em',
          }}
        >
          {isSorted ? <><Trophy size={12} /> SORTED ✓ — Slot Finalized</> : <><CheckCircle2 size={12} /> Mark as SORTED / DONE</>}
        </button>
      </div>
    );
  };

  // ─── Render ────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header + Stats ───────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(30,27,75,0.85) 100%)',
        border: '1px solid rgba(99,102,241,0.25)',
        borderRadius: 18, padding: '20px 24px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: '50%', background: 'rgba(99,102,241,0.07)', filter: 'blur(50px)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <Briefcase size={15} style={{ color: '#818cf8' }} />
              <span style={{ color: '#818cf8', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Internship Season 2026-27
              </span>
              <span style={{ fontSize: 10, background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 20, padding: '1px 7px', fontWeight: 700 }}>
                {stats.total} companies
              </span>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#f8fafc', fontFamily: 'Outfit, sans-serif', margin: 0 }}>
              Intern Applications Tracker
            </h2>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(76px, 1fr))',
            gap: 6,
            width: '100%',
            marginTop: 12
          }}>
            {[
              { l: 'Applied', v: stats.applied, c: '#818cf8' },
              { l: 'OA Good', v: stats.oa_good, c: '#10b981' },
              { l: 'Shortlisted', v: stats.shortlisted, c: '#38bdf8' },
              { l: 'Interview', v: stats.interview, c: '#fb923c' },
              { l: 'Offer', v: stats.offer, c: '#4ade80' },
              { l: 'Sorted ✓', v: stats.sorted > 0 ? '1' : '—', c: '#38bdf8' },
              { l: 'Rejected', v: stats.rejected, c: '#f87171' },
            ].map(s => (
              <div key={s.l} style={{
                background: 'rgba(3,7,18,0.7)', border: '1px solid rgba(30,41,59,0.7)',
                borderRadius: 10, padding: '6px 8px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: s.c, fontFamily: 'Outfit, sans-serif' }}>{s.v}</div>
                <div style={{ fontSize: 8, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 1, whiteSpace: 'nowrap' }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tier legend */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', borderTop: '1px solid rgba(30,41,59,0.5)', paddingTop: 12 }}>
          <span style={{ fontSize: 10, color: '#475569', fontWeight: 600 }}>Tiers:</span>
          {[
            { t: 'DREAM', c: '#fbbf24', sub: '≥₹15L or USD' },
            { t: 'TOP', c: '#34d399', sub: '≥₹5L' },
            { t: 'GOOD', c: '#818cf8', sub: '≥₹2L' },
            { t: 'CORE', c: '#94a3b8', sub: '<₹2L' },
          ].map(t => (
            <span key={t.t} style={{ fontSize: 10, color: t.c, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ background: `${t.c}18`, border: `1px solid ${t.c}30`, borderRadius: 20, padding: '1px 6px', fontWeight: 800 }}>{t.t}</span>
              <span style={{ color: '#334155' }}>{t.sub}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Controls ─────────────────────────────────────────── */}
      <div style={{
        background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(30,41,59,0.7)',
        borderRadius: 14, padding: '12px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {/* Top row: Search + View Mode toggle */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(3,7,18,0.8)', border: '1px solid rgba(51,65,85,0.6)', borderRadius: 9, padding: '6px 12px', flex: '1 1 180px', maxWidth: '280px' }}>
            <Search size={13} style={{ color: '#475569', flexShrink: 0 }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search company…"
              style={{ background: 'none', border: 'none', outline: 'none', color: '#cbd5e1', fontSize: 12, width: '100%', fontFamily: 'Inter, sans-serif' }}
            />
          </div>

          {/* View toggle */}
          <div style={{ display: 'flex', gap: 2, background: 'rgba(3,7,18,0.8)', border: '1px solid rgba(30,41,59,0.7)', borderRadius: 9, padding: 3, marginLeft: 'auto' }}>
            {(['table','cards'] as ViewMode[]).map(v => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                style={{
                  padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
                  background: viewMode === v ? 'rgba(99,102,241,0.2)' : 'transparent',
                  border: viewMode === v ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent',
                  color: viewMode === v ? '#818cf8' : '#475569',
                  display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700,
                }}
              >
                {v === 'table' ? <List size={13} /> : <LayoutGrid size={13} />}
                <span className="hide-mobile-label">{v === 'table' ? 'Table' : 'Cards'}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Bottom row: Status filters (Scrollable) */}
        <div 
          className="no-scrollbar"
          style={{
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
            paddingBottom: 4,
            width: '100%',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {([
            'active',
            'all',
            'not_applied',
            'applied',
            'oa_bad',
            'oa_good',
            'shortlisted',
            'interview_good',
            'offered',
            'rejected'
          ] as FilterKey[]).map(f => {
            const isActive = filter === f;
            const count = filterCounts[f];
            
            // Get label, emoji, and colors
            let label = f === 'active' ? 'Active' : f === 'all' ? 'All' : STATUS_CONFIG[f as InternStatus]?.label ?? f;
            let emoji = f === 'active' ? '🟢' : f === 'all' ? '📋' : STATUS_CONFIG[f as InternStatus]?.emoji ?? '';
            
            // Customize colors from STATUS_CONFIG
            let activeColor = '#a5b4fc';
            let activeBg = 'rgba(99,102,241,0.18)';
            let activeBorder = 'rgba(99,102,241,0.6)';
            
            if (f !== 'active' && f !== 'all') {
              const cfg = STATUS_CONFIG[f as InternStatus];
              if (cfg) {
                activeColor = cfg.color;
                activeBg = cfg.bg;
                activeBorder = cfg.border;
              }
            }
            
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '5px 11px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                  cursor: 'pointer', transition: 'all 0.12s',
                  border: isActive ? `1px solid ${activeBorder}` : '1px solid rgba(51,65,85,0.45)',
                  background: isActive ? activeBg : 'transparent',
                  color: isActive ? activeColor : '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                <span>{emoji}</span>
                <span>{label}</span>
                <span style={{ 
                  fontSize: 9, 
                  opacity: 0.8, 
                  background: isActive ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.4)',
                  padding: '1px 5px',
                  borderRadius: 4,
                  marginLeft: 2,
                  fontFamily: 'monospace'
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main List ────────────────────────────────────────── */}
      {activeList.length === 0 ? (
        <div style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(30,41,59,0.5)', borderRadius: 16, padding: '40px 20px', textAlign: 'center' }}>
          <Sparkles size={32} style={{ color: '#334155', margin: '0 auto 10px', display: 'block' }} />
          <p style={{ color: '#475569', margin: 0, fontSize: 14 }}>No companies match the current filter.</p>
        </div>
      ) : viewMode === 'table' ? (
        <div style={{ background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(30,41,59,0.7)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr>
                  <SortTh k="company">#</SortTh>
                  <SortTh k="company">Company</SortTh>
                  <SortTh k="ctc">Tier</SortTh>
                  <SortTh k="ctc">CTC</SortTh>
                  <SortTh k="resumeEnd">Deadline</SortTh>
                  <SortTh k="company">Interview</SortTh>
                  <SortTh k="myStatus">My Status</SortTh>
                  <SortTh k="company">Notes</SortTh>
                  <SortTh k="myStatus">Sorted</SortTh>
                </tr>
              </thead>
              <tbody>
                {activeList.map(i => renderTableRow(i))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 14 }}>
          {activeList.map(i => renderCard(i))}
        </div>
      )}

      {/* ── Rejected Accordion ──────────────────────────────── */}
      {rejectedList.length > 0 && filter !== 'rejected' && (
        <div style={{ background: 'rgba(248,113,113,0.04)', border: '1px solid rgba(248,113,113,0.18)', borderRadius: 14, overflow: 'hidden' }}>
          <button
            onClick={() => setShowRejected(!showRejected)}
            style={{
              width: '100%', padding: '13px 18px', background: 'transparent', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              cursor: 'pointer', color: '#f87171',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <XCircle size={15} />
              <span style={{ fontWeight: 700, fontSize: 13 }}>
                Rejected ({rejectedList.length}) — Hidden from main list
              </span>
            </div>
            <ChevronDown size={15} style={{ transform: showRejected ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>

          {showRejected && (
            <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
              {rejectedList.map(intern => (
                <div key={intern.id} style={{
                  background: 'rgba(3,7,18,0.6)', border: '1px solid rgba(248,113,113,0.18)',
                  borderRadius: 12, padding: '12px 14px', opacity: 0.72,
                }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#94a3b8', marginBottom: 5 }}>{intern.company}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 10, color: '#f87171', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 20, padding: '2px 8px', fontWeight: 700 }}>
                      REJECTED
                    </span>
                    <span style={{ fontSize: 11, color: '#334155', fontFamily: 'Outfit, sans-serif', fontWeight: 700 }}>
                      {formatCTC(intern.ctc, intern.currency)}
                    </span>
                  </div>
                  {intern.notes && <p style={{ fontSize: 11, color: '#334155', marginTop: 8, marginBottom: 8, lineHeight: 1.4 }}>{intern.notes}</p>}
                  <button
                    onClick={() => setStatus(intern.id, 'not_applied')}
                    style={{
                      marginTop: 8, padding: '5px 11px', borderRadius: 8, width: '100%',
                      border: '1px solid rgba(51,65,85,0.5)', background: 'transparent',
                      color: '#64748b', fontSize: 10, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    ↩ Move back to Active
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* ── Details Modal ── */}
      {selectedDetail && (
        <div
          onClick={() => setSelectedDetail(null)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(3, 7, 18, 0.85)', backdropFilter: 'blur(12px)',
            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#090d16', border: '1px solid rgba(99,102,241,0.25)',
              borderRadius: 20, width: '100%', maxWidth: '720px', maxHeight: '85vh',
              boxShadow: '0 20px 40px -15px rgba(0,0,0,0.7), 0 0 30px rgba(99,102,241,0.06)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
              animation: 'fadeIn 0.2s ease',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '20px 24px', borderBottom: '1px solid rgba(30,41,59,0.7)',
              background: 'linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(30,27,75,0.4) 100%)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16,
            }}>
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 800, color: '#f8fafc', margin: 0, fontFamily: 'Outfit, sans-serif' }}>
                  {selectedDetail.company}
                </h3>
                {selectedDetail.positionNote && (
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#818cf8', marginTop: 4 }}>
                    {selectedDetail.positionNote}
                  </div>
                )}
              </div>
              <button
                onClick={() => setSelectedDetail(null)}
                style={{
                  background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(51,65,85,0.4)',
                  borderRadius: '50%', width: 28, height: 28, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  color: '#94a3b8', transition: 'all 0.15s',
                }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Quick Badges */}
            <div style={{
              padding: '12px 24px', background: 'rgba(3,7,18,0.4)',
              borderBottom: '1px solid rgba(30,41,59,0.5)',
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12,
            }}>
              <div>
                <span style={{ fontSize: 10, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Stipend</span>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#4ade80', marginTop: 1 }}>
                  {selectedDetail.stipend || formatCTC(selectedDetail.ctc, selectedDetail.currency)}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 10, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>CGPA Cut-off</span>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#38bdf8', marginTop: 1 }}>
                  {selectedDetail.cgpaCutoff && parseFloat(selectedDetail.cgpaCutoff) > 0 ? `≥ ${selectedDetail.cgpaCutoff}` : 'No Cut-off'}
                </div>
              </div>
              {selectedDetail.duration && (
                <div>
                  <span style={{ fontSize: 10, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Duration</span>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginTop: 2 }}>{selectedDetail.duration}</div>
                </div>
              )}
              {selectedDetail.location && (
                <div>
                  <span style={{ fontSize: 10, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Location</span>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginTop: 2 }}>{selectedDetail.location}</div>
                </div>
              )}
            </div>

            {/* Content Body (Scrollable) */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* Job Description */}
              {selectedDetail.jobDescription && (
                <div>
                  <h4 style={{ fontSize: 12, fontWeight: 800, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px 0' }}>
                    Job Description
                  </h4>
                  <div style={{
                    fontSize: 13, color: '#94a3b8', lineHeight: 1.6, whiteSpace: 'pre-wrap',
                    background: 'rgba(15,23,42,0.4)', borderRadius: 10, padding: 12,
                    border: '1px solid rgba(30,41,59,0.5)',
                  }}>
                    {selectedDetail.jobDescription}
                  </div>
                </div>
              )}

              {/* Skills Required */}
              {selectedDetail.skillsRequired && (
                <div>
                  <h4 style={{ fontSize: 12, fontWeight: 800, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px 0' }}>
                    Skills Required
                  </h4>
                  <div style={{
                    fontSize: 13, color: '#cbd5e1', lineHeight: 1.5,
                    background: 'rgba(15,23,42,0.4)', borderRadius: 10, padding: 12,
                    border: '1px solid rgba(30,41,59,0.5)',
                  }}>
                    {selectedDetail.skillsRequired}
                  </div>
                </div>
              )}

              {/* Selection Process */}
              {selectedDetail.selectionProcess && (
                <div>
                  <h4 style={{ fontSize: 12, fontWeight: 800, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px 0' }}>
                    Selection Process
                  </h4>
                  <div style={{
                    fontSize: 13, color: '#94a3b8', lineHeight: 1.5,
                    background: 'rgba(15,23,42,0.4)', borderRadius: 10, padding: 12,
                    border: '1px solid rgba(30,41,59,0.5)',
                  }}>
                    {selectedDetail.selectionProcess}
                  </div>
                </div>
              )}

              {/* Allowed Depts & Degrees */}
              {((selectedDetail.allowedDepts && selectedDetail.allowedDepts.length > 0) || 
                (selectedDetail.allowedDegrees && selectedDetail.allowedDegrees.length > 0)) && (
                <div>
                  <h4 style={{ fontSize: 12, fontWeight: 800, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px 0' }}>
                    Eligibility (Departments & Degrees)
                  </h4>
                  <div style={{
                    display: 'flex', flexDirection: 'column', gap: 8,
                    background: 'rgba(15,23,42,0.4)', borderRadius: 10, padding: 12,
                    border: '1px solid rgba(30,41,59,0.5)',
                  }}>
                    {selectedDetail.allowedDegrees && selectedDetail.allowedDegrees.length > 0 && (
                      <div>
                        <span style={{ fontSize: 10, color: '#475569', fontWeight: 700 }}>DEGREES:</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                          {selectedDetail.allowedDegrees.map(deg => (
                            <span key={deg} style={{ fontSize: 11, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 4, padding: '2px 6px', color: '#cbd5e1' }}>
                              {deg}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedDetail.allowedDepts && selectedDetail.allowedDepts.length > 0 && (
                      <div style={{ marginTop: 4 }}>
                        <span style={{ fontSize: 10, color: '#475569', fontWeight: 700 }}>DEPARTMENTS:</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                          {selectedDetail.allowedDepts.map(dept => (
                            <span key={dept} style={{ fontSize: 11, background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(51,65,85,0.4)', borderRadius: 4, padding: '2px 6px', color: '#94a3b8' }}>
                              {dept}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 24px', borderTop: '1px solid rgba(30,41,59,0.7)',
              background: 'rgba(3,7,18,0.6)', display: 'flex', justifyContent: 'flex-end', gap: 12,
            }}>
              <button
                onClick={() => setSelectedDetail(null)}
                style={{
                  background: 'rgba(30,41,59,0.4)', border: '1px solid rgba(51,65,85,0.4)',
                  borderRadius: 10, padding: '8px 16px', color: '#94a3b8',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                Close
              </button>
              {selectedDetail.jnfUrl && (
                <a
                  href={selectedDetail.jnfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    border: 'none', borderRadius: 10, padding: '8px 16px', color: '#fff',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer', textDecoration: 'none',
                    display: 'flex', alignItems: 'center', gap: 5,
                    boxShadow: '0 4px 12px rgba(99,102,241,0.25)',
                  }}
                >
                  Open ERP JNF page ↗
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

