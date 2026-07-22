export type InternStatus = 'not_applied' | 'applied' | 'shortlisted' | 'interview' | 'offer' | 'rejected';

export interface InternCompany {
  id: string;
  company: string;
  ctc: number;
  currency: string;
  applyStatus: string; // 'Apply' from ERP = open
  resumeStart: string;
  resumeEnd: string;
  interviewDate: string;
  positionNote?: string; // e.g. "Role A" / "Role B" for duplicates
  sortingDone: boolean;  // "SORTED / DONE" button
  myStatus: InternStatus;
  notes: string;
}

const LOCAL_STORAGE_KEY = 'iitkgp_intern_tracker_v2';

export const INTERN_COMPANIES_DEFAULT: InternCompany[] = [
  { id: 'i1',  company: 'Amazon',                                     ctc: 130000,  currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-11 15:45', resumeEnd: '2026-07-12 23:59', interviewDate: '', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i2',  company: 'American Express',                           ctc: 175000,  currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-14 12:05', resumeEnd: '2026-07-16 14:00', interviewDate: '', positionNote: 'Role A', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i3',  company: 'American Express',                           ctc: 175000,  currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-14 12:03', resumeEnd: '2026-07-16 14:00', interviewDate: '', positionNote: 'Role B', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i4',  company: 'Atlassian India LLP',                       ctc: 130000,  currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-19 13:42', resumeEnd: '2026-07-21 17:00', interviewDate: '', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i5',  company: 'Bain and Company',                          ctc: 140000,  currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-02 10:36', resumeEnd: '2026-07-03 18:00', interviewDate: '', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i6',  company: 'Boston Consulting Group (BCG)',              ctc: 150000,  currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-02 10:39', resumeEnd: '2026-07-07 11:59', interviewDate: '', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i7',  company: 'Cisco India Pvt Ltd',                       ctc: 98000,   currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-09 19:29', resumeEnd: '2026-07-11 08:00', interviewDate: '', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i8',  company: 'Corridor Technologies',                     ctc: 100000,  currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-19 09:30', resumeEnd: '2026-07-20 23:59', interviewDate: '', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i9',  company: 'D. E. Shaw India',                          ctc: 300000,  currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-12 19:52', resumeEnd: '2026-07-15 11:59', interviewDate: '', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i10', company: 'Ebullient Securities (Tradewalk)',           ctc: 750000,  currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-06 22:30', resumeEnd: '2026-07-08 23:59', interviewDate: '', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i11', company: 'Flipkart',                                   ctc: 50000,   currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-15 18:38', resumeEnd: '2026-07-17 23:59', interviewDate: '', positionNote: 'Role A', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i12', company: 'Flipkart',                                   ctc: 150000,  currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-15 18:37', resumeEnd: '2026-07-17 23:59', interviewDate: '', positionNote: 'Role B', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i13', company: 'Glean Search Technologies',                  ctc: 7000,    currency: 'USD', applyStatus: 'Apply', resumeStart: '2026-07-21 17:01', resumeEnd: '2026-07-22 16:00', interviewDate: '', positionNote: 'USD Role', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i14', company: 'Glean Search Technologies',                  ctc: 300000,  currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-21 17:01', resumeEnd: '2026-07-22 16:00', interviewDate: '', positionNote: 'INR Role', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i15', company: 'Goldman Sachs',                              ctc: 266667,  currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-19 09:30', resumeEnd: '2026-07-20 09:00', interviewDate: '', positionNote: 'Role A', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i16', company: 'Goldman Sachs',                              ctc: 191667,  currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-19 09:30', resumeEnd: '2026-07-20 13:00', interviewDate: '', positionNote: 'Role B', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i17', company: 'Google',                                     ctc: 144167,  currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-08 16:19', resumeEnd: '2026-07-12 23:59', interviewDate: '', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i18', company: 'Graviton Research Capital LLP',              ctc: 2500000, currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-16 10:48', resumeEnd: '2026-07-17 23:59', interviewDate: '', positionNote: 'Role A', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i19', company: 'Graviton Research Capital LLP',              ctc: 2500000, currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-15 11:11', resumeEnd: '2026-07-17 23:59', interviewDate: '', positionNote: 'Role B', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i20', company: 'Hindustan Unilever Limited',                 ctc: 220000,  currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-21 17:00', resumeEnd: '2026-07-22 16:00', interviewDate: '', positionNote: 'Role A', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i21', company: 'Hindustan Unilever Limited',                 ctc: 220000,  currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-21 17:00', resumeEnd: '2026-07-22 16:00', interviewDate: '', positionNote: 'Role B', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i22', company: 'IMC',                                        ctc: 2500000, currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-09 19:36', resumeEnd: '2026-07-11 11:59', interviewDate: '', positionNote: 'Role A', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i23', company: 'IMC',                                        ctc: 2500000, currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-09 19:34', resumeEnd: '2026-07-11 11:59', interviewDate: '', positionNote: 'Role B', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i24', company: 'JP Morgan Chase',                            ctc: 225000,  currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-15 12:19', resumeEnd: '2026-07-16 16:00', interviewDate: '', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i25', company: 'KLA',                                        ctc: 250000,  currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-17 16:01', resumeEnd: '2026-07-21 10:59', interviewDate: '', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i26', company: 'LEK Consulting',                             ctc: 180000,  currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-02 10:08', resumeEnd: '2026-07-04 18:00', interviewDate: '', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i27', company: 'McKinsey & Company',                         ctc: 140000,  currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-02 09:47', resumeEnd: '2026-07-03 11:00', interviewDate: '', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i28', company: 'Microsoft Corporation',                      ctc: 125000,  currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-06 16:08', resumeEnd: '2026-07-08 23:59', interviewDate: '', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i29', company: 'Millennium Consulting India',                ctc: 300000,  currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-10 16:13', resumeEnd: '2026-07-15 23:59', interviewDate: '', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i30', company: 'Morgan Stanley',                             ctc: 186000,  currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-19 09:30', resumeEnd: '2026-07-20 23:59', interviewDate: '', positionNote: 'Role A', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i31', company: 'Morgan Stanley',                             ctc: 186000,  currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-19 09:30', resumeEnd: '2026-07-20 23:59', interviewDate: '', positionNote: 'Role B', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i32', company: 'Neo Wealth and Asset Management',            ctc: 100000,  currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-17 19:20', resumeEnd: '2026-07-19 23:59', interviewDate: '', positionNote: 'Role A', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i33', company: 'Neo Wealth and Asset Management',            ctc: 250000,  currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-17 15:54', resumeEnd: '2026-07-19 23:59', interviewDate: '', positionNote: 'Role B', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i34', company: 'Neo Wealth and Asset Management',            ctc: 250000,  currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-17 15:56', resumeEnd: '2026-07-19 23:59', interviewDate: '', positionNote: 'Role C', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i35', company: 'Nomura',                                     ctc: 175000,  currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-08 16:52', resumeEnd: '2026-07-10 10:00', interviewDate: '', positionNote: 'Role A', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i36', company: 'Nomura',                                     ctc: 175000,  currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-08 16:52', resumeEnd: '2026-07-10 10:00', interviewDate: '', positionNote: 'Role B', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i37', company: 'Optiver',                                    ctc: 3000000, currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-11 15:49', resumeEnd: '2026-07-13 10:00', interviewDate: '', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i38', company: 'Plivo Services India',                       ctc: 175000,  currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-13 16:40', resumeEnd: '2026-07-15 13:00', interviewDate: '', positionNote: 'Role A', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i39', company: 'Plivo Services India',                       ctc: 150000,  currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-13 16:40', resumeEnd: '2026-07-15 13:00', interviewDate: '', positionNote: 'Role B', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i40', company: 'Pluswealth Capital Management LLP',          ctc: 1500000, currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-10 19:49', resumeEnd: '2026-07-13 16:00', interviewDate: '', positionNote: 'Role A', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i41', company: 'Pluswealth Capital Management LLP',          ctc: 1500000, currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-10 19:52', resumeEnd: '2026-07-13 16:00', interviewDate: '', positionNote: 'Role B', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i42', company: 'QI-CAP Investments Pvt Ltd',                 ctc: 500000,  currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-21 17:02', resumeEnd: '2026-07-22 17:00', interviewDate: '', positionNote: 'Role A', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i43', company: 'QI-CAP Investments Pvt Ltd',                 ctc: 500000,  currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-21 17:03', resumeEnd: '2026-07-22 17:00', interviewDate: '', positionNote: 'Role B', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i44', company: 'Quadeye',                                    ctc: 3000000, currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-15 19:25', resumeEnd: '2026-07-16 23:59', interviewDate: '', positionNote: 'Role A', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i45', company: 'Quadeye',                                    ctc: 3000000, currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-15 19:25', resumeEnd: '2026-07-16 23:59', interviewDate: '', positionNote: 'Role B', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i46', company: 'QUANTBOX RESEARCH',                          ctc: 2500000, currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-15 19:48', resumeEnd: '2026-07-16 13:00', interviewDate: '', positionNote: 'Role A', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i47', company: 'QUANTBOX RESEARCH',                          ctc: 2500000, currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-15 19:45', resumeEnd: '2026-07-16 13:00', interviewDate: '', positionNote: 'Role B', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i48', company: 'QUANTBOX RESEARCH',                          ctc: 2500000, currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-15 19:46', resumeEnd: '2026-07-16 13:00', interviewDate: '', positionNote: 'Role C', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i49', company: 'QUANTBOX RESEARCH',                          ctc: 2500000, currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-15 19:40', resumeEnd: '2026-07-16 13:00', interviewDate: '', positionNote: 'Role D', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i50', company: 'Sprinklr',                                   ctc: 150000,  currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-15 10:59', resumeEnd: '2026-07-16 08:59', interviewDate: '', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i51', company: 'Stripe India Pvt Ltd',                       ctc: 200000,  currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-08 17:31', resumeEnd: '2026-07-11 23:59', interviewDate: '', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i52', company: 'Tower Research Capital',                     ctc: 750000,  currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-20 16:10', resumeEnd: '2026-07-21 11:00', interviewDate: '', positionNote: 'Role A', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i53', company: 'Tower Research Capital',                     ctc: 750000,  currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-20 16:10', resumeEnd: '2026-07-21 11:00', interviewDate: '', positionNote: 'Role B', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i54', company: 'Trexquant (India) Business Consulting',      ctc: 500000,  currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-06 16:10', resumeEnd: '2026-07-08 23:59', interviewDate: '', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i55', company: 'Uber India Pvt Ltd',                         ctc: 187916,  currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-17 11:13', resumeEnd: '2026-07-18 23:59', interviewDate: '', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i56', company: 'UiPath',                                     ctc: 150000,  currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-21 17:00', resumeEnd: '2026-07-22 23:59', interviewDate: '', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i57', company: 'Wells Fargo',                                ctc: 130000,  currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-21 15:08', resumeEnd: '2026-07-22 16:00', interviewDate: '', sortingDone: false, myStatus: 'not_applied', notes: '' },
  { id: 'i58', company: 'Zanskar Research LLP',                       ctc: 300000,  currency: 'INR', applyStatus: 'Apply', resumeStart: '2026-07-13 21:34', resumeEnd: '2026-07-16 18:00', interviewDate: '', sortingDone: false, myStatus: 'not_applied', notes: '' },
];

