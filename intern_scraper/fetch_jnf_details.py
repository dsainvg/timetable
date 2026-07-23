"""
fetch_jnf_details.py
---------------------
Fetches the JNF detail page for every role in all_roles_flat.json using your
active ERP session cookies and extracts role title, description, eligibility,
stipend, duration, job type, etc.

USAGE:
  1. Update cookies.json with your current session cookies (copy from browser DevTools)
  2. Run:  python fetch_jnf_details.py

Output:
  data/all_roles_detailed.json  -- full enriched role data
"""

import json
import os
import re
import time
import urllib.request
import urllib.parse
from html.parser import HTMLParser

# ─── COOKIES ─────────────────────────────────────────────────────────────────
# Paste your fresh cookies here OR put them in cookies.json
# (cookies.json is gitignored — never commit session tokens)

COOKIES_FILE = os.path.join(os.path.dirname(__file__), "cookies.json")

DEFAULT_COOKIES = {
    "JSESSIONID": "612E81B9E33185A50227E8E335711242.node3",
    "ssoToken": "B9B0572EC013D64B204590ED4B7A5DCC.node71C5BAEECAFEE2DBC4D9AA41314CED8CD.node85BI5EM8Q2N2BBPXZOPNBB05SPDJE1F18SPVVV7EOWF67E4RU2AGNE6T6Y1SN4U7D",
    "JSID_IIT_ERP3": "1C5BAEECAFEE2DBC4D9AA41314CED8CD.node8",
    "JSID_Academic": "5D45238B2F431B3B497B6D95FAB0F39C.node1",
    "LAST_ACCESS_TIME": "1784794847834",
    "JSID_TrainingPlacementSSO": "612E81B9E33185A50227E8E335711242.node3",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 Edg/150.0.0.0",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://erp.iitkgp.ac.in/TrainingPlacementSSO/TPStudent.jsp",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}

DELAY_SECONDS = 1.2  # be polite — ~50 requests at 1.2s = ~1 min total


# ─── HTML PARSER FOR JNF DETAIL PAGE ─────────────────────────────────────────

class JNFDetailParser(HTMLParser):
    """
    Parses the TPJNFView.jsp page.
    The page renders key-value pairs in <td> cells inside table rows.
    We extract all label→value pairs from the rendered HTML table.
    """

    def __init__(self):
        super().__init__()
        self._rows: list[tuple[str, str]] = []
        self._cells: list[str] = []
        self._current_text: str = ""
        self._in_td = False
        self._in_th = False
        self._depth = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("td", "th"):
            self._in_td = True
            self._current_text = ""
        if tag == "tr":
            self._cells = []

    def handle_endtag(self, tag):
        if tag in ("td", "th"):
            self._cells.append(self._current_text.strip())
            self._in_td = False
            self._current_text = ""
        if tag == "tr":
            if len(self._cells) >= 2:
                label = self._cells[0].strip().rstrip(":")
                value = self._cells[1].strip()
                if label:
                    self._rows.append((label, value))
            self._cells = []

    def handle_data(self, data):
        if self._in_td:
            self._current_text += data

    def handle_entityref(self, name):
        ENTITIES = {"nbsp": " ", "amp": "&", "lt": "<", "gt": ">", "quot": '"'}
        if self._in_td:
            self._current_text += ENTITIES.get(name, "")

    def get_fields(self) -> dict:
        """Convert label/value pairs into a clean dict."""
        result = {}
        for label, value in self._rows:
            key = re.sub(r"\s+", "_", label.lower()).strip("_")
            key = re.sub(r"[^a-z0-9_]", "", key)
            if key and value and value not in ("&nbsp;", "\xa0"):
                result[key] = value
        return result


# ─── HTTP FETCH ───────────────────────────────────────────────────────────────

def load_cookies() -> dict:
    if os.path.exists(COOKIES_FILE):
        with open(COOKIES_FILE, encoding="utf-8") as f:
            return json.load(f)
    # Write default template so user knows where to update
    with open(COOKIES_FILE, "w", encoding="utf-8") as f:
        json.dump(DEFAULT_COOKIES, f, indent=2)
    return DEFAULT_COOKIES


