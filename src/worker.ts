// @ts-ignore
import { connect } from 'cloudflare:sockets';
import { INTERN_COMPANIES_DEFAULT } from './data/internData';
import { SCHEDULE_GRID, COURSES } from './data/timetableData';

export interface Env {
  DB?: any;
  AI?: any;
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
  APP_PASSWORD?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  DEFAULT_EMAIL?: string;
  CF_ACCOUNT_ID?: string;
  CF_API_TOKEN?: string;
}

// ─── CLOUDFLARE WORKERS AI DISPATCHER (DIRECT NATIVE BINDING env.AI) ───
async function callAIModel(env: Env, systemPrompt: string, userPrompt: string): Promise<string> {
  if (!env.AI) {
    console.error('[WORKERS AI BINDING MISSING] env.AI binding is required.');
    return '';
  }

  const models = [
    '@cf/zai-org/glm-4.7-flash',
    '@cf/google/gemma-4-26b-a4b-it',
    '@cf/qwen/qwen3-30b-a3b-fp8',
    '@cf/meta/llama-3.1-8b-instruct',
    '@cf/meta/llama-3-8b-instruct',
    '@cf/qwen/qwen1.5-0.5b-chat',
    '@cf/mistral/mistral-7b-instruct-v0.1',
  ];

  for (const model of models) {
    try {
      const aiRes = await env.AI.run(model, {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });
      const text = (aiRes.response || aiRes.text || (typeof aiRes === 'string' ? aiRes : '')).trim();
      if (text) return text;
    } catch (e: any) {
      console.error(`[WORKERS AI BINDING ERROR for ${model}]`, e?.message || e);
    }
  }

  return '';
}

const DEFAULT_RECIPIENT = 'me@timio.dpdns.org';

const ALLOWED_TRIGGER_SENDERS = [
  'dsainvg@hotmail.com',
  'onlyforgdb@gmail.com',
  'dsainvg@gmail.com',
];

function parseEmailAddress(rawFrom: string): string {
  if (!rawFrom) return '';
  const angleMatch = rawFrom.match(/<([^>]+)>/);
  if (angleMatch) return angleMatch[1].trim().toLowerCase();
  return rawFrom.trim().toLowerCase();
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

// ─── COURSE NAME & SHORT FORM MAPPING ────────────────────────────────
const COURSE_NAME_MAP: Record<string, { shortName: string; fullName: string }> = {
  CS61064: { shortName: 'HPPC', fullName: 'High Performance Parallel Programming' },
  CS39001: { shortName: 'Comp Org Lab', fullName: 'Computer Organization Laboratory' },
  CS31005: { shortName: 'Algo 2', fullName: 'Algorithms II' },
  CS31007: { shortName: 'Comp Org', fullName: 'Computer Organization & Architecture' },
  AI60213: { shortName: 'FLLM', fullName: 'Foundations of Large Language Models' },
  CS31003: { shortName: 'Compilers', fullName: 'Compilers' },
  CS39003: { shortName: 'Compilers Lab', fullName: 'Compilers Laboratory' },
  INTERNSHIP: { shortName: 'Internship', fullName: 'CDC Internship Recruitment' },
  INTERN: { shortName: 'Internship', fullName: 'CDC Internship Recruitment' },
};

function getSubjectDisplayName(code: string): string {
  const mapped = COURSE_NAME_MAP[code];
  return mapped ? `${mapped.shortName}` : code;
}

// ─── UTILITY FOR STREAMING RAW EMAIL TEXT & MIME PARSING ───────────
async function readStreamText(stream: any): Promise<string> {
  if (!stream || typeof stream.getReader !== 'function') return '';
  try {
    const reader = stream.getReader();
    const decoder = new TextDecoder('utf-8');
    let result = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value, { stream: true });
    }
    result += decoder.decode();
    return result;
  } catch (e) {
    console.error('readStreamText error:', e);
    return '';
  }
}

function stripMimeAndHtml(raw: string): string {
  if (!raw) return '';
  let text = raw;

  // 1. Quoted-printable decode
  text = text.replace(/=\r?\n/g, '');
  text = text.replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  // 2. Extract plain text part from MIME if multipart exists
  if (text.includes('Content-Type: text/plain')) {
    const parts = text.split(/Content-Type:\s*text\/plain/i);
    if (parts.length > 1) {
      let plainPart = parts[1];
      const endBoundary = plainPart.search(/--_000_|--[A-Za-z0-9_-]+|Content-Type:/i);
      if (endBoundary !== -1) {
        plainPart = plainPart.substring(0, endBoundary);
      }
      text = plainPart;
    }
  }

  // 3. Strip CSS style and script blocks
  text = text.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  text = text.replace(/<script[\s\S]*?<\/script>/gi, ' ');

  // 4. Strip all HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // 5. Decode HTML entities
  text = text.replace(/&nbsp;/gi, ' ');
  text = text.replace(/&amp;/gi, '&');
  text = text.replace(/&lt;/gi, '<');
  text = text.replace(/&gt;/gi, '>');
  text = text.replace(/&quot;/gi, '"');
  text = text.replace(/&#\d+;/gi, '');

  // 6. Remove Google Groups / Footer / Header noise lines
  const cleanLines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => {
      if (!line) return false;
      const l = line.toLowerCase();
      if (l.includes('you received this message because you are subscribed')) return false;
      if (l.includes('cdc-notifications-2026+unsubscribe')) return false;
      if (l.includes('this content was created by someone else')) return false;
      if (l.includes('to view this discussion visit')) return false;
      if (l.includes('https://groups.google.com/d/msgid')) return false;
      if (l.startsWith('--_000_')) return false;
      return true;
    });

  text = cleanLines.join('\n');
  text = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return text;
}

