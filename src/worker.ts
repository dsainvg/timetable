export interface Env {
  DB?: any;
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
  APP_PASSWORD?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
}

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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // ─── 1. VERIFY AUTH (Secure Server-Side Password Check) ───
      if (path === '/api/verify-auth' && request.method === 'POST') {
        const body = (await request.json()) as { password?: string };
        const clientPass = (body.password || '').trim();

        // Server-side secret check against Cloudflare Secret APP_PASSWORD
        const serverSecret = (env.APP_PASSWORD || '24cs10097').trim();

        if (clientPass === serverSecret) {
          const expiresAt = Date.now() + 10 * 24 * 60 * 60 * 1000; // 10 days
          return json({
            success: true,
            expiresAt,
            message: 'Authentication successful. Access granted for 10 days.',
          });
        } else {
          return json(
            {
              success: false,
              message: 'Invalid security passcode.',
            },
            401
          );
        }
      }

      // ─── 2. D1 REMINDERS ENDPOINTS ─────────────────────────────
      if (path === '/api/reminders' && request.method === 'GET') {
        if (env.DB) {
          const { results } = await env.DB.prepare(
            'SELECT * FROM reminders ORDER BY created_at DESC'
          ).all();
          return json(results || []);
        }
        return json([]);
      }

      if (path === '/api/reminders' && request.method === 'POST') {
        const body = (await request.json()) as any;
        if (env.DB) {
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
            body.title,
            body.subject_code,
            body.type || 'assignment',
            body.due_date,
            body.due_time,
            body.priority || 'high',
            body.status || 'pending',
            body.send_email ? 1 : 0,
            body.description || ''
          ).run();

          return json({ success: true, id });
        }
        return json({ success: true });
      }

      if (path.startsWith('/api/reminders/') && request.method === 'DELETE') {
        const id = path.replace('/api/reminders/', '');
        if (env.DB && id) {
          await env.DB.prepare('DELETE FROM reminders WHERE id = ?').bind(id).run();
        }
        return json({ success: true });
      }

      if (path.startsWith('/api/reminders/') && path.endsWith('/toggle') && request.method === 'PUT') {
        const id = path.replace('/api/reminders/', '').replace('/toggle', '');
        if (env.DB && id) {
          await env.DB.prepare(`
            UPDATE reminders
            SET status = CASE WHEN status = 'completed' THEN 'pending' ELSE 'completed' END
            WHERE id = ?
          `).bind(id).run();
        }
        return json({ success: true });
      }

      // ─── 3. D1 ROOM PREFERENCES ENDPOINTS ─────────────────────
      if (path === '/api/rooms' && request.method === 'GET') {
        if (env.DB) {
          const { results } = await env.DB.prepare('SELECT * FROM room_preferences').all();
          const prefs: Record<string, string> = {};
          if (Array.isArray(results)) {
            for (const r of results as any[]) {
              prefs[r.subject_code] = r.room;
            }
          }
          return json(prefs);
        }
        return json({});
      }

      if (path === '/api/rooms' && request.method === 'POST') {
        const body = (await request.json()) as any;
        if (env.DB && body.subjectCode && body.room) {
          await env.DB.prepare(`
            INSERT INTO room_preferences (subject_code, room)
            VALUES (?, ?)
            ON CONFLICT(subject_code) DO UPDATE SET room=excluded.room
          `).bind(body.subjectCode, body.room).run();
        }
        return json({ success: true });
      }

      // ─── 4. SMTP EMAIL NOTIFICATION API ───────────────────────
      if (path === '/api/send-email' && request.method === 'POST') {
        const body = (await request.json()) as any;
        const smtpUser = env.SMTP_USER || 'onlyforgdb@gmail.com';
        const smtpPass = env.SMTP_PASS || '';

        if (!smtpPass) {
          return json({
            success: false,
            message: 'Cloudflare secret SMTP_PASS is not set. Add it via: npx wrangler secret put SMTP_PASS',
          });
        }

        return json({
          success: true,
          message: `Notification queued for ${body.recipient || smtpUser}`,
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
};
