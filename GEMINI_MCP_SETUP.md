# Connecting the IIT Kharagpur Timetable MCP Server to Gemini Spark

This guide explains how to connect your serverless Model Context Protocol (MCP) server endpoint (`/mcp`) as a custom Connected App in **Gemini Spark**.

---

## Prerequisites

To connect a custom MCP server to Gemini Apps, ensure you meet Google's requirements:
- Sign in to the Gemini web app ([gemini.google.com](https://gemini.google.com)) with a **personal Google Account**.
- Be eligible and have access to **Gemini Spark**.
- Have **Keep Activity** enabled on your Google account settings.

---

## Step-by-Step Setup Guide

### 1. Obtain Your MCP Server URL
- **Production (Cloudflare Workers)**: `https://<your-worker-domain>.workers.dev/mcp`
- **Local Server (Local Tunnel / ngrok)**: `https://<your-subdomain>.ngrok-free.app/mcp`

### 2. Add Custom App in Gemini Web App
1. Open [gemini.google.com](https://gemini.google.com) on your computer.
2. Click **Settings & help** (⚙️) in the bottom-left corner and select **Connected Apps**.
3. Under **Custom apps for Spark**, click **Add a custom app link**.
4. Enter your MCP server URL (e.g. `https://<your-domain>/mcp`).
5. Click **Next** and follow the on-screen instructions to authorize.

---

## Available MCP Tools

Once connected, Gemini Spark can invoke the following custom tools automatically:

| Tool Name | Description | Example Prompt |
| :--- | :--- | :--- |
| `get_timetable_schedule` | Fetch IIT Kharagpur class schedule for a day or subject | `@Timetable What classes do I have on Monday?` |
| `get_reminders` | Fetch pending assignments, exams, and tasks | `@Timetable List my pending assignments for CS31007` |
| `add_reminder` | Add a new task or exam reminder | `@Timetable Remind me to prepare for Compilers exam on 2026-08-01 at 10:00 AM` |
| `get_attendance_records` | View attendance summary and bunk tracker stats | `@Timetable What is my current attendance percentage in HPPC?` |
| `log_attendance` | Record class attendance status (attended/missed/cancelled) | `@Timetable Log that I attended CS31007 lecture today` |

---

## Technical Protocol Details

The `/mcp` server endpoint complies with the standard **Model Context Protocol (MCP)** specifications:
- **Transport**: Supports both **JSON-RPC 2.0** over `POST /mcp` and **Server-Sent Events (SSE)** over `GET /mcp`.
- **CORS**: Configured for cross-origin access (`Access-Control-Allow-Origin: *`).
- **Methods Supported**:
  - `initialize`: Exposes protocol version `2024-11-05` and server metadata (`iitkgp-timetable-mcp`).
  - `notifications/initialized`: Acknowledges client session startup.
  - `ping`: Keep-alive handshake.
  - `tools/list`: Returns JSON schemas for all available tools.
  - `tools/call`: Executes actions against D1 Database / timetable schedule.