function parseCDCNotice(cleanText: string, subject: string): any | null {
  const isCDC = /CDC Notice|INTERNSHIP\s*\||CDC|CV Submission|Placement Notice/i.test(subject) ||
                /Company\s*:\s*[A-Za-z]/i.test(cleanText) ||
                /Type\s*:\s*INTERNSHIP/i.test(cleanText) ||
                /CV Submission/i.test(cleanText);

  if (!isCDC) return null;

  // Extract Company Name
  let company = '';
  const comMatch1 = cleanText.match(/Company\s*:\s*([^\n\r]+)/i);
  if (comMatch1) {
    company = comMatch1[1].trim();
  } else {
    const comMatch2 = subject.match(/(?:INTERNSHIP\s*\|\s*[^|]+\s*\|\s*|CDC Notice.*?\s+)([A-Z0-9\s.&-]+)$/i);
    if (comMatch2) {
      company = comMatch2[1].trim();
    }
  }

  if (!company) {
    const knownCompanies = ['QUALCOMM', 'Google', 'Amazon', 'Atlassian', 'AlphaGrep', 'American Express', 'Bain', 'BCG', 'Capital One', 'Cisco', 'Goldman Sachs', 'Microsoft', 'Uber', 'BlackRock', 'Piramal', 'Irage', 'Graviton', 'Wells Fargo'];
    for (const c of knownCompanies) {
      if (new RegExp(`\\b${c}\\b`, 'i').test(cleanText) || new RegExp(`\\b${c}\\b`, 'i').test(subject)) {
        company = c.toUpperCase();
        break;
      }
    }
  }

  if (!company) company = 'CDC Company';

  // Extract Notice Type
  let noticeType = 'Notice';
  if (/CV Submission|Resume Submission|Apply/i.test(cleanText) || /CV Submission/i.test(subject)) {
    noticeType = 'CV Submission';
  } else if (/PPT|Pre-Placement Talk/i.test(cleanText) || /PPT/i.test(subject)) {
    noticeType = 'PPT';
  } else if (/Test|Online Test|Assessment/i.test(cleanText) || /Test/i.test(subject)) {
    noticeType = 'Test';
  } else if (/Interview/i.test(cleanText) || /Interview/i.test(subject)) {
    noticeType = 'Interview';
  }

  // Extract Deadline Date & Time
  let dueDate = getISTDate().dateString;
  let dueTime = '23:59';

  const dtMatch = cleanText.match(/(\d{1,2}):(\d{2})\s*(AM|PM)[,\s]+(\d{1,2})(?:st|nd|rd|th)?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?:\s+(\d{4}))?/i);
  if (dtMatch) {
    let h = parseInt(dtMatch[1], 10);
    const m = dtMatch[2];
    const period = dtMatch[3].toUpperCase();
    if (period === 'PM' && h < 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    dueTime = `${h < 10 ? '0' + h : h}:${m}`;

    const monthMap: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
    const mStr = monthMap[dtMatch[5].toLowerCase()] || '07';
    const dNum = parseInt(dtMatch[4], 10);
    const dStr = dNum < 10 ? `0${dNum}` : `${dNum}`;
    const yStr = dtMatch[6] || '2026';
    dueDate = `${yStr}-${mStr}-${dStr}`;
  } else {
    const dMatch = cleanText.match(/(\d{2})[-/](\d{2})[-/](\d{4})/);
    if (dMatch) {
      dueDate = `${dMatch[3]}-${dMatch[2]}-${dMatch[1]}`;
    }
    const tMatch = cleanText.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (tMatch) {
      let h = parseInt(tMatch[1], 10);
      const m = tMatch[2];
      const period = tMatch[3].toUpperCase();
      if (period === 'PM' && h < 12) h += 12;
      if (period === 'AM' && h === 12) h = 0;
      dueTime = `${h < 10 ? '0' + h : h}:${m}`;
    }
  }

  const title = `CDC ${noticeType}: ${company}`;
  const priority = noticeType === 'PPT' ? 'medium' : 'high';
  const categoryType = noticeType === 'PPT' ? 'other' : (noticeType === 'Test' || noticeType === 'Interview' ? 'exam' : 'assignment');

  const descMatch = cleanText.match(/(The CV submission[\s\S]*?)(?:CDC,|$)/i) || cleanText.match(/([^.\n]+\b(?:opened|deadline|apply|submission|scheduled)\b[^.\n]+)/i);
  const briefDesc = descMatch ? descMatch[1].replace(/\s+/g, ' ').trim().slice(0, 180) : `${company} ${noticeType} deadline.`;

  return {
    type: 'reminder',
    title,
    subject_code: 'INTERNSHIP',
    reminder_type: categoryType,
    due_date: dueDate,
    due_time: dueTime,
    priority,
    description: briefDesc,
  };
}

// ─── AI DECIDER & SANITIZATION HELPERS ──────────────────────────────
function isGibberishOrDisclaimer(text: string): boolean {
  if (!text || text.trim().length < 3) return true;
  const lower = text.toLowerCase();
  const noisePatterns = [
    'do not reply', 'automated notification', 'system notification', 'system generated',
    'cdc erp bot', 'confidentiality notice', 'all rights reserved', 'sent from my',
    'disclaimer', 'dear student', 'thanks & regards', 'link for the ppt will be shared',
    'candidates are required', 'instructions will be shared', 'for any queries',
    'feel free to reach', 'regards,', 'sincerely,', 'this email is intended',
    'attachment', 'google groups', 'download the file', 'unsubscribe', 'portal notification',
    'content-type:', 'content-transfer-encoding', 'href=', 'style=', '<body', '<div'
  ];
  return noisePatterns.some(pat => lower.includes(pat));
}

function cleanTaskTitle(rawTitle: string): string {
  if (!rawTitle) return 'Task';
  let title = rawTitle.replace(/^(remind me|remind|please|set reminder for|due:|note:|subject:|\d+\.\s*|\[.*?\])\s*/gi, '').trim();
  title = title.replace(/\s+(due|by|at)\s+\d{4}-\d{2}-\d{2}.*$/gi, '').trim();
  title = title.replace(/\s+(high|medium|low)\s+priority.*$/gi, '').trim();
  if (title.length > 55) {
    title = title.substring(0, 52).trim() + '…';
  }
  return title || 'Task';
}