def make_cookie_header(cookies: dict) -> str:
    return "; ".join(f"{k}={v}" for k, v in cookies.items())


def fetch_url(url: str, cookies: dict) -> str | None:
    req_headers = dict(HEADERS)
    req_headers["Cookie"] = make_cookie_header(cookies)

    req = urllib.request.Request(url, headers=req_headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read()
            # Try UTF-8, fall back to ISO-8859-1 (ERP default)
            try:
                return raw.decode("utf-8")
            except UnicodeDecodeError:
                return raw.decode("iso-8859-1", errors="replace")
    except Exception as e:
        print(f"    [FETCH ERROR] {url} -- {e}")
        return None


def parse_jnf_page(html: str) -> dict:
    parser = JNFDetailParser()
    parser.feed(html)
    fields = parser.get_fields()

    # Also look for common specific patterns with regex for robustness
    title_m = re.search(r"Job\s+Title[^<]*</t[dh][^>]*>([^<]+)", html, re.IGNORECASE)
    if title_m and "job_title" not in fields:
        fields["job_title"] = title_m.group(1).strip()

    desc_m = re.search(r"Job\s+Description[^<]*</t[dh][^>]*>([^<]{10,}?)(?:</td>|<br)", html, re.IGNORECASE | re.DOTALL)
    if desc_m and "job_description" not in fields:
        desc_text = re.sub(r"<[^>]+>", " ", desc_m.group(1)).strip()
        if len(desc_text) > 5:
            fields["job_description_inline"] = desc_text

    return fields


# ─── MAIN ─────────────────────────────────────────────────────────────────────

def main():
    base_dir = os.path.dirname(__file__)
    flat_json = os.path.join(base_dir, "data", "all_roles_flat.json")
    out_json  = os.path.join(base_dir, "data", "all_roles_detailed.json")
    cache_dir = os.path.join(base_dir, "data", "_html_cache")
    os.makedirs(cache_dir, exist_ok=True)

    with open(flat_json, encoding="utf-8") as f:
        roles = json.load(f)

    cookies = load_cookies()
    print(f"\n[fetch_jnf_details] Fetching details for {len(roles)} roles...\n")

    enriched = []
    for i, role in enumerate(roles):
        url = role.get("jnf_url", "")
        jnf_id = role.get("jnf_id", "?")
        com_id = role.get("com_id", "?")
        company = role.get("company_name", "?")

        if not url:
            enriched.append(role)
            continue

        cache_file = os.path.join(cache_dir, f"jnf_{jnf_id}_com_{com_id}.html")
        print(f"  [{i+1:02d}/{len(roles)}] {company} (jnf_id={jnf_id}, com_id={com_id})")

        # Use cached HTML if already fetched
        if os.path.exists(cache_file):
            with open(cache_file, encoding="utf-8", errors="replace") as f:
                html = f.read()
            print(f"         [cache hit]")
        else:
            html = fetch_url(url, cookies)
            if html:
                with open(cache_file, "w", encoding="utf-8") as f:
                    f.write(html)
                print(f"         [fetched {len(html)} chars]")
                time.sleep(DELAY_SECONDS)
            else:
                enriched.append(role)
                continue

        # Check if session expired (redirected to login)
        if "ssoToken" in html.lower() and "login" in html.lower() and len(html) < 2000:
            print(f"\n  [SESSION EXPIRED] Update cookies in {COOKIES_FILE} and re-run.\n")
            break

        detail_fields = parse_jnf_page(html)

        merged = dict(role)
        merged["jnf_details"] = detail_fields
        enriched.append(merged)

    # Save
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(enriched, f, indent=2, ensure_ascii=False)

    print(f"\n[saved] {out_json}")
    print(f"[done]  {len(enriched)} roles saved with detail fields\n")

    # Quick preview of first role's jnf_details
    for r in enriched:
        if r.get("jnf_details"):
            print(f"\n[Preview] {r['company_name']} jnf_id={r['jnf_id']} fields extracted:")
            for k, v in list(r["jnf_details"].items())[:12]:
                v_short = (v[:90] + "...") if len(v) > 90 else v
                print(f"    {k}: {v_short}")
            break


if __name__ == "__main__":
    main()
