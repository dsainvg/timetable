import json
import os
import re

BASE_DIR = os.path.dirname(__file__)
DETAILED_JSON = os.path.join(BASE_DIR, "data", "all_roles_detailed.json")
TARGET_TS = os.path.abspath(os.path.join(BASE_DIR, "..", "src", "data", "internData.ts"))

def parse_ctc(ctc_val):
    if not ctc_val:
        return 0
    val_str = str(ctc_val).strip()
    if not val_str:
        return 0
    if re.match(r'^\d+(\.\d+)?$', val_str):
        try:
            return int(float(val_str))
        except Exception:
            return 0
    m_total = re.search(r'TOTAL\s*[-:=]?\s*(\d[\d,\.]*)', val_str, re.IGNORECASE)
    if m_total:
        cleaned = re.sub(r'[^\d.]', '', m_total.group(1))
        if cleaned:
            try:
                return int(float(cleaned))
            except Exception:
                pass
    m_lakh = re.search(r'(\d+(?:\.\d+)?)\s*(?:lakhs?|lakh|l)\b', val_str, re.IGNORECASE)
    if m_lakh:
        try:
            return int(float(m_lakh.group(1)) * 100000)
        except Exception:
            pass
    numbers = re.findall(r'\b\d(?:[\d,]*\d)?(?:\.\d+)?\b', val_str)
    parsed_nums = []
    for n in numbers:
        c = re.sub(r'[^\d.]', '', n)
        if c:
            try:
                parsed_nums.append(int(float(c)))
            except Exception:
                pass
    if parsed_nums:
        return max(parsed_nums)
    cleaned = re.sub(r'[^\d.]', '', val_str)
    if cleaned:
        try:
            return int(float(cleaned))
        except Exception:
            pass
    return 0

def slugify(text: str) -> str:
    if not text:
        return ""
    text = text.lower()
    text = re.sub(r'[^a-z0-9]+', '_', text)
    return text.strip('_')

