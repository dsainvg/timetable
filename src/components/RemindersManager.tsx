import React, { useState } from 'react';
import { Bell, Plus, Trash2, CheckCircle2, Send, BookOpen, Calendar, X, AlertTriangle } from 'lucide-react';
import { Reminder } from '../services/api';
import { COURSES } from '../data/timetableData';

interface RemindersManagerProps {
  reminders: Reminder[];
  onSaveReminder: (reminder: Omit<Reminder, 'id' | 'created_at'> & { id?: string }) => void;
  onDeleteReminder: (id: string) => void;
  onToggleReminderStatus: (id: string) => void;
  onSendEmail: (subject: string, text: string) => void;
  initialSubjectFilter?: string;
}

const TYPE_CONFIG = {
  assignment: { emoji: '📝', color: '#818cf8', bg: 'rgba(99,102,241,0.1)' },
  class:       { emoji: '🎓', color: '#38bdf8', bg: 'rgba(56,189,248,0.1)' },
  exam:        { emoji: '📋', color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
  project:     { emoji: '🚀', color: '#fb923c', bg: 'rgba(251,146,60,0.1)' },
  other:       { emoji: '📌', color: '#94a3b8', bg: 'rgba(148,163,184,0.08)' },
};

const PRIORITY_CONFIG = {
  high:   { color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.35)', label: '🔴 High' },
  medium: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.35)',  label: '🟡 Medium' },
  low:    { color: '#818cf8', bg: 'rgba(99,102,241,0.1)',   border: 'rgba(99,102,241,0.3)',   label: '🔵 Low' },
};

function getDaysLeft(dueDate: string): { days: number; urgent: boolean; text: string } {
  const due = new Date(dueDate).getTime();
  const now = new Date().getTime();
  const diff = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { days: diff, urgent: true, text: `${Math.abs(diff)}d overdue` };
  if (diff === 0) return { days: 0, urgent: true, text: 'Due today!' };
  if (diff === 1) return { days: 1, urgent: true, text: 'Due tomorrow' };
  return { days: diff, urgent: diff <= 3, text: `${diff}d left` };
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(3,7,18,0.8)',
  border: '1px solid rgba(51,65,85,0.7)',
  borderRadius: 10,
  padding: '9px 12px',
  color: '#e2e8f0',
  fontSize: 12,
  outline: 'none',
  fontFamily: 'Inter, sans-serif',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
};

