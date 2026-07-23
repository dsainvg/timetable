"""
fetch_all_roles.py
-------------------
Fetches ALL internship roles directly from the jqGrid XML API endpoint
(bypasses the 20-row virtual scroll limit of the saved HTML).

Steps:
  1. Hit ERPMonitoring.htm?action=fetchData&jqqueryid=37&rows=500
  2. Parse the XML response (jqGrid format) for all role entries
  3. For each role, fetch its JNF detail page and parse full details
  4. Save everything to data/all_roles_detailed.json

Usage:  python fetch_all_roles.py
"""

import json
import os
import re
import time
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET

# ─── CONFIG ───────────────────────────────────────────────────────────────────

BASE_DIR   = os.path.dirname(__file__)
CACHE_DIR  = os.path.join(BASE_DIR, "data", "_html_cache")
OUT_JSON   = os.path.join(BASE_DIR, "data", "all_roles_detailed.json")
COOKIES_FILE = os.path.join(BASE_DIR, "cookies.json")
os.makedirs(CACHE_DIR, exist_ok=True)
os.makedirs(os.path.join(BASE_DIR, "data"), exist_ok=True)

# jqGrid XML endpoint — fetches ALL rows
GRID_URL = (
    "https://erp.iitkgp.ac.in/TrainingPlacementSSO/ERPMonitoring.htm"
    "?action=fetchData&jqqueryid=37&_search=false&rows=500&page=1&sidx=companyname&sord=asc"
)

JNF_BASE = (
    "https://erp.iitkgp.ac.in/TrainingPlacementSSO/TPJNFView.jsp"
    "?jnf_id={jnf_id}&com_id={com_id}&yop=2026-2027&user_type=SU&rollno=24CS10097"
)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 Edg/150.0.0.0",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://erp.iitkgp.ac.in/TrainingPlacementSSO/TPStudent.jsp",
    "Connection": "keep-alive",
}

DELAY = 1.0   # seconds between JNF detail requests


# ─── COOKIES ──────────────────────────────────────────────────────────────────

def load_cookies() -> dict:
    if os.path.exists(COOKIES_FILE):
        with open(COOKIES_FILE, encoding="utf-8") as f:
            return json.load(f)
    raise FileNotFoundError(f"cookies.json not found at {COOKIES_FILE}")


def cookie_header(cookies: dict) -> str:
    return "; ".join(f"{k}={v}" for k, v in cookies.items())


# ─── HTTP ─────────────────────────────────────────────────────────────────────

def fetch(url: str, cookies: dict, binary: bool = False):
    req = urllib.request.Request(url, headers={**HEADERS, "Cookie": cookie_header(cookies)})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            raw = resp.read()
            if binary:
                return raw
            try:
                return raw.decode("utf-8")
            except UnicodeDecodeError:
                return raw.decode("iso-8859-1", errors="replace")
    except Exception as e:
        print(f"  [ERR] {url[:80]} -- {e}")
        return None


# ─── PARSE GRID XML ───────────────────────────────────────────────────────────

def parse_grid_xml(xml_text: str) -> list[dict]:
    """
    jqGrid returns XML like:
      <rows>
        <page>1</page><total>4</total><records>72</records>
        <row id="0">
          <cell>AlphaGrep...</cell>   <!-- companyname -->
          <cell>...</cell>             <!-- view2 -->
          ...
        </row>
      </rows>

    Column order matches colModel in intern.html JS:
      companyname, view2, view3, designation, description,
      ctc, Currency, view1, apply, resumedeadline_st,
      resumedeadline, interview_date_confirmed, contract, view
    """
    COLUMNS = [
        "companyname", "view2", "view3", "designation", "description",
        "ctc", "currency", "view1", "apply", "resumedeadline_st",
        "resumedeadline", "interview_date_confirmed", "contract", "view"
    ]

    # Strip any leading whitespace / encoding declaration issues
    xml_text = xml_text.strip()
    if not xml_text.startswith("<?") and not xml_text.startswith("<"):
        print("  [WARN] Unexpected XML response start")
        print("  Preview:", xml_text[:200])
        return []

    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as e:
        print(f"  [ERR] XML parse error: {e}")
        print("  Preview:", xml_text[:300])
        return []

    total_records = root.findtext("records", "?")
    print(f"  Grid reports {total_records} total records")

    roles = []
    for row_el in root.findall("row"):
        cells = [c.text or "" for c in row_el.findall("cell")]
        row = {}
        for i, col in enumerate(COLUMNS):
            row[col] = cells[i].strip() if i < len(cells) else ""

        # Extract com_id and jnf_id from the HTML snippets in view cells
        # 'view3' cell often contains onclick="TPJNFView('jnf_id','com_id','yop')"
        jnf_id = ""
        com_id = ""

        for cell_val in cells:
            m_jnf = re.search(r"TPJNFView\(['\"](\d+)['\"],\s*['\"](\d+)['\"]", cell_val)
            if m_jnf:
                jnf_id = m_jnf.group(1)
                com_id = m_jnf.group(2)
                break
            m_com = re.search(r"TPComView\(['\"][^'\"]+['\"],\s*['\"](\d+)['\"]", cell_val)
            if m_com and not com_id:
                com_id = m_com.group(1)

        # Strip HTML from company name cell
        company = re.sub(r"<[^>]+>", "", row["companyname"]).strip()
        if not company:
            # Sometimes the company name is in an anchor title attr
            m = re.search(r'title="([^"]+)"', row["companyname"])
            company = m.group(1) if m else row["companyname"]

        if not company:
            continue

        entry = {
            "company_name": company,
            "com_id": com_id,
            "jnf_id": jnf_id,
            "apply_acceptance": re.sub(r"<[^>]+>", "", row["description"]).strip(),
            "ctc": row["ctc"],
            "currency": row["currency"],
            "application_status": row["apply"],
            "resume_upload_start": row["resumedeadline_st"],
            "resume_upload_end": row["resumedeadline"],
            "interview_selection_date": row["interview_date_confirmed"],
        }

        if jnf_id and com_id:
            entry["jnf_url"] = JNF_BASE.format(jnf_id=jnf_id, com_id=com_id)
        else:
            entry["jnf_url"] = ""

        roles.append(entry)

    return roles


