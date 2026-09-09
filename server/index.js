import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// In-memory cache for API fallback
let remindersStore = [
  {
    id: 'rem-1',
    title: 'Parallel Programming Assignment 1',
    subject_code: 'CS61064',
    type: 'assignment',
    due_date: '2026-07-28',
    due_time: '23:59',
    priority: 'high',
    status: 'pending',
    send_email: true,
    description: 'Implement CUDA vector addition and matrix multiplication.',
    created_at: new Date().toISOString(),
  },
  {
    id: 'rem-2',
    title: 'Compilers Lab Lexer',
    subject_code: 'CS39003',
    type: 'assignment',
    due_date: '2026-07-29',
    due_time: '18:00',
    priority: 'medium',
    status: 'pending',
    send_email: true,
    description: 'Flex/Bison lexer specification for Mini-C language.',
    created_at: new Date().toISOString(),
  },
  {
    id: 'rem-3',
    title: 'Computer Org Midsem Exam Prep',
    subject_code: 'CS31007',
    type: 'exam',
    due_date: '2026-07-30',
    due_time: '10:00',
    priority: 'high',
    status: 'pending',
    send_email: false,
    description: 'Revise MIPS pipeline datapath and hazard unit in NC241.',
    created_at: new Date().toISOString(),
  },
];

let roomPrefsStore = {
  CS31007: 'NC241',
  CS31003: 'NC241',
  CS31005: 'NC231',
};

function parseCTC(ctcStr) {
  if (!ctcStr) return 0;
  const str = String(ctcStr).trim();
  if (!str) return 0;
  if (/^\d+(\.\d+)?$/.test(str)) return parseInt(str, 10);
  const mTotal = str.match(/TOTAL\s*[-:=]?\s*(\d[\d,\.]*)/i);
  if (mTotal) {
    const cleaned = mTotal[1].replace(/[^\d.]/g, '');
    if (cleaned) return parseInt(cleaned, 10);
  }
  const nums = str.match(/\b\d(?:[\d,]*\d)?(?:\.\d+)?\b/g);
  if (nums) {
    const parsed = nums.map(n => parseInt(n.replace(/[^\d.]/g, ''), 10)).filter(n => !isNaN(n));
    if (parsed.length > 0) return Math.max(...parsed);
  }
  const fallback = str.replace(/[^\d.]/g, '');
  return fallback ? parseInt(fallback, 10) : 0;
}

// Seed internRolesStore from scraper output JSON on startup
let internRolesStore = [];
try {
  const jsonPath = path.resolve('intern_scraper/data/all_roles_detailed.json');
  if (fs.existsSync(jsonPath)) {
    const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    internRolesStore = raw.map((r, idx) => {
      let ctcVal = parseCTC(r.ctc);
      
      let jd = (r.jnf_details || {}).job_description || '';
      let title = (jd.split('\n')[0] || '').trim();
      if (jd.toLowerCase().includes("quant dev")) title = "Quant Developer";
      else if (jd.toLowerCase().includes("quant res")) title = "Quant Researcher";
      else if (jd.toLowerCase().includes("quant trad")) title = "Quant Trader";
      else if (jd.toLowerCase().includes("sde") || jd.toLowerCase().includes("software")) title = "Software Engineer";
      else if (jd.toLowerCase().includes("data science")) title = "Data Scientist";
      if (title.length > 50) title = title.substring(0, 47) + '...';
      if (!title) title = "Internship Role";

      return {
        id: `i${idx+1}`,
        company: r.company_name,
        ctc: ctcVal,
        currency: r.currency || 'INR',
        applyStatus: r.apply_acceptance || 'Apply',
        resumeStart: r.resume_upload_start || '',
        resumeEnd: r.resume_upload_end || '',
        interviewDate: r.interview_selection_date || '',
        positionNote: title,
        sortingDone: false,
        myStatus: r.application_status === 'Y' ? 'applied' : 'not_applied',
        notes: '',
        jnfUrl: r.jnf_url || '',
        jnfId: r.jnf_id || '',
        comId: r.com_id || '',
        cgpaCutoff: (r.jnf_details || {}).cgpa_cutoff || '0.0',
        stipend: (r.jnf_details || {}).stipend_per_month || r.ctc,
        allowedDepts: (r.jnf_details || {}).allowed_departments || [],
        allowedDegrees: (r.jnf_details || {}).allowed_degrees || [],
        jobDescription: jd,
        selectionProcess: (r.jnf_details || {}).selection_process || '',
        skillsRequired: (r.jnf_details || {}).skills_required || '',
        duration: (r.jnf_details || {}).duration || '',
        location: (r.jnf_details || {}).location || '',
        positions: (r.jnf_details || {}).positions || '',
        tentativeStart: (r.jnf_details || {}).tentative_start_date || '',
        applicationStatus: r.application_status || ''
      };
    });
  }
} catch (e) {
  console.error("Local server failed to load scraper JSON:", e);
}