async function extractActionsWithAI(env: Env, emailText: string): Promise<any[]> {
  const systemPrompt = `You are an expert AI task & academic action extractor for an IIT Kharagpur CSE student.
Extract ONLY GENUINE, ACTIONABLE student items mentioned in the text into a JSON array of objects.

STRICT RULES:
1. DO NOT extract email disclaimers, signatures, "do not reply" footers, system notifications, or general policy/rules text.
2. For each task, construct a short, crisp, human-readable title (max 5-6 words, e.g. "CDC Test: Irage", "Compilers Lab Assignment", "HPPC Class Attendance"). NEVER raw-copy entire paragraphs or disclaimers as titles.
3. Map subjects to codes:
   - HPPC -> CS61064
   - Comp Org Lab -> CS39001
   - Algo 2 -> CS31005
   - Comp Org / Architecture -> CS31007
   - FLLM / LLM -> AI60213
   - Compilers -> CS31003
   - Compilers Lab -> CS39003
   - CDC / Internship / Company Placement -> INTERNSHIP
   - General / Other -> GENERAL

Action Types (3 schemas):

1. Attendance:
{"type": "attendance", "subject_code": "CS31007", "date": "YYYY-MM-DD", "status": "attended"|"missed"|"cancelled", "note": "optional brief note"}

2. Reminder / Task:
{"type": "reminder", "title": "Compilers Lab 1", "subject_code": "CS39003", "reminder_type": "assignment"|"class"|"exam"|"project"|"other", "due_date": "YYYY-MM-DD", "due_time": "HH:MM", "priority": "high"|"medium"|"low", "description": "brief details"}

3. Intern Role Update:
{"type": "intern", "company": "Company Name", "myStatus": "applied"|"oa_good"|"shortlisted"|"interview_good"|"offered"|"rejected", "interviewDate": "DD Mon, HH:MM AM/PM", "notes": "text"}

OUTPUT ONLY A VALID JSON ARRAY. NO MARKDOWN, NO EXPLANATION.`;

  const rawContent = await callAIModel(env, systemPrompt, emailText);
  if (rawContent) {
    const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (err) {
        console.error('[AI EXTRACTION PARSE ERROR]', err);
      }
    }
  }
  return [];
}

async function decideAndRefineActions(env: Env, originalText: string, candidates: any[]): Promise<any[]> {
  if (!Array.isArray(candidates) || candidates.length === 0) return [];

  // Local pre-filtering of obvious noise/gibberish
  const filtered = candidates.filter((act) => {
    if (!act || typeof act !== 'object') return false;
    const titleText = act.title || act.company || act.description || '';
    if (isGibberishOrDisclaimer(titleText)) return false;
    if (act.description && isGibberishOrDisclaimer(act.description)) {
      act.description = ''; // Strip disclaimer description
    }
    return true;
  });

  if (filtered.length === 0) return [];

  const deciderSystemPrompt = 'You filter out gibberish, eliminate duplicate tasks, and output clean valid JSON arrays.';
  const deciderUserPrompt = `You are the Final Action Decider & Parameter Refiner for an IIT Kharagpur student app.
Analyze the ORIGINAL TEXT and candidate extracted actions below:

ORIGINAL TEXT:
"""
${originalText.substring(0, 1500)}
"""

CANDIDATE ACTIONS:
${JSON.stringify(filtered, null, 2)}

DECISION & REFINEMENT INSTRUCTIONS:
1. REJECT/FILTER OUT any candidate action that is UNWANTED GIBBERISH, boilerplate text, email disclaimers, system notifications, or non-actionable chatter.
2. IF THERE ARE DUPLICATE/MULTIPLE REMINDERS FOR THE SAME CDC NOTICE OR TASK, KEEP ONLY THE SINGLE BEST, MOST ACCURATE REMINDER.
3. REFINE & NORMALIZE parameters for APPROVED valid actions:
   - "title": Short (3-6 words), crisp, actionable name (e.g., "CDC CV Submission: QUALCOMM", "Compilers Assignment 1"). NEVER a raw copied disclaimer or paragraph.
   - "subject_code": Valid code (CS61064, CS39001, CS31005, CS31007, AI60213, CS31003, CS39003, INTERNSHIP, GENERAL).
   - "type": "assignment"|"class"|"exam"|"project"|"other" for reminders, or "attendance" or "intern" or "cdc_schedule".
   - "due_date": YYYY-MM-DD.
   - "due_time": HH:MM (24-hour format).
   - "priority": "high"|"medium"|"low".
   - "description": Concise pertinent summary (location, POC, mode), strictly without email footers or disclaimers.

OUTPUT ONLY THE FINAL DECIDED JSON ARRAY OF ACTIONS. NO MARKDOWN.`;

  const rawContent = await callAIModel(env, deciderSystemPrompt, deciderUserPrompt);
  if (rawContent) {
    const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const decided = JSON.parse(jsonMatch[0]);
        if (Array.isArray(decided) && decided.length > 0) return decided;
      } catch (err) {
        console.error('[AI DECIDER PARSE ERROR]', err);
      }
    }
  }

  // Deterministic Fallback Decider
  return filtered.map((act) => {
    if (act.type === 'reminder') {
      return {
        ...act,
        title: cleanTaskTitle(act.title || act.description),
        description: isGibberishOrDisclaimer(act.description) ? '' : act.description,
      };
    }
    return act;
  });
}

