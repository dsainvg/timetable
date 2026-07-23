"""
parse_interns.py
----------------
Parses the locally saved intern.html (jqGrid rendered table) from ERP IIT Kharagpur
Internship portal and extracts every role / company row into structured JSON.

No external dependencies — uses Python stdlib only.

Usage:
    python parse_interns.py
    (or: python parse_interns.py --input ../intern.html --output data/interns.json)

Output: data/interns.json
"""

import argparse
import json
import os
import re
from html.parser import HTMLParser

# ─── HTML PARSER ──────────────────────────────────────────────────────────────

class JqGridParser(HTMLParser):
    """
    Parses the jqGrid rendered tbody of the ERP internship listing table.
    Targets <tr role="row"> rows (actual data rows, not header rows).
    Extracts cell 'title' attributes which hold the clean text values.
    Also extracts aria-describedby to identify column names.
    """

    COLUMN_MAP = {
        "grid37_rn": "row_number",
        "grid37_companyname": "company_name",
        "grid37_view2": "additional_details_company",
        "grid37_view3": "ppt",
        "grid37_designation": "designation_hidden",
        "grid37_description": "apply_acceptance",
        "grid37_ctc": "ctc",
        "grid37_Currency": "currency",
        "grid37_view1": "additional_details_jnf",
        "grid37_apply": "application_status",
        "grid37_resumedeadline_st": "resume_upload_start",
        "grid37_resumedeadline": "resume_upload_end",
        "grid37_interview_date_confirmed": "interview_selection_date",
        "grid37_contract": "contract",
        "grid37_view": "view_link",
    }

    # jnf_id extracted from onclick="TPJNFView(&quot;X&quot;,...)"
    JNF_ID_RE = re.compile(r'TPJNFView\(["\'](\d+)["\']')
    # com_id extracted from onclick="TPComView(..., &quot;X&quot;)"
    COM_ID_RE = re.compile(r'TPComView\(["\'][^"\']+["\'],\s*["\'](\d+)["\']')

    def __init__(self):
        super().__init__()
        self.rows = []           # final collected rows
        self._in_data_row = False
        self._current_row = {}
        self._current_col_key = None
        self._in_td = False
        self._in_a = False
        self._depth = 0          # track nesting for td
        self._current_href_onclick = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)

        if tag == "tr":
            role = attrs.get("role", "")
            if role == "row" and attrs.get("id", "").lstrip("-").isdigit():
                # Data row — actual entry rows have numeric IDs
                self._in_data_row = True
                self._current_row = {}
                self._depth = 0
            return

        if not self._in_data_row:
            return

        if tag == "td":
            col_key = self.COLUMN_MAP.get(attrs.get("aria-describedby", ""), None)
            self._current_col_key = col_key
            self._in_td = True
            # Grab the title attribute for clean text value
            title = attrs.get("title", "").strip()
            if col_key and title and title != "&nbsp;":
                self._current_row[col_key] = title
            elif col_key and col_key not in self._current_row:
                self._current_row[col_key] = ""
            return

        if tag == "a" and self._in_td:
            onclick = attrs.get("onclick", "")
            self._current_href_onclick = onclick
            # Extract jnf_id
            if self._current_col_key in ("apply_acceptance", "designation_hidden", "additional_details_jnf"):
                m = self.JNF_ID_RE.search(onclick)
                if m:
                    self._current_row["jnf_id"] = m.group(1)
            # Extract com_id from company name link
            if self._current_col_key == "company_name":
                m = self.COM_ID_RE.search(onclick)
                if m:
                    self._current_row["com_id"] = m.group(1)
            return

    def handle_endtag(self, tag):
        if not self._in_data_row:
            return

        if tag == "tr":
            if self._in_data_row and self._current_row:
                row = {k: v for k, v in self._current_row.items()
                       if k not in ("row_number", "designation_hidden", "view_link", "contract")}
                if row.get("company_name"):
                    self.rows.append(row)
            self._in_data_row = False
            self._current_row = {}
            self._in_td = False
            self._current_col_key = None

        if tag == "td":
            self._in_td = False
            self._current_col_key = None
            self._current_href_onclick = None

        if tag == "a":
            self._in_a = False


# ─── MAIN ─────────────────────────────────────────────────────────────────────

def parse_intern_html(input_path: str) -> list[dict]:
    with open(input_path, "r", encoding="iso-8859-1", errors="replace") as f:
        html = f.read()

    parser = JqGridParser()
    parser.feed(html)
    return parser.rows


def enrich_rows(rows: list[dict]) -> list[dict]:
    """Add derived URL field for the JNF view link."""
    enriched = []
    for row in rows:
        r = dict(row)
        jnf_id = r.get("jnf_id", "")
        com_id = r.get("com_id", "")
        if jnf_id and com_id:
            r["jnf_url"] = (
                f"https://erp.iitkgp.ac.in/TrainingPlacementSSO/TPJNFView.jsp"
                f"?jnf_id={jnf_id}&com_id={com_id}&yop=2026-2027&user_type=SU&rollno=24CS10097"
            )
        else:
            r["jnf_url"] = ""
        enriched.append(r)
    return enriched


def group_by_company(rows: list[dict]) -> dict:
    """Group all roles under their parent company."""
    grouped: dict[str, dict] = {}
    for row in rows:
        company = row.get("company_name", "Unknown")
        if company not in grouped:
            grouped[company] = {
                "company_name": company,
                "com_id": row.get("com_id", ""),
                "roles": [],
            }
        role_entry = {k: v for k, v in row.items() if k not in ("company_name", "com_id")}
        grouped[company]["roles"].append(role_entry)
    return grouped


def save_json(data, output_path: str):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"  [saved] {output_path}")


def main():
    parser = argparse.ArgumentParser(description="Parse IIT KGP ERP intern.html → JSON")
    parser.add_argument("--input",  default="../intern.html", help="Path to intern.html")
    parser.add_argument("--output-dir", default="data", help="Output directory")
    args = parser.parse_args()

    input_path = os.path.abspath(os.path.join(os.path.dirname(__file__), args.input))
    output_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), args.output_dir))

    print(f"\n[Parsing]: {input_path}")

    if not os.path.exists(input_path):
        print(f"  [ERR] File not found: {input_path}")
        return

    rows = parse_intern_html(input_path)
    rows = enrich_rows(rows)

    print(f"  [OK] Extracted {len(rows)} total roles across all companies\n")

    # ── Output 1: flat list of all roles ────────────────────────────────────
    flat_path = os.path.join(output_dir, "all_roles_flat.json")
    save_json(rows, flat_path)

    # ── Output 2: grouped by company ────────────────────────────────────────
    grouped = group_by_company(rows)
    grouped_list = list(grouped.values())
    grouped_path = os.path.join(output_dir, "all_roles_by_company.json")
    save_json(grouped_list, grouped_path)

    # ── Summary ─────────────────────────────────────────────────────────────
    print(f"\n[Summary]")
    print(f"  Companies  : {len(grouped)}")
    print(f"  Total roles: {len(rows)}")
    print()
    for company_data in grouped_list:
        n = len(company_data["roles"])
        print(f"  - {company_data['company_name']} -- {n} role{'s' if n > 1 else ''}")
    print()


if __name__ == "__main__":
    main()
