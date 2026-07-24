import React, { useState, useEffect } from 'react';
import {
  Calendar,
  BookOpen,
  Bell,
  Mail,
  Lock,
  Database,
  CheckCircle2,
  Briefcase,
} from 'lucide-react';
import { STUDENT_INFO } from './data/timetableData';
import { TodaySummary } from './components/TodaySummary';
import { WeeklyTimetable } from './components/WeeklyTimetable';
import { RemindersManager } from './components/RemindersManager';
import { InternTracker } from './components/InternTracker';
import { AuthModal } from './components/AuthModal';
import { EmailSettingsModal } from './components/EmailSettingsModal';
import {
  Reminder,
  checkAuthSession,
  getReminders,
  saveReminder,
  deleteReminder,
  toggleReminderStatus,
  getRoomPreferences,
  saveRoomPreference,
  sendEmailNotification,
  logoutAuthSession,
} from './services/api';

type TabId = 'today' | 'timetable' | 'reminders' | 'interns';

export const App: React.FC = () => {
  const isAnonymousTT = window.location.pathname === '/tt' || window.location.pathname === '/tt/';

  const [activeTab, setActiveTab] = useState<TabId>('today');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [roomPrefs, setRoomPrefs] = useState<Record<string, string>>({
    CS31007: 'NC241',
    CS31003: 'NC241',
    CS31005: 'NC231',
  });

  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  useEffect(() => {
    // If accessing /tt, skip authentication modal entirely
    if (isAnonymousTT) {
      setIsAuthenticated(true);
      loadData();
      return;
    }

    const authState = checkAuthSession();
    if (authState.isAuthenticated) {
      setIsAuthenticated(true);
      loadData();
    } else {
      setIsAuthModalOpen(true);
    }
  }, [isAnonymousTT]);

  const loadData = async () => {
    const rData = await getReminders();
    setReminders(rData);
    const roomData = await getRoomPreferences();
    setRoomPrefs(roomData);
  };

  const showToast = (message: string, _type: 'success' | 'info' = 'success') => {
    setNotification({ message, type: _type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleToggleRoom = async (subjectCode: string, room: string) => {
    const updated = await saveRoomPreference(subjectCode, room);
    setRoomPrefs(updated);
    showToast(`Room for ${subjectCode} → ${room}`);
  };

  const handleSaveReminder = async (remData: Omit<Reminder, 'id' | 'created_at'> & { id?: string }) => {
    const updatedList = await saveReminder(remData);
    setReminders(updatedList);
    showToast('Reminder saved!');
  };

  const handleDeleteReminder = async (id: string) => {
    const updatedList = await deleteReminder(id);
    setReminders(updatedList);
    showToast('Reminder deleted.', 'info');
  };

  const handleToggleReminderStatus = async (id: string) => {
    const updatedList = await toggleReminderStatus(id);
    setReminders(updatedList);
  };

  const handleSendEmail = async (subject: string, text: string) => {
    showToast('Dispatching Gmail alert…', 'info');
    const result = await sendEmailNotification({ recipient: 'me@timio.dpdns.org', subject, text });
    showToast(result.success ? 'Email delivered!' : `Notice: ${result.message}`, result.success ? 'success' : 'info');
  };

  // ─── ANONYMOUS /tt TIMETABLE ONLY VIEW (No Login, No Personal Info) ─
  if (isAnonymousTT) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#030712',
        color: '#f3f4f6',
        padding: '24px 16px',
        fontFamily: "'Inter', system-ui, sans-serif",
        WebkitFontSmoothing: 'antialiased',
        maxWidth: 1280,
        margin: '0 auto',
      }}>
        <WeeklyTimetable roomPrefs={roomPrefs} onToggleRoom={handleToggleRoom} />
      </div>
    );
  }

  // ─── DOM GATEKEEPER FOR UNAUTHENTICATED USERS (No Protected DOM Rendered) ───
  if (!isAuthenticated) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#030712',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}>
        <AuthModal
          isOpen={true}
          onAuthenticated={() => {
            setIsAuthenticated(true);
            setIsAuthModalOpen(false);
            loadData();
            showToast('Authenticated! 10-day session active.');
          }}
        />
      </div>
    );
  }

  const TABS: { id: TabId; label: string; mobileLabel: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'today',     label: "Today's Classes",         mobileLabel: 'Today',     icon: Calendar },
    { id: 'timetable', label: 'Weekly Timetable',        mobileLabel: 'Schedule',  icon: BookOpen },
    { id: 'reminders', label: 'Tasks & Reminders',       mobileLabel: 'Tasks',     icon: Bell,
      badge: reminders.filter(r => r.status === 'pending').length },
    { id: 'interns',   label: 'Internships',             mobileLabel: 'Interns',   icon: Briefcase },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#030712',
      color: '#f3f4f6',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Inter', system-ui, sans-serif",
      WebkitFontSmoothing: 'antialiased',
    }}>

      {/* Toast */}
      {notification && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 100,
          background: '#0f172a',
          border: '1px solid rgba(99,102,241,0.5)',
          borderRadius: 14,
          padding: '12px 16px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', gap: 10,
          fontSize: 12, maxWidth: 340,
          animation: 'fadeIn 0.25s ease',
        }}>
          <CheckCircle2 size={18} style={{ color: '#4ade80', flexShrink: 0 }} />
          <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{notification.message}</span>
        </div>
      )}

      {/* ─── Header / Navbar ─── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(15,23,42,0.92)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(30,41,59,0.8)',
      }}>
        {/* Top Bar */}
        <div style={{
          maxWidth: 1280, margin: '0 auto',
          padding: '12px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          {/* Logo / Student Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 15px rgba(99,102,241,0.4)',
            }}>
              <Calendar size={22} style={{ color: '#ffffff' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="student-name" style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc', fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.01em' }}>
                  {STUDENT_INFO.name}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 800, fontFamily: 'monospace',
                  background: 'rgba(99,102,241,0.15)', color: '#818cf8',
                  border: '1px solid rgba(99,102,241,0.3)',
                  padding: '1px 7px', borderRadius: 6,
                  flexShrink: 0,
                }}>
                  {STUDENT_INFO.rollNo}
                </span>
              </div>
              <p className="student-sub" style={{ margin: 0, fontSize: 11, color: '#64748b' }}>
                {STUDENT_INFO.dept} · {STUDENT_INFO.session}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setIsEmailModalOpen(true)}
              style={{
                background: 'rgba(30,41,59,0.7)', border: '1px solid rgba(51,65,85,0.6)',
                borderRadius: 10, padding: '7px 12px', fontSize: 11, fontWeight: 700,
                color: '#cbd5e1', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                transition: 'all 0.15s',
              }}
              title="Configure Gmail SMTP Alerts"
            >
              <Mail size={14} style={{ color: '#818cf8' }} />
              <span className="desktop-only">SMTP Alerts</span>
            </button>

            <div style={{
              background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)',
              borderRadius: 10, padding: '7px 12px', fontSize: 11, fontWeight: 700,
              color: '#4ade80', display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Database size={13} />
              <span className="desktop-only">Synced</span>
            </div>

            {isAuthenticated && (
              <button
                onClick={() => {
                  logoutAuthSession();
                  setIsAuthenticated(false);
                  setIsAuthModalOpen(true);
                }}
                style={{
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: 10, padding: '7px 10px', fontSize: 11, fontWeight: 700,
                  color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                  transition: 'all 0.15s',
                }}
                title="Lock Session"
              >
                <Lock size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Desktop Tabs Bar */}
        <div style={{
          maxWidth: 1280, margin: '0 auto',
          padding: '0 20px',
          display: 'flex', gap: 4,
          borderTop: '1px solid rgba(30,41,59,0.5)',
        }} className="desktop-nav">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '12px 18px',
                  fontSize: 12, fontWeight: 700,
                  color: active ? '#818cf8' : '#64748b',
                  background: active ? 'rgba(99,102,241,0.1)' : 'transparent',
                  border: 'none',
                  borderBottom: active ? '2px solid #6366f1' : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  position: 'relative',
                }}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span style={{
                    background: '#f59e0b', color: '#0f0f0f',
                    fontSize: 9, fontWeight: 800,
                    padding: '1px 6px', borderRadius: 10,
                    fontFamily: 'monospace',
                  }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* ─── Main Content Body ─── */}
      <main style={{
        maxWidth: 1280,
        width: '100%',
        margin: '0 auto',
        padding: '24px 20px 80px',
        flex: 1,
        boxSizing: 'border-box',
      }}>
        {activeTab === 'today' && (
          <TodaySummary
            roomPrefs={roomPrefs}
            reminders={reminders}
            onAddReminderForSubject={() => {
              setActiveTab('reminders');
            }}
            onSendTestEmail={handleSendEmail}
          />
        )}
        {activeTab === 'timetable' && (
          <WeeklyTimetable roomPrefs={roomPrefs} onToggleRoom={handleToggleRoom} />
        )}
        {activeTab === 'reminders' && (
          <RemindersManager
            reminders={reminders}
            onSaveReminder={handleSaveReminder}
            onDeleteReminder={handleDeleteReminder}
            onToggleReminderStatus={handleToggleReminderStatus}
            onSendEmail={handleSendEmail}
          />
        )}
        {activeTab === 'interns' && <InternTracker />}
      </main>

      {/* ─── Mobile Bottom Nav ─── */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
        background: 'rgba(15,23,42,0.97)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(30,41,59,0.8)',
        padding: '8px 4px 12px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      }} className="mobile-nav">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                padding: '6px 10px', borderRadius: 12, border: 'none',
                background: active ? 'rgba(99,102,241,0.15)' : 'transparent',
                color: active ? '#818cf8' : '#475569',
                cursor: 'pointer', minWidth: 60, position: 'relative',
                transition: 'all 0.15s',
              }}
            >
              <Icon size={20} />
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.03em' }}>
                {tab.mobileLabel}
              </span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span style={{
                  position: 'absolute', top: 4, right: 8,
                  background: '#f59e0b', color: '#0f0f0f',
                  fontSize: 8, fontWeight: 800,
                  width: 14, height: 14, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'monospace',
                }}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Modals */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onAuthenticated={() => {
          setIsAuthenticated(true);
          setIsAuthModalOpen(false);
          showToast('Authenticated! 10-day session active.');
        }}
      />
      <EmailSettingsModal isOpen={isEmailModalOpen} onClose={() => setIsEmailModalOpen(false)} />
    </div>
  );
};