// --- GMAIL SMTP TRANSPORTER CONFIGURATION ---
const SENDER_EMAIL = process.env.GMAIL_USER || 'onlyforgdb@gmail.com';
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || ''; // Settable via environment variable or UI prompt

function createTransporter(pass = GMAIL_APP_PASSWORD) {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: SENDER_EMAIL,
      pass: pass,
    },
  });
}

function generateSessionToken(expiresAt) {
  const payload = JSON.stringify({ rollNo: '24cs10097', expiresAt, salt: 'kgp_timetable_2026' });
  return 'tt_token_' + Buffer.from(payload).toString('base64').replace(/=/g, '');
}

function validateSessionToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.substring(7).trim();
  if (!token.startsWith('tt_token_')) return false;
  try {
    const rawB64 = token.replace('tt_token_', '');
    const decoded = JSON.parse(Buffer.from(rawB64, 'base64').toString('utf8'));
    if (decoded && decoded.expiresAt && decoded.expiresAt > Date.now()) {
      return true;
    }
  } catch (e) {
    return false;
  }
  return false;
}

let attendanceStore = [];

const MCP_TOOLS = [
  {
    name: 'get_timetable_schedule',
    description: 'Fetch IIT Kharagpur class schedule for a specific day or course.',
    inputSchema: {
      type: 'object',
      properties: {
        day: { type: 'string', description: 'Day of week (Mon, Tue, Wed, Thur, Fri, or all)' },
        subjectCode: { type: 'string', description: 'Course code e.g. CS31007, CS61064, AI60213' },
      },
    },
  },
  {
    name: 'get_reminders',
    description: 'Get list of pending or completed tasks, assignments, exams, and CDC deadlines.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter status: pending, completed, or all' },
        subjectCode: { type: 'string', description: 'Filter by subject code' },
      },
    },
  },
  {
    name: 'add_reminder',
    description: 'Add a new task, assignment, exam, or reminder to the portal.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title of the task or reminder' },
        subjectCode: { type: 'string', description: 'Subject code e.g. CS31007 or GENERAL' },
        type: { type: 'string', description: 'Type: assignment, class, exam, project, other' },
        dueDate: { type: 'string', description: 'Due date in YYYY-MM-DD format' },
        dueTime: { type: 'string', description: 'Due time in HH:MM format' },
        priority: { type: 'string', description: 'Priority: high, medium, or low' },
        description: { type: 'string', description: 'Additional details or notes' },
      },
      required: ['title'],
    },
  },
  {
    name: 'get_attendance_records',
    description: 'Get attendance history and percentage statistics for IIT Kharagpur courses.',
    inputSchema: {
      type: 'object',
      properties: {
        subjectCode: { type: 'string', description: 'Filter by course code (e.g. CS31007)' },
      },
    },
  },
  {
    name: 'log_attendance',
    description: 'Log attendance status (attended, missed, cancelled) for a course on a date.',
    inputSchema: {
      type: 'object',
      properties: {
        subjectCode: { type: 'string', description: 'Subject code e.g. CS31007' },
        status: { type: 'string', description: 'Status: attended, missed, or cancelled' },
        date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
        note: { type: 'string', description: 'Optional note' },
      },
      required: ['subjectCode', 'status'],
    },
  },
];

