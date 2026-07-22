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

const LOCAL_STORAGE_KEY_REMINDERS = 'iitkgp_timetable_reminders_v1';
const LOCAL_STORAGE_KEY_ROOMS = 'iitkgp_timetable_room_prefs_v1';
const LOCAL_STORAGE_KEY_AUTH = 'iitkgp_timetable_auth_v1';

// Initial default room selections requested by user
const DEFAULT_ROOM_PREFS: Record<string, string> = {
  CS31007: 'NC241',
  CS31003: 'NC241',
  CS31005: 'NC231',
};

// Initial sample reminders
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

// --- AUTHENTICATION (10 Days Expiry) ---
export const AUTH_PASSWORD_DEFAULT = '24cs10097';
export const AUTH_EXPIRY_DAYS = 10;

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
    console.error('Failed to read auth state from localStorage:', e);
  }
  return { isAuthenticated: false, expiresAt: null };
}

export function saveAuthSession(): number {
  const expiresAt = Date.now() + AUTH_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  localStorage.setItem(
    LOCAL_STORAGE_KEY_AUTH,
    JSON.stringify({ authenticated: true, expiresAt })
  );
  return expiresAt;
}

export function logoutAuthSession(): void {
  localStorage.removeItem(LOCAL_STORAGE_KEY_AUTH);
}

// --- ROOM PREFERENCES ---
export async function getRoomPreferences(): Promise<Record<string, string>> {
  try {
    const res = await fetch('/api/rooms');
    if (res.ok) {
      const data = await res.json();
      if (data && Object.keys(data).length > 0) return data;
    }
  } catch {
    // API server not reachable, use LocalStorage
  }

  const raw = localStorage.getItem(LOCAL_STORAGE_KEY_ROOMS);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      // fallback
    }
  }
  localStorage.setItem(LOCAL_STORAGE_KEY_ROOMS, JSON.stringify(DEFAULT_ROOM_PREFS));
  return DEFAULT_ROOM_PREFS;
}

export async function saveRoomPreference(subjectCode: string, room: string): Promise<Record<string, string>> {
  const current = await getRoomPreferences();
  const updated = { ...current, [subjectCode]: room };

  localStorage.setItem(LOCAL_STORAGE_KEY_ROOMS, JSON.stringify(updated));

  try {
    await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subjectCode, room }),
    });
  } catch {
    // network fallback handled
  }

  return updated;
}

// --- REMINDERS ---
export async function getReminders(): Promise<Reminder[]> {
  try {
    const res = await fetch('/api/reminders');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) return data;
    }
  } catch {
    // fallback
  }

  const raw = localStorage.getItem(LOCAL_STORAGE_KEY_REMINDERS);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      // fallback
    }
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

  try {
    await fetch('/api/reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reminder),
    });
  } catch {
    // fallback
  }

  return updated;
}

export async function deleteReminder(id: string): Promise<Reminder[]> {
  const current = await getReminders();
  const updated = current.filter((r) => r.id !== id);
  localStorage.setItem(LOCAL_STORAGE_KEY_REMINDERS, JSON.stringify(updated));

  try {
    await fetch(`/api/reminders/${id}`, { method: 'DELETE' });
  } catch {
    // fallback
  }

  return updated;
}

export async function toggleReminderStatus(id: string): Promise<Reminder[]> {
  const current = await getReminders();
  const updated = current.map((r) =>
    r.id === id ? { ...r, status: r.status === 'completed' ? 'pending' : 'completed' } as Reminder : r
  );
  localStorage.setItem(LOCAL_STORAGE_KEY_REMINDERS, JSON.stringify(updated));

  try {
    await fetch(`/api/reminders/${id}/toggle`, { method: 'PUT' });
  } catch {
    // fallback
  }

  return updated;
}

// --- SMTP EMAIL ALERT DISPATCH ---
export async function sendEmailNotification(payload: {
  recipient: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
