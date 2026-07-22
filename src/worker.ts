// @ts-ignore
import { connect } from 'cloudflare:sockets';

export interface Env {
  DB?: any;
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
  APP_PASSWORD?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  DEFAULT_EMAIL?: string;
}

const DEFAULT_RECIPIENT = 'sai@dsainvg.me';

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

// Direct Gmail SMTP Dispatcher using Cloudflare TLS Sockets over Port 465
async function sendGmailSmtp(options: {
  smtpUser: string;
  smtpPass: string;
  recipient: string;
  subject: string;
  text: string;
}) {
  const { smtpUser, smtpPass, recipient, subject, text } = options;

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
      // SMTP responses end with CRLF
      if (buffer.endsWith('\r\n') || buffer.includes('\n')) {
        break;
      }
    }
    console.log('[SMTP IN]', buffer.trim());
    return buffer;
  }

  async function sendCmd(cmd: string): Promise<string> {
    console.log('[SMTP OUT]', cmd.startsWith('AUTH') || cmd.length > 20 ? '[CREDENTIALS HIDDEN]' : cmd);
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

    // 9. Send Email Headers & Body
    const rawMessage =
      `From: "IIT KGP Timetable Portal" <${smtpUser}>\r\n` +
      `To: <${recipient}>\r\n` +
      `Subject: ${subject}\r\n` +
      `Content-Type: text/plain; charset=utf-8\r\n` +
      `Date: ${new Date().toUTCString()}\r\n` +
      `\r\n` +
      `${text}\r\n` +
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
      message: `Email successfully sent to ${recipient} via Gmail SMTP (${smtpUser})!`,
    };
  } catch (err: any) {
    try { socket.close(); } catch {}
    console.error('[GMAIL SMTP ERROR]', err);
    throw err;
  }
}

// Wrapper Helper
async function dispatchEmail(env: Env, payload: { recipient: string; subject: string; text: string }) {
  const recipient = payload.recipient || env.DEFAULT_EMAIL || DEFAULT_RECIPIENT;
  const smtpUser = env.SMTP_USER || 'onlyforgdb@gmail.com';
  const smtpPass = env.SMTP_PASS || '';

  if (!smtpPass) {
    return {
      success: false,
      message: `Gmail SMTP_PASS secret is missing. Configure it on Cloudflare via: npx wrangler secret put SMTP_PASS`,
    };
  }

  try {
    return await sendGmailSmtp({
      smtpUser,
      smtpPass,
      recipient,
      subject: payload.subject,
      text: payload.text,
    });
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Gmail SMTP dispatch failed.',
    };
  }
}

// Auto-initialize D1 Database Tables
async function ensureTables(db: any) {
  if (!db) return;
  try {
    await db.batch([
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
    ]);
  } catch (err) {
    console.error('D1 Table Auto-Init Warning:', err);
  }
}

// ─── DAILY MORNING SUMMARY (7:00 AM) ──────────────────────────────────
async function sendDailyMorningSummary(env: Env, recipient: string) {
  const todayStr = new Date().toISOString().split('T')[0];
  const summaryKey = `daily-summary-${todayStr}`;

  const check = await env.DB.prepare(
    'SELECT * FROM sent_email_logs WHERE reminder_id = ? AND recipient = ?'
  ).bind(summaryKey, recipient).all();

  if (check.results && check.results.length > 0) {
    console.log(`[DAILY CRON] Summary already sent for ${todayStr}. Skipping.`);
    return;
  }

  const { results: dueTasks } = await env.DB.prepare(
    "SELECT * FROM reminders WHERE due_date = ? AND status = 'pending'"
  ).bind(todayStr).all();

  const taskList = (dueTasks || []) as any[];
  const taskText = taskList.length > 0
    ? taskList.map(t => `• [${t.subject_code}] ${t.title} (${t.due_time || '23:59'})`).join('\n')
    : 'No pending tasks due today.';

  const subject = `🌅 [Daily Morning Summary] ${todayStr} - IIT Kharagpur`;
  const text = `Good Morning!\n\nHere is your daily summary for ${todayStr}:\n\n📋 Tasks Due Today:\n${taskText}\n\nHave a productive day!`;

  await dispatchEmail(env, { recipient, subject, text });

  await env.DB.prepare(
    'INSERT INTO sent_email_logs (id, reminder_id, recipient) VALUES (?, ?, ?) ON CONFLICT DO NOTHING'
  ).bind('log-' + Date.now(), summaryKey, recipient).run();
}

