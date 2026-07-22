import React, { useState } from 'react';
import { MapPin, Layers, Building, SlidersHorizontal, X } from 'lucide-react';
import { COURSES, TIME_SLOTS, SCHEDULE_GRID, ClassSlot, Course } from '../data/timetableData';

interface WeeklyTimetableProps {
  roomPrefs: Record<string, string>;
  onToggleRoom: (subjectCode: string, room: string) => void;
}

const DAYS = ['Mon','Tue','Wed','Thur','Fri'] as const;
type Day = typeof DAYS[number];
const DAY_FULL: Record<Day, string> = { Mon:'Monday', Tue:'Tuesday', Wed:'Wednesday', Thur:'Thursday', Fri:'Friday' };

export const WeeklyTimetable: React.FC<WeeklyTimetableProps> = ({ roomPrefs, onToggleRoom }) => {
  const [selectedCourse, setSelectedCourse] = useState<{ course: Course; slot: ClassSlot } | null>(null);

  const getSlotRoom = (slot: ClassSlot) => roomPrefs[slot.subjectCode] || slot.defaultRoom;

  const getSlotForCell = (day: string, slotIndex: number): ClassSlot | undefined =>
    SCHEDULE_GRID.find(s => {
      if (s.day !== day) return false;
      if (s.labSpan) return slotIndex >= s.slotIndex && slotIndex < s.slotIndex + s.labSpan;
      return s.slotIndex === slotIndex;
    });

  const todayDay = (() => {
    const d = new Date().getDay();
    const map: Record<number, Day | undefined> = { 1:'Mon', 2:'Tue', 3:'Wed', 4:'Thur', 5:'Fri' };
    return map[d];
  })();

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* ── Header + Room Toggles ─────────────────────────────── */}
      <div style={{
        background:'rgba(15,23,42,0.95)', border:'1px solid rgba(30,41,59,0.8)',
        borderRadius:18, padding:'20px 24px',
        display:'flex', flexWrap:'wrap', alignItems:'flex-start', justifyContent:'space-between', gap:20,
      }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:4 }}>
            <Layers size={14} style={{ color:'#818cf8' }} />
            <span style={{ color:'#818cf8', fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase' }}>
              Interactive Slot Matrix
            </span>
          </div>
          <h2 style={{ fontSize:22, fontWeight:800, color:'#f8fafc', fontFamily:'Outfit, sans-serif', margin:0 }}>
            Weekly Timetable
          </h2>
          <p style={{ fontSize:11, color:'#475569', marginTop:4 }}>
            Click any class cell to view details & change room
          </p>
        </div>

        {/* Room preference controls */}
        <div style={{
          background:'rgba(3,7,18,0.7)', border:'1px solid rgba(30,41,59,0.8)',
          borderRadius:14, padding:'12px 16px',
          display:'flex', flexWrap:'wrap', alignItems:'center', gap:12,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#475569', fontWeight:700 }}>
            <SlidersHorizontal size={12} style={{ color:'#6366f1' }} />
            Multi-Slot Rooms:
          </div>

          {/* CS31007 / CS31003 toggle */}
          <div style={{ display:'flex', alignItems:'center', gap:4, background:'rgba(15,23,42,0.8)', border:'1px solid rgba(30,41,59,0.6)', borderRadius:10, padding:4 }}>
            <span style={{ fontSize:10, fontFamily:'monospace', color:'#64748b', padding:'0 6px', fontWeight:700 }}>CS31007/003:</span>
            {['NC241','NC244/242'].map(r => {
              const isActive = r === 'NC241'
                ? (roomPrefs['CS31007'] || 'NC241') === 'NC241'
                : (roomPrefs['CS31007'] || 'NC241') !== 'NC241';
              return (
                <button
                  key={r}
                  onClick={() => {
                    if (r === 'NC241') { onToggleRoom('CS31007','NC241'); onToggleRoom('CS31003','NC241'); }
                    else { onToggleRoom('CS31007','NC244'); onToggleRoom('CS31003','NC242'); }
                  }}
                  style={{
                    padding:'4px 10px', borderRadius:8, fontSize:10, fontWeight:700, cursor:'pointer',
                    transition:'all 0.12s',
                    background: isActive ? 'rgba(99,102,241,0.25)' : 'transparent',
                    border: isActive ? '1px solid rgba(99,102,241,0.5)' : '1px solid transparent',
                    color: isActive ? '#a5b4fc' : '#334155',
                  }}
                >{r}</button>
              );
            })}
          </div>

          {/* CS31005 toggle */}
          <div style={{ display:'flex', alignItems:'center', gap:4, background:'rgba(15,23,42,0.8)', border:'1px solid rgba(30,41,59,0.6)', borderRadius:10, padding:4 }}>
            <span style={{ fontSize:10, fontFamily:'monospace', color:'#64748b', padding:'0 6px', fontWeight:700 }}>CS31005:</span>
            {['NC231','NC232'].map(r => {
              const isActive = (roomPrefs['CS31005'] || 'NC231') === r;
              return (
                <button
                  key={r}
                  onClick={() => onToggleRoom('CS31005', r)}
                  style={{
                    padding:'4px 10px', borderRadius:8, fontSize:10, fontWeight:700, cursor:'pointer',
                    transition:'all 0.12s',
                    background: isActive ? 'rgba(74,222,128,0.2)' : 'transparent',
                    border: isActive ? '1px solid rgba(74,222,128,0.4)' : '1px solid transparent',
                    color: isActive ? '#4ade80' : '#334155',
                  }}
                >{r}</button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────── */}
      <div style={{
        background:'rgba(15,23,42,0.9)', border:'1px solid rgba(30,41,59,0.7)',
        borderRadius:18, overflow:'hidden',
      }}>
        <div style={{ overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:900 }}>
            <thead>
              <tr style={{ background:'rgba(3,7,18,0.9)', borderBottom:'1px solid rgba(30,41,59,0.8)' }}>
                <th style={{
                  padding:'12px 16px', textAlign:'left', minWidth:100,
                  fontSize:10, fontWeight:700, color:'#334155', textTransform:'uppercase', letterSpacing:'0.06em',
                  borderRight:'1px solid rgba(30,41,59,0.6)',
                }}>Day</th>
                {TIME_SLOTS.map(ts => (
                  <th key={ts.index} style={{
                    padding:'10px 6px', textAlign:'center', minWidth:110,
                    borderRight:'1px solid rgba(30,41,59,0.4)',
                  }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', fontFamily:'monospace' }}>
                      {ts.timeLabel.split('-')[0]}
                    </div>
                    <div style={{ fontSize:9, color:'#334155', marginTop:1 }}>
                      → {ts.timeLabel.split('-')[1]}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map(day => {
                const isToday = todayDay === day;
                return (
                  <tr key={day} style={{
                    background: isToday ? 'rgba(99,102,241,0.04)' : 'transparent',
                    borderBottom:'1px solid rgba(30,41,59,0.5)',
                    transition:'background 0.12s',
                  }}>
                    {/* Day header cell */}
                    <td style={{
                      padding:'12px 16px',
                      borderRight:'1px solid rgba(30,41,59,0.6)',
                      background: isToday ? 'rgba(99,102,241,0.08)' : 'rgba(3,7,18,0.4)',
                      verticalAlign:'middle',
                    }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ fontSize:13, fontWeight:800, color: isToday ? '#a5b4fc' : '#64748b', fontFamily:'Outfit, sans-serif' }}>
                          {day}
                        </span>
                        {isToday && (
                          <span style={{ width:6, height:6, borderRadius:'50%', background:'#4ade80', display:'inline-block', flexShrink:0 }} />
                        )}
                      </div>
                      <div style={{ fontSize:9, color:'#334155', marginTop:1 }}>{DAY_FULL[day]}</div>
                    </td>

                    {/* Slot cells */}
                    {TIME_SLOTS.map(slotInfo => {
                      const slot = getSlotForCell(day, slotInfo.index);

                      if (!slot) return (
                        <td key={slotInfo.index} style={{
                          padding:4, borderRight:'1px solid rgba(30,41,59,0.3)',
                          background:'rgba(3,7,18,0.2)', textAlign:'center',
                        }}>
                          <span style={{ fontSize:10, color:'#1e293b' }}>—</span>
                        </td>
                      );

                      if (slot.labSpan && slot.slotIndex !== slotInfo.index) return null;

                      const course = COURSES[slot.subjectCode];
                      const room = getSlotRoom(slot);

                      return (
                        <td
                          key={slotInfo.index}
                          colSpan={slot.labSpan || 1}
                          onClick={() => setSelectedCourse({ course, slot })}
                          style={{ padding:5, borderRight:'1px solid rgba(30,41,59,0.3)', cursor:'pointer', verticalAlign:'top' }}
                        >
                          <div style={{
                            borderRadius:12, padding:'8px 10px',
                            background:`${course?.color}12`,
                            border:`1px solid ${course?.color}35`,
                            height:'100%', minHeight:70,
                            display:'flex', flexDirection:'column', justifyContent:'space-between',
                            transition:'all 0.15s',
                          }}
                            onMouseEnter={e => {
                              (e.currentTarget as HTMLElement).style.transform = 'scale(1.03)';
                              (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 20px ${course?.color}25`;
                            }}
                            onMouseLeave={e => {
                              (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                              (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                            }}
                          >
                            <div>
                              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                                <span style={{
                                  fontSize:10, fontWeight:800, fontFamily:'monospace',
                                  background: course?.color || '#6366f1',
                                  color:'#fff', borderRadius:5, padding:'1px 5px',
                                }}>{slot.subjectCode}</span>
                                {slot.multiRooms && (
                                  <span style={{ fontSize:8, color:'#f59e0b', background:'rgba(245,158,11,0.12)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:4, padding:'1px 4px' }}>Multi</span>
                                )}
                              </div>
                              <div style={{ fontSize:11, fontWeight:700, color:'#e2e8f0', lineHeight:1.3 }}>
                                {course?.name}
                              </div>
                            </div>
                            <div style={{ marginTop:6, paddingTop:5, borderTop:`1px solid ${course?.color}20`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                              <span style={{ fontSize:10, fontWeight:700, color:'#4ade80', display:'flex', alignItems:'center', gap:3 }}>
                                <MapPin size={9} /> {room}
                              </span>
                              <span style={{ fontSize:9, color:'#475569', fontFamily:'monospace' }}>{course?.ltp}</span>
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Course Detail Modal ──────────────────────────────────── */}
      {selectedCourse && (
        <div style={{
          position:'fixed', inset:0, zIndex:50,
          background:'rgba(3,7,18,0.85)', backdropFilter:'blur(14px)',
          display:'flex', alignItems:'center', justifyContent:'center', padding:16,
        }}
          onClick={e => { if (e.target === e.currentTarget) setSelectedCourse(null); }}
        >
          <div style={{
            background:'#0f172a', borderRadius:22, padding:28, width:'100%', maxWidth:480,
            border:'1px solid rgba(99,102,241,0.35)',
            boxShadow:'0 25px 50px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)',
            animation:'fadeIn 0.22s ease',
          }}>
            {/* Modal header */}
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                <div style={{
                  width:50, height:50, borderRadius:14, background: selectedCourse.course.color,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  color:'#fff', fontWeight:800, fontSize:16, fontFamily:'monospace',
                  boxShadow:`0 4px 16px ${selectedCourse.course.color}40`,
                }}>
                  {selectedCourse.slot.subjectCode.substring(0,2)}
                </div>
                <div>
                  <div style={{ fontSize:10, fontWeight:700, color:'#818cf8', textTransform:'uppercase', letterSpacing:'0.07em' }}>
                    {selectedCourse.course.type}
                  </div>
                  <h3 style={{ fontSize:18, fontWeight:800, color:'#f8fafc', fontFamily:'Outfit, sans-serif', margin:0 }}>
                    {selectedCourse.course.name}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedCourse(null)}
                style={{ background:'rgba(30,41,59,0.7)', border:'1px solid rgba(51,65,85,0.5)', borderRadius:10, padding:8, cursor:'pointer', color:'#64748b', lineHeight:1, transition:'all 0.12s' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Details table */}
            <div style={{ background:'rgba(3,7,18,0.7)', border:'1px solid rgba(30,41,59,0.7)', borderRadius:14, padding:'4px 16px', marginBottom:20 }}>
              {[
                { label:'Course Code', value: <span style={{ fontFamily:'monospace', fontWeight:800, color:'#a5b4fc' }}>{selectedCourse.slot.subjectCode}</span> },
                { label:'L-T-P', value: selectedCourse.course.ltp },
                { label:'Credits', value: <span style={{ color:'#4ade80', fontWeight:800 }}>{selectedCourse.course.credits}.0</span> },
                { label:'Schedule', value: `${selectedCourse.slot.startTime} – ${selectedCourse.slot.endTime} (${selectedCourse.slot.dayFull})` },
                { label:'Venue', value: <span style={{ color:'#4ade80', fontWeight:800, display:'flex', alignItems:'center', gap:4 }}><MapPin size={13} />{getSlotRoom(selectedCourse.slot)}</span> },
              ].map((row, i, arr) => (
                <div key={row.label} style={{
                  display:'flex', justifyContent:'space-between', alignItems:'center',
                  padding:'11px 0', fontSize:12,
                  borderBottom: i < arr.length - 1 ? '1px solid rgba(30,41,59,0.6)' : 'none',
                }}>
                  <span style={{ color:'#475569', fontWeight:600 }}>{row.label}</span>
                  <span style={{ color:'#e2e8f0', fontWeight:600 }}>{row.value}</span>
                </div>
              ))}
            </div>

            {/* Room switcher */}
            {selectedCourse.slot.multiRooms && (
              <div style={{ background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.25)', borderRadius:14, padding:'14px 16px', marginBottom:20 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#818cf8', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
                  <Building size={13} /> Switch Room for {selectedCourse.slot.subjectCode}
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  {selectedCourse.slot.multiRooms.map(r => {
                    const isActive = getSlotRoom(selectedCourse.slot) === r;
                    return (
                      <button
                        key={r}
                        onClick={() => onToggleRoom(selectedCourse.slot.subjectCode, r)}
                        style={{
                          flex:1, padding:'9px', borderRadius:10, fontSize:12, fontWeight:700, cursor:'pointer',
                          transition:'all 0.12s', display:'flex', alignItems:'center', justifyContent:'center', gap:5,
                          background: isActive ? 'rgba(99,102,241,0.25)' : 'rgba(15,23,42,0.7)',
                          border: isActive ? '1px solid rgba(99,102,241,0.6)' : '1px solid rgba(51,65,85,0.5)',
                          color: isActive ? '#a5b4fc' : '#475569',
                          boxShadow: isActive ? '0 0 12px rgba(99,102,241,0.15)' : 'none',
                        }}
                      >
                        <MapPin size={12} /> {r} {isActive ? '✓' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              onClick={() => setSelectedCourse(null)}
              style={{
                width:'100%', padding:'11px', borderRadius:12, fontSize:13, fontWeight:700,
                background:'rgba(30,41,59,0.7)', border:'1px solid rgba(51,65,85,0.6)',
                color:'#94a3b8', cursor:'pointer', transition:'all 0.12s',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
