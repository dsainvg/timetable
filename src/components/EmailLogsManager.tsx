import React, { useState, useEffect } from 'react';
import {
  MailCheck,
  Sparkles,
  Send,
  CheckCircle2,
  AlertCircle,
  Search,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { EmailLog, getEmailLogs, parseAndExecuteEmailResponse } from '../services/api';

interface EmailLogsManagerProps {
  onRefreshData?: () => void;
}

export const EmailLogsManager: React.FC<EmailLogsManagerProps> = ({ onRefreshData }) => {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [simText, setSimText] = useState('');
  const [simSender, setSimSender] = useState('sai@timio.dsainvg.me');
  const [simSubject, setSimSubject] = useState('Re: IIT KGP Daily Class & Tasks Update');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processNotice, setProcessNotice] = useState<{ type: 'success' | 'error' | null; message: string; results?: string[] }>({
    type: null,
    message: '',
  });

  const loadLogs = async () => {
    setLoading(true);
    const data = await getEmailLogs();
    setLogs(data);
    setLoading(false);
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleSimulateProcess = async (textToProcess?: string) => {
    const content = textToProcess || simText;
    if (!content.trim()) return;

    setIsProcessing(true);
    setProcessNotice({ type: null, message: '' });

    const result = await parseAndExecuteEmailResponse(content, {
      sender: simSender.trim() || 'sai@timio.dsainvg.me',
      subject: simSubject.trim() || 'Inbound Email Response / Trigger',
    });

    if (result.success) {
      setProcessNotice({
        type: 'success',
        message: `Successfully parsed and executed ${result.actionCount} automated action(s)!`,
        results: result.executionResults,
      });
      setSimText('');
      await loadLogs();
      if (onRefreshData) onRefreshData();
    } else {
      setProcessNotice({
        type: 'error',
        message: result.message || 'Failed to process email response.',
      });
    }
    setIsProcessing(false);
  };

  const sampleTriggers = [
    {
      title: '📋 CDC Forwarded Schedule',
      text: `INTERNSHIP | Schedule | CDC Internship schedule for 25th July
25-07-2026 04:50

Type : INTERNSHIP
Subject : Schedule
Company : CDC Internship schedule for 25th July

1. [PPT] Piramal Pharma (01:00 PM - 02:00 PM)
Mode: Online
POC: Keshav (7710038569)

2. [Test] Irage (03:00 PM - 04:30 PM)
Mode: Offline
POC: Khush (9922168000)
Himanshu(+91 93113 32376)

3. [Test] Graviton Research Capital LLP (05:00 PM - 08:00 PM)
Mode: Offline
POC: Aditi (8815395895)
Anjali (+91 79896 13926)

4. [Test] Wells Fargo (08:00 PM - 10:00 PM)
Mode: Online
POC: Bhavy (+91 75971 21669)
Nikita Sinha (+91 99692 07598)

5. [TEST] Atlassian (10:00 PM - 12:30 AM)
Mode: Online
POC: Anurag(+91 94910 87133)
Vatsal (+91 92344 57393)

Note : The link for the PPT will be shared shortly. All interested candidates are required to attend the PPT. The test link, along with detailed instructions, will also be shared soon

CDC, IIT Kharagpur
This is an automated notification from CDC ERP Bot.`,
    },
    {
      title: 'Attendance + Assignment + Interview',
      text: 'Attended CS31007 today. Missed HPPC yesterday. Remind me Compilers lab assignment due 2026-07-29 at 18:00 high priority. Set Google interview for 30 July 10:00 AM.',
    },
    {
      title: 'Class Cancelled + Intern Application',
      text: 'Prof cancelled Algo 2 class today. Applied to Amazon. Remind me midsem prep for Computer Architecture on Friday.',
    },
    {
      title: 'Class Attended + Offer Received',
      text: 'Attended FLLM today. Got offer from Atlassian with stipend details.',
    },
  ];

  const filteredLogs = logs.filter((log) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      log.subject.toLowerCase().includes(q) ||
      log.sender.toLowerCase().includes(q) ||
      log.body.toLowerCase().includes(q)
    );
  });

  const totalActionsExecuted = logs.reduce((sum, l) => sum + (l.action_count || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, animation: 'fadeIn 0.2s ease' }}>
      
      {/* ─── Header Banner ─── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(30,27,75,0.85) 100%)',
        border: '1px solid rgba(99,102,241,0.3)',
        borderRadius: 20, padding: '22px 26px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16,
        boxShadow: '0 12px 35px rgba(0,0,0,0.4)',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <MailCheck size={24} style={{ color: '#818cf8' }} />
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#f8fafc', fontFamily: 'Outfit, sans-serif' }}>
              Inbound Email Trigger Logs & Automated Executions
            </h2>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>
            Lists all received email triggers, AI-extracted tasks, logged class attendances, and intern status updates.
          </p>
        </div>

        <button
          onClick={loadLogs}
          disabled={loading}
          style={{
            background: 'rgba(30,41,59,0.8)',
            border: '1px solid rgba(51,65,85,0.8)',
            borderRadius: 12, padding: '10px 16px',
            color: '#e2e8f0', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
            transition: 'all 0.15s',
          }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} style={{ color: '#818cf8' }} />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* ─── Trigger Statistics ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <div style={{
          background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(30,41,59,0.8)',
          borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(99,102,241,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
            <MailCheck size={20} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Emails Received</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#f8fafc', fontFamily: 'Outfit, sans-serif' }}>{logs.length}</div>
          </div>
        </div>

        <div style={{
          background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(30,41,59,0.8)',
          borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(74,222,128,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4ade80' }}>
            <Zap size={20} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions Executed</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#4ade80', fontFamily: 'Outfit, sans-serif' }}>{totalActionsExecuted}</div>
          </div>
        </div>

        <div style={{
          background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(30,41,59,0.8)',
          borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(245,158,11,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24' }}>
            <Sparkles size={20} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Parser Status</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#fbbf24' }}>Active (Cloudflare / Dual Engine)</div>
          </div>
        </div>
      </div>

      {/* ─── Interactive Email Trigger & Response Simulator ─── */}
      <div style={{
        background: 'rgba(15,23,42,0.85)',
        border: '1px solid rgba(99,102,241,0.3)',
        borderRadius: 18, padding: '20px 24px',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} style={{ color: '#818cf8' }} />
            <span style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc', fontFamily: 'Outfit, sans-serif' }}>
              Process / Simulate Inbound Email Response
            </span>
          </div>
          <span style={{ fontSize: 11, color: '#64748b' }}>
            Paste any email response or click sample presets below to trigger automated parsing.
          </span>
        </div>

        {/* Sample Presets */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center' }}>Samples:</span>
          {sampleTriggers.map((sample, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setSimText(sample.text);
                handleSimulateProcess(sample.text);
              }}
              style={{
                background: 'rgba(30,41,59,0.7)',
                border: '1px solid rgba(99,102,241,0.3)',
                borderRadius: 8, padding: '4px 10px',
                fontSize: 11, fontWeight: 700, color: '#a5b4fc',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              ⚡ {sample.title}
            </button>
          ))}
        </div>

        {/* Input Text Area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Sender Email</label>
              <input
                type="text"
                value={simSender}
                onChange={(e) => setSimSender(e.target.value)}
                style={{ width: '100%', background: 'rgba(3,7,18,0.8)', border: '1px solid rgba(51,65,85,0.7)', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: '#cbd5e1', fontFamily: 'monospace', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Subject</label>
              <input
                type="text"
                value={simSubject}
                onChange={(e) => setSimSubject(e.target.value)}
                style={{ width: '100%', background: 'rgba(3,7,18,0.8)', border: '1px solid rgba(51,65,85,0.7)', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: '#cbd5e1', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Inbound Email Body / Text Trigger</label>
            <textarea
              value={simText}
              onChange={(e) => setSimText(e.target.value)}
              rows={3}
              placeholder="e.g. Attended CS31007 today. Missed HPPC yesterday. Compilers assignment due 2026-07-29 at 18:00 high priority. Google interview on 30 July 10:00 AM."
              style={{
                width: '100%', background: 'rgba(3,7,18,0.8)', border: '1px solid rgba(51,65,85,0.7)',
                borderRadius: 10, padding: '10px 12px', fontSize: 12, color: '#f8fafc',
                resize: 'vertical', outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            onClick={() => handleSimulateProcess()}
            disabled={isProcessing || !simText.trim()}
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              border: 'none', borderRadius: 10, padding: '10px 18px',
              color: '#ffffff', fontSize: 12, fontWeight: 700,
              cursor: isProcessing || !simText.trim() ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: isProcessing || !simText.trim() ? 0.6 : 1, transition: 'all 0.15s',
              boxShadow: '0 4px 15px rgba(99,102,241,0.3)',
            }}
          >
            {isProcessing ? (
              <span>Parsing and executing actions…</span>
            ) : (
              <>
                <Send size={15} />
                <span>Process & Log Inbound Email Trigger</span>
              </>
            )}
          </button>
        </div>

        {/* Process Notice & Execution Summary */}
        {processNotice.message && (
          <div style={{
            background: processNotice.type === 'success' ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${processNotice.type === 'success' ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)'}`,
            borderRadius: 12, padding: '12px 16px', fontSize: 12,
            color: processNotice.type === 'success' ? '#4ade80' : '#f87171',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, marginBottom: processNotice.results?.length ? 6 : 0 }}>
              {processNotice.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{processNotice.message}</span>
            </div>

            {processNotice.results && processNotice.results.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(74,222,128,0.2)' }}>
                <span style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800 }}>Executed Actions Summary:</span>
                {processNotice.results.map((res, i) => (
                  <div key={i} style={{ color: '#e2e8f0', fontSize: 12, fontFamily: 'monospace' }}>
                    {res}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Received Email Logs History ─── */}
      <div style={{
        background: 'rgba(15,23,42,0.7)',
        border: '1px solid rgba(30,41,59,0.8)',
        borderRadius: 16, padding: '20px',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#f8fafc', fontFamily: 'Outfit, sans-serif' }}>
            Historical Email Trigger Logs ({filteredLogs.length})
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(3,7,18,0.8)', border: '1px solid rgba(51,65,85,0.6)', borderRadius: 9, padding: '6px 12px' }}>
            <Search size={14} style={{ color: '#64748b' }} />
            <input
              type="text"
              placeholder="Search logs…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ background: 'none', border: 'none', outline: 'none', color: '#cbd5e1', fontSize: 12, width: 160 }}
            />
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748b', fontSize: 13 }}>
            No inbound email trigger logs found. Try simulating an email trigger above!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                style={{
                  background: 'rgba(30,41,59,0.5)',
                  border: '1px solid rgba(51,65,85,0.6)',
                  borderRadius: 14, padding: '16px 18px',
                  display: 'flex', flexDirection: 'column', gap: 10,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#f1f5f9', fontFamily: 'Outfit, sans-serif' }}>
                      {log.subject}
                    </span>
                    <div style={{ fontSize: 11, color: '#818cf8', fontFamily: 'monospace', marginTop: 2 }}>
                      From: {log.sender}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 6,
                      background: log.action_count > 0 ? 'rgba(74,222,128,0.15)' : 'rgba(148,163,184,0.15)',
                      color: log.action_count > 0 ? '#4ade80' : '#94a3b8',
                      border: `1px solid ${log.action_count > 0 ? 'rgba(74,222,128,0.3)' : 'rgba(148,163,184,0.3)'}`,
                    }}>
                      {log.action_count} Action(s) Executed
                    </span>
                    <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>
                      {log.created_at || 'Just now'}
                    </span>
                  </div>
                </div>

                {/* Email Body Snippet */}
                <div style={{ background: 'rgba(3,7,18,0.6)', border: '1px solid rgba(51,65,85,0.4)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#cbd5e1', fontStyle: 'italic' }}>
                  "{log.body}"
                </div>

                {/* Executed Action Items Badges */}
                {Array.isArray(log.execution_summary) && log.execution_summary.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                    <span style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800 }}>Actions Executed on Website:</span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {log.execution_summary.map((item, i) => (
                        <div
                          key={i}
                          style={{
                            background: 'rgba(15,23,42,0.8)',
                            border: '1px solid rgba(99,102,241,0.3)',
                            borderRadius: 6, padding: '3px 8px',
                            fontSize: 11, color: '#a5b4fc', fontFamily: 'monospace',
                          }}
                        >
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
