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

### 1. Obtain Your MCP Server URL & Access Key
The MCP endpoint requires authentication using a secret key or session token. Secrets can be configured via environment variables (`MCP_API_KEY`, `MCP_AUTH_TOKEN`, `MCP_PASSWORD`, or `APP_PASSWORD`, default: `24cs10097`).

Append your key as a query parameter in the URL:
- **Production (Cloudflare Workers)**: `https://<your-worker-domain>.workers.dev/mcp?key=24cs10097`
- **Local Server (Local Tunnel / ngrok)**: `https://<your-subdomain>.ngrok-free.app/mcp?key=24cs10097`

*(Alternatively, clients supporting HTTP headers can pass `Authorization: Bearer <key_or_token>`, `Authorization: Basic <base64>`, or `X-API-Key: <key_or_token>`)*

### 2. Add Custom App in Gemini Web App
1. Open [gemini.google.com](https://gemini.google.com) on your computer.
2. Click **Settings & help** (⚙️) in the bottom-left corner and select **Connected Apps**.
3. Under **Custom apps for Spark**, click **Add a custom app link**.
4. Enter your authenticated MCP server URL (e.g. `https://<your-domain>/mcp?key=24cs10097`).
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
- **Authentication**: Constant-time (timing-safe) validation of secret key or session token provided via query parameters (`key`, `api_key`, `token`, `access_token`, `password`, `auth`), `Authorization` header (`Bearer <token>` or `Basic <base64>`), or `X-API-Key` header. Unauthenticated requests return `401 Unauthorized` with `WWW-Authenticate: Bearer`.
- **Methods Supported**:
  - `initialize`: Exposes protocol version `2024-11-05` and server metadata (`iitkgp-timetable-mcp`).
  - `notifications/initialized`: Acknowledges client session startup.
  - `ping`: Keep-alive handshake.
  - `tools/list`: Returns JSON schemas for all available tools.
  - `tools/call`: Executes actions against D1 Database / timetable schedule.
