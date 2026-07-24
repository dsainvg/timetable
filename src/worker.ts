// @ts-ignore
import { connect } from 'cloudflare:sockets';
import { INTERN_COMPANIES_DEFAULT } from './data/internData';
import { SCHEDULE_GRID, COURSES } from './data/timetableData';

export interface Env {
  DB?: any;
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
  APP_PASSWORD?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  DEFAULT_EMAIL?: string;
}

const DEFAULT_RECIPIENT = 'me@timio.dpdns.org';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

// ─── COURSE NAME & SHORT FORM MAPPING ────────────────────────────────
const COURSE_NAME_MAP: Record<string, { shortName: string; fullName: string }> = {
  CS61064: { shortName: 'HPPC', fullName: 'High Performance Parallel Programming' },
  CS39001: { shortName: 'Comp Org Lab', fullName: 'Computer Organization Laboratory' },
  CS31005: { shortName: 'Algo 2', fullName: 'Algorithms II' },
  CS31007: { shortName: 'Comp Org', fullName: 'Computer Organization & Architecture' },
  AI60213: { shortName: 'FLLM', fullName: 'Foundations of Large Language Models' },
  CS31003: { shortName: 'Compilers', fullName: 'Compilers' },
  CS39003: { shortName: 'Compilers Lab', fullName: 'Compilers Laboratory' },
};

function getSubjectDisplayName(code: string): string {
  const mapped = COURSE_NAME_MAP[code];
  return mapped ? `${mapped.shortName}` : code;
}

