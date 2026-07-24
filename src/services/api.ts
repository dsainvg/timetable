import { InternCompany } from '../data/internData';

export interface Reminder {
  id: string;
  title: string;
  subject_code: string;
  type: 'assignment' | 'class' | 'exam' | 'project' | 'other';
  due_date: string; // YYYY-MM-DD
  due_time: string; // HH:MM
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'completed';
  send_email: boolean;
  description: string;
  created_at?: string;
}

export type AttendanceStatus = 'attended' | 'missed' | 'cancelled';

export interface AttendanceRecord {
  id: string;
  subject_code: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  note?: string;
  created_at?: string;
}

const LOCAL_STORAGE_KEY_REMINDERS = 'iitkgp_timetable_reminders_v1';
const LOCAL_STORAGE_KEY_ROOMS = 'iitkgp_timetable_room_prefs_v1';
const LOCAL_STORAGE_KEY_AUTH = 'iitkgp_timetable_auth_v1';
const LOCAL_STORAGE_KEY_ATTENDANCE = 'iitkgp_timetable_attendance_v1';

const DEFAULT_ROOM_PREFS: Record<string, string> = {
  CS31007: 'NC241',
  CS31003: 'NC241',
  CS31005: 'NC231',
};

const INITIAL_REMINDERS: Reminder[] = [
  {
    id: 'rem-1',
    title: 'Parallel Programming Lab 1',
    subject_code: 'CS61064',
    type: 'assignment',
    due_date: '2026-07-28',
    due_time: '23:59',
    priority: 'high',
    status: 'pending',
    send_email: true,
    description: 'Implement CUDA matrix multiplication & reduction kernel.',
    created_at: new Date().toISOString(),
  },
  {
    id: 'rem-2',
    title: 'Compilers Flex & Bison Lexer',
    subject_code: 'CS39003',
    type: 'assignment',
    due_date: '2026-07-29',
    due_time: '18:00',
    priority: 'medium',
    status: 'pending',
    send_email: true,
    description: 'Construct AST nodes and token scanner for Mini-C.',
    created_at: new Date().toISOString(),
  },
  {
    id: 'rem-3',
    title: 'Computer Architecture Midsem Prep',
    subject_code: 'CS31007',
    type: 'exam',
    due_date: '2026-07-30',
    due_time: '10:00',
    priority: 'high',
    status: 'pending',
    send_email: false,
    description: 'Review Cache hierarchy, memory interleaving & pipeline hazards in NC241.',
    created_at: new Date().toISOString(),
  },
];

const LOCAL_STORAGE_KEY_LAST_EDIT = 'iitkgp_timetable_last_edit_v1';

export function touchLocalLastEdit(timestamp?: number): void {
  const ts = timestamp || Date.now();
  localStorage.setItem(LOCAL_STORAGE_KEY_LAST_EDIT, ts.toString());
}

export function getLocalLastEdit(): number {
  return Number(localStorage.getItem(LOCAL_STORAGE_KEY_LAST_EDIT) || 0);
}

export async function checkSyncWithServer(): Promise<{ needsRefresh: boolean; serverLastEdit: number }> {
  try {
    const res = await fetch('/api/sync-check', { headers: getAuthHeaders() });
    if (res.ok) {
      const data = await res.json();
      const serverLastEdit = Number(data.lastEdit || 0);
      const localLastEdit = getLocalLastEdit();
      if (serverLastEdit > localLastEdit) {
        touchLocalLastEdit(serverLastEdit);
        return { needsRefresh: true, serverLastEdit };
      }
    }
  } catch (e) {
    console.error('Sync check error:', e);
  }
  return { needsRefresh: false, serverLastEdit: 0 };
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_AUTH);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.token) {
        headers['Authorization'] = `Bearer ${parsed.token}`;
      }
    }
  } catch (e) {
    console.error('Error reading auth headers:', e);
  }
  return headers;
}

// ─── AUTHENTICATION (Server-Side Verified, 30 Days Expiry) ───────
export function checkAuthSession(): { isAuthenticated: boolean; expiresAt: number | null } {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_AUTH);
    if (!raw) return { isAuthenticated: false, expiresAt: null };
    const parsed = JSON.parse(raw);
    const now = Date.now();
    if (parsed.authenticated && parsed.expiresAt > now) {
      return { isAuthenticated: true, expiresAt: parsed.expiresAt };
    }
  } catch (e) {
    console.error('Failed to read auth state:', e);
  }
  return { isAuthenticated: false, expiresAt: null };
}

