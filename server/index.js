import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';

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

// Health endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    d1_binding: 'DB (timetable: 6b53ce94-8279-4643-bf1c-b35715815fe6)',
    sender_email: SENDER_EMAIL,
  });
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