async function executeMcpToolLocal(name, args) {
  if (name === 'get_timetable_schedule') {
    return 'IIT Kharagpur Timetable Schedule:\n- [Mon] 08:00 - 08:55: HPPC (CS61064)\n- [Mon] 09:00 - 09:55: Comp Org (CS31007)';
  }

  if (name === 'get_reminders') {
    const status = (args.status || 'all').toLowerCase();
    let filtered = remindersStore;
    if (status === 'pending' || status === 'completed') {
      filtered = filtered.filter(r => r.status === status);
    }
    const formatted = filtered.map(r => `• [${r.status.toUpperCase()}] [${r.subject_code}] ${r.title} | Due: ${r.due_date} ${r.due_time}`);
    return `Reminders (${filtered.length}):\n${formatted.join('\n')}`;
  }

  if (name === 'add_reminder') {
    const title = (args.title || '').trim();
    if (!title) throw new Error('Title is required for add_reminder.');
    const newRem = {
      id: 'rem-' + Date.now(),
      title,
      subject_code: (args.subjectCode || 'GENERAL').toUpperCase(),
      type: args.type || 'assignment',
      due_date: args.dueDate || new Date().toISOString().split('T')[0],
      due_time: args.dueTime || '23:59',
      priority: args.priority || 'medium',
      status: 'pending',
      send_email: true,
      description: args.description || '',
      created_at: new Date().toISOString(),
    };
    remindersStore.unshift(newRem);
    return `Successfully created reminder '${title}' [${newRem.subject_code}] due on ${newRem.due_date} ${newRem.due_time}.`;
  }

  if (name === 'get_attendance_records') {
    return `Attendance Records (${attendanceStore.length}):\n` + (attendanceStore.map(a => `- [${a.date}] ${a.subjectCode}: ${a.status}`).join('\n') || 'No records logged.');
  }

  if (name === 'log_attendance') {
    const record = {
      id: 'att-' + Date.now(),
      subjectCode: (args.subjectCode || 'GENERAL').toUpperCase(),
      status: (args.status || 'attended').toLowerCase(),
      date: args.date || new Date().toISOString().split('T')[0],
      note: args.note || '',
    };
    attendanceStore.unshift(record);
    return `Logged attendance for ${record.subjectCode} on ${record.date}: ${record.status.toUpperCase()}.`;
  }

  throw new Error(`Unknown tool name '${name}'.`);
}

function timingSafeEqualStr(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function validateMcpAuth(req) {
  const paramKey =
    req.query.key ||
    req.query.api_key ||
    req.query.token ||
    req.query.access_token ||
    req.query.password ||
    req.query.auth;

  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers['x-api-key'];

  const envSecrets = [
    process.env.MCP_API_KEY,
    process.env.MCP_AUTH_TOKEN,
    process.env.MCP_PASSWORD,
    process.env.APP_PASSWORD,
  ].filter((s) => typeof s === 'string' && s.trim().length > 0).map((s) => s.trim());

  const secrets = envSecrets.length > 0 ? envSecrets : ['24cs10097'];

  function isSecretValid(candidate) {
    if (!candidate) return false;
    const trimmed = String(candidate).trim();
    for (const secret of secrets) {
      if (timingSafeEqualStr(trimmed, secret)) return true;
    }
    if (typeof validateSessionToken === 'function') {
      return validateSessionToken(`Bearer ${trimmed}`);
    }
    return false;
  }

  if (paramKey && isSecretValid(paramKey)) {
    return true;
  }

  if (apiKeyHeader && isSecretValid(apiKeyHeader)) {
    return true;
  }

  if (authHeader) {
    const strHeader = String(authHeader);
    if (/^Bearer\s+/i.test(strHeader)) {
      const raw = strHeader.replace(/^Bearer\s+/i, '').trim();
      if (isSecretValid(raw)) return true;
    } else if (/^Basic\s+/i.test(strHeader)) {
      try {
        const b64 = strHeader.replace(/^Basic\s+/i, '').trim();
        const decoded = Buffer.from(b64, 'base64').toString('utf8');
        const parts = decoded.split(':');
        for (const part of parts) {
          if (part && isSecretValid(part)) return true;
        }
      } catch (e) {}
    } else {
      if (isSecretValid(strHeader.trim())) return true;
    }
  }

  return false;
}

// MCP Endpoint (/mcp) for Express local server
app.get('/mcp', (req, res) => {
  if (!validateMcpAuth(req)) {
    res.setHeader('WWW-Authenticate', 'Bearer realm="iitkgp-timetable-mcp", error="invalid_token"');
    return res.status(401).json({
      success: false,
      error: 'Unauthorized. Valid MCP authentication key or token required.',
    });
  }

  const accept = req.headers.accept || '';
  if (accept.includes('text/event-stream')) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    const origin = `${req.protocol}://${req.get('host')}`;
    return res.send(`event: endpoint\ndata: ${origin}/mcp\n\n`);
  }
  return res.json({
    name: 'iitkgp-timetable-mcp',
    version: '1.0.0',
    status: 'active',
    mcpVersion: '2024-11-05',
    description: 'Serverless MCP Server for IIT Kharagpur Timetable, Tasks, CDC Internships, and Attendance Tracking',
    capabilities: {
      tools: {
        listChanged: false,
      },
    },
  });
});