export const RemindersManager: React.FC<RemindersManagerProps> = ({
  reminders, onSaveReminder, onDeleteReminder, onToggleReminderStatus, onSendEmail,
  initialSubjectFilter = 'all',
}) => {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [filterSubject, setFilterSubject] = useState(initialSubjectFilter);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed'>('pending');

  const [formTitle, setFormTitle] = useState('');
  const [formSubject, setFormSubject] = useState(Object.keys(COURSES)[0] || 'CS61064');
  const [formType, setFormType] = useState<keyof typeof TYPE_CONFIG>('assignment');
  const [formDueDate, setFormDueDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 2); return d.toISOString().split('T')[0];
  });
  const [formDueTime, setFormDueTime] = useState('23:59');
  const [formPriority, setFormPriority] = useState<'high' | 'medium' | 'low'>('high');
  const [formSendEmail, setFormSendEmail] = useState(true);
  const [formDesc, setFormDesc] = useState('');

  const resetForm = () => { setFormTitle(''); setFormDesc(''); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;
    onSaveReminder({ title: formTitle, subject_code: formSubject, type: formType, due_date: formDueDate, due_time: formDueTime, priority: formPriority, status: 'pending', send_email: formSendEmail, description: formDesc });
    if (formSendEmail) onSendEmail(`NEW: ${formTitle} (${formSubject})`, `Reminder: ${formTitle}\nSubject: ${formSubject}\nDue: ${formDueDate} ${formDueTime}\nPriority: ${formPriority}`);
    resetForm();
    setIsAddOpen(false);
  };

  const filtered = reminders.filter(r => {
    if (filterSubject !== 'all' && r.subject_code !== filterSubject) return false;
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    return true;
  }).sort((a, b) => {
    if (a.status === 'completed' && b.status !== 'completed') return 1;
    if (b.status === 'completed' && a.status !== 'completed') return -1;
    const pa = { high:0,medium:1,low:2 }[a.priority] ?? 2;
    const pb = { high:0,medium:1,low:2 }[b.priority] ?? 2;
    return pa - pb;
  });

  const pendingCount = reminders.filter(r => r.status === 'pending').length;
  const overdueCount = reminders.filter(r => r.status === 'pending' && getDaysLeft(r.due_date).days < 0).length;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* ── Header ──────────────────────────────────────────────── */}
      <div style={{
        background:'linear-gradient(135deg, rgba(15,23,42,0.97) 0%, rgba(25,20,60,0.9) 100%)',
        border:'1px solid rgba(99,102,241,0.25)', borderRadius:20,
        padding:'20px 24px', position:'relative', overflow:'hidden',
      }}>
        <div style={{ position:'absolute', top:-50, right:-50, width:200, height:200, borderRadius:'50%', background:'rgba(245,158,11,0.05)', filter:'blur(50px)', pointerEvents:'none' }} />

        <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between', gap:16 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
              <Bell size={14} style={{ color:'#f59e0b' }} />
              <span style={{ color:'#f59e0b', fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase' }}>
                Assignment & Class Reminders
              </span>
            </div>
            <h2 style={{ fontSize:22, fontWeight:800, color:'#f8fafc', fontFamily:'Outfit, sans-serif', margin:0 }}>
              Tasks & Submissions Portal
            </h2>
            <p style={{ fontSize:11, color:'#475569', marginTop:4 }}>
              Synced • Email Alerts to <strong style={{ color:'#818cf8', fontFamily:'monospace' }}>sai@dsainvg.me</strong>
            </p>
          </div>

          <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
            {/* Stat pills */}
            {[
              { l:'Pending', v:pendingCount, c:'#f59e0b' },
              { l:'Overdue', v:overdueCount, c:'#f87171' },
            ].map(s => (
              <div key={s.l} style={{ background:'rgba(3,7,18,0.7)', border:'1px solid rgba(30,41,59,0.7)', borderRadius:12, padding:'8px 14px', textAlign:'center' }}>
                <div style={{ fontSize:20, fontWeight:800, color:s.c, fontFamily:'Outfit, sans-serif' }}>{s.v}</div>
                <div style={{ fontSize:9, color:'#475569', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em', marginTop:1 }}>{s.l}</div>
              </div>
            ))}

            <button
              onClick={() => setIsAddOpen(true)}
              style={{
                padding:'10px 20px', borderRadius:14, fontSize:13, fontWeight:800, cursor:'pointer',
                background:'linear-gradient(135deg, #6366f1, #7c3aed)',
                border:'1px solid rgba(99,102,241,0.5)', color:'#fff',
                boxShadow:'0 4px 20px rgba(99,102,241,0.3)',
                display:'flex', alignItems:'center', gap:8, transition:'all 0.15s',
              }}
            >
              <Plus size={16} /> New Reminder
            </button>
          </div>
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────────── */}
      <div style={{
        background:'rgba(15,23,42,0.8)', border:'1px solid rgba(30,41,59,0.7)',
        borderRadius:14, padding:'12px 16px',
        display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between', gap:12,
      }}>
        <div style={{ display:'flex', gap:6 }}>
          {(['pending','completed','all'] as const).map(st => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              style={{
                padding:'6px 14px', borderRadius:8, fontSize:11, fontWeight:700, cursor:'pointer', transition:'all 0.12s',
                background: filterStatus === st ? 'rgba(99,102,241,0.2)' : 'transparent',
                border: filterStatus === st ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(51,65,85,0.4)',
                color: filterStatus === st ? '#a5b4fc' : '#475569',
                textTransform:'capitalize',
              }}
            >
              {st === 'pending' ? '⏳ Pending' : st === 'completed' ? '✓ Completed' : 'All'}
            </button>
          ))}
        </div>

        <select
          value={filterSubject}
          onChange={e => setFilterSubject(e.target.value)}
          style={{
            background:'rgba(3,7,18,0.8)', border:'1px solid rgba(51,65,85,0.6)',
            borderRadius:10, padding:'7px 12px', color:'#cbd5e1', fontSize:11,
            fontFamily:'monospace', outline:'none', cursor:'pointer',
          }}
        >
          <option value="all">All Subjects</option>
          {Object.keys(COURSES).map(code => (
            <option key={code} value={code}>{code} — {COURSES[code].name.substring(0,22)}…</option>
          ))}
        </select>
      </div>

      {/* ── Reminder Cards ──────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div style={{ background:'rgba(15,23,42,0.5)', border:'1px solid rgba(30,41,59,0.5)', borderRadius:18, padding:'48px 24px', textAlign:'center' }}>
          <CheckCircle2 size={40} style={{ color:'#4ade80', margin:'0 auto 12px', display:'block' }} />
          <h3 style={{ fontSize:16, fontWeight:700, color:'#4ade80', margin:'0 0 6px' }}>All Clear!</h3>
          <p style={{ fontSize:12, color:'#334155', margin:'0 0 16px' }}>No reminders match this filter.</p>
          <button
            onClick={() => setIsAddOpen(true)}
            style={{
              padding:'9px 20px', borderRadius:12, fontSize:12, fontWeight:700, cursor:'pointer',
              background:'rgba(99,102,241,0.15)', border:'1px solid rgba(99,102,241,0.4)', color:'#818cf8',
            }}
          >
            + Add First Reminder
          </button>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:14 }}>
          {filtered.map(rem => {
            const course = COURSES[rem.subject_code];
            const isDone = rem.status === 'completed';
            const pCfg = PRIORITY_CONFIG[rem.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.low;
            const tCfg = TYPE_CONFIG[rem.type as keyof typeof TYPE_CONFIG] || TYPE_CONFIG.other;
            const dl = getDaysLeft(rem.due_date);

            return (
              <div key={rem.id} style={{
                background: isDone ? 'rgba(15,23,42,0.4)' : 'rgba(15,23,42,0.9)',
                border: isDone
                  ? '1px solid rgba(30,41,59,0.4)'
                  : rem.priority === 'high'
                  ? '1px solid rgba(248,113,113,0.35)'
                  : '1px solid rgba(51,65,85,0.5)',
                borderRadius:18, padding:'18px 20px',
                display:'flex', flexDirection:'column', gap:12,
                opacity: isDone ? 0.6 : 1,
                transition:'all 0.15s',
                position:'relative', overflow:'hidden',
              }}>
                {/* Priority accent strip */}
                {!isDone && (
                  <div style={{
                    position:'absolute', top:0, left:0, right:0, height:3,
                    background: pCfg.color, borderRadius:'18px 18px 0 0',
                    opacity: 0.7,
                  }} />
                )}

                {/* Top row: checkbox + subject code + priority + delete */}
                <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:2 }}>
                  <button
                    onClick={() => onToggleReminderStatus(rem.id)}
                    style={{
                      width:22, height:22, borderRadius:7, flexShrink:0, cursor:'pointer',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      border: isDone ? '2px solid #4ade80' : '2px solid rgba(51,65,85,0.8)',
                      background: isDone ? 'rgba(74,222,128,0.2)' : 'transparent',
                      color: isDone ? '#4ade80' : 'transparent',
                      transition:'all 0.15s',
                    }}
                  >
                    <CheckCircle2 size={13} strokeWidth={3} />
                  </button>

                  <span style={{
                    fontSize:10, fontWeight:800, fontFamily:'monospace',
                    background: course?.color || '#6366f1',
                    color:'#fff', borderRadius:6, padding:'2px 7px',
                    opacity: isDone ? 0.5 : 1,
                  }}>{rem.subject_code}</span>

                  <span style={{
                    fontSize:10, fontWeight:700,
                    background: tCfg.bg, color: tCfg.color,
                    borderRadius:6, padding:'2px 7px',
                  }}>{tCfg.emoji} {rem.type}</span>

                  <span style={{
                    marginLeft:'auto', fontSize:10, fontWeight:800,
                    background: pCfg.bg, color: pCfg.color,
                    border:`1px solid ${pCfg.border}`, borderRadius:20, padding:'2px 8px',
                  }}>{pCfg.label}</span>

                  <button
                    onClick={() => onDeleteReminder(rem.id)}
                    style={{ background:'transparent', border:'none', cursor:'pointer', color:'#334155', padding:4, borderRadius:6, lineHeight:1, transition:'color 0.12s' }}
                    title="Delete"
                    onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#334155')}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Title */}
                <h3 style={{
                  fontSize:14, fontWeight:800, color: isDone ? '#334155' : '#f1f5f9',
                  fontFamily:'Outfit, sans-serif', margin:0, lineHeight:1.3,
                  textDecoration: isDone ? 'line-through' : 'none',
                }}>
                  {rem.title}
                </h3>

                {rem.description && (
                  <p style={{ fontSize:11, color:'#475569', margin:0, lineHeight:1.5, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
                    {rem.description}
                  </p>
                )}

                {/* Due date row */}
                <div style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  background:'rgba(3,7,18,0.5)', borderRadius:10, padding:'8px 12px',
                  border:'1px solid rgba(30,41,59,0.6)',
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7, fontSize:11 }}>
                    <Calendar size={12} style={{ color:'#6366f1', flexShrink:0 }} />
                    <span style={{ color:'#94a3b8' }}>
                      Due: <strong style={{ color:'#e2e8f0', fontFamily:'monospace' }}>{rem.due_date}</strong>
                      <span style={{ color:'#475569' }}> at </span>
                      <strong style={{ color:'#e2e8f0', fontFamily:'monospace' }}>{rem.due_time}</strong>
                    </span>
                  </div>
                  {!isDone && (
                    <span style={{
                      fontSize:10, fontWeight:800,
                      color: dl.urgent ? '#f87171' : '#64748b',
                      background: dl.urgent ? 'rgba(248,113,113,0.1)' : 'rgba(30,41,59,0.5)',
                      border: dl.urgent ? '1px solid rgba(248,113,113,0.3)' : '1px solid rgba(30,41,59,0.5)',
                      borderRadius:20, padding:'2px 8px', fontFamily:'monospace',
                      display:'flex', alignItems:'center', gap:4,
                    }}>
                      {dl.urgent && <AlertTriangle size={9} />}
                      {dl.text}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display:'flex', gap:8, paddingTop:8, borderTop:'1px solid rgba(30,41,59,0.5)' }}>
                  <button
                    onClick={() => onSendEmail(
                      `REMINDER: ${rem.title} (${rem.subject_code})`,
                      `Task: ${rem.title}\nSubject: ${rem.subject_code}\nDue: ${rem.due_date} ${rem.due_time}\nPriority: ${rem.priority}\nDetails: ${rem.description || 'N/A'}`
                    )}
                    style={{
                      flex:1, padding:'8px', borderRadius:10, fontSize:11, fontWeight:700, cursor:'pointer',
                      background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.3)',
                      color:'#818cf8', display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                      transition:'all 0.12s',
                    }}
                  >
                    <Send size={12} /> Send Gmail Alert
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add Modal ────────────────────────────────────────────── */}
      {isAddOpen && (
        <div style={{
          position:'fixed', inset:0, zIndex:50,
          background:'rgba(3,7,18,0.88)', backdropFilter:'blur(14px)',
          display:'flex', alignItems:'center', justifyContent:'center', padding:16,
        }}
          onClick={e => { if (e.target === e.currentTarget) setIsAddOpen(false); }}
        >
          <div style={{
            background:'#0f172a', borderRadius:22, padding:28,
            width:'100%', maxWidth:460, maxHeight:'90vh', overflowY:'auto',
            border:'1px solid rgba(99,102,241,0.35)',
            boxShadow:'0 25px 50px rgba(0,0,0,0.6)',
            animation:'fadeIn 0.22s ease',
          }}>
            {/* Modal header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:36, height:36, borderRadius:10, background:'rgba(99,102,241,0.2)', border:'1px solid rgba(99,102,241,0.4)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <BookOpen size={16} style={{ color:'#818cf8' }} />
                </div>
                <span style={{ fontSize:17, fontWeight:800, color:'#f8fafc', fontFamily:'Outfit, sans-serif' }}>
                  Create Reminder
                </span>
              </div>
              <button
                onClick={() => setIsAddOpen(false)}
                style={{ background:'rgba(30,41,59,0.7)', border:'1px solid rgba(51,65,85,0.5)', borderRadius:10, padding:7, cursor:'pointer', color:'#64748b', lineHeight:1 }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {/* Title */}
              <div>
                <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>
                  Title / Task *
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Compilers Assignment 2 Submission"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Subject + Type */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Subject</label>
                  <select value={formSubject} onChange={e => setFormSubject(e.target.value)} style={{ ...inputStyle, cursor:'pointer' }}>
                    {Object.keys(COURSES).map(code => (
                      <option key={code} value={code}>{code}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Type</label>
                  <select value={formType} onChange={e => setFormType(e.target.value as any)} style={{ ...inputStyle, cursor:'pointer' }}>
                    {Object.keys(TYPE_CONFIG).map(t => (
                      <option key={t} value={t}>{TYPE_CONFIG[t as keyof typeof TYPE_CONFIG].emoji} {t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Due date + time */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Due Date</label>
                  <input required type="date" value={formDueDate} onChange={e => setFormDueDate(e.target.value)} style={{ ...inputStyle, colorScheme:'dark' }} />
                </div>
                <div>
                  <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Due Time</label>
                  <select value={formDueTime} onChange={e => setFormDueTime(e.target.value)} style={{ ...inputStyle, cursor:'pointer' }}>
                    {[
                      { v:'08:00', l:'08:00 AM' },
                      { v:'09:00', l:'09:00 AM' },
                      { v:'10:00', l:'10:00 AM' },
                      { v:'11:00', l:'11:00 AM' },
                      { v:'12:00', l:'12:00 PM' },
                      { v:'13:00', l:'01:00 PM' },
                      { v:'14:00', l:'02:00 PM' },
                      { v:'15:00', l:'03:00 PM' },
                      { v:'16:00', l:'04:00 PM' },
                      { v:'17:00', l:'05:00 PM' },
                      { v:'18:00', l:'06:00 PM' },
                      { v:'19:00', l:'07:00 PM' },
                      { v:'20:00', l:'08:00 PM' },
                      { v:'21:00', l:'09:00 PM' },
                      { v:'22:00', l:'10:00 PM' },
                      { v:'23:59', l:'11:59 PM (End of Day)' },
                    ].map(t => (
                      <option key={t.v} value={t.v}>{t.l}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Priority */}
              <div>
                <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Priority</label>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                  {(['high','medium','low'] as const).map(p => {
                    const cfg = PRIORITY_CONFIG[p];
                    const isActive = formPriority === p;
                    return (
                      <button
                        key={p} type="button"
                        onClick={() => setFormPriority(p)}
                        style={{
                          padding:'9px 6px', borderRadius:10, fontSize:11, fontWeight:800, cursor:'pointer',
                          transition:'all 0.12s',
                          background: isActive ? cfg.bg : 'rgba(15,23,42,0.7)',
                          border: isActive ? `1px solid ${cfg.border}` : '1px solid rgba(51,65,85,0.5)',
                          color: isActive ? cfg.color : '#334155',
                        }}
                      >
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={{ display:'block', fontSize:10, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Notes / Details</label>
                <textarea
                  rows={2}
                  placeholder="Optional: instructions, links, room numbers..."
                  value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                  style={{ ...inputStyle, resize:'vertical' }}
                />
              </div>

              {/* Email toggle */}
              <label style={{
                display:'flex', alignItems:'center', gap:10,
                background:'rgba(99,102,241,0.07)', border:'1px solid rgba(99,102,241,0.25)',
                borderRadius:12, padding:'11px 14px', cursor:'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={formSendEmail}
                  onChange={e => setFormSendEmail(e.target.checked)}
                  style={{ width:15, height:15, cursor:'pointer', accentColor:'#6366f1' }}
                />
                <span style={{ fontSize:12, color:'#94a3b8' }}>
                  Send immediate email alert to <strong style={{ color:'#818cf8' }}>sai@dsainvg.me</strong>
                </span>
              </label>

              {/* Submit */}
              <button
                type="submit"
                style={{
                  width:'100%', padding:'12px', borderRadius:14, fontSize:13, fontWeight:800, cursor:'pointer',
                  background:'linear-gradient(135deg, #6366f1, #7c3aed)',
                  border:'1px solid rgba(99,102,241,0.5)', color:'#fff',
                  boxShadow:'0 4px 20px rgba(99,102,241,0.3)',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  transition:'all 0.15s',
                }}
              >
                <Plus size={16} /> Save Reminder
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