async function processInboundEmailTrigger(
  env: Env,
  sender: string,
  subject: string,
  rawEmailText: string,
  autoExecute: boolean = true
): Promise<{
  success: boolean;
  actionCount: number;
  parsedActions: any[];
  executed: boolean;
  executionResults: string[];
  message?: string;
}> {
  // Strip MIME boundaries, quoted-printable encoding, HTML tags, and Google Groups headers
  const emailText = stripMimeAndHtml(rawEmailText);
  let rawCandidates: any[] = [];

  // 0. Single CDC Notice / CV Submission Extractor
  const singleCDCNotice = parseCDCNotice(emailText, subject);
  if (singleCDCNotice) {
    rawCandidates.push(singleCDCNotice);
  }

  // 0b. CDC Schedule Bulletin Detection & Parsing (for numbered schedules like 1. [PPT] ... 2. [Test] ...)
  if (rawCandidates.length === 0) {
    const isCDCSchedule = /\d+\.\s*\[(PPT|Test|TEST|Interview|Slot)\]/i.test(emailText);
    if (isCDCSchedule) {
      let scheduleDate = getISTDate().dateString;
      const dMatch1 = emailText.match(/(\d{2})[-/](\d{2})[-/](\d{4})/);
      if (dMatch1) {
        scheduleDate = `${dMatch1[3]}-${dMatch1[2]}-${dMatch1[1]}`;
      } else {
        const dMatch2 = emailText.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);
        if (dMatch2) {
          const monthMap: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
          const mStr = monthMap[dMatch2[2].toLowerCase()] || '07';
          const dNum = parseInt(dMatch2[1], 10);
          const dStr = dNum < 10 ? `0${dNum}` : `${dNum}`;
          scheduleDate = `2026-${mStr}-${dStr}`;
        }
      }

      const cdcItemRegex = /(?:^|\n)\s*(\d+)\.\s*\[([^\]]+)\]\s*([^(]+)\s*\(([^)]+)\)([\s\S]*?)(?=(?:\n\s*\d+\.\s*\[|$))/gi;
      let match;
      while ((match = cdcItemRegex.exec(emailText)) !== null) {
        const eventType = match[2].trim();
        const companyName = match[3].trim();
        const timeRange = match[4].trim();
        const restInfo = match[5].trim();

        const modeMatch = restInfo.match(/Mode\s*:\s*([^\n]+)/i);
        const modeInfo = modeMatch ? modeMatch[1].trim() : 'Online/Offline';

        const pocMatch = restInfo.match(/POC\s*:\s*([\s\S]*?)(?=\n\s*(?:Note|CDC|$|\d+\.))/i);
        const pocInfo = pocMatch ? pocMatch[1].replace(/\n+/g, ' ').trim() : 'CDC Coordinator';

        let dueTime = '10:00';
        const tMatch = timeRange.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (tMatch) {
          let h = parseInt(tMatch[1], 10);
          const m = tMatch[2];
          const period = tMatch[3].toUpperCase();
          if (period === 'PM' && h < 12) h += 12;
          if (period === 'AM' && h === 12) h = 0;
          dueTime = `${h < 10 ? '0' + h : h}:${m}`;
        }

        rawCandidates.push({
          type: 'cdc_schedule',
          company: companyName,
          eventType: eventType.toUpperCase(),
          date: scheduleDate,
          timeRange,
          dueTime,
          mode: modeInfo,
          poc: pocInfo,
          description: `[CDC ${eventType.toUpperCase()}] ${companyName} (${timeRange}). Mode: ${modeInfo}. POC: ${pocInfo}`,
        });
      }
    }
  }

  // 1. Attempt Workers AI extraction if available
  if (rawCandidates.length === 0 && env.AI) {
    rawCandidates = await extractActionsWithAI(env, emailText);
  }

  // 2. Smart Heuristic Fallback Engine (single task for non-schedule emails)
  if (!Array.isArray(rawCandidates) || rawCandidates.length === 0) {
    rawCandidates = [];
    const todayStr = getISTDate().dateString;

    // Check for attendance logs
    if (/(attended|present|missed|bunked|absent|cancelled)/i.test(emailText)) {
      const subjectMap: Record<string, string> = {
        hppc: 'CS61064', cs61064: 'CS61064',
        'comp org lab': 'CS39001', cs39001: 'CS39001',
        'algo 2': 'CS31005', algo: 'CS31005', cs31005: 'CS31005',
        'comp org': 'CS31007', cs31007: 'CS31007', architecture: 'CS31007',
        fllm: 'AI60213', llm: 'AI60213', ai60213: 'AI60213',
        compiler: 'CS31003', compilers: 'CS31003', cs31003: 'CS31003',
        'compiler lab': 'CS39003', 'compilers lab': 'CS39003', cs39003: 'CS39003',
      };

      let matchedSub = 'CS31007';
      for (const [key, code] of Object.entries(subjectMap)) {
        if (emailText.toLowerCase().includes(key)) {
          matchedSub = code;
          break;
        }
      }

      let status: 'attended' | 'missed' | 'cancelled' = 'attended';
      if (/(missed|bunked|absent)/i.test(emailText)) status = 'missed';
      else if (/cancelled/i.test(emailText)) status = 'cancelled';

      let logDate = todayStr;
      if (/yesterday/i.test(emailText)) {
        const yDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
        logDate = getISTDate(yDate).dateString;
      }

      rawCandidates.push({
        type: 'attendance',
        subject_code: matchedSub,
        date: logDate,
        status,
        note: `Parsed from email`,
      });
    }

    // Check for reminder/task
    if (rawCandidates.length === 0 && /(remind|due|assignment|exam|test|prep|project|interview|cdc|intern)/i.test(emailText)) {
      let dueDate = todayStr;
      const dateMatch = emailText.match(/(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        dueDate = dateMatch[1];
      } else if (/tomorrow/i.test(emailText)) {
        const tmrw = new Date(Date.now() + 24 * 60 * 60 * 1000);
        dueDate = getISTDate(tmrw).dateString;
      }

      let dueTime = '23:59';
      const timeMatch = emailText.match(/(\d{1,2}:\d{2}(?:\s*(?:AM|PM))?)/i);
      if (timeMatch) dueTime = timeMatch[1];

      rawCandidates.push({
        type: 'reminder',
        title: cleanTaskTitle(subject || emailText.slice(0, 40)),
        subject_code: /cdc|intern|company/i.test(emailText) ? 'INTERNSHIP' : 'GENERAL',
        reminder_type: /exam|test|midsem/i.test(emailText) ? 'exam' : 'assignment',
        due_date: dueDate,
        due_time: dueTime,
        priority: /high|urgent/i.test(emailText) ? 'high' : 'medium',
        description: emailText.slice(0, 150),
      });
    }
  }

  // 3. AI Decider & Refiner Phase: Filters out unwanted gibberish and refines parameters
  const parsedActions = await decideAndRefineActions(env, rawEmailText, rawCandidates);



  const executionResults: string[] = [];

  // 3. Auto-Execute extracted actions in database if enabled
  if (autoExecute && env.DB && parsedActions.length > 0) {
    await ensureTables(env.DB);

    for (const act of parsedActions) {
      try {
        if (act.type === 'cdc_schedule') {
          const companyName = act.company || 'Company';
          const eventTypeClean = (act.eventType || 'EVENT').toLowerCase().trim();
          const companySlug = companyName.toLowerCase().replace(/\W+/g, '');
          const remId = `rem-cdc-${companySlug}-${eventTypeClean}-${act.date}`;

          // PPT -> Low Priority & 'other' category; Test/Interview -> High Priority & 'exam' category
          const priority = eventTypeClean === 'ppt' ? 'low' : 'high';
          const categoryType = eventTypeClean === 'ppt' ? 'other' : (/(test|exam|interview)/.test(eventTypeClean) ? 'exam' : 'other');

          await env.DB.prepare(`
            INSERT INTO reminders (id, title, subject_code, type, due_date, due_time, priority, status, send_email, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              title=excluded.title,
              type=excluded.type,
              due_date=excluded.due_date,
              due_time=excluded.due_time,
              priority=excluded.priority,
              description=excluded.description,
              status='pending'
          `).bind(
            remId,
            `[CDC ${act.eventType}] ${companyName}`,
            'INTERNSHIP',
            categoryType,
            act.date,
            act.dueTime,
            priority,
            'pending',
            1,
            act.description
          ).run();

          executionResults.push(`📌 Updated/Created CDC Reminder: [${act.eventType}] ${companyName} on ${act.date} at ${act.dueTime} (${priority.toUpperCase()} priority, Mode: ${act.mode})`);
        } else if (act.type === 'attendance') {
          const id = 'att-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
          await env.DB.prepare(`
            INSERT INTO attendance_records (id, subject_code, date, status, note)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              subject_code=excluded.subject_code,
              date=excluded.date,
              status=excluded.status,
              note=excluded.note
          `).bind(id, act.subject_code, act.date, act.status, act.note || '').run();

          executionResults.push(`🟢 Logged Attendance: [${getSubjectDisplayName(act.subject_code)}] ${act.status.toUpperCase()} on ${act.date}`);
        } else if (act.type === 'reminder') {
          const titleSlug = (act.title || 'task').toLowerCase().replace(/\W+/g, '').slice(0, 25);
          const dueStr = act.due_date || getISTDate().dateString;
          const id = `rem-${titleSlug}-${dueStr}`;

          await env.DB.prepare(`
            INSERT INTO reminders (id, title, subject_code, type, due_date, due_time, priority, status, send_email, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              title=excluded.title,
              due_date=excluded.due_date,
              due_time=excluded.due_time,
              priority=excluded.priority,
              description=excluded.description,
              status='pending'
          `).bind(
            id,
            act.title || 'Parsed Task',
            act.subject_code || 'GENERAL',
            act.reminder_type || 'assignment',
            dueStr,
            act.due_time || '23:59',
            act.priority || 'medium',
            'pending',
            1,
            act.description || ''
          ).run();

          executionResults.push(`📌 Saved Reminder: "${act.title}" (${getSubjectDisplayName(act.subject_code)}) Due ${dueStr}`);
        } else if (act.type === 'intern') {
          const companyName = act.company || 'Unknown Company';
          const { results } = await env.DB.prepare(
            'SELECT id FROM intern_roles WHERE LOWER(company) LIKE ?'
          ).bind(`%${companyName.toLowerCase()}%`).all();

          if (results && results.length > 0) {
            const roleId = results[0].id;
            await env.DB.prepare(`
              UPDATE intern_roles SET
                my_status = COALESCE(?, my_status),
                interview_date = CASE WHEN ? <> '' THEN ? ELSE interview_date END,
                notes = CASE WHEN ? <> '' THEN ? ELSE notes END
              WHERE id = ?
            `).bind(act.myStatus || null, act.interviewDate || '', act.interviewDate || '', act.notes || '', act.notes || '', roleId).run();

            if (act.interviewDate) {
              const remId = 'rem-interview-' + roleId;
              await env.DB.prepare(`
                INSERT INTO reminders (id, title, subject_code, type, due_date, due_time, priority, status, send_email, description)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  title=excluded.title,
                  status='pending'
              `).bind(remId, `Interview: ${companyName}`, 'INTERNSHIP', 'exam', getISTDate().dateString, '10:00', 'high', 'pending', 1, `Scheduled via email parser`).run();
            }

            executionResults.push(`💼 Updated Intern Role: ${companyName} -> Status: ${act.myStatus || 'Updated'}`);
          } else {
            executionResults.push(`⚠️ Company "${companyName}" not found in Intern Database.`);
          }
        }
      } catch (execErr: any) {
        console.error('[ACTION EXECUTION ERROR]', execErr);
        executionResults.push(`❌ Failed to execute action (${act.type}): ${execErr.message}`);
      }
    }
    await touchLastEdit(env.DB);
  }

  // Record log entry into email_logs table
  if (env.DB) {
    try {
      const emailLogId = 'elog-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
      await env.DB.prepare(`
        INSERT INTO email_logs (id, sender, subject, body, action_count, execution_summary)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        emailLogId,
        sender,
        subject,
        emailText,
        parsedActions.length,
        JSON.stringify(executionResults)
      ).run();
    } catch (logErr) {
      console.error('[EMAIL LOG INSERT ERROR]', logErr);
    }
  }

  return {
    success: true,
    actionCount: parsedActions.length,
    parsedActions,
    executed: autoExecute,
    executionResults,
  };
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

async function touchLastEdit(db: any) {
  if (!db) return;
  const nowStr = Date.now().toString();
  try {
    await db.prepare(
      "INSERT INTO metadata (key, value) VALUES ('last_edit_timestamp', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ).bind(nowStr).run();
  } catch (e) {
    console.error('touchLastEdit warning:', e);
  }
}

async function getLastEditTimestamp(db: any): Promise<number> {
  if (!db) return Date.now();
  try {
    const res = await db.prepare("SELECT value FROM metadata WHERE key = 'last_edit_timestamp'").get();
    if (res && res.value) return Number(res.value);
  } catch (e) {}
  return Date.now();
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
        CREATE TABLE IF NOT EXISTS auth_tokens (
          token TEXT PRIMARY KEY,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at INTEGER NOT NULL
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
        CREATE TABLE IF NOT EXISTS attendance_records (
          id TEXT PRIMARY KEY,
          subject_code TEXT NOT NULL,
          date TEXT NOT NULL,
          status TEXT NOT NULL,
          note TEXT DEFAULT '',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
      db.prepare(`
        CREATE TABLE IF NOT EXISTS email_logs (
          id TEXT PRIMARY KEY,
          sender TEXT DEFAULT 'sai@timio.dsainvg.me',
          subject TEXT NOT NULL,
          body TEXT NOT NULL,
          action_count INTEGER DEFAULT 0,
          execution_summary TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

  // 4. Fetch Attendance records & Missed Class Alerts
  let attendanceHtml = '';
  let missedAlertsHtml = '';
  try {
    const { results: attLogs } = await env.DB.prepare(
      "SELECT * FROM attendance_records ORDER BY date DESC, created_at DESC"
    ).all();
    const attList = (attLogs || []) as any[];

    // Calculate per-subject stats
    const stats: Record<string, { attended: number; missed: number; cancelled: number }> = {};
    for (const log of attList) {
      if (!stats[log.subject_code]) {
        stats[log.subject_code] = { attended: 0, missed: 0, cancelled: 0 };
      }
      if (log.status === 'attended') stats[log.subject_code].attended++;
      else if (log.status === 'missed') stats[log.subject_code].missed++;
      else if (log.status === 'cancelled') stats[log.subject_code].cancelled++;
    }

    // Check if any subject scheduled today had its previous class missed!
    const missedTodaySubs: string[] = [];
    for (const slot of todaySlots) {
      const subCode = slot.subjectCode;
      const prevLog = attList.find(l => l.subject_code === subCode);
      if (prevLog && prevLog.status === 'missed') {
        if (!missedTodaySubs.includes(subCode)) {
          missedTodaySubs.push(subCode);
        }
      }
    }

    if (missedTodaySubs.length > 0) {
      missedAlertsHtml = `
        <div class="card" style="border-left: 4px solid #ef4444; background: rgba(239,68,68,0.1); margin-bottom:16px;">
          <div class="card-title" style="color:#f87171; font-weight:800;">⚠️ MISSED PREVIOUS CLASS WARNING</div>
          <p style="margin:6px 0 0; font-size:12px; color:#fca5a5;">
            Notice: You missed the previous class for: <strong>${missedTodaySubs.map(getSubjectDisplayName).join(', ')}</strong>.
            Make sure to attend today's lecture to keep your attendance above 75%!
          </p>
        </div>
      `;
    }

    // Find most missed subject
    let mostMissedSub = '';
    let maxMissed = 0;
    for (const [sub, st] of Object.entries(stats)) {
      if (st.missed > maxMissed) {
        maxMissed = st.missed;
        mostMissedSub = sub;
      }
    }

    if (Object.keys(stats).length > 0) {
      const summaryRows = Object.entries(stats).map(([sub, st]) => {
        const total = st.attended + st.missed;
        const pct = total > 0 ? Math.round((st.attended / total) * 100) : 100;
        const badgeColor = pct >= 75 ? '#4ade80' : '#f87171';
        return `
          <tr style="border-bottom:1px solid #1e293b;">
            <td style="padding:8px; font-weight:700; color:#f8fafc;">${getSubjectDisplayName(sub)}</td>
            <td style="padding:8px; color:#4ade80; text-align:center;">${st.attended}</td>
            <td style="padding:8px; color:#f87171; text-align:center;">${st.missed}</td>
            <td style="padding:8px; color:#fbbf24; text-align:center;">${st.cancelled}</td>
            <td style="padding:8px; font-weight:800; color:${badgeColor}; text-align:center;">${pct}%</td>
          </tr>
        `;
      }).join('');

      attendanceHtml = `
        <h4 style="color:#f8fafc; margin:24px 0 10px; font-size:14px;">📊 Attendance & Bunk Tracker Stats:</h4>
        ${mostMissedSub ? `<p style="font-size:12px; color:#fb923c; margin-bottom:10px;">🚨 <strong>Most Missed Class:</strong> ${getSubjectDisplayName(mostMissedSub)} (${maxMissed} missed lectures)</p>` : ''}
        <table style="width:100%; border-collapse:collapse; font-size:12px; text-align:left; background:rgba(15,23,42,0.6); border-radius:8px; overflow:hidden;">
          <thead>
            <tr style="background:#1e293b; color:#94a3b8;">
              <th style="padding:8px;">Subject</th>
              <th style="padding:8px; text-align:center;">Present</th>
              <th style="padding:8px; text-align:center;">Missed</th>
              <th style="padding:8px; text-align:center;">Cancelled</th>
              <th style="padding:8px; text-align:center;">Pct %</th>
            </tr>
          </thead>
          <tbody>
            ${summaryRows}
          </tbody>
        </table>
      `;
    }
  } catch (e) {
    console.error('Failed to query attendance for daily email summary:', e);
  }

  const html = buildHtmlEmail({
    title: '🌅 Daily Summary & 24-Hour Horizon Report',
    subtitle: `Next 24 Hours Window (${todayStr} to ${tomorrowStr}) • Roll No: 24CS10097`,
    accentColor: '#6366f1',
    contentHtml: `
      <h3 style="color:#818cf8; margin-top:0; font-size:16px;">Good Morning!</h3>
      <p style="color:#94a3b8; font-size:13px;">Here is your accurate <strong>Next 24 Hours</strong> schedule, test breakdown, and attendance alert (${todayStr} – ${tomorrowStr}):</p>
      
      ${missedAlertsHtml}

      <h4 style="color:#f8fafc; margin:20px 0 10px; font-size:14px;">📅 Next 24 Hours Classes:</h4>
      ${classesHtml}

      <h4 style="color:#f8fafc; margin:20px 0 10px; font-size:14px;">📋 Tasks & Tests Due (Next 24 Hours):</h4>
      ${tasksHtml}

      ${attendanceHtml}
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

async function validateSessionToken(authHeader: string | null, db?: any): Promise<boolean> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.substring(7).trim();
  if (!token.startsWith('tt_token_')) return false;
  try {
    const rawB64 = token.replace('tt_token_', '');
    const decoded = JSON.parse(atob(rawB64));
    if (decoded && decoded.expiresAt && decoded.expiresAt > Date.now()) {
      return true;
    }
  } catch (e) {}

  if (db) {
    try {
      const res = await db.prepare("SELECT 1 FROM auth_tokens WHERE token = ? AND expires_at > ?").bind(token, Date.now()).get();
      if (res) return true;
    } catch (e) {}
  }
  return false;
}

      // ─── 2. API ROUTES (/api/*) ──────────────────────────────────
      if (env.DB) {
        await ensureTables(env.DB);
      }

      if (path === '/api/sync-check' && request.method === 'GET') {
        const lastEdit = await getLastEditTimestamp(env.DB);
        return json({ success: true, lastEdit });
      }

      if (path === '/api/verify-auth' && request.method === 'POST') {
        const body = (await request.json()) as { password?: string };
        const clientPass = (body.password || '').trim();
        const serverSecret = (env.APP_PASSWORD || '24cs10097').trim();

        if (clientPass === serverSecret) {
          const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
          const token = generateSessionToken(expiresAt);
          if (env.DB) {
            try {
              await env.DB.prepare(
                "INSERT INTO auth_tokens (token, expires_at) VALUES (?, ?) ON CONFLICT(token) DO UPDATE SET expires_at = excluded.expires_at"
              ).bind(token, expiresAt).run();
            } catch (e) {
              console.error('Failed to store auth_token in D1:', e);
            }
          }
          return json({
            success: true,
            token,
            expiresAt,
            message: 'Authentication successful. Access granted for 30 days.',
          });
        } else {
          return json({ success: false, message: 'Invalid security passcode.' }, 401);
        }
      }

      // Authorization Gatekeeper for protected API routes
      const authHeader = request.headers.get('Authorization');
      const isValidAuth = await validateSessionToken(authHeader, env.DB);
      if (!isValidAuth) {
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

            await touchLastEdit(env.DB);
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

            await touchLastEdit(env.DB);
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
            await touchLastEdit(env.DB);
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
            await touchLastEdit(env.DB);
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
            await touchLastEdit(env.DB);
          } catch (e) {
            console.error('POST /api/rooms D1 error:', e);
          }
        }
        return json({ success: true });
      }

      // ─── ATTENDANCE TRACKER API ────────────────────────────────
      if (path === '/api/attendance' && request.method === 'GET') {
        if (env.DB) {
          try {
            const { results } = await env.DB.prepare(
              'SELECT * FROM attendance_records ORDER BY date DESC, created_at DESC'
            ).all();
            return json(results || []);
          } catch (e) {
            console.error('GET /api/attendance D1 error:', e);
          }
        }
        return json([]);
      }

      if (path === '/api/attendance' && request.method === 'POST') {
        const body = (await request.json()) as any;
        if (env.DB && body.subject_code && body.date && body.status) {
          try {
            const id = body.id || 'att-' + Date.now();
            await env.DB.prepare(`
              INSERT INTO attendance_records (id, subject_code, date, status, note)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                subject_code=excluded.subject_code,
                date=excluded.date,
                status=excluded.status,
                note=excluded.note
            `).bind(
              id,
              body.subject_code,
              body.date,
              body.status,
              body.note || ''
            ).run();
            await touchLastEdit(env.DB);
            return json({ success: true, id });
          } catch (e: any) {
            console.error('POST /api/attendance D1 error:', e);
            return json({ success: false, message: e.message }, 500);
          }
        }
        return json({ success: true });
      }

      if (path.startsWith('/api/attendance/') && request.method === 'DELETE') {
        const parts = path.split('/');
        const id = parts[parts.length - 1];

        if (env.DB && id) {
          try {
            await env.DB.prepare('DELETE FROM attendance_records WHERE id = ?').bind(id).run();
            await touchLastEdit(env.DB);
          } catch (e: any) {
            console.error(`DELETE /api/attendance/${id} D1 error:`, e);
          }
        }
        return json({ success: true, deleted: id });
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

      // ─── 5. EMAIL TRIGGER WORKER API ──────────────────────────────
      if (path === '/api/trigger-email' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as {
          triggerType?: 'daily' | 'sunday' | 'reminders' | 'custom';
          recipient?: string;
          subject?: string;
          message?: string;
        };

        const targetRecipient = body.recipient || env.DEFAULT_EMAIL || DEFAULT_RECIPIENT;
        const triggerType = body.triggerType || 'daily';

        try {
          if (triggerType === 'daily') {
            await sendDailyMorningSummary(env, targetRecipient);
            return json({ success: true, message: `Daily 24-hour summary email worker triggered successfully for ${targetRecipient}` });
          } else if (triggerType === 'sunday') {
            await sendSundayWeeklySummary(env, targetRecipient);
            return json({ success: true, message: `Sunday weekly summary email worker triggered successfully for ${targetRecipient}` });
          } else if (triggerType === 'reminders') {
            await processHourlyReminders(env, targetRecipient);
            return json({ success: true, message: `Hourly reminder scan worker triggered successfully for ${targetRecipient}` });
          } else if (triggerType === 'custom') {
            const result = await dispatchEmail(env, {
              recipient: targetRecipient,
              subject: body.subject || '⚡ Worker Trigger Notification',
              text: body.message || 'Manual worker email trigger executed.',
            });
            return json(result, result.success ? 200 : 400);
          }
          return json({ success: false, message: 'Invalid trigger type. Supported types: daily, sunday, reminders, custom.' }, 400);
        } catch (e: any) {
          console.error('[EMAIL TRIGGER WORKER ERROR]', e);
          return json({ success: false, error: e.message || 'Failed to execute email trigger worker' }, 500);
        }
      }

      // ─── 6. CLOUDFLARE WORKERS AI ASSISTANT BINDING API ─────────────
      if (path === '/api/ai-assistant' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as {
          prompt?: string;
          systemPrompt?: string;
          model?: string;
        };

        const userPrompt = body.prompt || 'Summarize my timetable schedule for today.';
        const systemPrompt = body.systemPrompt || 'You are an intelligent academic assistant for an IIT Kharagpur CSE student. Provide concise, helpful advice regarding coursework, attendance, timetable scheduling, and internship preparation.';
        const targetModel = body.model || '@cf/meta/llama-3-8b-instruct';

        if (env.AI) {
          try {
            const aiResponse = await env.AI.run(targetModel, {
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
              ],
            });
            return json({
              success: true,
              model: targetModel,
              response: aiResponse.response || aiResponse,
            });
          } catch (e: any) {
            console.error('[WORKERS AI RUN ERROR]', e);
            return json({ success: false, error: e.message || 'Workers AI execution error.' }, 500);
          }
        } else {
          return json(
            {
              success: false,
              message:
                'Cloudflare Workers AI binding is configured in wrangler.json ("ai": { "binding": "AI" }). To enable live Workers AI model responses, deploy the worker using "npx wrangler deploy".',
              setupRequired: true,
            },
            503
          );
        }
      }

      // ─── 7. MULTI-ACTION EMAIL RESPONSE PARSER & DISPATCHER API ──────
      if (path === '/api/parse-email-actions' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as {
          emailText?: string;
          autoExecute?: boolean;
          sender?: string;
          subject?: string;
        };

        const emailText = (body.emailText || '').trim();
        if (!emailText) {
          return json({ success: false, message: 'emailText is required.' }, 400);
        }

        const sender = parseEmailAddress(body.sender || 'dsainvg@gmail.com');
        const isAllowedSender = ALLOWED_TRIGGER_SENDERS.some(allowed => sender.includes(allowed.toLowerCase()));

        if (!isAllowedSender) {
          return json({
            success: false,
            message: `Unauthorized sender "${sender}". Inbound email triggers are only allowed from: ${ALLOWED_TRIGGER_SENDERS.join(', ')}`,
          }, 403);
        }

        const subject = body.subject || 'Inbound Email Response / Trigger';
        const autoExecute = body.autoExecute !== false;

        const result = await processInboundEmailTrigger(env, sender, subject, emailText, autoExecute);
        return json(result);
      }

      // ─── 8. GET INBOUND EMAIL TRIGGER LOGS API ────────────────────────
      if (path === '/api/email-logs' && request.method === 'GET') {
        if (env.DB) {
          try {
            const { results } = await env.DB.prepare(
              'SELECT * FROM email_logs ORDER BY created_at DESC'
            ).all();
            const parsedLogs = (results || []).map((row: any) => ({
              id: row.id,
              sender: row.sender,
              subject: row.subject,
              body: row.body,
              action_count: Number(row.action_count || 0),
              execution_summary: JSON.parse(row.execution_summary || '[]'),
              created_at: row.created_at,
            }));
            return json(parsedLogs);
          } catch (e) {
            console.error('GET /api/email-logs D1 error:', e);
          }
        }
        return json([]);
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

  // ─── CLOUDFLARE EMAIL ROUTING TRIGGER HANDLER ───────────────────
  async email(message: any, env: Env, _ctx: any): Promise<void> {
    const rawFrom = message.from || '';
    const sender = parseEmailAddress(rawFrom);
    const subject = message.headers?.get('subject') || 'Inbound Email Trigger';
    console.log(`[EMAIL ROUTING TRIGGER RECEIVED] From: "${rawFrom}" (Parsed: ${sender}), Subject: ${subject}`);

    const isAllowedSender = ALLOWED_TRIGGER_SENDERS.some(allowed => sender.includes(allowed.toLowerCase()));
    if (!isAllowedSender) {
      console.log(`[EMAIL TRIGGER REJECTED] Unauthorized sender: ${sender}`);
      if (typeof message.setReject === 'function') {
        message.setReject('Sender not authorized for automated timetable trigger.');
      }
      return;
    }

    let rawBody = '';
    try {
      if (message.raw) {
        rawBody = await readStreamText(message.raw);
      }
    } catch (err) {
      console.error('[EMAIL RAW STREAM ERROR]', err);
    }

    const emailText = stripMimeAndHtml(rawBody) || subject;
    const result = await processInboundEmailTrigger(env, sender, subject, emailText, true);
    console.log(`[EMAIL ROUTING TRIGGER PROCESSED] Executed ${result.actionCount} action(s).`);
  },
};
