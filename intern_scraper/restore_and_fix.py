import json
import os
import re

BASE_DIR = os.path.dirname(__file__)
TEMP_ORIG = os.path.join(BASE_DIR, "temp_orig.ts")
DETAILED_JSON = os.path.join(BASE_DIR, "data", "all_roles_detailed.json")
TARGET_TS = os.path.abspath(os.path.join(BASE_DIR, "..", "src", "data", "internData.ts"))

def parse_ctc(ctc_val):
    if not ctc_val:
        return 0
    try:
        cleaned = re.sub(r'[^\d.]', '', str(ctc_val))
        return int(float(cleaned)) if cleaned else 0
    except Exception:
        return 0

def fix():
    # 1. Parse original 74 roles from git history
    if not os.path.exists(TEMP_ORIG):
        print("temp_orig.ts not found")
        return

    try:
        with open(TEMP_ORIG, encoding="utf-16") as f:
            content = f.read()
    except Exception:
        with open(TEMP_ORIG, encoding="utf-8", errors="ignore") as f:
            content = f.read()

    m = re.search(r'export const INTERN_COMPANIES_DEFAULT: InternCompany\[\] = (\[\s*\{.*?\}\s*\]);', content, re.DOTALL)
    if not m:
        # Fallback split
        part = content.split('export const INTERN_COMPANIES_DEFAULT: InternCompany[] = ')[1]
        array_str = part.split(';\n\nexport function getInternData()')[0]
        orig_roles = json.loads(array_str)
    else:
        orig_roles = json.loads(m.group(1))
    print(f"Loaded {len(orig_roles)} original roles from git history.")

    # 2. Read newly scraped all_roles_detailed.json
    with open(DETAILED_JSON, encoding="utf-8") as f:
        scraped_roles = json.load(f)

    # Build lookup map for scraped details by (com_id, jnf_id) or company_name
    scraped_map = {}
    databricks_role = None
    for r in scraped_roles:
        c_name = r.get("company_name", "")
        if c_name == "Databricks":
            databricks_role = r
            continue
        key = (r.get("com_id"), r.get("jnf_id"))
        scraped_map[key] = r

    # 3. Restore exact original roles (i1 to i74) with fresh scraped details
    restored_list = []
    for orig in orig_roles:
        old_id = orig["id"]
        com_id = orig.get("comId")
        jnf_id = orig.get("jnfId")
        key = (com_id, jnf_id)

        scraped = scraped_map.get(key)
        if scraped:
            jnf_details = scraped.get("jnf_details", {})
            pos_note = jnf_details.get("form_type") or scraped.get("apply_acceptance") or orig.get("positionNote", "")
            
            entry = {
                "id": old_id, # KEEP EXACT ORIGINAL ID!
                "company": scraped.get("company_name") or orig["company"],
                "ctc": parse_ctc(scraped.get("ctc")) or orig.get("ctc", 0),
                "currency": scraped.get("currency") or orig.get("currency", "INR"),
                "applyStatus": scraped.get("application_status") or orig.get("applyStatus", "Apply"),
                "resumeStart": scraped.get("resume_upload_start") or orig.get("resumeStart", ""),
                "resumeEnd": scraped.get("resume_upload_end") or orig.get("resumeEnd", ""),
                "interviewDate": orig.get("interviewDate", ""),
                "positionNote": pos_note,
                "sortingDone": orig.get("sortingDone", False),
                "myStatus": orig.get("myStatus", "not_applied"),
                "notes": orig.get("notes", ""),
                "jnfUrl": scraped.get("jnf_url") or orig.get("jnfUrl", ""),
                "jnfId": jnf_id,
                "comId": com_id,
                "cgpaCutoff": jnf_details.get("cgpa_cutoff") or orig.get("cgpaCutoff", ""),
                "stipend": jnf_details.get("stipend_per_month") or orig.get("stipend", ""),
                "allowedDepts": jnf_details.get("allowed_departments") or orig.get("allowedDepts", []),
                "allowedDegrees": jnf_details.get("allowed_degrees") or orig.get("allowedDegrees", []),
                "jobDescription": jnf_details.get("job_description") or orig.get("jobDescription", ""),
                "selectionProcess": jnf_details.get("selection_process") or orig.get("selectionProcess", ""),
                "skillsRequired": jnf_details.get("skills_required") or orig.get("skillsRequired", ""),
                "duration": jnf_details.get("duration") or orig.get("duration", ""),
                "location": jnf_details.get("location") or orig.get("location", ""),
                "positions": jnf_details.get("positions") or orig.get("positions", ""),
                "tentativeStart": jnf_details.get("tentative_start_date") or orig.get("tentativeStart", ""),
                "applicationStatus": scraped.get("application_status") or orig.get("applicationStatus", "")
            }
        else:
            entry = orig

        restored_list.append(entry)

    # 4. Append Databricks at the end with a new ID (i75)
    if databricks_role:
        db_details = databricks_role.get("jnf_details", {})
        db_entry = {
            "id": "i75", # NEW STABLE ID FOR DATABRICKS
            "company": "Databricks",
            "ctc": 300000,
            "currency": "INR",
            "applyStatus": "Y",
            "resumeStart": "2026-07-20 10:00",
            "resumeEnd": "2026-07-24 23:59",
            "interviewDate": "",
            "positionNote": "INTERNSHIP",
            "sortingDone": False,
            "myStatus": "applied",
            "notes": "",
            "jnfUrl": "https://erp.iitkgp.ac.in/TrainingPlacementSSO/TPJNFView.jsp?jnf_id=1&com_id=999&yop=2026-2027&user_type=SU&rollno=24CS10097",
            "jnfId": "1",
            "comId": "999",
            "cgpaCutoff": db_details.get("cgpa_cutoff", "7.0"),
            "stipend": db_details.get("stipend_per_month", "300000 INR"),
            "allowedDepts": db_details.get("allowed_departments", []),
            "allowedDegrees": db_details.get("allowed_degrees", []),
            "jobDescription": db_details.get("job_description", ""),
            "selectionProcess": "",
            "skillsRequired": "",
            "duration": "",
            "location": "",
            "positions": "",
            "tentativeStart": "",
            "applicationStatus": "Y"
        }
        restored_list.append(db_entry)

    print(f"Restored total of {len(restored_list)} roles with exact stable IDs.")

    # 5. Write restored data back into internData.ts
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

const LOCAL_STORAGE_KEY = 'iitkgp_intern_tracker_v4';

export const INTERN_COMPANIES_DEFAULT: InternCompany[] = {json.dumps(restored_list, indent=2, ensure_ascii=False)};

export function getInternData(): InternCompany[] {{
  try {{
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {{
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {{
        // Merge saved statuses with fresh dataset
        const savedMap = new Map(parsed.map((item: InternCompany) => [item.id, item]));
        return INTERN_COMPANIES_DEFAULT.map(item => {{
          const userItem = savedMap.get(item.id);
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

    # Clean up temp file
    if os.path.exists(TEMP_ORIG):
        os.remove(TEMP_ORIG)

    print(f"Successfully restored {TARGET_TS}!")

if __name__ == "__main__":
    fix()