app.post('/mcp', async (req, res) => {
  const { id, method, params } = req.body || {};

  if (!validateMcpAuth(req)) {
    res.setHeader('WWW-Authenticate', 'Bearer realm="iitkgp-timetable-mcp", error="invalid_token"');
    return res.status(401).json({
      jsonrpc: '2.0',
      id: id ?? null,
      error: {
        code: -32001,
        message: 'Unauthorized. Valid MCP authentication key or token required.',
      },
    });
  }

  if (method === 'initialize') {
    return res.json({
      jsonrpc: '2.0',
      id: id ?? null,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: 'iitkgp-timetable-mcp',
          version: '1.0.0',
        },
      },
    });
  }

  if (method === 'notifications/initialized') {
    if (id !== undefined && id !== null) {
      return res.json({ jsonrpc: '2.0', id, result: {} });
    }
    return res.status(202).end();
  }

  if (method === 'ping') {
    return res.json({ jsonrpc: '2.0', id: id ?? null, result: {} });
  }

  if (method === 'tools/list') {
    return res.json({
      jsonrpc: '2.0',
      id: id ?? null,
      result: { tools: MCP_TOOLS },
    });
  }

  if (method === 'tools/call') {
    const { name, arguments: args } = params || {};
    try {
      const resultText = await executeMcpToolLocal(name, args || {});
      return res.json({
        jsonrpc: '2.0',
        id: id ?? null,
        result: {
          content: [{ type: 'text', text: resultText }],
          isError: false,
        },
      });
    } catch (err) {
      return res.json({
        jsonrpc: '2.0',
        id: id ?? null,
        result: {
          content: [{ type: 'text', text: `Error executing tool '${name}': ${err.message || String(err)}` }],
          isError: true,
        },
      });
    }
  }

  return res.status(404).json({
    jsonrpc: '2.0',
    id: id ?? null,
    error: {
      code: -32601,
      message: `Method '${method}' not found. Supported methods: initialize, notifications/initialized, ping, tools/list, tools/call`,
    },
  });
});

// Health endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    d1_binding: 'DB (timetable: 6b53ce94-8279-4643-bf1c-b35715815fe6)',
    sender_email: SENDER_EMAIL,
  });
});

// Auth endpoint
app.post('/api/verify-auth', (req, res) => {
  const { password } = req.body || {};
  const serverPass = process.env.APP_PASSWORD || '24cs10097';
  if (password && password.trim() === serverPass.trim()) {
    const expiresAt = Date.now() + 10 * 24 * 60 * 60 * 1000;
    const token = generateSessionToken(expiresAt);
    return res.json({
      success: true,
      token,
      expiresAt,
      message: 'Authentication successful. Access granted for 10 days.',
    });
  }
  return res.status(401).json({ success: false, message: 'Invalid security passcode.' });
});

// Middleware for protected routes
app.use((req, res, next) => {
  if (req.path === '/api/health' || req.path === '/api/verify-auth') {
    return next();
  }
  const authHeader = req.headers.authorization;
  if (!validateSessionToken(authHeader)) {
    return res.status(401).json({ success: false, error: 'Unauthorized. Valid authentication token required.' });
  }
  next();
});

// GET intern roles
app.get('/api/interns', (req, res) => {
  res.json(internRolesStore);
});