// ─── RICH HTML EMAIL TEMPLATE BUILDER ────────────────────────────────
function buildHtmlEmail(options: {
  title: string;
  subtitle?: string;
  contentHtml: string;
  accentColor?: string;
}) {
  const accent = options.accentColor || '#6366f1';
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #030712; color: #f3f4f6; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
    .header { background: linear-gradient(135deg, ${accent} 0%, #4338ca 100%); padding: 26px 28px; text-align: left; }
    .header h1 { margin: 0; font-size: 20px; color: #ffffff; font-weight: 800; letter-spacing: -0.02em; }
    .header p { margin: 6px 0 0; font-size: 12px; color: rgba(255,255,255,0.85); }
    .body { padding: 28px; font-size: 14px; line-height: 1.6; color: #cbd5e1; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 16px 20px; margin-bottom: 14px; }
    .card-title { font-size: 15px; font-weight: 700; color: #f8fafc; margin-bottom: 4px; }
    .card-sub { font-size: 12px; color: #94a3b8; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-top: 6px; }
    .badge-high { background: rgba(239,68,68,0.2); color: #f87171; border: 1px solid rgba(239,68,68,0.4); }
    .badge-medium { background: rgba(245,158,11,0.2); color: #fbbf24; border: 1px solid rgba(245,158,11,0.4); }
    .badge-low { background: rgba(74,222,128,0.2); color: #4ade80; border: 1px solid rgba(74,222,128,0.4); }
    .footer { border-top: 1px solid #1e293b; padding: 18px 28px; text-align: center; font-size: 11px; color: #64748b; background: #0b0f19; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${options.title}</h1>
      ${options.subtitle ? `<p>${options.subtitle}</p>` : ''}
    </div>
    <div class="body">
      ${options.contentHtml}
    </div>
    <div class="footer">
      This is an auto-generated mail from your IIT Kharagpur Timetable & Task Portal (24CS10097).
    </div>
  </div>
</body>
</html>
  `;
}

// Direct Gmail SMTP Dispatcher using Cloudflare TLS Sockets over Port 465
async function sendGmailSmtp(options: {
  smtpUser: string;
  smtpPass: string;
  recipient: string;
  subject: string;
  htmlContent: string;
}) {
  const { smtpUser, smtpPass, recipient, subject, htmlContent } = options;

  console.log(`[GMAIL SMTP CONNECT] Connecting to smtp.gmail.com:465 for ${recipient}...`);

  const socket = connect({ hostname: 'smtp.gmail.com', port: 465 }, { secureTransport: 'on' });
  const writer = socket.writable.getWriter();
  const reader = socket.readable.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  async function readResponse(): Promise<string> {
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value);
      if (buffer.endsWith('\r\n') || buffer.includes('\n')) {
        break;
      }
    }
    return buffer;
  }

  async function sendCmd(cmd: string): Promise<string> {
    await writer.write(encoder.encode(cmd + '\r\n'));
    return await readResponse();
  }

  try {
    // 1. Initial Greeting 220
    const greeting = await readResponse();
    if (!greeting.startsWith('220')) {
      throw new Error('SMTP Greeting failed: ' + greeting);
    }

    // 2. EHLO
    const ehlo = await sendCmd('EHLO localhost');
    if (!ehlo.startsWith('250')) {
      throw new Error('SMTP EHLO failed: ' + ehlo);
    }

    // 3. AUTH LOGIN
    const auth = await sendCmd('AUTH LOGIN');
    if (!auth.startsWith('334')) {
      throw new Error('SMTP AUTH LOGIN failed: ' + auth);
    }

    // 4. Username (base64)
    const userResp = await sendCmd(btoa(smtpUser));
    if (!userResp.startsWith('334')) {
      throw new Error('SMTP Username rejected: ' + userResp);
    }

    // 5. Password (base64)
    const cleanPass = smtpPass.replace(/\s+/g, '');
    const passResp = await sendCmd(btoa(cleanPass));
    if (!passResp.startsWith('235')) {
      throw new Error(`Gmail SMTP Auth Failed (235 expected): ${passResp}. Ensure Gmail App Password is configured.`);
    }

    // 6. MAIL FROM
    const mailFrom = await sendCmd(`MAIL FROM:<${smtpUser}>`);
    if (!mailFrom.startsWith('250')) {
      throw new Error('SMTP MAIL FROM failed: ' + mailFrom);
    }

    // 7. RCPT TO
    const rcptTo = await sendCmd(`RCPT TO:<${recipient}>`);
    if (!rcptTo.startsWith('250')) {
      throw new Error('SMTP RCPT TO failed: ' + rcptTo);
    }

    // 8. DATA
    const dataResp = await sendCmd('DATA');
    if (!dataResp.startsWith('354')) {
      throw new Error('SMTP DATA failed: ' + dataResp);
    }

    // 9. Send Email Message Content with HTML Headers
    const rawMessage =
      `From: "IIT KGP Timetable Portal" <${smtpUser}>\r\n` +
      `To: <${recipient}>\r\n` +
      `Subject: ${subject}\r\n` +
      `MIME-Version: 1.0\r\n` +
      `Content-Type: text/html; charset=utf-8\r\n` +
      `Date: ${new Date().toUTCString()}\r\n` +
      `\r\n` +
      `${htmlContent}\r\n` +
      `.\r\n`;

    await writer.write(encoder.encode(rawMessage));
    const sendResult = await readResponse();

    if (!sendResult.startsWith('250')) {
      throw new Error('SMTP Message submission failed: ' + sendResult);
    }

    // 10. QUIT
    await sendCmd('QUIT');
    try { socket.close(); } catch {}

    return {
      success: true,
      recipient,
      message: `Email successfully delivered to ${recipient} via Gmail SMTP!`,
    };
  } catch (err: any) {
    try { socket.close(); } catch {}
    console.error('[GMAIL SMTP ERROR]', err);
    throw err;
  }
}

// Wrapper Helper
async function dispatchEmail(env: Env, payload: { recipient: string; subject: string; text?: string; html?: string; title?: string; subtitle?: string; accentColor?: string }) {
  const recipient = payload.recipient || env.DEFAULT_EMAIL || DEFAULT_RECIPIENT;
  const smtpUser = env.SMTP_USER || 'onlyforgdb@gmail.com';
  const smtpPass = env.SMTP_PASS || '';

  if (!smtpPass) {
    return {
      success: false,
      message: `Gmail SMTP_PASS secret is missing. Configure it on Cloudflare via: npx wrangler secret put SMTP_PASS`,
    };
  }

  const htmlContent = payload.html || buildHtmlEmail({
    title: payload.title || payload.subject || 'IIT KGP Timetable Notification',
    subtitle: payload.subtitle || 'Autumn Semester 2026-2027',
    contentHtml: `<p style="margin:0;">${(payload.text || '').replace(/\n/g, '<br/>')}</p>`,
    accentColor: payload.accentColor || '#6366f1',
  });

  try {
    return await sendGmailSmtp({
      smtpUser,
      smtpPass,
      recipient,
      subject: payload.subject,
      htmlContent,
    });
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Gmail SMTP dispatch failed.',
    };
  }
}

let isDbInitialized = false;

function getHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString();
}

// Auto-initialize D1 Database Tables
async function ensureTables(db: any) {
  if (!db || isDbInitialized) return;
  
  const targetHash = getHash(JSON.stringify(INTERN_COMPANIES_DEFAULT));
  try {
    const result = await db.prepare("SELECT value FROM metadata WHERE key = 'companies_hash'").get();
    if (result && result.value === targetHash) {
      isDbInitialized = true;
      return;
    }
  } catch (err) {
    // If the metadata table doesn't exist, we proceed with full table creation and insert
  }

  try {
    await db.batch([
      db.prepare(`
        CREATE TABLE IF NOT EXISTS metadata (
          key TEXT PRIMARY KEY,
          value TEXT
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS reminders (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          subject_code TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'assignment',
          due_date TEXT NOT NULL,
          due_time TEXT DEFAULT '23:59',
          priority TEXT NOT NULL DEFAULT 'medium',
          status TEXT NOT NULL DEFAULT 'pending',
          send_email INTEGER DEFAULT 1,
          description TEXT DEFAULT '',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS room_preferences (
          subject_code TEXT PRIMARY KEY,
          selected_room TEXT NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS sent_email_logs (
          id TEXT PRIMARY KEY,
          reminder_id TEXT NOT NULL,
          recipient TEXT NOT NULL,
          sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(reminder_id, recipient)
        )
      `),
      db.prepare(`
        CREATE TABLE IF NOT EXISTS intern_roles (
          id TEXT PRIMARY KEY,
          company TEXT NOT NULL,
          ctc INTEGER NOT NULL,
          currency TEXT NOT NULL,
          apply_status TEXT NOT NULL,
          resume_start TEXT,
          resume_end TEXT,
          interview_date TEXT,
          position_note TEXT,
          sorting_done INTEGER DEFAULT 0,
          my_status TEXT DEFAULT 'not_applied',
          notes TEXT DEFAULT '',
          jnf_url TEXT,
          jnf_id TEXT,
          com_id TEXT,
          cgpa_cutoff TEXT,
          stipend TEXT,
          allowed_depts TEXT,
          allowed_degrees TEXT,
          job_description TEXT,
          selection_process TEXT,
          skills_required TEXT,
          duration TEXT,
          location TEXT,
          positions TEXT,
          tentative_start TEXT,
          application_status TEXT DEFAULT ''
        )
      `),
    ]);

    // Build a single batch query for all 72 roles (1 RTT total) to update static details
    const statements = INTERN_COMPANIES_DEFAULT.map(r => {
      return db.prepare(`
        INSERT INTO intern_roles (
          id, company, ctc, currency, apply_status, resume_start, resume_end, interview_date,
          position_note, sorting_done, my_status, notes, jnf_url, jnf_id, com_id,
          cgpa_cutoff, stipend, allowed_depts, allowed_degrees, job_description,
          selection_process, skills_required, duration, location, positions, tentative_start, application_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          company = excluded.company,
          ctc = excluded.ctc,
          currency = excluded.currency,
          apply_status = excluded.apply_status,
          resume_start = excluded.resume_start,
          resume_end = excluded.resume_end,
          position_note = excluded.position_note,
          jnf_url = excluded.jnf_url,
          jnf_id = excluded.jnf_id,
          com_id = excluded.com_id,
          cgpa_cutoff = excluded.cgpa_cutoff,
          stipend = excluded.stipend,
          allowed_depts = excluded.allowed_depts,
          allowed_degrees = excluded.allowed_degrees,
          job_description = excluded.job_description,
          selection_process = excluded.selection_process,
          skills_required = excluded.skills_required,
          duration = excluded.duration,
          location = excluded.location,
          positions = excluded.positions,
          tentative_start = excluded.tentative_start,
          application_status = excluded.application_status,
          my_status = CASE WHEN intern_roles.my_status = 'not_applied' THEN excluded.my_status ELSE intern_roles.my_status END
      `).bind(
        r.id, r.company, r.ctc, r.currency, r.applyStatus, r.resumeStart, r.resumeEnd, r.interviewDate || '',
        r.positionNote || '', r.sortingDone ? 1 : 0, r.myStatus, r.notes || '', r.jnfUrl || '', r.jnfId || '', r.comId || '',
        r.cgpaCutoff || '', r.stipend || '', JSON.stringify(r.allowedDepts || []), JSON.stringify(r.allowedDegrees || []),
        r.jobDescription || '', r.selectionProcess || '', r.skillsRequired || '', r.duration || '', r.location || '',
        r.positions || '', r.tentativeStart || '', r.applicationStatus || ''
      );
    });
    await db.batch(statements);

    // Save hash in metadata table
    await db.prepare("INSERT INTO metadata (key, value) VALUES ('companies_hash', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(targetHash).run();

    isDbInitialized = true;
  } catch (err) {
    console.error('D1 Table Auto-Init Warning:', err);
  }
}

// ─── IST (UTC+5:30) TIME HELPER ──────────────────────────────────────
function getISTDate(date = new Date()) {
  const istMillis = date.getTime() + (5 * 60 + 30) * 60 * 1000;
  const ist = new Date(istMillis);
  const year = ist.getUTCFullYear();
  const month = ist.getUTCMonth() + 1;
  const day = ist.getUTCDate();
  const hours = ist.getUTCHours();
  const minutes = ist.getUTCMinutes();
  const dayOfWeek = ist.getUTCDay();

  const mm = month < 10 ? `0${month}` : `${month}`;
  const dd = day < 10 ? `0${day}` : `${day}`;
  const dateString = `${year}-${mm}-${dd}`;

  return { year, month, day, hours, minutes, dayOfWeek, dateString };
}

// ─── DAILY MORNING SUMMARY (6:00 AM IST - NEXT 24 HOURS HORIZON) ──────
async function sendDailyMorningSummary(env: Env, recipient: string) {
  const ist = getISTDate();
  const todayStr = ist.dateString;
  
  const tomorrowDateObj = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const tomorrowIst = getISTDate(tomorrowDateObj);
  const tomorrowStr = tomorrowIst.dateString;

  const summaryKey = `daily-summary-${todayStr}`;

  const check = await env.DB.prepare(
    'SELECT * FROM sent_email_logs WHERE reminder_id = ? AND recipient = ?'
  ).bind(summaryKey, recipient).all();

  if (check.results && check.results.length > 0) {
    console.log(`[DAILY CRON] Summary already sent for ${todayStr} (IST). Skipping.`);
    return;
  }

  // 1. Fetch Room Preferences
  const roomPrefs: Record<string, string> = {};
  try {
    const { results: roomData } = await env.DB.prepare(
      "SELECT subject_code, selected_room FROM room_preferences"
    ).all();
    if (roomData) {
      for (const row of roomData) {
        roomPrefs[row.subject_code] = row.selected_room;
      }
    }
  } catch (e) {
    console.error('Failed to load room preferences for morning summary:', e);
  }

  // 2. Fetch classes for Next 24 Hours
  const DAY_MAP: Record<number, string> = {
    1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thur', 5: 'Fri',
  };
  const todayDayName = DAY_MAP[ist.dayOfWeek];
  const tomorrowDayName = DAY_MAP[tomorrowIst.dayOfWeek];

  const todaySlots = todayDayName
    ? SCHEDULE_GRID.filter(s => s.day === todayDayName).sort((a, b) => a.slotIndex - b.slotIndex)
    : [];

  const tomorrowSlots = tomorrowDayName
    ? SCHEDULE_GRID.filter(s => s.day === tomorrowDayName).sort((a, b) => a.slotIndex - b.slotIndex)
    : [];

  const combinedSlots = [
    ...todaySlots.map(s => ({ ...s, dayTag: "Today" })),
    ...tomorrowSlots.map(s => ({ ...s, dayTag: "Tomorrow" })),
  ];

  let classesHtml = '';
  if (combinedSlots.length > 0) {
    classesHtml = combinedSlots.map(s => {
      const course = COURSES[s.subjectCode];
      const room = roomPrefs[s.subjectCode] || s.defaultRoom;
      const color = course?.color || '#6366f1';
      const courseName = course?.name || s.subjectCode;
      const shortName = course?.shortName || s.subjectCode;
      return `
        <div class="card" style="border-left: 4px solid ${color};">
          <div class="card-title" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <span style="font-weight: 800; color: #f8fafc;">🏫 [${shortName}] ${courseName}</span>
            <span style="font-size: 11px; background: rgba(74,222,128,0.15); color: #4ade80; border: 1px solid rgba(74,222,128,0.3); border-radius: 6px; padding: 2px 8px; font-weight: 700; font-family: monospace; white-space: nowrap;">
              📍 ${room} (${s.dayTag})
            </span>
          </div>
          <div class="card-sub" style="font-size: 12px; color: #94a3b8;">
            Time slot: <strong>${s.startTime} - ${s.endTime}</strong> ${s.labSpan ? `(${s.labSpan}h block)` : ''}
          </div>
        </div>
      `;
    }).join('');
  } else {
    classesHtml = '<div class="card"><div class="card-title">🎉 Free Day!</div><div class="card-sub">No classes scheduled in the next 24 hours.</div></div>';
  }

  // 3. Fetch due tasks, tests & interviews due in Next 24 Hours
  const { results: dueTasks } = await env.DB.prepare(
    "SELECT * FROM reminders WHERE status = 'pending' AND (due_date = ? OR due_date = ?) ORDER BY due_date ASC, due_time ASC"
  ).bind(todayStr, tomorrowStr).all();

  const taskList = (dueTasks || []) as any[];
  const tasksHtml = taskList.length > 0
    ? taskList.map(t => {
        const subName = getSubjectDisplayName(t.subject_code);
        const dayTag = t.due_date === todayStr ? 'Today' : 'Tomorrow';
        return `
          <div class="card">
            <div class="card-title">📌 [${subName}] ${t.title}</div>
            <div class="card-sub">Due: <strong>${dayTag} at ${t.due_time || '23:59'}</strong> • ${t.description || 'No additional details'}</div>
            <span class="badge badge-${t.priority || 'high'}">${(t.priority || 'HIGH').toUpperCase()}</span>
          </div>
        `;
      }).join('')
    : '<div class="card"><div class="card-title">✨ All Caught Up!</div><div class="card-sub">No pending tasks, tests or interviews in the next 24 hours.</div></div>';

  const html = buildHtmlEmail({
    title: '🌅 Daily Summary & 24-Hour Horizon Report',
    subtitle: `Next 24 Hours Window (${todayStr} to ${tomorrowStr}) • Roll No: 24CS10097`,
    accentColor: '#6366f1',
    contentHtml: `
      <h3 style="color:#818cf8; margin-top:0; font-size:16px;">Good Morning!</h3>
      <p style="color:#94a3b8; font-size:13px;">Here is your accurate <strong>Next 24 Hours</strong> schedule, test breakdown, and task agenda (${todayStr} – ${tomorrowStr}):</p>
      
      <h4 style="color:#f8fafc; margin:20px 0 10px; font-size:14px;">📅 Next 24 Hours Classes:</h4>
      ${classesHtml}

      <h4 style="color:#f8fafc; margin:20px 0 10px; font-size:14px;">📋 Tasks & Tests Due (Next 24 Hours):</h4>
      ${tasksHtml}
    `,
  });

  const subject = `🌅 [Next 24 Hours Summary] ${todayStr} - IIT Kharagpur`;
  await dispatchEmail(env, { recipient, subject, html });

  await env.DB.prepare(
    'INSERT INTO sent_email_logs (id, reminder_id, recipient) VALUES (?, ?, ?) ON CONFLICT DO NOTHING'
  ).bind('log-' + Date.now(), summaryKey, recipient).run();
}

// ─── SUNDAY WEEKLY SUMMARY (6:00 AM IST SUNDAY) ───────────────────────
async function sendSundayWeeklySummary(env: Env, recipient: string) {
  const ist = getISTDate();
  const todayStr = ist.dateString;
  const summaryKey = `sunday-weekly-summary-${todayStr}`;

  const check = await env.DB.prepare(
    'SELECT * FROM sent_email_logs WHERE reminder_id = ? AND recipient = ?'
  ).bind(summaryKey, recipient).all();

  if (check.results && check.results.length > 0) {
    console.log(`[SUNDAY CRON] Weekly summary already sent for ${todayStr} (IST). Skipping.`);
    return;
  }

  const { results: doneItems } = await env.DB.prepare(
    "SELECT * FROM reminders WHERE status = 'completed'"
  ).all();

  const { results: pendingItems } = await env.DB.prepare(
    "SELECT * FROM reminders WHERE status = 'pending' ORDER BY due_date ASC"
  ).all();

  const doneList = (doneItems || []) as any[];
  const pendingList = (pendingItems || []) as any[];

  const doneHtml = doneList.length > 0
    ? doneList.map(t => {
        const subName = getSubjectDisplayName(t.subject_code);
        return `<div class="card" style="border-color:rgba(74,222,128,0.3);"><div class="card-title" style="color:#4ade80;">✓ [${subName}] ${t.title}</div></div>`;
      }).join('')
    : '<div class="card"><div class="card-sub">No completed tasks recorded this week.</div></div>';

  const pendingHtml = pendingList.length > 0
    ? pendingList.map(t => {
        const subName = getSubjectDisplayName(t.subject_code);
        return `<div class="card" style="border-color:rgba(129,140,248,0.3);"><div class="card-title">⏳ [${subName}] ${t.title}</div><div class="card-sub">Due: ${t.due_date} ${t.due_time}</div></div>`;
      }).join('')
    : '<div class="card"><div class="card-sub">No upcoming pending tasks!</div></div>';

  const html = buildHtmlEmail({
    title: '📊 Sunday Weekly Summary & Progress Report (6:00 AM IST)',
    subtitle: `Week of ${todayStr} • IIT Kharagpur`,
    accentColor: '#7c3aed',
    contentHtml: `
      <h3 style="color:#a78bfa; margin-top:0; font-size:16px;">Happy Sunday!</h3>
      <p style="color:#94a3b8; font-size:13px;">Here is your weekly progress report detailing completed work and upcoming tasks:</p>
      
      <h4 style="color:#4ade80; margin:20px 0 10px; font-size:14px;">✅ DONE STUFF (Completed Work):</h4>
      ${doneHtml}

      <h4 style="color:#818cf8; margin:20px 0 10px; font-size:14px;">📌 NEED TO DO STUFF (Upcoming Tasks):</h4>
      ${pendingHtml}
    `,
  });

  const subject = `📊 [Sunday Weekly Summary] Done & Upcoming Tasks - IIT Kharagpur`;
  await dispatchEmail(env, { recipient, subject, html });

  await env.DB.prepare(
    'INSERT INTO sent_email_logs (id, reminder_id, recipient) VALUES (?, ?, ?) ON CONFLICT DO NOTHING'
  ).bind('log-' + Date.now(), summaryKey, recipient).run();
}

// ─── HOURLY REMINDERS CHECK ──────────────────────────────────────────
async function processHourlyReminders(env: Env, recipient: string) {
  const { results } = await env.DB.prepare(`
    SELECT * FROM reminders
    WHERE status = 'pending' AND send_email = 1
  `).all();

  if (!results || results.length === 0) return;

  let sentCount = 0;
  for (const rem of results as any[]) {
    const check = await env.DB.prepare(`
      SELECT * FROM sent_email_logs
      WHERE reminder_id = ? AND recipient = ?
    `).bind(rem.id, recipient).all();

    if (check.results && check.results.length > 0) continue;

    const subName = getSubjectDisplayName(rem.subject_code);
    const html = buildHtmlEmail({
      title: `⏰ Reminder: ${rem.title}`,
      subtitle: `Subject: ${subName} • Priority: ${rem.priority.toUpperCase()}`,
      accentColor: '#e11d48',
      contentHtml: `
        <div class="card">
          <div class="card-title">${rem.title}</div>
          <div class="card-sub">Course: ${subName} • Due: ${rem.due_date} at ${rem.due_time}</div>
          <p style="margin:10px 0 0; color:#e2e8f0; font-size:13px;">${rem.description || 'No additional details.'}</p>
          <span class="badge badge-${rem.priority || 'high'}">${(rem.priority || 'HIGH').toUpperCase()}</span>
        </div>
      `,
    });

    const subject = `⏰ [Reminder Alert] ${rem.title} (${subName})`;
    await dispatchEmail(env, { recipient, subject, html });

    const logId = 'cron-log-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
    await env.DB.prepare(`
      INSERT INTO sent_email_logs (id, reminder_id, recipient)
      VALUES (?, ?, ?)
      ON CONFLICT(reminder_id, recipient) DO NOTHING
    `).bind(logId, rem.id, recipient).run();

    sentCount++;
  }

  console.log(`[HOURLY CRON] Sent ${sentCount} new reminder emails to ${recipient}.`);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // ─── 1. ALL NON-API ROUTES (/tt, /interns, /reminders, /, etc.) ──
      if (!path.startsWith('/api/')) {
        if (env.ASSETS) {
          const assetRes = await env.ASSETS.fetch(request);
          if (assetRes.status !== 404) {
            return assetRes;
          }
          const indexUrl = new URL(request.url);
          indexUrl.pathname = '/index.html';
          return await env.ASSETS.fetch(new Request(indexUrl.toString(), {
            method: 'GET',
            headers: request.headers,
          }));
        }
        return json({ error: 'Asset binding not configured' }, 500);
      }

function generateSessionToken(expiresAt: number): string {
  const payload = JSON.stringify({ rollNo: '24cs10097', expiresAt, salt: 'kgp_timetable_2026' });
  return 'tt_token_' + btoa(payload).replace(/=/g, '');
}

function validateSessionToken(authHeader: string | null): boolean {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.substring(7).trim();
  if (!token.startsWith('tt_token_')) return false;
  try {
    const rawB64 = token.replace('tt_token_', '');
    const decoded = JSON.parse(atob(rawB64));
    if (decoded && decoded.expiresAt && decoded.expiresAt > Date.now()) {
      return true;
    }
  } catch (e) {
    return false;
  }
  return false;
}

      // ─── 2. API ROUTES (/api/*) ──────────────────────────────────
      if (env.DB) {
        await ensureTables(env.DB);
      }

      if (path === '/api/verify-auth' && request.method === 'POST') {
        const body = (await request.json()) as { password?: string };
        const clientPass = (body.password || '').trim();
        const serverSecret = (env.APP_PASSWORD || '24cs10097').trim();

        if (clientPass === serverSecret) {
          const expiresAt = Date.now() + 10 * 24 * 60 * 60 * 1000;
          const token = generateSessionToken(expiresAt);
          return json({
            success: true,
            token,
            expiresAt,
            message: 'Authentication successful. Access granted for 10 days.',
          });
        } else {
          return json({ success: false, message: 'Invalid security passcode.' }, 401);
        }
      }

      // Authorization Gatekeeper for protected API routes
      const authHeader = request.headers.get('Authorization');
      if (!validateSessionToken(authHeader)) {
        return json({ success: false, error: 'Unauthorized. Valid authentication token required.' }, 401);
      }

      if (path === '/api/interns' && request.method === 'GET') {
        if (env.DB) {
          try {
            const { results } = await env.DB.prepare(
              'SELECT * FROM intern_roles'
            ).all();
            const parsed = (results || []).map((row: any) => ({
              id: row.id,
              company: row.company,
              ctc: Number(row.ctc),
              currency: row.currency,
              applyStatus: row.apply_status,
              resumeStart: row.resume_start,
              resumeEnd: row.resume_end,
              interviewDate: row.interview_date,
              positionNote: row.position_note,
              sortingDone: row.sorting_done === 1,
              myStatus: row.my_status,
              notes: row.notes,
              jnfUrl: row.jnf_url,
              jnfId: row.jnf_id,
              comId: row.com_id,
              cgpaCutoff: row.cgpa_cutoff,
              stipend: row.stipend,
              allowedDepts: JSON.parse(row.allowed_depts || '[]'),
              allowedDegrees: JSON.parse(row.allowed_degrees || '[]'),
              jobDescription: row.job_description,
              selectionProcess: row.selection_process,
              skillsRequired: row.skills_required,
              duration: row.duration,
              location: row.location,
              positions: row.positions,
              tentativeStart: row.tentative_start,
              applicationStatus: row.application_status
            }));
            return json(parsed);
          } catch (e) {
            console.error('GET /api/interns D1 error:', e);
          }
        }
        return json(INTERN_COMPANIES_DEFAULT);
      }

      if (path === '/api/interns' && request.method === 'POST') {
        const body = (await request.json()) as any;
        if (env.DB) {
          try {
            await env.DB.prepare(`
              UPDATE intern_roles SET
                my_status = ?,
                sorting_done = ?,
                notes = ?,
                interview_date = ?
              WHERE id = ?
            `).bind(
              body.myStatus || 'not_applied',
              body.sortingDone ? 1 : 0,
              body.notes || '',
              body.interviewDate || '',
              body.id
            ).run();

            // Synchronize with reminders table
            const remId = 'rem-interview-' + body.id;
            if (!body.interviewDate) {
              await env.DB.prepare('DELETE FROM reminders WHERE id = ?').bind(remId).run().catch(() => {});
            } else {
              let dueDate = '';
              let dueTime = '23:59';
              const parts = (body.interviewDate || '').trim().split(/\s+/);
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
                await env.DB.prepare(`
                  INSERT INTO reminders (id, title, subject_code, type, due_date, due_time, priority, status, send_email, description)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(id) DO UPDATE SET
                    due_date = excluded.due_date,
                    due_time = excluded.due_time,
                    title = excluded.title,
                    description = excluded.description,
                    status = 'pending'
                `).bind(
                  remId,
                  `Interview: ${body.company}`,
                  'INTERNSHIP',
                  'exam',
                  dueDate,
                  dueTime,
                  'high',
                  'pending',
                  1,
                  `Interview session scheduled for ${body.company} (${body.positionNote || 'Intern'}).`
                ).run();
              }
            }

            return json({ success: true });
          } catch (e) {
            console.error('POST /api/interns D1 error:', e);
          }
        }
        return json({ success: true });
      }

      if (path === '/api/reminders' && request.method === 'GET') {
        if (env.DB) {
          try {
            const { results } = await env.DB.prepare(
              'SELECT * FROM reminders ORDER BY created_at DESC'
            ).all();
            return json(results || []);
          } catch (e) {
            console.error('GET /api/reminders D1 error:', e);
          }
        }
        return json([]);
      }

      if (path === '/api/reminders' && request.method === 'POST') {
        const body = (await request.json()) as any;
        if (env.DB) {
          try {
            const id = body.id || 'rem-' + Date.now();
            await env.DB.prepare(`
              INSERT INTO reminders (id, title, subject_code, type, due_date, due_time, priority, status, send_email, description)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                title=excluded.title,
                subject_code=excluded.subject_code,
                type=excluded.type,
                due_date=excluded.due_date,
                due_time=excluded.due_time,
                priority=excluded.priority,
                status=excluded.status,
                send_email=excluded.send_email,
                description=excluded.description
            `).bind(
              id,
              body.title || 'Untitled Reminder',
              body.subject_code || 'GENERAL',
              body.type || 'assignment',
              body.due_date || new Date().toISOString().split('T')[0],
              body.due_time || '23:59',
              body.priority || 'high',
              body.status || 'pending',
              body.send_email ? 1 : 0,
              body.description || ''
            ).run();

            return json({ success: true, id });
          } catch (e: any) {
            console.error('POST /api/reminders D1 error:', e);
            return json({ success: false, message: e.message }, 500);
          }
        }
        return json({ success: true });
      }

      if (path.startsWith('/api/reminders/') && !path.endsWith('/toggle') && request.method === 'DELETE') {
        const parts = path.split('/');
        const id = parts[parts.length - 1];

        if (env.DB && id) {
          try {
            await env.DB.prepare('DELETE FROM sent_email_logs WHERE reminder_id = ?').bind(id).run().catch(() => {});
            await env.DB.prepare('DELETE FROM reminders WHERE id = ?').bind(id).run();
          } catch (e: any) {
            console.error(`DELETE /api/reminders/${id} D1 error:`, e);
          }
        }
        return json({ success: true, deleted: id });
      }

      if (path.startsWith('/api/reminders/') && path.endsWith('/toggle') && request.method === 'PUT') {
        const parts = path.split('/');
        const id = parts[parts.length - 2];

        if (env.DB && id) {
          try {
            await env.DB.prepare(`
              UPDATE reminders
              SET status = CASE WHEN status = 'completed' THEN 'pending' ELSE 'completed' END
              WHERE id = ?
            `).bind(id).run();
          } catch (e: any) {
            console.error(`PUT /api/reminders/${id}/toggle D1 error:`, e);
          }
        }
        return json({ success: true, toggled: id });
      }

      if (path === '/api/rooms' && request.method === 'GET') {
        if (env.DB) {
          try {
            const { results } = await env.DB.prepare('SELECT * FROM room_preferences').all();
            const prefs: Record<string, string> = {};
            if (Array.isArray(results)) {
              for (const r of results as any[]) {
                prefs[r.subject_code] = r.selected_room || r.room;
              }
            }
            return json(prefs);
          } catch (e) {
            console.error('GET /api/rooms D1 error:', e);
          }
        }
        return json({});
      }

      if (path === '/api/rooms' && request.method === 'POST') {
        const body = (await request.json()) as any;
        if (env.DB && body.subjectCode && body.room) {
          try {
            await env.DB.prepare(`
              INSERT INTO room_preferences (subject_code, selected_room)
              VALUES (?, ?)
              ON CONFLICT(subject_code) DO UPDATE SET selected_room=excluded.selected_room
            `).bind(body.subjectCode, body.room).run();
          } catch (e) {
            console.error('POST /api/rooms D1 error:', e);
          }
        }
        return json({ success: true });
      }

      // ─── 4. GMAIL SMTP DISPATCH API ─────────────────────────────
      if (path === '/api/send-email' && request.method === 'POST') {
        const body = (await request.json()) as any;
        const targetEmail = body.recipient || env.DEFAULT_EMAIL || DEFAULT_RECIPIENT;

        if (body.reminder_id && env.DB) {
          try {
            const { results } = await env.DB.prepare(
              'SELECT * FROM sent_email_logs WHERE reminder_id = ? AND recipient = ?'
            ).bind(body.reminder_id, targetEmail).all();

            if (results && results.length > 0) {
              return json({
                success: true,
                message: `Email already sent previously to ${targetEmail}.`,
                skipped: true,
              });
            }
          } catch (e) {
            console.error('Deduplication check warning:', e);
          }
        }

        const html = buildHtmlEmail({
          title: body.subject || '🧪 Test Email Alert',
          subtitle: `Sent to ${targetEmail} • IIT Kharagpur Portal`,
          accentColor: '#6366f1',
          contentHtml: `
            <div class="card">
              <div class="card-title">Notification Details</div>
              <p style="margin:8px 0 0; color:#e2e8f0;">${body.text || 'This is a test notification from your IIT Kharagpur Timetable & Tasks Application.'}</p>
            </div>
          `,
        });

        const dispatchResult = await dispatchEmail(env, {
          recipient: targetEmail,
          subject: body.subject || '⏰ IIT KGP Timetable Alert',
          html,
        });

        if (body.reminder_id && env.DB && dispatchResult.success) {
          try {
            const logId = 'log-' + Date.now();
            await env.DB.prepare(`
              INSERT INTO sent_email_logs (id, reminder_id, recipient)
              VALUES (?, ?, ?)
              ON CONFLICT(reminder_id, recipient) DO NOTHING
            `).bind(logId, body.reminder_id, targetEmail).run();
          } catch (e) {
            console.error('sent_email_logs insert warning:', e);
          }
        }

        return json(dispatchResult, dispatchResult.success ? 200 : 400);
      }

      return json({ error: 'API Endpoint Not Found' }, 404);
    } catch (err: any) {
      console.error('Worker error:', err);
      return json({ error: err.message || 'Internal Server Error' }, 500);
    }
  },

  // ─── CRON TRIGGER HANDLER ──────────────────────────────────────
  async scheduled(event: any, env: Env, _ctx: any): Promise<void> {
    const cron = event.cron || '';
    const now = new Date();
    const ist = getISTDate(now);
    const recipient = env.DEFAULT_EMAIL || DEFAULT_RECIPIENT;

    console.log(`[CRON TRIGGER] ${cron} fired at ${now.toISOString()} (IST: ${ist.dateString} ${ist.hours}:${ist.minutes})`);

    if (!env.DB) {
      console.log('[CRON] DB binding not available. Skipping D1 checks.');
      return;
    }

    try {
      await ensureTables(env.DB);

      // Sunday Morning Summary at 6:00 AM IST (dayOfWeek === 0, hours === 6)
      if (ist.dayOfWeek === 0 && ist.hours === 6) {
        await sendSundayWeeklySummary(env, recipient);
        return;
      }

      // Daily Morning Summary at 6:00 AM IST (hours === 6)
      if (ist.hours === 6) {
        await sendDailyMorningSummary(env, recipient);
        return;
      }

      await processHourlyReminders(env, recipient);
    } catch (err) {
      console.error('[CRON Handler Error]:', err);
    }
  },
};