// ─── SUNDAY WEEKLY SUMMARY (8:00 AM SUNDAY) ───────────────────────────
async function sendSundayWeeklySummary(env: Env, recipient: string) {
  const todayStr = new Date().toISOString().split('T')[0];
  const summaryKey = `sunday-weekly-summary-${todayStr}`;

  const check = await env.DB.prepare(
    'SELECT * FROM sent_email_logs WHERE reminder_id = ? AND recipient = ?'
  ).bind(summaryKey, recipient).all();

  if (check.results && check.results.length > 0) {
    console.log(`[SUNDAY CRON] Weekly summary already sent for ${todayStr}. Skipping.`);
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

  const doneText = doneList.length > 0
    ? doneList.map(t => `✓ [${t.subject_code}] ${t.title}`).join('\n')
    : 'No completed tasks recorded this week.';

  const pendingText = pendingList.length > 0
    ? pendingList.map(t => `⏳ [${t.subject_code}] ${t.title} (Due: ${t.due_date} ${t.due_time})`).join('\n')
    : 'All caught up! No pending tasks.';

  const subject = `📊 [Sunday Weekly Summary] Done & Upcoming Tasks - IIT Kharagpur`;
  const text = `Happy Sunday!\n\nHere is your Weekly Summary:\n\n✅ DONE STUFF (Completed Tasks):\n${doneText}\n\n📌 NEED TO DO STUFF (Upcoming Tasks):\n${pendingText}\n\nGood luck for the upcoming week!`;

  await dispatchEmail(env, { recipient, subject, text });

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

    const subject = `⏰ [Reminder Alert] ${rem.title} (${rem.subject_code})`;
    const text = `Reminder Notification:\n\nTask: ${rem.title}\nSubject: ${rem.subject_code}\nType: ${rem.type}\nDue: ${rem.due_date} at ${rem.due_time}\nPriority: ${rem.priority.toUpperCase()}\nDetails: ${rem.description || 'N/A'}`;

    await dispatchEmail(env, { recipient, subject, text });

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
          return json({
            success: true,
            expiresAt,
            message: 'Authentication successful. Access granted for 10 days.',
          });
        } else {
          return json({ success: false, message: 'Invalid security passcode.' }, 401);
        }
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

        const dispatchResult = await dispatchEmail(env, {
          recipient: targetEmail,
          subject: body.subject || '⏰ IIT KGP Timetable Alert',
          text: body.text || 'You have an upcoming class or task reminder.',
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
    const recipient = env.DEFAULT_EMAIL || DEFAULT_RECIPIENT;

    console.log(`[CRON TRIGGER] ${cron} fired at ${now.toISOString()}`);

    if (!env.DB) {
      console.log('[CRON] DB binding not available. Skipping D1 checks.');
      return;
    }

    try {
      await ensureTables(env.DB);

      if (cron === '0 8 * * 0' || (now.getDay() === 0 && now.getHours() === 8)) {
        await sendSundayWeeklySummary(env, recipient);
        return;
      }

      if (cron === '0 7 * * *' || now.getHours() === 7) {
        await sendDailyMorningSummary(env, recipient);
        return;
      }

      await processHourlyReminders(env, recipient);
    } catch (err) {
      console.error('[CRON Handler Error]:', err);
    }
  },
};