/**
 * Verifies passcode with backend API (/api/verify-auth).
 * Server returns authenticated token and expiration.
 */
export async function verifyAuthPasscode(password: string): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/verify-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      const expiresAt = data.expiresAt || (Date.now() + 30 * 24 * 60 * 60 * 1000);
      localStorage.setItem(
        LOCAL_STORAGE_KEY_AUTH,
        JSON.stringify({ authenticated: true, token: data.token, expiresAt })
      );
      touchLocalLastEdit();
      return { success: true, message: data.message || 'Access granted for 30 days.' };
    }

    return {
      success: false,
      message: data.message || 'Invalid security passcode.',
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Failed to connect to authentication server.',
    };
  }
}

export function logoutAuthSession(): void {
  localStorage.removeItem(LOCAL_STORAGE_KEY_AUTH);
}

// ─── ROOM PREFERENCES ─────────────────────────────────────────────
export async function getRoomPreferences(): Promise<Record<string, string>> {
  if (!checkAuthSession().isAuthenticated) return {};
  try {
    const res = await fetch('/api/rooms', { headers: getAuthHeaders() });
    if (res.ok) {
      const data = await res.json();
      if (data && Object.keys(data).length > 0) return data;
    } else if (res.status === 401) {
      return {};
    }
  } catch {
    // API server fallback
  }

  const raw = localStorage.getItem(LOCAL_STORAGE_KEY_ROOMS);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch { /* fallback */ }
  }
  localStorage.setItem(LOCAL_STORAGE_KEY_ROOMS, JSON.stringify(DEFAULT_ROOM_PREFS));
  return DEFAULT_ROOM_PREFS;
}

export async function saveRoomPreference(subjectCode: string, room: string): Promise<Record<string, string>> {
  const current = await getRoomPreferences();
  const updated = { ...current, [subjectCode]: room };
  localStorage.setItem(LOCAL_STORAGE_KEY_ROOMS, JSON.stringify(updated));
  touchLocalLastEdit();

  try {
    await fetch('/api/rooms', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ subjectCode, room }),
    });
  } catch { /* fallback */ }

  return updated;
}

// ─── REMINDERS ───────────────────────────────────────────────────
export async function getReminders(): Promise<Reminder[]> {
  if (!checkAuthSession().isAuthenticated) return [];
  try {
    const res = await fetch('/api/reminders', { headers: getAuthHeaders() });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) return data;
    } else if (res.status === 401) {
      return [];
    }
  } catch { /* fallback */ }

  const raw = localStorage.getItem(LOCAL_STORAGE_KEY_REMINDERS);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch { /* fallback */ }
  }

  localStorage.setItem(LOCAL_STORAGE_KEY_REMINDERS, JSON.stringify(INITIAL_REMINDERS));
  return INITIAL_REMINDERS;
}

export async function saveReminder(reminder: Omit<Reminder, 'id' | 'created_at'> & { id?: string }): Promise<Reminder[]> {
  const current = await getReminders();
  let updated: Reminder[];

  if (reminder.id) {
    updated = current.map((r) => (r.id === reminder.id ? { ...r, ...reminder } as Reminder : r));
  } else {
    const newRem: Reminder = {
      ...reminder,
      id: 'rem-' + Date.now(),
      created_at: new Date().toISOString(),
    };
    updated = [newRem, ...current];
  }

  localStorage.setItem(LOCAL_STORAGE_KEY_REMINDERS, JSON.stringify(updated));
  touchLocalLastEdit();

  try {
    await fetch('/api/reminders', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(reminder),
    });
  } catch { /* fallback */ }

  return updated;
}

