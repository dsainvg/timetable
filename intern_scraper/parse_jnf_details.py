"""
parse_jnf_details.py
---------------------
Post-processes cached HTML from fetch_jnf_details.py
to extract rich structured data from each JNF detail page.

Runs entirely offline using the _html_cache/ folder.

Usage:  python parse_jnf_details.py
Output: data/all_roles_detailed.json   (overwrites with enriched data)
"""

import json
import os
import re
import sys

BASE_DIR   = os.path.dirname(__file__)
FLAT_JSON  = os.path.join(BASE_DIR, "data", "all_roles_flat.json")
CACHE_DIR  = os.path.join(BASE_DIR, "data", "_html_cache")
OUT_JSON   = os.path.join(BASE_DIR, "data", "all_roles_detailed.json")


# ─── HTML HELPERS ─────────────────────────────────────────────────────────────

def strip_tags(html: str) -> str:
    """Remove HTML tags and collapse whitespace."""
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"&#\d+;", "", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"&lt;", "<", text)
    text = re.sub(r"&gt;", ">", text)
    text = re.sub(r"&quot;", '"', text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def get_section(html: str, header: str) -> str:
    """
    Extract content of a section that starts with a header td
    e.g. <td ...>Job Description</td> then the next <tr><td>CONTENT</td>
    """
    # Find the header row
    pattern = re.compile(
        rf'<td[^>]*>{re.escape(header)}</td>\s*</tr>\s*<tr[^>]*>\s*<td[^>]*>(.*?)</td>\s*</tr>',
        re.IGNORECASE | re.DOTALL
    )
    m = pattern.search(html)
    if m:
        return strip_tags(m.group(1))

    # Fallback: more lenient — allow attributes like colspan
    pattern2 = re.compile(
        rf'class="header"[^>]*>{re.escape(header)}</td>.*?</tr>.*?<tr[^>]*>\s*<td[^>]*>(.*?)</td>',
        re.IGNORECASE | re.DOTALL
    )
    m2 = pattern2.search(html)
    if m2:
        return strip_tags(m2.group(1))

    return ""


def get_section_between_headers(html: str, start_header: str, end_header: str) -> str:
    """Get all text between two header labels."""
    start = html.find(start_header)
    if start == -1:
        return ""
    end = html.find(end_header, start + len(start_header))
    chunk = html[start:end] if end != -1 else html[start:start + 8000]
    return strip_tags(chunk)


# ─── MAIN PARSER ──────────────────────────────────────────────────────────────

def parse_jnf_html(html: str, company: str, jnf_id: str) -> dict:
    details = {}

    # ── Company name ──────────────────────────────────────────────────────────
    m = re.search(r'Company\s*:\s*([^<\r\n]+)', html)
    if m:
        details["company_display_name"] = m.group(1).strip()

    # ── Job Profile table (Form Type / Stipend / CGPA) ────────────────────────
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

    # ── Job Description ───────────────────────────────────────────────────────
    jd_m = re.search(
        r'class="header"[^>]*>Job Description</td>\s*</tr>\s*<tr[^>]*>\s*<td[^>]*>(.*?)</td>\s*</tr>',
        html, re.IGNORECASE | re.DOTALL
    )
    if jd_m:
        details["job_description"] = strip_tags(jd_m.group(1))

    # ── Allowed Departments ───────────────────────────────────────────────────
    # All <td> with background-color: lightgrey = department, next td = degree
    dept_section_m = re.search(r'Allowed Departments and degrees(.*?)(?:class="header"|$)', html, re.DOTALL | re.IGNORECASE)
    if dept_section_m:
        dept_html = dept_section_m.group(1)
        departments = re.findall(
            r'background-color:\s*lightgrey[^>]*>(.*?)</td>',
            dept_html, re.IGNORECASE | re.DOTALL
        )
        dept_list = [strip_tags(d) for d in departments if strip_tags(d)]
        details["allowed_departments"] = dept_list

        # Grab all td text items in dept section, exclude dept headers
        all_cells = re.findall(r'<td[^>]*>(.*?)</td>', dept_html, re.DOTALL)
        degrees = []
        for cell in all_cells:
            t = strip_tags(cell)
            if t and t not in dept_list and len(t) > 5 and "header" not in cell:
                degrees.append(t)
        details["allowed_degrees"] = degrees

    # ── Application details (resume upload window, interview date) ────────────
    res_start = re.search(r'Resume Upload Start.*?<td[^>]*>(.*?)</td>', html, re.IGNORECASE | re.DOTALL)
    if res_start:
        details["resume_upload_start_detail"] = strip_tags(res_start.group(1))

    res_end = re.search(r'Resume Upload End.*?<td[^>]*>(.*?)</td>', html, re.IGNORECASE | re.DOTALL)
    if res_end:
        details["resume_upload_end_detail"] = strip_tags(res_end.group(1))

    # ── Selection process / test details ─────────────────────────────────────
    sel_m = re.search(
        r'class="header"[^>]*>(?:Selection Process|Test Details)[^<]*</td>\s*</tr>\s*<tr[^>]*>\s*<td[^>]*>(.*?)</td>',
        html, re.IGNORECASE | re.DOTALL
    )
    if sel_m:
        details["selection_process"] = strip_tags(sel_m.group(1))

    # ── Skills Required ───────────────────────────────────────────────────────
    skills_m = re.search(
        r'class="header"[^>]*>(?:Skills Required|Skills)[^<]*</td>\s*</tr>\s*<tr[^>]*>\s*<td[^>]*>(.*?)</td>',
        html, re.IGNORECASE | re.DOTALL
    )
    if skills_m:
        details["skills_required"] = strip_tags(skills_m.group(1))

    # ── Duration ─────────────────────────────────────────────────────────────
    dur_m = re.search(r'Duration[^<]*</t[dh][^>]*>\s*<td[^>]*>(.*?)</td>', html, re.IGNORECASE | re.DOTALL)
    if dur_m:
        details["duration"] = strip_tags(dur_m.group(1))

    # ── Location / Venue ──────────────────────────────────────────────────────
    loc_m = re.search(r'(?:Location|Venue|Place of Posting)[^<]*</t[dh][^>]*>\s*<td[^>]*>(.*?)</td>', html, re.IGNORECASE | re.DOTALL)
    if loc_m:
        details["location"] = strip_tags(loc_m.group(1))

    # ── Number of positions ───────────────────────────────────────────────────
    pos_m = re.search(r'(?:No\.? of (?:Positions|Vacancies)|Number of Positions)[^<]*</t[dh][^>]*>\s*<td[^>]*>(.*?)</td>', html, re.IGNORECASE | re.DOTALL)
    if pos_m:
        details["positions"] = strip_tags(pos_m.group(1))

    # ── Tentative joining / start date ───────────────────────────────────────
    join_m = re.search(r'(?:Tentative Join|Start Date|Internship Start)[^<]*</t[dh][^>]*>\s*<td[^>]*>(.*?)</td>', html, re.IGNORECASE | re.DOTALL)
    if join_m:
        details["tentative_start_date"] = strip_tags(join_m.group(1))

    # ── Clean up empty fields ─────────────────────────────────────────────────
    return {k: v for k, v in details.items() if v and v != "&nbsp;" and v != " "}


# ─── ENTRY POINT ──────────────────────────────────────────────────────────────

def main():
    with open(FLAT_JSON, encoding="utf-8") as f:
        roles = json.load(f)

    print(f"\n[parse_jnf_details] Processing {len(roles)} cached HTML files...\n")

    enriched = []
    for i, role in enumerate(roles):
        jnf_id = role.get("jnf_id", "")
        com_id = role.get("com_id", "")
        company = role.get("company_name", "?")

        cache_file = os.path.join(CACHE_DIR, f"jnf_{jnf_id}_com_{com_id}.html")

        if not os.path.exists(cache_file):
            print(f"  [{i+1:02d}] {company} -- no cache, skipping")
            enriched.append(role)
            continue

        with open(cache_file, encoding="utf-8", errors="replace") as f:
            html = f.read()

        details = parse_jnf_html(html, company, jnf_id)

        merged = dict(role)
        merged["jnf_details"] = details
        enriched.append(merged)

        # Print summary — encode safely for Windows console
        def safe(s): return s.encode('ascii', errors='replace').decode('ascii')
        jd_preview = details.get("job_description", "")[:80].replace("\n", " ")
        cgpa = details.get("cgpa_cutoff", "?")
        stipend = details.get("stipend_per_month", "?")
        depts = len(details.get("allowed_departments", []))
        print(f"  [{i+1:02d}] {safe(company)} (jnf={jnf_id})")
        print(f"       Stipend: {safe(stipend)}  CGPA: {safe(cgpa)}  Depts: {depts}")
        print(f"       JD: {safe(jd_preview)}...")
        print()

    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(enriched, f, indent=2, ensure_ascii=False)

    print(f"[saved] {OUT_JSON}")
    print(f"[done]  {len(enriched)} roles with full details\n")


if __name__ == "__main__":
    main()
