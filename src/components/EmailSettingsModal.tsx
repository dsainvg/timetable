import React, { useState } from 'react';
import { Mail, Key, Send, CheckCircle2, AlertCircle, ShieldCheck, X } from 'lucide-react';
import { sendEmailNotification } from '../services/api';

interface EmailSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EmailSettingsModal: React.FC<EmailSettingsModalProps> = ({ isOpen, onClose }) => {
  const [recipient, setRecipient] = useState('sai@dsainvg.me');
  const [appPassword, setAppPassword] = useState(() => {
    return localStorage.getItem('iitkgp_timetable_gmail_app_pass') || '';
  });
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: '',
  });
  const [isSending, setIsSending] = useState(false);

  if (!isOpen) return null;

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('iitkgp_timetable_gmail_app_pass', appPassword);
    setStatus({
      type: 'success',
      message: 'SMTP settings saved locally!',
    });
  };

  const handleSendTest = async () => {
    setIsSending(true);
    setStatus({ type: null, message: '' });

    const result = await sendEmailNotification({
      recipient: recipient.trim() || 'sai@dsainvg.me',
      subject: '🧪 Test Email Alert - IIT KGP Timetable Portal',
      text: 'This is a test email verification from your Timetable & Reminder Web Application (24CS10097) sent to sai@dsainvg.me.',
    });

    if (result.success) {
      setStatus({
        type: 'success',
        message: result.message || 'Test email successfully sent to your inbox!',
      });
    } else {
      setStatus({
        type: 'error',
        message: result.message || 'Failed to send test email. Please check your App Password or SMTP server status.',
      });
    }
    setIsSending(false);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-container max-w-md w-full animate-fade-in border border-indigo-500/40">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-indigo-400 font-bold font-outfit text-lg">
            <Mail className="w-5 h-5" />
            <span>Gmail SMTP Configuration</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 p-1 rounded-lg hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-400 mb-4">
          Configure Gmail SMTP dispatch settings to deliver automated assignment and class alerts directly from <strong className="text-indigo-300 font-mono">onlyforgdb@gmail.com</strong>.
        </p>

        <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold uppercase tracking-wider mb-1">
              Sender / Recipient Email
            </label>
            <input
              type="email"
              required
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-100 font-mono outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold uppercase tracking-wider mb-1">
              Gmail App Password (16-character)
            </label>
            <div className="relative">
              <input
                type="password"
                placeholder="xxxx xxxx xxxx xxxx"
                value={appPassword}
                onChange={(e) => setAppPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 pl-9 text-slate-100 font-mono outline-none focus:border-indigo-500"
              />
              <Key className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Generated from Google Account -&gt; Security -&gt; App Passwords.
            </p>
          </div>

          {status.message && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                status.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}
            >
              {status.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              )}
              <span>{status.message}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              type="submit"
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-2.5 rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Save Settings</span>
            </button>

            <button
              type="button"
              onClick={handleSendTest}
              disabled={isSending}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-1.5"
            >
              {isSending ? (
                <span className="inline-block animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></span>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send Test Email</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
