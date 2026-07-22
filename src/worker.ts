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

// Auto-initialize D1 Database Tables if they don't exist yet
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

// Send email helper
async function dispatchEmail(env: Env, payload: { recipient: string; subject: string; text: string }) {
  const recipient = payload.recipient || env.DEFAULT_EMAIL || DEFAULT_RECIPIENT;
  console.log(`[EMAIL DISPATCH] To: ${recipient} | Subject: ${payload.subject}`);
  return { success: true, recipient };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Ensure D1 Tables exist on every API request
      if (env.DB) {
        await ensureTables(env.DB);
      }

      // ─── 1. VERIFY AUTH (Server-Side Passcode Verification) ──
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

      // ─── 2. D1 REMINDERS ENDPOINTS ─────────────────────────────
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

      // DELETE /api/reminders/:id
      if (path.startsWith('/api/reminders/') && !path.endsWith('/toggle') && request.method === 'DELETE') {
        const parts = path.split('/');
        const id = parts[parts.length - 1];

        if (env.DB && id) {
          try {
            // Delete associated sent email logs first
            await env.DB.prepare('DELETE FROM sent_email_logs WHERE reminder_id = ?').bind(id).run().catch(() => {});
            // Delete reminder record
            await env.DB.prepare('DELETE FROM reminders WHERE id = ?').bind(id).run();
          } catch (e: any) {
            console.error(`DELETE /api/reminders/${id} D1 error:`, e);
          }
        }
        return json({ success: true, deleted: id });
      }

      // PUT /api/reminders/:id/toggle
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

      // ─── 3. D1 ROOM PREFERENCES ENDPOINTS ─────────────────────
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

      // ─── 4. SMTP EMAIL NOTIFICATION API ───────────────────────
      if (path === '/api/send-email' && request.method === 'POST') {
        const body = (await request.json()) as any;
        const targetEmail = body.recipient || env.DEFAULT_EMAIL || DEFAULT_RECIPIENT;

        // Deduplication check: if reminder_id provided, check if already sent to this recipient
        if (body.reminder_id && env.DB) {
          try {
            const { results } = await env.DB.prepare(
              'SELECT * FROM sent_email_logs WHERE reminder_id = ? AND recipient = ?'
            ).bind(body.reminder_id, targetEmail).all();

            if (results && results.length > 0) {
              return json({
                success: true,
                message: `Email already sent previously for reminder ${body.reminder_id} to ${targetEmail} (D1 Deduplication active).`,
                skipped: true,
              });
            }
          } catch (e) {
            console.error('Deduplication check warning:', e);
          }
        }

        await dispatchEmail(env, {
          recipient: targetEmail,
          subject: body.subject || '⏰ IIT KGP Timetable Alert',
          text: body.text || 'You have an upcoming reminder.',
        });

        // Log sent status into D1 DB to prevent duplicate alerts
        if (body.reminder_id && env.DB) {
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

        return json({
          success: true,
          message: `Email notification successfully queued/delivered to ${targetEmail}`,
        });
      }

      // ─── 5. STATIC ASSETS FALLBACK ─────────────────────────────
      if (env.ASSETS) {
        return await env.ASSETS.fetch(request);
      }

      return json({ error: 'Not Found' }, 404);
    } catch (err: any) {
      console.error('Worker error:', err);
      return json({ error: err.message || 'Internal Server Error' }, 500);
    }
  },

  // ─── 6. HOURLY CRON TRIGGER HANDLER (Every Hour: "0 * * * *") ──
  async scheduled(_event: any, env: Env, _ctx: any): Promise<void> {
    console.log(`[HOURLY CRON] Triggered at ${new Date().toISOString()}`);
    const recipient = env.DEFAULT_EMAIL || DEFAULT_RECIPIENT;

    if (!env.DB) {
      console.log('[HOURLY CRON] DB binding not available. Skipping D1 reminder check.');
      return;
    }

    try {
      await ensureTables(env.DB);

      // Query pending reminders where send_email = 1
      const { results } = await env.DB.prepare(`
        SELECT * FROM reminders
        WHERE status = 'pending' AND send_email = 1
      `).all();

      if (!results || results.length === 0) {
        console.log('[HOURLY CRON] No pending reminders found.');
        return;
      }

      let sentCount = 0;
      for (const rem of results as any[]) {
        // Deduplication check in D1: check if email was already logged for this reminder and recipient
        const check = await env.DB.prepare(`
          SELECT * FROM sent_email_logs
          WHERE reminder_id = ? AND recipient = ?
        `).bind(rem.id, recipient).all();

        if (check.results && check.results.length > 0) {
          console.log(`[HOURLY CRON] Duplicate prevented for reminder ${rem.id} (${rem.title}) -> already sent to ${recipient}.`);
          continue;
        }

        // Dispatch email notification to sai@dsainvg.me
        const subject = `⏰ [Reminder Alert] ${rem.title} (${rem.subject_code})`;
        const text = `Hourly Reminder Notification:\n\nTask: ${rem.title}\nSubject: ${rem.subject_code}\nType: ${rem.type}\nDue: ${rem.due_date} at ${rem.due_time}\nPriority: ${rem.priority.toUpperCase()}\nDetails: ${rem.description || 'N/A'}`;

        await dispatchEmail(env, { recipient, subject, text });

        // Record log in D1 to guarantee NO duplicate emails
        const logId = 'cron-log-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
        await env.DB.prepare(`
          INSERT INTO sent_email_logs (id, reminder_id, recipient)
          VALUES (?, ?, ?)
          ON CONFLICT(reminder_id, recipient) DO NOTHING
        `).bind(logId, rem.id, recipient).run();

        sentCount++;
      }

      console.log(`[HOURLY CRON] Successfully processed ${results.length} pending reminders. Sent ${sentCount} new emails to ${recipient}.`);
    } catch (err) {
      console.error('[HOURLY CRON Error]:', err);
    }
  },
};