# ─── PARSE JNF DETAIL PAGE ────────────────────────────────────────────────────

def strip_tags(html: str) -> str:
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"&#\d+;", "", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"&lt;", "<", text)
    text = re.sub(r"&gt;", ">", text)
    text = re.sub(r"&quot;", '"', text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def parse_jnf_html(html: str) -> dict:
    details = {}

    # Company display name
    m = re.search(r'Company\s*:\s*([^<\r\n]+)', html)
    if m:
        details["company_display_name"] = m.group(1).strip()

    # Job Profile: Form Type / Stipend / Additional / CGPA
    profile_m = re.search(
        r'<th>Form Type</th>.*?<th>Stipend per month</th>.*?<th>Additional Criteria</th>.*?<th>CGPA Cut-off</th>.*?'
        r'<td>(.*?)</td>.*?<td>(.*?)</td>.*?<td>(.*?)</td>.*?<td>(.*?)</td>',
        html, re.IGNORECASE | re.DOTALL
    )
    if profile_m:
        details["form_type"]           = strip_tags(profile_m.group(1))
        details["stipend_per_month"]   = strip_tags(profile_m.group(2))
        details["additional_criteria"] = strip_tags(profile_m.group(3))
        details["cgpa_cutoff"]         = strip_tags(profile_m.group(4))

    # Job Description
    jd_m = re.search(
        r'class="header"[^>]*>Job Description</td>\s*</tr>\s*<tr[^>]*>\s*<td[^>]*>(.*?)</td>\s*</tr>',
        html, re.IGNORECASE | re.DOTALL
    )
    if jd_m:
        details["job_description"] = strip_tags(jd_m.group(1))

    # Allowed Departments + Degrees
    dept_section_m = re.search(
        r'Allowed Departments and degrees(.*?)(?:class="header"|$)',
        html, re.DOTALL | re.IGNORECASE
    )
    if dept_section_m:
        dept_html = dept_section_m.group(1)
        departments = re.findall(
            r'background-color:\s*lightgrey[^>]*>(.*?)</td>',
            dept_html, re.IGNORECASE | re.DOTALL
        )
        dept_list = [strip_tags(d) for d in departments if strip_tags(d)]
        details["allowed_departments"] = dept_list

        all_cells = re.findall(r'<td[^>]*>(.*?)</td>', dept_html, re.DOTALL)
        degrees = []
        for cell in all_cells:
            t = strip_tags(cell)
            if t and t not in dept_list and len(t) > 5 and "header" not in cell:
                degrees.append(t)
        details["allowed_degrees"] = degrees

    # Selection process
    sel_m = re.search(
        r'class="header"[^>]*>(?:Selection Process|Test Details)[^<]*</td>\s*</tr>\s*<tr[^>]*>\s*<td[^>]*>(.*?)</td>',
        html, re.IGNORECASE | re.DOTALL
    )
    if sel_m:
        details["selection_process"] = strip_tags(sel_m.group(1))

    # Skills
    skills_m = re.search(
        r'class="header"[^>]*>(?:Skills Required|Skills)[^<]*</td>\s*</tr>\s*<tr[^>]*>\s*<td[^>]*>(.*?)</td>',
        html, re.IGNORECASE | re.DOTALL
    )
    if skills_m:
        details["skills_required"] = strip_tags(skills_m.group(1))

    # Duration / Location / Positions
    dur_m = re.search(r'Duration[^<]*</t[dh][^>]*>\s*<td[^>]*>(.*?)</td>', html, re.IGNORECASE | re.DOTALL)
    if dur_m:
        details["duration"] = strip_tags(dur_m.group(1))

    loc_m = re.search(r'(?:Location|Venue|Place of Posting)[^<]*</t[dh][^>]*>\s*<td[^>]*>(.*?)</td>', html, re.IGNORECASE | re.DOTALL)
    if loc_m:
        details["location"] = strip_tags(loc_m.group(1))

    pos_m = re.search(r'(?:No\.? of (?:Positions|Vacancies)|Number of Positions)[^<]*</t[dh][^>]*>\s*<td[^>]*>(.*?)</td>', html, re.IGNORECASE | re.DOTALL)
    if pos_m:
        details["positions"] = strip_tags(pos_m.group(1))

    join_m = re.search(r'(?:Tentative Join|Start Date|Internship Start)[^<]*</t[dh][^>]*>\s*<td[^>]*>(.*?)</td>', html, re.IGNORECASE | re.DOTALL)
    if join_m:
        details["tentative_start_date"] = strip_tags(join_m.group(1))

    return {k: v for k, v in details.items() if v and v not in ("&nbsp;", " ", "")}


# ─── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    cookies = load_cookies()
    safe = lambda s: s.encode("ascii", errors="replace").decode("ascii")

    # ── Step 1: Fetch grid XML for all roles ──────────────────────────────────
    print(f"\n[Step 1] Fetching all roles from grid API...")
    xml_text = fetch(GRID_URL, cookies)

    if not xml_text:
        print("  [ERR] Failed to fetch grid XML. Check cookies.")
        return

    # Save raw XML for debugging
    with open(os.path.join(BASE_DIR, "data", "_grid_response.xml"), "w", encoding="utf-8") as f:
        f.write(xml_text)

    # Check for session expiry
    if "<html" in xml_text.lower() and "login" in xml_text.lower():
        print("  [ERR] Session expired. Update cookies.json and re-run.")
        return

    roles = parse_grid_xml(xml_text)
    print(f"  Parsed {len(roles)} roles from grid\n")

    if not roles:
        print("  [ERR] No roles parsed. Check data/_grid_response.xml for response content.")
        return

    # ── Step 2: Fetch JNF detail for each role ────────────────────────────────
    print(f"[Step 2] Fetching JNF detail pages for {len(roles)} roles...")
    enriched = []
    for i, role in enumerate(roles):
        url    = role.get("jnf_url", "")
        jnf_id = role.get("jnf_id", "")
        com_id = role.get("com_id", "")
        company = role.get("company_name", "?")

        print(f"  [{i+1:02d}/{len(roles)}] {safe(company[:40])} (jnf={jnf_id}, com={com_id})", end=" ")

        if not url or not jnf_id:
            print("-- no URL, skipping detail")
            enriched.append(role)
            continue

        cache_file = os.path.join(CACHE_DIR, f"jnf_{jnf_id}_com_{com_id}.html")

        if os.path.exists(cache_file):
            with open(cache_file, encoding="utf-8", errors="replace") as f:
                html = f.read()
            print("[cache]")
        else:
            html = fetch(url, cookies)
            if html:
                with open(cache_file, "w", encoding="utf-8") as f:
                    f.write(html)
                print(f"[fetched {len(html)} chars]")
                time.sleep(DELAY)
            else:
                print("[fetch failed]")
                enriched.append(role)
                continue

        if "<html" in html.lower() and "login" in html.lower() and len(html) < 3000:
            print("\n  [ERR] Session expired mid-run. Update cookies.json.")
            break

        details = parse_jnf_html(html)
        merged = dict(role)
        merged["jnf_details"] = details
        enriched.append(merged)

    # ── Step 3: Save ──────────────────────────────────────────────────────────
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(enriched, f, indent=2, ensure_ascii=False)

    print(f"\n[saved] {OUT_JSON}")
    print(f"[done]  {len(enriched)} roles total\n")

    # Summary
    companies = {}
    for r in enriched:
        c = r["company_name"]
        companies[c] = companies.get(c, 0) + 1
    print(f"  {len(companies)} companies, {len(enriched)} roles:")
    for c, n in sorted(companies.items(), key=lambda x: x[0]):
        print(f"    - {safe(c[:50]):<50} {n} role{'s' if n>1 else ''}")


if __name__ == "__main__":
    main()