export async function deleteReminder(id: string): Promise<Reminder[]> {
  const current = await getReminders();
  const updated = current.filter((r) => r.id !== id);
  localStorage.setItem(LOCAL_STORAGE_KEY_REMINDERS, JSON.stringify(updated));
  touchLocalLastEdit();

  try {
    await fetch(`/api/reminders/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
  } catch { /* fallback */ }

  return updated;
}

export async function toggleReminderStatus(id: string): Promise<Reminder[]> {
  const current = await getReminders();
  const updated = current.map((r) =>
    r.id === id ? { ...r, status: r.status === 'completed' ? 'pending' : 'completed' } as Reminder : r
  );
  localStorage.setItem(LOCAL_STORAGE_KEY_REMINDERS, JSON.stringify(updated));
  touchLocalLastEdit();

  try {
    await fetch(`/api/reminders/${id}/toggle`, {
      method: 'PUT',
      headers: getAuthHeaders(),
    });
  } catch { /* fallback */ }

  return updated;
}

// ─── SMTP EMAIL ALERT DISPATCH ───────────────────────────────────
export async function sendEmailNotification(payload: {
  recipient: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    console.error('Email API call error:', err);
    return {
      success: false,
      message: err.message || 'Failed to connect to email backend service.',
    };
  }
}

// ─── INTERN TRACKER ───────────────────────────────────────────────
export async function getInternRoles(): Promise<InternCompany[]> {
  if (!checkAuthSession().isAuthenticated) return [];
  try {
    const res = await fetch('/api/interns', { headers: getAuthHeaders() });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) return data;
    }
  } catch {
    // API server fallback
  }
  return [];
}

export async function saveInternRole(role: InternCompany): Promise<boolean> {
  if (!checkAuthSession().isAuthenticated) return false;
  
  touchLocalLastEdit();

  // Synchronize with local storage reminders list
  try {
    const remId = 'rem-interview-' + role.id;
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_REMINDERS);
    let current = raw ? JSON.parse(raw) : [];
    if (!role.interviewDate) {
      current = current.filter((r: any) => r.id !== remId);
    } else {
      let dueDate = '';
      let dueTime = '23:59';
      const parts = role.interviewDate.trim().split(/\s+/);
      if (parts.length >= 1) {
        const datePart = parts[0];
        const timePart = parts[1] || '23:59';
        if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
          dueDate = datePart;
        } else if (/^\d{2}-\d{2}-\d{4}$/.test(datePart)) {
          const [d, m, y] = datePart.split('-');
          dueDate = `${y}-${m}-${d}`;
        }
        if (/^\d{2}:\d{2}$/.test(timePart)) {
          dueTime = timePart;
        }
      }
      if (dueDate) {
        const existingIdx = current.findIndex((r: any) => r.id === remId);
        const newRem = {
          id: remId,
          title: `Interview: ${role.company}`,
          subject_code: 'INTERNSHIP',
          type: 'exam',
          due_date: dueDate,
          due_time: dueTime,
          priority: 'high',
          status: 'pending',
          send_email: true,
          description: `Interview session scheduled for ${role.company} (${role.positionNote || 'Intern'}).`,
          created_at: new Date().toISOString()
        };
        if (existingIdx >= 0) {
          current[existingIdx] = { ...current[existingIdx], ...newRem };
        } else {
          current.unshift(newRem);
        }
      }
    }
    localStorage.setItem(LOCAL_STORAGE_KEY_REMINDERS, JSON.stringify(current));
  } catch (e) {
    console.error('Failed to sync interview date to local reminders:', e);
  }

  try {
    const res = await fetch('/api/interns', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(role),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── ATTENDANCE TRACKER ───────────────────────────────────────────
export async function getAttendanceRecords(): Promise<AttendanceRecord[]> {
  if (!checkAuthSession().isAuthenticated) return [];
  try {
    const res = await fetch('/api/attendance', { headers: getAuthHeaders() });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) return data;
    }
  } catch {
    // API fallback
  }

  const raw = localStorage.getItem(LOCAL_STORAGE_KEY_ATTENDANCE);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch { /* fallback */ }
  }
  return [];
}

export async function saveAttendanceRecord(record: Omit<AttendanceRecord, 'id' | 'created_at'> & { id?: string }): Promise<AttendanceRecord[]> {
  const current = await getAttendanceRecords();
  let updated: AttendanceRecord[];

  const id = record.id || 'att-' + Date.now();
  const fullRec: AttendanceRecord = {
    ...record,
    id,
    created_at: new Date().toISOString(),
  };

  const existingIdx = current.findIndex(r => r.id === id);
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = fullRec;
  } else {
    updated = [fullRec, ...current];
  }

  localStorage.setItem(LOCAL_STORAGE_KEY_ATTENDANCE, JSON.stringify(updated));
  touchLocalLastEdit();

  try {
    await fetch('/api/attendance', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(fullRec),
    });
  } catch { /* fallback */ }

  return updated;
}

export async function deleteAttendanceRecord(id: string): Promise<AttendanceRecord[]> {
  const current = await getAttendanceRecords();
  const updated = current.filter(r => r.id !== id);
  localStorage.setItem(LOCAL_STORAGE_KEY_ATTENDANCE, JSON.stringify(updated));
  touchLocalLastEdit();

  try {
    await fetch(`/api/attendance/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
  } catch { /* fallback */ }

  return updated;
}

