import React, { useState, useEffect } from 'react';
import {
  Clock, MapPin, BookOpen, CheckCircle2,
  BellRing, Sparkles, CalendarDays, Send, BadgeAlert,
} from 'lucide-react';
import { SCHEDULE_GRID, COURSES, ClassSlot } from '../data/timetableData';
import { Reminder } from '../services/api';

interface TodaySummaryProps {
  roomPrefs: Record<string, string>;
  reminders: Reminder[];
  onAddReminderForSubject: (subjectCode: string) => void;
  onSendTestEmail: (subject: string, text: string) => void;
}

const DAY_NAMES = ['Mon','Tue','Wed','Thur','Fri'] as const;
type DayName = typeof DAY_NAMES[number];

const DAY_TO_IDX: Record<DayName, number> = { Mon:1, Tue:2, Wed:3, Thur:4, Fri:5 };
const DAY_FULL: Record<DayName, string> = { Mon:'Monday', Tue:'Tuesday', Wed:'Wednesday', Thur:'Thursday', Fri:'Friday' };

function parseTime(timeStr: string): number {
  const [time, modifier] = timeStr.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (modifier === 'PM' && hours < 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

export const TodaySummary: React.FC<TodaySummaryProps> = ({
  roomPrefs, reminders, onAddReminderForSubject, onSendTestEmail,
}) => {
  const [selectedDay, setSelectedDay] = useState<DayName>('Mon');
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15000);
    const idx = new Date().getDay();
    const map: Partial<Record<number, DayName>> = { 1:'Mon',2:'Tue',3:'Wed',4:'Thur',5:'Fri' };
    if (map[idx]) setSelectedDay(map[idx]!);
    return () => clearInterval(timer);
  }, []);

  const daySlots = SCHEDULE_GRID.filter(s => s.day === selectedDay)
    .sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime));

  const getRoom = (slot: ClassSlot) => roomPrefs[slot.subjectCode] || slot.defaultRoom;

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const isToday = DAY_TO_IDX[selectedDay] === now.getDay();

  const getStatus = (slot: ClassSlot) => {
    const s = parseTime(slot.startTime), e = parseTime(slot.endTime);
    if (!isToday) return { state: 'scheduled', label: 'Scheduled', color: '#475569' };
    if (nowMin >= s && nowMin <= e) {
      const rem = e - nowMin;
      return { state: 'ongoing', label: `● LIVE — ${rem}m left`, color: '#4ade80' };
    }
    if (nowMin < s) {
      const diff = s - nowMin;
      if (diff <= 60) return { state: 'soon', label: `⚡ In ${diff}m`, color: '#f59e0b' };
      return { state: 'upcoming', label: 'Upcoming', color: '#818cf8' };
    }
    return { state: 'done', label: '✓ Done', color: '#334155' };
  };

  const activeClass = daySlots.find(s => getStatus(s).state === 'ongoing');
  const nextClass = daySlots.find(s => ['soon','upcoming'].includes(getStatus(s).state));
  const doneCount = daySlots.filter(s => getStatus(s).state === 'done').length;
  const totalCount = daySlots.length;
  const progressPct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Hero Banner ─────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(15,23,42,0.97) 0%, rgba(30,27,75,0.9) 50%, rgba(15,23,42,0.97) 100%)',
        border: '1px solid rgba(99,102,241,0.3)',
        borderRadius: 22,
        padding: '24px 28px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Glow blobs */}
        <div style={{ position:'absolute', top:-60, right:-60, width:250, height:250, borderRadius:'50%', background:'rgba(99,102,241,0.08)', filter:'blur(60px)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:-40, left:-40, width:180, height:180, borderRadius:'50%', background:'rgba(74,222,128,0.05)', filter:'blur(50px)', pointerEvents:'none' }} />

        {/* Top row: title + active class card */}
        <div style={{ display:'flex', flexWrap:'wrap', alignItems:'flex-start', justifyContent:'space-between', gap:20, marginBottom: 24 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
              <Sparkles size={14} style={{ color:'#4ade80' }} />
              <span style={{ color:'#818cf8', fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase' }}>
                Autumn 2026-2027
              </span>
            </div>
            <h1 style={{ fontSize:26, fontWeight:800, color:'#f8fafc', fontFamily:'Outfit, sans-serif', margin:0, lineHeight:1.2 }}>
              Today's Classes
            </h1>
            <p style={{ margin:'6px 0 0', fontSize:12, color:'#64748b', display:'flex', alignItems:'center', gap:8 }}>
              <CalendarDays size={13} style={{ color:'#475569' }} />
              <span style={{ color:'#94a3b8' }}>
                {now.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'short', year:'numeric' })}
              </span>
              <span style={{ color:'#4ade80', fontFamily:'monospace', fontWeight:700 }}>
                {now.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}
              </span>
            </p>
          </div>

          {/* Active / Next class widget */}
          {activeClass ? (
            <div style={{
              background:'rgba(74,222,128,0.08)', border:'1px solid rgba(74,222,128,0.35)',
              borderRadius:16, padding:'14px 18px', minWidth:240, maxWidth:320,
              display:'flex', alignItems:'center', gap:14,
              boxShadow:'0 0 30px rgba(74,222,128,0.1)',
            }}>
              <div style={{ width:46, height:46, borderRadius:12, background:'rgba(74,222,128,0.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <BellRing size={22} style={{ color:'#4ade80' }} />
              </div>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:10, fontWeight:800, color:'#4ade80', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:3 }}>
                  Live Now
                </div>
                <div style={{ fontSize:14, fontWeight:800, color:'#f1f5f9', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', fontFamily:'Outfit, sans-serif' }}>
                  {COURSES[activeClass.subjectCode]?.name}
                </div>
                <div style={{ fontSize:11, color:'#94a3b8', marginTop:2, display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ color:'#4ade80', fontFamily:'monospace', fontWeight:700 }}>{activeClass.subjectCode}</span>
                  <span style={{ background:'rgba(74,222,128,0.15)', color:'#4ade80', border:'1px solid rgba(74,222,128,0.3)', borderRadius:6, padding:'1px 7px', fontSize:10, fontWeight:700, display:'flex', alignItems:'center', gap:3 }}>
                    <MapPin size={9} /> {getRoom(activeClass)}
                  </span>
                </div>
              </div>
            </div>
          ) : nextClass ? (
            <div style={{
              background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.3)',
              borderRadius:16, padding:'14px 18px', minWidth:240, maxWidth:320,
              display:'flex', alignItems:'center', gap:14,
            }}>
              <div style={{ width:46, height:46, borderRadius:12, background:'rgba(99,102,241,0.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Clock size={20} style={{ color:'#818cf8' }} />
              </div>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:10, fontWeight:800, color:'#818cf8', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:3 }}>
                  Next Up
                </div>
                <div style={{ fontSize:14, fontWeight:800, color:'#f1f5f9', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', fontFamily:'Outfit, sans-serif' }}>
                  {COURSES[nextClass.subjectCode]?.name}
                </div>
                <div style={{ fontSize:11, color:'#94a3b8', marginTop:2, display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontFamily:'monospace', fontWeight:700, color:'#a5b4fc' }}>{nextClass.startTime}</span>
                  <span style={{ background:'rgba(99,102,241,0.15)', color:'#818cf8', borderRadius:6, padding:'1px 7px', fontSize:10, fontWeight:700, display:'flex', alignItems:'center', gap:3 }}>
                    <MapPin size={9} /> {getRoom(nextClass)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              background:'rgba(15,23,42,0.7)', border:'1px solid rgba(30,41,59,0.7)',
              borderRadius:16, padding:'14px 18px', minWidth:200,
              display:'flex', alignItems:'center', gap:12,
            }}>
              <CheckCircle2 size={28} style={{ color:'#4ade80', flexShrink:0 }} />
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:'#94a3b8' }}>No Active Class</div>
                <div style={{ fontSize:11, color:'#475569', marginTop:2 }}>Free slot / all done</div>
              </div>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {totalCount > 0 && isToday && (
          <div style={{ marginBottom:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <span style={{ fontSize:11, color:'#64748b', fontWeight:600 }}>Day Progress</span>
              <span style={{ fontSize:11, color:'#818cf8', fontWeight:700, fontFamily:'monospace' }}>{doneCount}/{totalCount} classes done</span>
            </div>
            <div style={{ height:6, background:'rgba(30,41,59,0.8)', borderRadius:10, overflow:'hidden' }}>
              <div style={{
                height:'100%', width:`${progressPct}%`,
                background:'linear-gradient(90deg, #6366f1, #4ade80)',
                borderRadius:10, transition:'width 0.5s ease',
              }} />
            </div>
          </div>
        )}

        {/* Day Switcher */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap', borderTop:'1px solid rgba(30,41,59,0.6)', paddingTop:18 }}>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {DAY_NAMES.map(day => {
              const count = SCHEDULE_GRID.filter(s => s.day === day).length;
              const active = selectedDay === day;
              const isTodayDay = DAY_TO_IDX[day] === now.getDay();
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  style={{
                    padding:'8px 16px', borderRadius:12, fontSize:12, fontWeight:700,
                    cursor:'pointer', transition:'all 0.15s', display:'flex', alignItems:'center', gap:7,
                    border: active ? '1px solid rgba(99,102,241,0.6)' : '1px solid rgba(30,41,59,0.7)',
                    background: active ? 'rgba(99,102,241,0.2)' : 'rgba(15,23,42,0.6)',
                    color: active ? '#a5b4fc' : '#475569',
                    boxShadow: active ? '0 0 12px rgba(99,102,241,0.15)' : 'none',
                    position:'relative',
                  }}
                >
                  {isTodayDay && (
                    <span style={{ width:6, height:6, borderRadius:'50%', background:'#4ade80', display:'inline-block', flexShrink:0 }} />
                  )}
                  <span>{DAY_FULL[day].substring(0,3)}</span>
                  <span style={{
                    fontSize:9, fontWeight:800, background: active ? 'rgba(99,102,241,0.3)' : 'rgba(30,41,59,0.6)',
                    color: active ? '#c7d2fe' : '#334155', borderRadius:20, padding:'1px 6px', fontFamily:'monospace',
                  }}>{count}</span>
                </button>
              );
            })}
          </div>
          <div style={{ fontSize:11, color:'#475569' }}>
            <span>NC241 & NC231 Defaulted</span>
          </div>
        </div>
      </div>

      {/* ── Class Cards ──────────────────────────────────────────── */}
      {daySlots.length === 0 ? (
        <div style={{
          background:'rgba(15,23,42,0.5)', border:'1px solid rgba(30,41,59,0.5)',
          borderRadius:18, padding:'48px 24px', textAlign:'center',
        }}>
          <CalendarDays size={40} style={{ color:'#1e293b', margin:'0 auto 12px', display:'block' }} />
          <h3 style={{ fontSize:16, fontWeight:700, color:'#475569', margin:'0 0 6px' }}>No Classes Scheduled</h3>
          <p style={{ fontSize:12, color:'#334155', margin:0 }}>Enjoy the free day or use it for self-study!</p>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:14 }}>
          {daySlots.map(slot => {
            const course = COURSES[slot.subjectCode];
            const room = getRoom(slot);
            const st = getStatus(slot);
            const subjectReminders = reminders.filter(r => r.subject_code === slot.subjectCode && r.status === 'pending');

            const borderColor = st.state === 'ongoing'
              ? 'rgba(74,222,128,0.5)'
              : st.state === 'soon'
              ? 'rgba(245,158,11,0.45)'
              : st.state === 'done'
              ? 'rgba(30,41,59,0.5)'
              : 'rgba(51,65,85,0.4)';

            const cardBg = st.state === 'ongoing'
              ? 'rgba(74,222,128,0.04)'
              : st.state === 'done'
              ? 'rgba(15,23,42,0.4)'
              : 'rgba(15,23,42,0.85)';

            return (
              <div key={slot.id} style={{
                background: cardBg,
                border: `1px solid ${borderColor}`,
                borderRadius: 18,
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                transition: 'all 0.15s',
                opacity: st.state === 'done' ? 0.65 : 1,
                position: 'relative',
                overflow: 'hidden',
              }}>
                {/* Color strip */}
                <div style={{
                  position:'absolute', top:0, left:20, right:20, height:3,
                  borderRadius:'0 0 4px 4px',
                  background: course?.color || '#6366f1',
                  opacity: st.state === 'done' ? 0.3 : 1,
                }} />

                {/* Header row */}
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10, marginTop:4 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:5 }}>
                      <span style={{
                        fontSize:11, fontWeight:800, fontFamily:'Outfit, sans-serif',
                        padding:'2px 8px', borderRadius:6, color:'#fff',
                        background: course?.color || '#6366f1',
                        opacity: st.state === 'done' ? 0.6 : 1,
                      }}>{course?.shortName || slot.subjectCode}</span>
                      <span style={{ fontSize:10, color:'#475569', background:'rgba(30,41,59,0.7)', borderRadius:6, padding:'1px 6px', textTransform:'uppercase', letterSpacing:'0.04em' }}>
                        {course?.type}
                      </span>
                    </div>
                    <h3 style={{
                      fontSize:14, fontWeight:800, color: st.state === 'done' ? '#475569' : '#f1f5f9',
                      margin:0, lineHeight:1.3, fontFamily:'Outfit, sans-serif',
                      textDecoration: st.state === 'done' ? 'line-through' : 'none',
                      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                    }}>
                      {course?.name}
                    </h3>
                  </div>

                  {/* Status badge */}
                  <span style={{
                    fontSize:10, fontWeight:800, letterSpacing:'0.04em',
                    padding:'4px 10px', borderRadius:20, whiteSpace:'nowrap', flexShrink:0,
                    color: st.color,
                    background: `${st.color}14`,
                    border: `1px solid ${st.color}35`,
                  }}>
                    {st.label}
                  </span>
                </div>

                {/* Time + Room grid */}
                <div style={{
                  display:'grid', gridTemplateColumns:'1fr 1fr',
                  gap:8, background:'rgba(3,7,18,0.5)',
                  borderRadius:12, padding:'10px 14px',
                  border:'1px solid rgba(30,41,59,0.6)',
                }}>
                  <div>
                    <div style={{ fontSize:9, color:'#475569', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:3 }}>Time Slot</div>
                    <div style={{ fontSize:12, fontWeight:700, color:'#cbd5e1', fontFamily:'monospace', display:'flex', alignItems:'center', gap:4 }}>
                      <Clock size={11} style={{ color:'#818cf8' }} />
                      {slot.startTime} – {slot.endTime}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize:9, color:'#475569', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:3 }}>Venue</div>
                    <div style={{ fontSize:12, fontWeight:800, color:'#4ade80', display:'flex', alignItems:'center', gap:4 }}>
                      <MapPin size={11} style={{ color:'#4ade80' }} />
                      {room}
                    </div>
                  </div>
                </div>

                {/* Pending reminders */}
                {subjectReminders.length > 0 && (
                  <div style={{
                    background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.28)',
                    borderRadius:10, padding:'8px 12px',
                    display:'flex', alignItems:'center', justifyContent:'space-between', gap:8,
                  }}>
                    <div style={{ display:'flex', alignItems:'center', gap:7, minWidth:0 }}>
                      <BadgeAlert size={13} style={{ color:'#f59e0b', flexShrink:0 }} />
                      <span style={{ fontSize:11, color:'#fcd34d', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {subjectReminders[0].title}
                      </span>
                    </div>
                    <span style={{ fontSize:10, fontWeight:800, color:'#f59e0b', background:'rgba(245,158,11,0.15)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:20, padding:'2px 8px', fontFamily:'monospace', flexShrink:0 }}>
                      {subjectReminders.length} pending
                    </span>
                  </div>
                )}

                {/* LTP info */}
                <div style={{ fontSize:10, color:'#334155', display:'flex', gap:8 }}>
                  <span>L-T-P: <strong style={{ color:'#475569' }}>{course?.ltp}</strong></span>
                  <span>•</span>
                  <span>Credits: <strong style={{ color:'#818cf8' }}>{course?.credits}</strong></span>
                </div>

                {/* Actions */}
                <div style={{ display:'flex', gap:8, paddingTop:10, borderTop:'1px solid rgba(30,41,59,0.5)' }}>
                  <button
                    onClick={() => onAddReminderForSubject(slot.subjectCode)}
                    style={{
                      flex:1, padding:'8px 12px', borderRadius:10, fontSize:11, fontWeight:700,
                      background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.3)',
                      color:'#a5b4fc', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                      transition:'all 0.12s',
                    }}
                  >
                    <BookOpen size={13} /> Add Task
                  </button>
                  <button
                    onClick={() => onSendTestEmail(
                      `Class Alert: ${slot.subjectCode} – ${course?.name}`,
                      `Reminder for ${course?.name} (${slot.subjectCode}) at ${slot.startTime} in ${room}.`
                    )}
                    style={{
                      padding:'8px 12px', borderRadius:10, fontSize:11, fontWeight:700,
                      background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.25)',
                      color:'#818cf8', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                      transition:'all 0.12s',
                    }}
                    title="Send Gmail Alert"
                  >
                    <Send size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
