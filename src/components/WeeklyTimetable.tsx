import React, { useState } from 'react';
import { MapPin, Layers, X } from 'lucide-react';
import { COURSES, MORNING_SLOTS, AFTERNOON_SLOTS, SCHEDULE_GRID, ClassSlot, Course } from '../data/timetableData';

interface WeeklyTimetableProps {
  roomPrefs: Record<string, string>;
  onToggleRoom: (subjectCode: string, room: string) => void;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thur', 'Fri'] as const;
type Day = typeof DAYS[number];

export const WeeklyTimetable: React.FC<WeeklyTimetableProps> = ({ roomPrefs }) => {
  const [selectedCourse, setSelectedCourse] = useState<{ course: Course; slot: ClassSlot; spanHours: number } | null>(null);

  const getSlotRoom = (slot: ClassSlot) => roomPrefs[slot.subjectCode] || slot.defaultRoom;

  // Smart Cell Merger: Merges consecutive slots with identical subjectCode on the same day within a table session
  const getMergedCellInfo = (day: string, slotIndex: number, slotsGroup: typeof MORNING_SLOTS) => {
    const daySlots = SCHEDULE_GRID.filter(s => s.day === day);

    // 1. Check if labSpan slot covers this slotIndex
    const labSlot = daySlots.find(s => s.labSpan && slotIndex >= s.slotIndex && slotIndex < s.slotIndex + s.labSpan);
    if (labSlot) {
      if (slotIndex === labSlot.slotIndex) {
        const availableInGroup = slotsGroup.filter(ts => ts.index >= slotIndex).length;
        const colSpan = Math.min(labSlot.labSpan!, availableInGroup);
        return { slot: labSlot, colSpan, isStart: true };
      }
      return { slot: labSlot, colSpan: labSlot.labSpan!, isStart: false };
    }

    // 2. Find exact slot for this slotIndex
    const slot = daySlots.find(s => s.slotIndex === slotIndex);
    if (!slot) return null;

    // 3. Check if previous adjacent slot in this group has same subjectCode
    const groupIndices = slotsGroup.map(ts => ts.index);
    if (groupIndices.includes(slotIndex - 1)) {
      const prevSlot = daySlots.find(s => s.slotIndex === slotIndex - 1);
      if (prevSlot && prevSlot.subjectCode === slot.subjectCode && !prevSlot.labSpan) {
        return { slot, colSpan: 1, isStart: false };
      }
    }

    // 4. Count consecutive adjacent slots in this group with same subjectCode
    let span = 1;
    while (true) {
      const nextIndex = slotIndex + span;
      if (!groupIndices.includes(nextIndex)) break;

      const nextSlot = daySlots.find(s => s.slotIndex === nextIndex);
      if (nextSlot && nextSlot.subjectCode === slot.subjectCode && !nextSlot.labSpan) {
        span++;
      } else {
        break;
      }
    }

    return { slot, colSpan: span, isStart: true };
  };

  const todayDay = (() => {
    const d = new Date().getDay();
    const map: Record<number, Day | undefined> = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thur', 5: 'Fri' };
    return map[d];
  })();

  // Render function for a session table (isAfternoon omits Day column)
  const renderTimetableGrid = (slotsGroup: typeof MORNING_SLOTS, isAfternoon = false) => {
    const numCols = slotsGroup.length;
    return (
      <div style={{
        background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(30,41,59,0.7)',
        borderRadius: 18, overflow: 'hidden', height: '100%',
      }}>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            tableLayout: 'fixed',
            minWidth: isAfternoon ? numCols * 110 : numCols * 110 + 80,
          }}>
            <colgroup>
              {!isAfternoon && <col style={{ width: '80px' }} />}
              {slotsGroup.map(ts => (
                <col key={ts.index} style={{ width: isAfternoon ? `calc(100% / ${numCols})` : `calc((100% - 80px) / ${numCols})` }} />
              ))}
            </colgroup>
            <thead>
              <tr style={{ background: 'rgba(3,7,18,0.9)', borderBottom: '1px solid rgba(30,41,59,0.8)' }}>
                {!isAfternoon && (
                  <th style={{
                    padding: '12px 10px', textAlign: 'left',
                    fontSize: 10, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em',
                    borderRight: '1px solid rgba(30,41,59,0.6)',
                  }}>Day</th>
                )}
                {slotsGroup.map(ts => (
                  <th key={ts.index} style={{
                    padding: '10px 4px', textAlign: 'center',
                    borderRight: '1px solid rgba(30,41,59,0.4)',
                    overflow: 'hidden',
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', fontFamily: 'monospace' }}>
                      {ts.timeLabel.split('-')[0]}
                    </div>
                    <div style={{ fontSize: 9, color: '#334155', marginTop: 1 }}>
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
                    borderBottom: '1px solid rgba(30,41,59,0.5)',
                    transition: 'background 0.12s',
                  }}>
                    {/* Day header cell */}
                    {!isAfternoon && (
                      <td style={{
                        padding: '12px 10px',
                        borderRight: '1px solid rgba(30,41,59,0.6)',
                        background: isToday ? 'rgba(99,102,241,0.08)' : 'rgba(3,7,18,0.4)',
                        verticalAlign: 'middle',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: isToday ? '#a5b4fc' : '#64748b', fontFamily: 'Outfit, sans-serif' }}>
                            {day}
                          </span>
                          {isToday && (
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ade80', display: 'inline-block', flexShrink: 0 }} />
                          )}
                        </div>
                      </td>
                    )}

                    {/* Slot Cells */}
                    {slotsGroup.map(slotInfo => {
                      const mergedInfo = getMergedCellInfo(day, slotInfo.index, slotsGroup);

                      if (!mergedInfo) return (
                        <td key={slotInfo.index} style={{
                          padding: 3, borderRight: '1px solid rgba(30,41,59,0.3)',
                          background: 'rgba(3,7,18,0.2)', textAlign: 'center',
                          height: 82, boxSizing: 'border-box',
                        }}>
                          <span style={{ fontSize: 10, color: '#1e293b' }}>—</span>
                        </td>
                      );

                      if (!mergedInfo.isStart) return null;

                      const { slot, colSpan } = mergedInfo;
                      const course = COURSES[slot.subjectCode];
                      const room = getSlotRoom(slot);
                      const isMulti = colSpan > 1;

                      return (
                        <td
                          key={slotInfo.index}
                          colSpan={colSpan}
                          onClick={() => setSelectedCourse({ course, slot, spanHours: colSpan })}
                          style={{ padding: 3, borderRight: '1px solid rgba(30,41,59,0.3)', cursor: 'pointer', verticalAlign: 'top', height: 82, boxSizing: 'border-box' }}
                        >
                          <div style={{
                            borderRadius: 10, padding: '6px 8px',
                            background: isMulti ? `${course?.color}1d` : `${course?.color}12`,
                            border: isMulti ? `1px solid ${course?.color}60` : `1px solid ${course?.color}35`,
                            height: '100%',
                            boxSizing: 'border-box',
                            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                            transition: 'all 0.15s',
                            position: 'relative',
                            overflow: 'hidden',
                          }}
                            onMouseEnter={e => {
                              (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)';
                              (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 20px ${course?.color}30`;
                            }}
                            onMouseLeave={e => {
                              (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                              (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                            }}
                          >
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 3, marginBottom: 2 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
                                  <span style={{
                                    fontSize: 10, fontWeight: 800, fontFamily: 'Outfit, sans-serif',
                                    background: course?.color || '#6366f1',
                                    color: '#fff', borderRadius: 4, padding: '1px 5px',
                                    whiteSpace: 'nowrap',
                                  }}>{course?.shortName || slot.subjectCode}</span>
                                  {isMulti && (
                                    <span style={{
                                      fontSize: 8, fontWeight: 800,
                                      background: `${course?.color}30`, color: '#f8fafc',
                                      border: `1px solid ${course?.color}60`, borderRadius: 4, padding: '0px 3px',
                                      fontFamily: 'monospace', whiteSpace: 'nowrap',
                                    }}>
                                      {colSpan}h
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div style={{ fontSize: 10.5, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                {course?.name}
                              </div>
                            </div>

                            <div style={{ marginTop: 3, paddingTop: 3, borderTop: `1px solid ${course?.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: 9.5, fontWeight: 700, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 2, whiteSpace: 'nowrap' }}>
                                <MapPin size={8} /> {room}
                              </span>
                              <span style={{ fontSize: 8.5, color: '#475569', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{course?.ltp}</span>
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
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{
        background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(30,41,59,0.8)',
        borderRadius: 18, padding: '20px 24px',
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
            <Layers size={14} style={{ color: '#818cf8' }} />
            <span style={{ color: '#818cf8', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Autumn 2026-2027 Schedule
            </span>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#f8fafc', fontFamily: 'Outfit, sans-serif', margin: 0 }}>
            Weekly Timetable
          </h2>
        </div>
        <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>Morning: <strong style={{ color: '#a5b4fc' }}>8 AM – 1 PM</strong></span>
          <span>•</span>
          <span>Afternoon: <strong style={{ color: '#4ade80' }}>2 PM – 5 PM</strong></span>
        </div>
      </div>

      {/* ── Side-By-Side Tables Row ────────────────────────────── */}
      <div className="timetable-tables-container">
        {/* Table 1: Morning Session */}
        <div className="timetable-morning-col">
          {renderTimetableGrid(MORNING_SLOTS, false)}
        </div>

        {/* Table 2: Afternoon Session */}
        <div className="timetable-afternoon-col">
          {renderTimetableGrid(AFTERNOON_SLOTS, true)}
        </div>
      </div>

      {/* ── Course Detail Modal ──────────────────────────────────── */}
      {selectedCourse && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(3,7,18,0.85)', backdropFilter: 'blur(14px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}
          onClick={e => { if (e.target === e.currentTarget) setSelectedCourse(null); }}
        >
          <div style={{
            background: '#0f172a', borderRadius: 22, padding: 28, width: '100%', maxWidth: 480,
            border: '1px solid rgba(99,102,241,0.35)',
            boxShadow: '0 25px 50px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)',
            animation: 'fadeIn 0.22s ease',
          }}>
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 50, height: 50, borderRadius: 14, background: selectedCourse.course.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: 800, fontSize: 14, fontFamily: 'Outfit, sans-serif',
                  boxShadow: `0 4px 16px ${selectedCourse.course.color}40`,
                }}>
                  {selectedCourse.course.shortName.substring(0, 3)}
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    {selectedCourse.course.type} {selectedCourse.spanHours > 1 ? `(${selectedCourse.spanHours} Hours Merged)` : ''}
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: '#f8fafc', fontFamily: 'Outfit, sans-serif', margin: 0 }}>
                    {selectedCourse.course.name}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedCourse(null)}
                style={{ background: 'rgba(30,41,59,0.7)', border: '1px solid rgba(51,65,85,0.5)', borderRadius: 10, padding: 8, cursor: 'pointer', color: '#64748b', lineHeight: 1, transition: 'all 0.12s' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Details table */}
            <div style={{ background: 'rgba(3,7,18,0.7)', border: '1px solid rgba(30,41,59,0.7)', borderRadius: 14, padding: '4px 16px', marginBottom: 20 }}>
              {[
                { label: 'Course Name', value: <span style={{ fontWeight: 800, color: '#a5b4fc' }}>{selectedCourse.course.shortName}</span> },
                { label: 'L-T-P', value: selectedCourse.course.ltp },
                { label: 'Credits', value: <span style={{ color: '#4ade80', fontWeight: 800 }}>{selectedCourse.course.credits}.0</span> },
                { label: 'Time & Day', value: `${selectedCourse.slot.startTime} (${selectedCourse.slot.dayFull}) — ${selectedCourse.spanHours}h block` },
                { label: 'Venue', value: <span style={{ color: '#4ade80', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={13} />{getSlotRoom(selectedCourse.slot)}</span> },
              ].map((row, i, arr) => (
                <div key={row.label} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '11px 0', fontSize: 12,
                  borderBottom: i < arr.length - 1 ? '1px solid rgba(30,41,59,0.6)' : 'none',
                }}>
                  <span style={{ color: '#475569', fontWeight: 600 }}>{row.label}</span>
                  <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{row.value}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setSelectedCourse(null)}
              style={{
                width: '100%', padding: '11px', borderRadius: 12, fontSize: 13, fontWeight: 700,
                background: 'rgba(30,41,59,0.7)', border: '1px solid rgba(51,65,85,0.6)',
                color: '#94a3b8', cursor: 'pointer', transition: 'all 0.12s',
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
