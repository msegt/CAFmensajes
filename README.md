# WhatsApp Business Sender

A Next.js app that reads contacts from Supabase and sends WhatsApp messages via the WhatsApp Business Cloud API.

---

## Architecture

```
┌─────────────────────┐      ┌──────────────────────────────┐
│  Browser (Next.js)  │ ───▶ │  Next.js API Routes          │
│  Static UI          │      │  /api/contacts                │
│  (GitHub Pages or   │      │  /api/send                    │
│   Cloudflare Pages) │      │  /api/webhook  ◀── Meta       │
└─────────────────────┘      └──────────────────────────────┘
                                        │
                    ┌───────────────────┴──────────────────┐
                    │                                      │
             ┌──────▼──────┐                   ┌──────────▼──────┐
             │  Supabase   │                   │  WhatsApp Cloud │
             │  Database   │                   │  API (Meta)     │
             └─────────────┘                   └─────────────────┘
```

---

## ⚙️ Setup Guide

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/whatsapp-sender
cd whatsapp-sender
npm install
```

### 2. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your values:

```bash
cp .env.local.example .env.local
```

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role (⚠️ server-only) |
| `WHATSAPP_ACCESS_TOKEN` | Meta Business Manager → System Users → Generate Token |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta Developer Dashboard → WhatsApp → Getting Started |
| `WHATSAPP_VERIFY_TOKEN` | Create your own random string for webhook verification |

### 3. Set up Supabase

Run the migration in `supabase/migrations/001_contacts.sql` in your Supabase SQL editor.

### 4. WhatsApp Webhook Setup

Deploy this app first, then in the Meta App Dashboard:
- Set Webhook URL to: `https://your-domain.com/api/webhook`
- Set Verify Token to the value of `WHATSAPP_VERIFY_TOKEN`
- Subscribe to: `messages`, `message_status`

### 5. Development

```bash
npm run dev
# Opens at http://localhost:3000
```

### 6. Deploy

#### Option A — Cloudflare Pages (Recommended)

```bash
# Install Cloudflare adapter
npm install @cloudflare/next-on-pages

# Push to GitHub — Cloudflare Pages picks it up automatically
# Set environment variables in Cloudflare Pages → Settings → Variables
```

#### Option B — GitHub Pages (Static export, no API routes)

> ⚠️ GitHub Pages only serves static files. If using GitHub Pages, you must
> deploy the API routes separately (e.g. as Cloudflare Workers or Supabase Edge Functions).
> See `worker/` for the standalone Cloudflare Worker alternative.

```bash
# For GitHub Pages static export (no backend):
npm run export
# Then push the `out/` folder to GitHub Pages
```

---

## Project Structure

```
whatsapp-sender/
├── pages/
│   ├── index.tsx           # Main dashboard UI
│   ├── _app.tsx            # App wrapper
│   └── api/
│       ├── contacts.ts     # GET /api/contacts — fetch from Supabase
│       ├── send.ts         # POST /api/send — send WhatsApp message
│       └── webhook.ts      # GET/POST /api/webhook — Meta webhook handler
├── components/
│   ├── ContactsTable.tsx   # Contacts list with selection
│   ├── MessageComposer.tsx # Message compose panel
│   └── StatusBadge.tsx     # Delivery status badge
├── lib/
│   ├── supabase.ts         # Supabase client (browser-safe)
│   ├── supabaseAdmin.ts    # Supabase admin client (server-only)
│   └── whatsapp.ts         # WhatsApp API helper
├── styles/
│   └── globals.css         # Design tokens + base styles
├── supabase/
│   └── migrations/
│       └── 001_contacts.sql
├── worker/
│   └── index.ts            # Standalone Cloudflare Worker (alternative backend)
├── .env.local.example
├── next.config.js
├── package.json
└── README.md
```