def convert():
    if not os.path.exists(DETAILED_JSON):
        print(f"File not found: {DETAILED_JSON}")
        return

    with open(DETAILED_JSON, encoding="utf-8") as f:
        roles = json.load(f)

    # Read existing internData.ts to preserve user modified myStatus/notes/interviewDate and stable IDs
    existing_map = {}
    key_to_id_map = {}
    if os.path.exists(TARGET_TS):
        with open(TARGET_TS, encoding="utf-8") as f:
            ts_content = f.read()
            m = re.search(r'export const INTERN_COMPANIES_DEFAULT: InternCompany\[\] = (\[.*\]);', ts_content, re.DOTALL)
            if not m:
                part = ts_content.split('export const INTERN_COMPANIES_DEFAULT: InternCompany[] = ')[1]
                array_str = part.split(';\n\nexport function getInternData()')[0]
                existing_items = json.loads(array_str)
            else:
                existing_items = json.loads(m.group(1))

            for item in existing_items:
                role_id = item['id']
                existing_map[role_id] = item
                c_name = item.get('company', '')
                j_id = str(item.get('jnfId') or '')
                c_id = str(item.get('comId') or '')
                pos = item.get('positionNote') or ''

                if c_id and j_id:
                    key_to_id_map[("com_jnf_id", c_id, j_id)] = role_id
                if c_name and j_id:
                    key_to_id_map[("name_jnf", slugify(c_name), j_id)] = role_id

    formatted_roles = []
    for idx, r in enumerate(roles, 1):
        company_name = r.get("company_name", "Unknown")
        com_id = str(r.get("com_id") or "")
        jnf_id = str(r.get("jnf_id") or "")
        jnf_details = r.get("jnf_details", {})
        pos_note = jnf_details.get("form_type") or r.get("apply_acceptance") or ""

        # Multi-key deterministic ID resolution (Com ID + JNF ID takes precedence)
        role_id = None
        if com_id and jnf_id and ("com_jnf_id", com_id, jnf_id) in key_to_id_map:
            role_id = key_to_id_map[("com_jnf_id", com_id, jnf_id)]
        elif company_name and jnf_id and ("name_jnf", slugify(company_name), jnf_id) in key_to_id_map:
            role_id = key_to_id_map[("name_jnf", slugify(company_name), jnf_id)]

        if not role_id:
            role_id = f"i{idx}"

        existing = existing_map.get(role_id, {})
        existing_status = existing.get("myStatus")
        if r.get("application_status") == "Y":
            if not existing_status or existing_status == "not_applied":
                my_status = "applied"
            else:
                my_status = existing_status
        else:
            my_status = existing_status if existing_status else "not_applied"

        entry = {
            "id": role_id,
            "company": r.get("company_name", "Unknown"),
            "ctc": parse_ctc(r.get("ctc")),
            "currency": r.get("currency") or "INR",
            "applyStatus": r.get("application_status") or "Apply",
            "resumeStart": r.get("resume_upload_start") or "",
            "resumeEnd": r.get("resume_upload_end") or "",
            "interviewDate": existing.get("interviewDate") or r.get("interview_selection_date") or "",
            "positionNote": pos_note,
            "sortingDone": existing.get("sortingDone", False),
            "myStatus": my_status,
            "notes": existing.get("notes", ""),
            "jnfUrl": r.get("jnf_url", ""),
            "jnfId": jnf_id,
            "comId": com_id,
            "cgpaCutoff": jnf_details.get("cgpa_cutoff") or "",
            "stipend": jnf_details.get("stipend_per_month") or "",
            "allowedDepts": jnf_details.get("allowed_departments") or [],
            "allowedDegrees": jnf_details.get("allowed_degrees") or [],
            "jobDescription": jnf_details.get("job_description") or "",
            "selectionProcess": jnf_details.get("selection_process") or "",
            "skillsRequired": jnf_details.get("skills_required") or "",
            "duration": jnf_details.get("duration") or "",
            "location": jnf_details.get("location") or "",
            "positions": jnf_details.get("positions") or "",
            "tentativeStart": jnf_details.get("tentative_start_date") or "",
            "applicationStatus": r.get("application_status") or ""
        }
        formatted_roles.append(entry)

    ts_template = f"""export type InternStatus = 'not_applied' | 'applied' | 'oa_bad' | 'oa_good' | 'shortlisted' | 'interview_good' | 'offered' | 'rejected';

export interface InternCompany {{
  id: string;
  company: string;
  ctc: number;
  currency: string;
  applyStatus: string;
  resumeStart: string;
  resumeEnd: string;
  interviewDate: string;
  positionNote?: string;
  sortingDone: boolean;
  myStatus: InternStatus;
  notes: string;
  jnfUrl?: string;
  jnfId?: string;
  comId?: string;
  cgpaCutoff?: string;
  stipend?: string;
  allowedDepts?: string[];
  allowedDegrees?: string[];
  jobDescription?: string;
  selectionProcess?: string;
  skillsRequired?: string;
  duration?: string;
  location?: string;
  positions?: string;
  tentativeStart?: string;
  applicationStatus?: string;
}}

const LOCAL_STORAGE_KEY = 'iitkgp_intern_tracker_v5';

export const INTERN_COMPANIES_DEFAULT: InternCompany[] = {json.dumps(formatted_roles, indent=2, ensure_ascii=False)};

export function getInternData(): InternCompany[] {{
  try {{
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {{
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {{
        // Merge saved user overrides (myStatus, notes, sortingDone, interviewDate) into fresh scraped list by ID or comId+jnfId
        const savedMap = new Map(parsed.map((item: InternCompany) => [item.id, item]));
        const savedComJnfMap = new Map(parsed.filter((item: InternCompany) => item.comId && item.jnfId).map((item: InternCompany) => [`${{item.comId}}_${{item.jnfId}}`, item]));

        return INTERN_COMPANIES_DEFAULT.map(item => {{
          const userItem = savedMap.get(item.id) || (item.comId && item.jnfId ? savedComJnfMap.get(`${{item.comId}}_${{item.jnfId}}`) : undefined);
          if (userItem) {{
            return {{
              ...item,
              myStatus: userItem.myStatus,
              notes: userItem.notes,
              sortingDone: userItem.sortingDone,
              interviewDate: userItem.interviewDate || item.interviewDate,
            }};
          }}
          return item;
        }});
      }}
    }}
  }} catch (e) {{
    console.error('Failed to load intern tracker data:', e);
  }}
  return INTERN_COMPANIES_DEFAULT;
}}

export function saveInternData(data: InternCompany[]): void {{
  try {{
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  }} catch (e) {{
    console.error('Failed to save intern tracker data:', e);
  }}
}}

export function formatCTC(ctc: number, currency: string): string {{
  if (!ctc) return 'N/A';
  if (currency === 'USD') return `${{ctc.toLocaleString('en-US')}} USD`;
  if (ctc >= 100000) {{
    const lakhs = ctc / 100000;
    return `₹${{lakhs % 1 === 0 ? lakhs.toFixed(0) : lakhs.toFixed(2)}} Lakhs`;
  }}
  return `₹${{ctc.toLocaleString('en-IN')}}`;
}}

export const STATUS_CONFIG: Record<InternStatus, {{ label: string; emoji: string; color: string; bg: string; border: string }}> = {{
  offered:        {{ label: 'Offer Received 🎉', emoji: '🏆', color: '#4ade80', bg: 'rgba(74,222,128,0.15)', border: 'rgba(74,222,128,0.4)' }},
  interview_good: {{ label: 'Interviewed / Done', emoji: '🎙️', color: '#fb923c', bg: 'rgba(251,146,60,0.15)', border: 'rgba(251,146,60,0.4)' }},
  shortlisted:    {{ label: 'Shortlisted',       emoji: '⭐', color: '#38bdf8', bg: 'rgba(56,189,248,0.15)', border: 'rgba(56,189,248,0.4)' }},
  oa_good:        {{ label: 'OA Solved (Good)',   emoji: '🟢', color: '#10b981', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.4)' }},
  oa_bad:         {{ label: 'OA Bad / Fumbled',   emoji: '🔴', color: '#ef4444', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)' }},
  applied:        {{ label: 'Applied (No OA yet)',emoji: '📩', color: '#818cf8', bg: 'rgba(129,140,248,0.15)', border: 'rgba(129,140,248,0.4)' }},
  not_applied:    {{ label: 'Not Applied',        emoji: '⏳', color: '#64748b', bg: 'rgba(100,116,139,0.15)', border: 'rgba(100,116,139,0.4)' }},
  rejected:       {{ label: 'Rejected',           emoji: '❌', color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)' }},
}};
"""

    with open(TARGET_TS, "w", encoding="utf-8") as f:
        f.write(ts_template)

    print(f"Successfully generated {TARGET_TS} with {len(formatted_roles)} roles!")

if __name__ == "__main__":
    convert()
