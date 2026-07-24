import json
import os

BASE_DIR = os.path.dirname(__file__)
DETAILED_JSON = os.path.join(BASE_DIR, "data", "all_roles_detailed.json")

databricks_entry = {
    "company_name": "Databricks",
    "com_id": "999",
    "jnf_id": "1",
    "apply_acceptance": "Apply",
    "ctc": "300000",
    "currency": "INR",
    "application_status": "Y",
    "resume_upload_start": "2026-07-20 10:00",
    "resume_upload_end": "2026-07-24 23:59",
    "interview_selection_date": "",
    "jnf_url": "https://erp.iitkgp.ac.in/TrainingPlacementSSO/TPJNFView.jsp?jnf_id=1&com_id=999&yop=2026-2027&user_type=SU&rollno=24CS10097",
    "jnf_details": {
        "company_display_name": "Databricks",
        "form_type": "INTERNSHIP",
        "stipend_per_month": "300000 INR",
        "cgpa_cutoff": "7.0",
        "job_description": "At Databricks, we are passionate about helping data teams solve the world's toughest problems — from making the next mode of transportation a reality to accelerating the development of medical breakthroughs. We do this by building and running the world's best data and AI infrastructure platform so our customers can use deep data insights to improve their business. Founded by engineers and dedicated to our customers, we leap at every opportunity to solve technical challenges, from designing next-gen UI/UX for working with data to scaling our services and infrastructure across millions of virtual machines. And we're only getting started. As a software engineer, you will work with our engineering team to build infrastructure and products for the Databricks platform. We're hiring across all of our teams, including backend, full stack, infrastructure, databases, systems, tools, cloud, and customer-facing products. You will join a cohort of engineers who will build their careers through collaborative projects and learning opportunities. With a dedicated mentor and supportive team, you'll onboard quickly and start contributing to impactful projects soon after starting here at Databricks!",
        "allowed_departments": [
            "COMPUTER SCIENCE AND ENGINEERING",
            "ARTIFICIAL INTELLIGENCE",
            "ELECTRONICS AND ELECTRICAL COMMUNICATION ENGG.",
            "ELECTRICAL ENGINEERING",
            "MATHEMATICS"
        ],
        "allowed_degrees": [
            "B.TECH --- COMPUTER SCIENCE & ENGG. (B.TECH 4Y)",
            "DUAL DEGREE --- COMPUTER SCIENCE & ENGG. (M.TECH DUAL 5Y)",
            "B.TECH --- ARTIFICIAL INTELLIGENCE(B.TECH 4Y)",
            "4YRS B.S --- MATHEMATICS AND COMPUTING (B.S.4Y)"
        ]
    }
}

if os.path.exists(DETAILED_JSON):
    with open(DETAILED_JSON, encoding="utf-8") as f:
        roles = json.load(f)
    
    # Check if already present
    exists = any(r.get("company_name") == "Databricks" for r in roles)
    if not exists:
        roles.insert(0, databricks_entry)
        with open(DETAILED_JSON, "w", encoding="utf-8") as f:
            json.dump(roles, f, indent=2, ensure_ascii=False)
        print("Added Databricks to all_roles_detailed.json")
    else:
        print("Databricks already exists in json")
