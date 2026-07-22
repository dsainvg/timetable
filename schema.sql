-- Cloudflare D1 Database Schema for Timetable & Reminders

CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subject_code TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'assignment', -- 'assignment', 'class', 'exam', 'project', 'other'
  due_date TEXT NOT NULL,
  due_time TEXT DEFAULT '23:59',
  priority TEXT NOT NULL DEFAULT 'medium', -- 'high', 'medium', 'low'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed'
  send_email INTEGER DEFAULT 1,
  description TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS room_preferences (
  subject_code TEXT PRIMARY KEY,
  selected_room TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table to tackle duplicate email notifications
CREATE TABLE IF NOT EXISTS sent_email_logs (
  id TEXT PRIMARY KEY,
  reminder_id TEXT NOT NULL,
  recipient TEXT NOT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(reminder_id, recipient)
);

-- Insert Default Room Preferences (NC241 for CS31007/CS31003, NC231 for CS31005)
INSERT OR REPLACE INTO room_preferences (subject_code, selected_room) VALUES
  ('CS31007', 'NC241'),
  ('CS31003', 'NC241'),
  ('CS31005', 'NC231');

-- Insert Initial Sample Reminders
INSERT OR REPLACE INTO reminders (id, title, subject_code, type, due_date, due_time, priority, status, description) VALUES
  ('rem-1', 'Parallel Programming Assignment 1', 'CS61064', 'assignment', '2026-07-28', '23:59', 'high', 'pending', 'Implement CUDA vector addition and matrix multiplication.'),
  ('rem-2', 'Compilers Lab Assignment 1', 'CS39003', 'assignment', '2026-07-29', '18:00', 'medium', 'pending', 'Flex/Bison lexer specification for Mini-C language.'),
  ('rem-3', 'Computer Org Quiz Prep', 'CS31007', 'exam', '2026-07-30', '10:00', 'high', 'pending', 'Revise MIPS pipeline datapath and hazard unit.');
