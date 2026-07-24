import React, { useState } from 'react';
import {
  XCircle,
  Plus,
  Trash2,
  BookOpen,
  PieChart,
  ShieldAlert,
  Check,
  Ban,
  Sparkles,
} from 'lucide-react';
import { COURSES, SCHEDULE_GRID } from '../data/timetableData';
import { AttendanceRecord, AttendanceStatus } from '../services/api';

interface AttendanceTrackerProps {
  records: AttendanceRecord[];
  onSaveRecord: (rec: Omit<AttendanceRecord, 'id' | 'created_at'> & { id?: string }) => void;
  onDeleteRecord: (id: string) => void;
}

export const AttendanceTracker: React.FC<AttendanceTrackerProps> = ({
  records,
  onSaveRecord,
  onDeleteRecord,
}) => {
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // Calculate today's day name and today's scheduled classes from timetable
  const now = new Date();
  const DAY_MAP: Record<number, string> = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thur', 5: 'Fri' };
  const todayDayName = DAY_MAP[now.getDay()] || '';

  // Get unique subject codes scheduled for TODAY
  const todaySlots = todayDayName
    ? SCHEDULE_GRID.filter((s) => s.day === todayDayName)
    : [];
  const todaySubjectCodes = Array.from(new Set(todaySlots.map((s) => s.subjectCode)));

  // Class selection for logging (strictly today's classes if available, or all courses on weekends)
  const availableLogSubjects = todaySubjectCodes.length > 0 ? todaySubjectCodes : Object.keys(COURSES);

  // Form State
  const [selectedSub, setSelectedSub] = useState<string>(availableLogSubjects[0] || 'CS31007');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedStatus, setSelectedStatus] = useState<AttendanceStatus>('attended');
  const [selectedNote, setSelectedNote] = useState<string>('');

  // Get all course codes in curriculum for stats overview
  const courseCodes = Object.keys(COURSES);

  // Compute Per-Subject Stats (Simple Attended, Missed, Cancelled, Pct)
  const subjectStats = courseCodes.map((subCode) => {
    const subLogs = records.filter((r) => r.subject_code === subCode);
    const attended = subLogs.filter((r) => r.status === 'attended').length;
    const missed = subLogs.filter((r) => r.status === 'missed').length;
    const cancelled = subLogs.filter((r) => r.status === 'cancelled').length;

    const totalHeld = attended + missed; // Cancelled does not count against held lectures
    const pct = totalHeld > 0 ? Math.round((attended / totalHeld) * 100) : 100;

    return {
      subCode,
      course: COURSES[subCode],
      attended,
      missed,
      cancelled,
      totalHeld,
      pct,
      subLogs,
    };
  });

  // Overall Stats
  const totalAttended = records.filter((r) => r.status === 'attended').length;
  const totalMissed = records.filter((r) => r.status === 'missed').length;
  const totalCancelled = records.filter((r) => r.status === 'cancelled').length;
  const totalHeldSemester = totalAttended + totalMissed;
  const overallPct = totalHeldSemester > 0 ? Math.round((totalAttended / totalHeldSemester) * 100) : 100;

  // Most Missed Class
  const sortedByMissed = [...subjectStats].sort((a, b) => b.missed - a.missed);
  const mostMissed = sortedByMissed[0] && sortedByMissed[0].missed > 0 ? sortedByMissed[0] : null;

  // Quick log helper
  const handleQuickLog = (subjectCode: string, status: AttendanceStatus) => {
    onSaveRecord({
      subject_code: subjectCode,
      date: new Date().toISOString().split('T')[0],
      status,
      note: status === 'cancelled' ? 'Prof Cancelled' : '',
    });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveRecord({
      subject_code: selectedSub,
      date: selectedDate,
      status: selectedStatus,
      note: selectedNote,
    });
    setShowAddModal(false);
    setSelectedNote('');
  };

  // Filtered log table
  const filteredRecords = records.filter((r) => {
    if (filterSubject !== 'all' && r.subject_code !== filterSubject) return false;
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, animation: 'fadeIn 0.2s ease' }}>
      
      {/* ─── Header Banner ─── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(30,41,59,0.8) 0%, rgba(15,23,42,0.9) 100%)',
        border: '1px solid rgba(99,102,241,0.25)',
        borderRadius: 20, padding: '20px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16,
        boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <PieChart size={22} style={{ color: '#818cf8' }} />
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#f8fafc', fontFamily: 'Outfit, sans-serif' }}>
              Attendance & Cancelled Class Tracker
            </h2>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>
            Quickly log today's classes, track lectures attended/missed, and keep record of professor cancellations.
          </p>
        </div>

        <button
          onClick={() => {
            setSelectedSub(availableLogSubjects[0] || 'CS31007');
            setShowAddModal(true);
          }}
          style={{
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            border: 'none', borderRadius: 12, padding: '10px 18px',
            color: '#ffffff', fontSize: 13, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
            boxShadow: '0 0 20px rgba(99,102,241,0.4)', transition: 'all 0.15s',
          }}
        >
          <Plus size={16} />
          <span>Log Attendance Entry</span>
        </button>
      </div>

      {/* ─── Today's Class Quick Logger ─── */}
      <div style={{
        background: 'rgba(15,23,42,0.7)',
        border: '1px solid rgba(30,41,59,0.8)',
        borderRadius: 16, padding: '16px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={16} style={{ color: '#f59e0b' }} />
            <span style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc', letterSpacing: '0.02em' }}>
              Today's Scheduled Classes ({todayDayName || 'Weekend'})
            </span>
          </div>

          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
            {todaySubjectCodes.length > 0 ? `${todaySubjectCodes.length} classes scheduled today` : 'No timetable classes today'}
          </span>
        </div>

        {todaySubjectCodes.length === 0 ? (
          <div style={{ padding: '16px', background: 'rgba(30,41,59,0.4)', borderRadius: 12, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
            🎉 No classes scheduled on your timetable for today! (Weekend / Free day).
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {todaySubjectCodes.map((subCode) => {
              const course = COURSES[subCode];
              const todayLog = records.find(
                (r) => r.subject_code === subCode && r.date === new Date().toISOString().split('T')[0]
              );

              return (
                <div
                  key={subCode}
                  style={{
                    background: 'rgba(30,41,59,0.5)',
                    border: '1px solid rgba(51,65,85,0.6)',
                    borderRadius: 12, padding: '12px 14px',
                    display: 'flex', flexDirection: 'column', gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 800, color: course?.color || '#818cf8' }}>
                        {course?.shortName || subCode}
                      </span>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{course?.name}</div>
                    </div>

                    {todayLog ? (
                      <span style={{
                        fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 6,
                        background: todayLog.status === 'attended' ? 'rgba(74,222,128,0.15)' : todayLog.status === 'missed' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                        color: todayLog.status === 'attended' ? '#4ade80' : todayLog.status === 'missed' ? '#f87171' : '#fbbf24',
                        border: `1px solid ${todayLog.status === 'attended' ? 'rgba(74,222,128,0.3)' : todayLog.status === 'missed' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
                      }}>
                        {todayLog.status.toUpperCase()}
                      </span>
                    ) : (
                      <span style={{ fontSize: 10, color: '#64748b' }}>Not Marked</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => handleQuickLog(subCode, 'attended')}
                      style={{
                        flex: 1, padding: '6px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                        background: 'rgba(74,222,128,0.12)', color: '#4ade80',
                        border: '1px solid rgba(74,222,128,0.3)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                      }}
                      title="Mark Present"
                    >
                      <Check size={13} />
                      <span>Present</span>
                    </button>

                    <button
                      onClick={() => handleQuickLog(subCode, 'missed')}
                      style={{
                        flex: 1, padding: '6px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                        background: 'rgba(239,68,68,0.12)', color: '#f87171',
                        border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                      }}
                      title="Mark Missed"
                    >
                      <XCircle size={13} />
                      <span>Missed</span>
                    </button>

                    <button
                      onClick={() => handleQuickLog(subCode, 'cancelled')}
                      style={{
                        padding: '6px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                        background: 'rgba(245,158,11,0.12)', color: '#fbbf24',
                        border: '1px solid rgba(245,158,11,0.3)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                      title="Mark Class Cancelled"
                    >
                      <Ban size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Course-wise Attendance Cards ─── */}
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc', marginBottom: 14 }}>
          Course-wise Attendance Breakdown
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {subjectStats.map((st) => {
            return (
              <div
                key={st.subCode}
                style={{
                  background: 'rgba(15,23,42,0.7)',
                  border: '1px solid rgba(30,41,59,0.8)',
                  borderRadius: 16, padding: '18px 20px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: st.course?.color || '#818cf8' }}>
                      {st.course?.shortName || st.subCode}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{st.course?.name}</div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#818cf8', fontFamily: 'monospace' }}>
                      {st.pct}%
                    </div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>
                      {st.attended}/{st.totalHeld} attended
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ height: 6, background: 'rgba(30,41,59,0.9)', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
                  <div style={{
                    height: '100%', width: `${st.pct}%`,
                    background: '#6366f1', borderRadius: 10, transition: 'width 0.4s ease',
                  }} />
                </div>

                {/* Stats breakdown */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', borderTop: '1px solid rgba(30,41,59,0.6)', paddingTop: 10 }}>
                  <span>🟢 Attended: <strong>{st.attended}</strong></span>
                  <span>🔴 Missed: <strong>{st.missed}</strong></span>
                  <span>🟡 Cancelled: <strong>{st.cancelled}</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Bottom Analytics & Stats Dashboard ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        
        {/* Most Missed Class Banner */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(15,23,42,0.8) 100%)',
          border: '1px solid rgba(239,68,68,0.4)',
          borderRadius: 16, padding: '18px 20px',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, background: 'rgba(239,68,68,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171', flexShrink: 0,
          }}>
            <ShieldAlert size={22} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Most Missed Course
            </div>
            {mostMissed ? (
              <>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc' }}>
                  {mostMissed.course?.name || mostMissed.subCode}
                </div>
                <div style={{ fontSize: 12, color: '#fca5a5', marginTop: 2 }}>
                  <strong>{mostMissed.missed}</strong> lectures missed
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>
                🎉 No missed classes logged!
              </div>
            )}
          </div>
        </div>

        {/* Cancelled Classes Summary Card */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(15,23,42,0.8) 100%)',
          border: '1px solid rgba(245,158,11,0.4)',
          borderRadius: 16, padding: '18px 20px',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, background: 'rgba(245,158,11,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24', flexShrink: 0,
          }}>
            <Ban size={22} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Official Cancelled Classes
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc' }}>
              {totalCancelled} Professor Cancellations
            </div>
            <div style={{ fontSize: 12, color: '#fcd34d', marginTop: 2 }}>
              Cancelled lectures kept in separate log.
            </div>
          </div>
        </div>

        {/* Overall Semester Stats Card */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(15,23,42,0.8) 100%)',
          border: '1px solid rgba(99,102,241,0.4)',
          borderRadius: 16, padding: '18px 20px',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, background: 'rgba(99,102,241,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8', flexShrink: 0,
          }}>
            <BookOpen size={22} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Overall Semester Attendance
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#4ade80', fontFamily: 'monospace' }}>
              {overallPct}% ({totalAttended}/{totalHeldSemester} held)
            </div>
            <div style={{ fontSize: 12, color: '#c7d2fe', marginTop: 2 }}>
              Total logs: {records.length} entries
            </div>
          </div>
        </div>

      </div>

      {/* ─── Detailed Attendance History Table ─── */}
      <div style={{
        background: 'rgba(15,23,42,0.7)',
        border: '1px solid rgba(30,41,59,0.8)',
        borderRadius: 16, padding: '20px',
      }}>
        {/* Table Filters */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#f8fafc' }}>
            Attendance History & Logged Entries ({filteredRecords.length})
          </h3>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {/* Subject Filter */}
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              style={{
                background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(51,65,85,0.8)',
                borderRadius: 10, padding: '6px 12px', fontSize: 12, color: '#e2e8f0', fontWeight: 600,
              }}
            >
              <option value="all">All Courses</option>
              {courseCodes.map((c) => (
                <option key={c} value={c}>
                  {COURSES[c]?.shortName || c}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(51,65,85,0.8)',
                borderRadius: 10, padding: '6px 12px', fontSize: 12, color: '#e2e8f0', fontWeight: 600,
              }}
            >
              <option value="all">All Statuses</option>
              <option value="attended">Attended 🟢</option>
              <option value="missed">Missed 🔴</option>
              <option value="cancelled">Cancelled 🟡</option>
            </select>
          </div>
        </div>

        {/* Table */}
        {filteredRecords.length === 0 ? (
          <div style={{ padding: '30px 0', textAlign: 'center', color: '#64748b', fontSize: 13 }}>
            No attendance records match your filter criteria.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(51,65,85,0.8)', color: '#64748b' }}>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>Date</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>Course</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>Status</th>
                  <th style={{ padding: '10px 12px', fontWeight: 700 }}>Notes</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((r) => {
                  const course = COURSES[r.subject_code];
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid rgba(30,41,59,0.6)' }}>
                      <td style={{ padding: '12px', color: '#f8fafc', fontWeight: 600, fontFamily: 'monospace' }}>
                        {r.date}
                      </td>

                      <td style={{ padding: '12px' }}>
                        <span style={{ fontWeight: 800, color: course?.color || '#818cf8' }}>
                          [{course?.shortName || r.subject_code}]
                        </span>{' '}
                        <span style={{ color: '#94a3b8', fontSize: 12 }}>{course?.name}</span>
                      </td>

                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 800,
                          background: r.status === 'attended' ? 'rgba(74,222,128,0.15)' : r.status === 'missed' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                          color: r.status === 'attended' ? '#4ade80' : r.status === 'missed' ? '#f87171' : '#fbbf24',
                          border: `1px solid ${r.status === 'attended' ? 'rgba(74,222,128,0.3)' : r.status === 'missed' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
                        }}>
                          {r.status.toUpperCase()}
                        </span>
                      </td>

                      <td style={{ padding: '12px', color: '#94a3b8', fontSize: 12 }}>
                        {r.note || '-'}
                      </td>

                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <button
                          onClick={() => onDeleteRecord(r.id)}
                          style={{
                            background: 'transparent', border: 'none', color: '#f87171',
                            cursor: 'pointer', padding: 4, borderRadius: 6,
                          }}
                          title="Delete entry"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Add Attendance Modal (Strictly Today's Classes in dropdown) ─── */}
      {showAddModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            background: '#0f172a', border: '1px solid rgba(99,102,241,0.4)',
            borderRadius: 20, width: '100%', maxWidth: 440, padding: 24,
            boxShadow: '0 25px 50px rgba(0,0,0,0.6)',
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800, color: '#f8fafc' }}>
              Log Attendance Entry
            </h3>

            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 6 }}>
                  Course / Subject ({todaySubjectCodes.length > 0 ? `Today's Timetable (${todayDayName})` : 'All Courses'})
                </label>
                <select
                  value={selectedSub}
                  onChange={(e) => setSelectedSub(e.target.value)}
                  style={{
                    width: '100%', background: 'rgba(30,41,59,0.9)', border: '1px solid rgba(51,65,85,0.8)',
                    borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#f8fafc', fontWeight: 600,
                  }}
                >
                  {availableLogSubjects.map((c) => (
                    <option key={c} value={c}>
                      [{COURSES[c]?.shortName || c}] {COURSES[c]?.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 6 }}>
                  Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  style={{
                    width: '100%', background: 'rgba(30,41,59,0.9)', border: '1px solid rgba(51,65,85,0.8)',
                    borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#f8fafc', fontWeight: 600,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 6 }}>
                  Attendance Status
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['attended', 'missed', 'cancelled'] as AttendanceStatus[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setSelectedStatus(st)}
                      style={{
                        flex: 1, padding: '10px 8px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                        cursor: 'pointer', transition: 'all 0.15s',
                        border: selectedStatus === st ? '2px solid #6366f1' : '1px solid rgba(51,65,85,0.8)',
                        background: selectedStatus === st ? 'rgba(99,102,241,0.2)' : 'rgba(30,41,59,0.6)',
                        color: selectedStatus === st ? '#818cf8' : '#64748b',
                      }}
                    >
                      {st === 'attended' ? '🟢 Present' : st === 'missed' ? '🔴 Missed' : '🟡 Cancelled'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 6 }}>
                  Notes / Reason (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Overslept / Prof was sick / Attended lab"
                  value={selectedNote}
                  onChange={(e) => setSelectedNote(e.target.value)}
                  style={{
                    width: '100%', background: 'rgba(30,41,59,0.9)', border: '1px solid rgba(51,65,85,0.8)',
                    borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#f8fafc',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 10, border: '1px solid rgba(51,65,85,0.8)',
                    background: 'rgba(30,41,59,0.6)', color: '#94a3b8', fontSize: 13, fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1, padding: '10px', borderRadius: 10, border: 'none',
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    color: '#ffffff', fontSize: 13, fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