// Migration-aware loader: if old v1 data exists, transfer statuses over
export function getInternData(): InternCompany[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as InternCompany[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    // migrate from v1 if present
    const v1raw = localStorage.getItem('iitkgp_intern_tracker_v1');
    if (v1raw) {
      const v1 = JSON.parse(v1raw) as InternCompany[];
      const merged = INTERN_COMPANIES_DEFAULT.map(d => {
        const old = v1.find(o => o.company === d.company);
        return old ? { ...d, myStatus: old.myStatus, sortingDone: old.sortingDone, notes: old.notes } : d;
      });
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
      return merged;
    }
  } catch { /* fallback */ }
  const defaults = [...INTERN_COMPANIES_DEFAULT];
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(defaults));
  return defaults;
}

export function saveInternData(data: InternCompany[]): void {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
}

export const STATUS_CONFIG: Record<InternStatus, {
  label: string; emoji: string;
  color: string; bg: string; border: string;
}> = {
  not_applied: { label: 'Not Applied', emoji: '○', color: '#64748b', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.22)' },
  applied:     { label: 'Applied',     emoji: '✓', color: '#818cf8', bg: 'rgba(99,102,241,0.12)',  border: 'rgba(99,102,241,0.35)'  },
  shortlisted: { label: 'Shortlisted', emoji: '🎯', color: '#38bdf8', bg: 'rgba(56,189,248,0.1)',  border: 'rgba(56,189,248,0.35)'  },
  interview:   { label: 'Interview',   emoji: '🔥', color: '#fb923c', bg: 'rgba(251,146,60,0.1)',  border: 'rgba(251,146,60,0.35)'  },
  offer:       { label: 'Offer! 🎉',   emoji: '🎉', color: '#4ade80', bg: 'rgba(74,222,128,0.1)',  border: 'rgba(74,222,128,0.35)'  },
  rejected:    { label: 'Rejected',    emoji: '✗',  color: '#f87171', bg: 'rgba(248,113,113,0.06)', border: 'rgba(248,113,113,0.2)' },
};

// Format CTC nicely
export function formatCTC(ctc: number, currency: string): string {
  if (currency === 'USD') return `$${(ctc / 1000).toFixed(1)}k/mo`;
  if (ctc >= 1000000) return `₹${(ctc / 100000).toFixed(1)}L/mo`;
  if (ctc >= 100000) return `₹${(ctc / 1000).toFixed(0)}k/mo`;
  return `₹${ctc.toLocaleString('en-IN')}/mo`;
}