// POST intern role update
app.post('/api/interns', (req, res) => {
  const role = req.body;
  const existingIdx = internRolesStore.findIndex((r) => r.id === role.id);
  if (existingIdx >= 0) {
    const updatedRole = { ...internRolesStore[existingIdx], ...role };
    internRolesStore[existingIdx] = updatedRole;

    // Synchronize with remindersStore
    const remId = 'rem-interview-' + role.id;
    if (!role.interviewDate) {
      remindersStore = remindersStore.filter((r) => r.id !== remId);
    } else {
      let dueDate = '';
      let dueTime = '23:59';
      const parts = (role.interviewDate || '').trim().split(/\s+/);
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
        const existingRemIdx = remindersStore.findIndex((r) => r.id === remId);
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
        if (existingRemIdx >= 0) {
          remindersStore[existingRemIdx] = { ...remindersStore[existingRemIdx], ...newRem };
        } else {
          remindersStore.unshift(newRem);
        }
      }
    }
  }
  res.json({ success: true, roles: internRolesStore });
});

// GET reminders
app.get('/api/reminders', (req, res) => {
  res.json(remindersStore);
});

// POST new reminder
app.post('/api/reminders', (req, res) => {
  const reminder = req.body;
  if (!reminder.id) {
    reminder.id = 'rem-' + Date.now();
    reminder.created_at = new Date().toISOString();
  }
  const existingIdx = remindersStore.findIndex((r) => r.id === reminder.id);
  if (existingIdx >= 0) {
    remindersStore[existingIdx] = { ...remindersStore[existingIdx], ...reminder };
  } else {
    remindersStore.unshift(reminder);
  }
  res.json({ success: true, reminder, reminders: remindersStore });
});

// DELETE reminder
app.delete('/api/reminders/:id', (req, res) => {
  const { id } = req.params;
  remindersStore = remindersStore.filter((r) => r.id !== id);
  res.json({ success: true, id, reminders: remindersStore });
});

// TOGGLE reminder
app.put('/api/reminders/:id/toggle', (req, res) => {
  const { id } = req.params;
  remindersStore = remindersStore.map((r) =>
    r.id === id ? { ...r, status: r.status === 'completed' ? 'pending' : 'completed' } : r
  );
  res.json({ success: true, id, reminders: remindersStore });
});

// GET room preferences
app.get('/api/rooms', (req, res) => {
  res.json(roomPrefsStore);
});

// POST room preference update
app.post('/api/rooms', (req, res) => {
  const { subjectCode, room } = req.body;
  if (subjectCode && room) {
    roomPrefsStore[subjectCode] = room;
  }
  res.json({ success: true, roomPrefs: roomPrefsStore });
});

// POST send-email (Gmail SMTP)
app.post('/api/send-email', async (req, res) => {
  const { recipient, subject, text, html, appPassword } = req.body;

  const targetEmail = recipient || SENDER_EMAIL;
  const passToUse = appPassword || GMAIL_APP_PASSWORD;

  if (!passToUse) {
    return res.status(400).json({
      success: false,
      message:
        'Gmail App Password is required to send emails via SMTP from onlyforgdb@gmail.com. Please configure your App Password in the Settings modal.',
    });
  }

  try {
    const transporter = createTransporter(passToUse);

    const mailOptions = {
      from: `"IIT KGP Timetable Alert" <${SENDER_EMAIL}>`,
      to: targetEmail,
      subject: subject || '⏰ Class & Assignment Reminder - IIT Kharagpur',
      text: text || 'You have an upcoming class or assignment due.',
      html:
        html ||
        `
        <div style="font-family: Arial, sans-serif; background: #0f172a; color: #f8fafc; padding: 24px; border-radius: 12px; border: 1px solid #334155;">
          <h2 style="color: #38bdf8; margin-top: 0;">📅 IIT Kharagpur Reminder Alert</h2>
          <p style="font-size: 16px; line-height: 1.5;">${text}</p>
          <hr style="border: 0; border-top: 1px solid #334155; margin: 20px 0;" />
          <p style="font-size: 12px; color: #94a3b8;">Sent automatically from your Timetable Portal (24CS10097) via onlyforgdb@gmail.com.</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);

    return res.json({
      success: true,
      message: `Email notification successfully sent to ${targetEmail}!`,
      messageId: info.messageId,
    });
  } catch (error) {
    console.error('SMTP Error:', error);
    return res.status(500).json({
      success: false,
      message: `SMTP Error: ${error.message || 'Could not send email via Gmail SMTP.'}`,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`D1 Database ID: 6b53ce94-8279-4643-bf1c-b35715815fe6`);
  console.log(`Gmail Sender: ${SENDER_EMAIL}`);
});
