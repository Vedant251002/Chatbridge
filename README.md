# WhatsApp AI Platform

A production-style WhatsApp AI assistant with **human-in-the-loop takeover**, **RAG-grounded replies**, and a clean Next.js admin UI.

Inbound messages flow through a Baileys gateway → BullMQ queue → AI use case that retrieves relevant chunks from a pgvector knowledge base, calls Grok, persists everything, and sends the reply. Agents can pause the AI on any conversation and reply manually from the live chat view, with realtime updates over SSE.

## In Plain English

Think of this project as a smart auto-replier for WhatsApp with a built-in control room.

**What it does**
- A customer sends a WhatsApp message to your number.
- The bot reads the message, looks up your own documents (FAQs, product info, policies — anything you upload) to find the relevant facts, and writes a grounded reply using AI.
- The reply is sent back on WhatsApp automatically.
- A human agent can jump in any time, pause the bot on a specific chat, and take over the conversation themselves.

**The two halves**
- **Backend (`src/`)** — the engine. Stays connected to WhatsApp, listens for incoming messages, runs the AI, and sends replies. Runs as a single always-on Node.js process.
- **Web admin (`web/`)** — the dashboard. A Next.js app where you scan the QR to link WhatsApp, upload knowledge documents, watch chats live, and reply by hand when needed.

They never talk directly. They share a Postgres database (chat history, documents, settings) and a Redis queue (jobs to send messages, live updates for the dashboard). That means you can restart or redeploy the dashboard without ever dropping the WhatsApp connection.

**A typical message, step by step**
1. Customer sends "Do you ship to Canada?" on WhatsApp.
2. Backend receives it through Baileys, drops it into a Redis queue, and saves the message.
3. A worker picks up the job, turns the question into an embedding, and searches your uploaded documents for the most similar chunks.
4. Those chunks are pasted into the AI prompt as context.
5. Grok generates an answer using only the facts from your documents.
6. Reply is saved, sent back over WhatsApp, and pushed live to any open dashboard windows.
7. If the agent had hit "Pause AI" on that chat, step 4–6 are skipped and the agent answers manually instead.

**Why this design**
- **No lost messages.** Every step goes through a queue with retries, so a temporary AI outage or restart doesn't drop a customer message.
- **Answers stay on-brand.** The bot only uses facts you upload, so it doesn't make things up about your business.
- **Humans stay in control.** One click pauses the AI on a single chat. The customer never knows the difference.
- **Live updates.** New messages, AI replies, and pause/resume events stream into the dashboard in real time over SSE — no refresh button.

**Who it's for**
Small support teams, sales teams, or anyone who wants a WhatsApp number that handles routine questions automatically but still lets a real person step in for the tricky ones.

## Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + TypeScript (Baileys + BullMQ workers) |
| WhatsApp | Baileys |
| AI (chat) | xAI Grok / Groq / mock — pluggable |
| AI (embeddings) | OpenAI `text-embedding-3-small` (1536 dims) / mock |
| Database | PostgreSQL 16 + pgvector + Prisma |
| Queue | BullMQ + Redis |
| Realtime | Redis pub/sub → SSE in Next.js |
| Frontend / API | Next.js 15 (App Router) |
| Runtime | Docker Compose |

## Architecture

```
        WhatsApp                   Browser (admin)
            │                          │
        Baileys                    SSE  REST
            │                          │
   ┌────────▼─────────┐        ┌──────▼──────────┐
   │  Backend node    │        │  Next.js (web)  │
   │  • inbound q     │        │  • inbox        │
   │  • outbound q    │        │  • live chat    │
   │  • ingest q      │        │  • knowledge    │
   │  • RAG + Grok    │        │  • config       │
   └────────┬─────────┘        └──────┬──────────┘
            │                         │
            └──────► Redis ◄──────────┘
            │                         │
            └──── PostgreSQL ─────────┘
                  + pgvector
```

The web container never opens a WhatsApp socket. Agent replies are enqueued onto an `outbound-messages` BullMQ queue and the backend (which owns the Baileys socket) consumes and sends. Realtime fan-out is per-conversation Redis pub/sub channels (`conv:{id}`) consumed via SSE.

## Project Structure

```
src/
├── ai/                    Prompt building, AI provider factory + clients
├── domain/                Entities + ports (clean-architecture seams)
├── infrastructure/
│   ├── ai/               Embedder factory (OpenAI + mock)
│   ├── db/               Prisma repositories (incl. pgvector raw queries)
│   ├── logging/          Pino logger
│   ├── queue/            BullMQ publishers + workers (inbound, outbound, ingest)
│   ├── realtime/         Redis pub/sub publisher
│   └── whatsapp/         Baileys gateway, listener, sender, session
├── use-cases/             Process inbound, retrieve knowledge, ingest document
├── utils/                 Errors, helpers, chunker

web/src/
├── app/
│   ├── api/              Route handlers (REST + SSE)
│   ├── conversations/    Live chat UI (inbox + thread view)
│   ├── knowledge/        Knowledge base manager
│   └── page.tsx          Setup page (QR + prompt editor)
├── components/
│   ├── chat/             Inbox, conversation view, message bubble
│   ├── knowledge/        Upload form, manager
│   └── ...               Toast, nav, footer, prompt editor, QR
└── lib/                   Validators, queue clients, Prisma, Redis, realtime
```

## Features

### 1. Human-in-the-loop takeover
- Per-conversation **Pause AI** toggle — flips a flag on the conversation and writes a system marker to the timeline.
- Agent composer becomes active when paused; replies skip the AI entirely and are queued for WhatsApp delivery.
- Live thread view auto-updates over SSE — new inbound, AI replies, agent replies, and pause/resume events stream into the UI without refreshing.
- Inbox sorted by `lastActivityAt`, lights up the most recent thread first.

### 2. RAG knowledge base
- Add documents as plain text, markdown, or URL.
- BullMQ ingest job chunks the text (~500 tokens, 50-token overlap), embeds via OpenAI, bulk-inserts into pgvector with an IVFFlat cosine index.
- On every inbound message, the system embeds the user query, runs cosine-similarity search, and injects the top-K chunks into the system prompt under a `--- KNOWLEDGE ---` block with citation markers.
- Sources used are stored on the message and rendered as small badges under the bot reply (`document title #ordinal (similarity %)`).
- Mock embedder lets the pipeline run end-to-end offline without an API key.

### 3. Phone number allowlist (per user)
- The AI replies **only** to numbers the signed-in admin has explicitly added. An empty list means the bot stays silent for everyone — messages still land in that admin's inbox for them to handle manually.
- Each admin keeps their **own** private allowlist. You only see, edit, and gate replies against the numbers you added.
- Add or remove numbers from the **Allowed numbers** card on `/`. Each entry can carry an optional label (e.g. "Customer", "QA tester").
- Matching is digits-only with smart suffix comparison, so `+91 91046 24966`, `919104624966`, and `+919104624966` all collide on the same identity. No need to worry about formatting at save-time.
- WhatsApp's new privacy-preserving identity (LID) is resolved automatically: when a sender's JID is `@lid`, the listener reads the real phone number from `senderPn` on the message key, so allowlist matching keeps working.

### 4. Multi-tenant admin accounts (full data isolation)
- Sign up at `/register` and sign in at `/login`. Each admin runs their own private bot.
- **Each user has their own everything**: their own WhatsApp pairing (separate QR), their own conversations and chat history, their own knowledge base, their own bot prompt, and their own allowlist. No user can see or affect another user's data.
- The Baileys backend keeps one socket per user (`sessions/<userId>/`) and routes inbound messages, RAG retrieval, and outbound replies through per-user tenancy guards.
- Passwords are hashed with `scrypt` (node stdlib, salted, memory-hard) and never stored in plaintext.
- Sessions are opaque random tokens, hashed (SHA-256) before storage, set as `HttpOnly` `SameSite=Lax` cookies, and expire after 30 days.
- Middleware blocks every page and API route except `/login`, `/register`, `/api/auth/*`, and `/api/health`. Anonymous API hits get a 401; anonymous page hits get redirected to `/login?next=…`.
- Tenancy is enforced at the database layer: every domain row has a `user_id` foreign key, every API query filters by the signed-in user, and the RAG SQL search joins on `documents.user_id` so a crafted query can never surface another user's chunks.

## Prerequisites

- Docker Desktop (v2+)
- A phone with WhatsApp (for QR scan)
- xAI Grok API key from [console.x.ai](https://console.x.ai) — required for chat completions
- OpenAI API key from [platform.openai.com](https://platform.openai.com) — required for embeddings (or set `EMBEDDINGS_PROVIDER=mock` for offline dev)

## Setup

```bash
git clone <repo>
cd whatsapp-ai-platform
cp .env.example .env
# Set GROK_API_KEY and OPENAI_API_KEY in .env
docker compose up --build
```

This builds both images, starts Postgres (with pgvector) and Redis, runs `prisma migrate deploy`, starts the Baileys backend (gateway + 3 workers), and starts the Next.js web app on `http://localhost:3000`.

Open `http://localhost:3000` and scan the QR with WhatsApp on your phone:

> Settings → Linked Devices → Link a Device → Scan QR

The session is persisted to `sessions/`.

## API Endpoints

### Conversations
- `GET /api/conversations` — list with last-message preview and pause state, ordered by activity
- `GET /api/messages/:conversationId` — full thread
- `POST /api/conversations/:id/pause` — `{ "paused": true|false }` — toggle HITL
- `POST /api/conversations/:id/reply` — `{ "text": "…" }` — send agent reply (queued for delivery)
- `GET /api/conversations/:id/stream` — SSE feed of realtime events

### Knowledge base
- `GET /api/knowledge` — list documents
- `POST /api/knowledge` — create + queue ingest. Body: `{ sourceType, title, sourceText | sourceUrl }`
- `GET /api/knowledge/:id` — document with all chunks
- `POST /api/knowledge/:id/reindex` — re-run ingestion
- `DELETE /api/knowledge/:id` — cascade delete

### Misc
- `POST /api/send-message` — admin-initiated outbound (existing)
- `GET /api/bot-config`, `PUT /api/bot-config` — base prompt
- `GET /api/allowed-numbers` — list allowlisted phones
- `POST /api/allowed-numbers` — add a phone. Body: `{ "phone": "+91…", "label": "optional" }`
- `DELETE /api/allowed-numbers/:id` — remove from allowlist
- `GET /api/qr` — current QR data URL
- `GET /api/health`

## How retrieval works

```
Inbound message
   │
   ▼
embed(user text) ──► pgvector cosine search (top 5, threshold 0.55)
                                  │
                                  ▼
   ┌─────────────────────────────────────────────────────┐
   │ system prompt =                                     │
   │   COMPANY CONTEXT (admin prompt)                    │
   │   KNOWLEDGE block ([1] doc-title: chunk text…)      │
   │   ASSESSMENT JSON contract                          │
   └─────────────────────────────────────────────────────┘
                                  │
                                  ▼
                            Grok chat call
                                  │
                                  ▼
   reply persisted with `aiOutput.sources` for traceability
```

## How HITL works

```
Inbound message arrives
        │
        ▼
   ┌──────────────────┐
   │ persist + emit   │
   │ message.created  │  ← SSE listeners get this immediately
   └────────┬─────────┘
            │
            ▼
     conversation.aiPaused?
            │
   ┌────────┴────────┐
   │ NO              │ YES
   ▼                 ▼
allowlisted?      skip AI; agent will reply
   │
   ┌────────┴────────┐
   │ YES             │ NO
   ▼                 ▼
RAG + AI reply    skip AI; wait for agent
   │
   ▼
persist + send
```

Agent reply path:
```
POST /api/conversations/:id/reply
        │
        ▼
   persist message (sender = agent)
        │
        ▼
   enqueue outbound-messages job (jid, text)
        │
        ▼
   backend outbound worker → Baileys.sendMessage
        │
        ▼
   publishEvent message.created → SSE
```

## Useful Commands

```bash
make infra      # Start Postgres + Redis only
make up         # Start full app
make tools      # + Adminer + Redis Commander + Prisma Studio
make down       # Stop everything
make migrate    # Run Prisma migrations
make logs       # Tail all container logs
make db         # Open psql shell
make redis      # Open redis-cli shell
```

## Real-world considerations

- **Restart-safe**: every cross-process boundary uses BullMQ with retries and exponential backoff. Agent replies don't get lost if the backend is down — they sit in the queue.
- **AI failure isolation**: RAG retrieval failures and Grok failures degrade gracefully; the user always gets an answer, even if it's a fallback.
- **Realtime fan-out**: SSE per conversation means a thousand open agent windows don't broadcast everywhere — only subscribers to `conv:{id}` get its events.
- **pgvector index**: `IVFFlat / lists=100` is fine up to ~100k chunks. For larger corpora, increase `lists` and `ANALYZE` after bulk inserts, or switch to HNSW (pgvector 0.5+).
- **Prompt injection**: company prompt + knowledge are wrapped between named delimiters, with the JSON contract repeated last so user-controlled text can't override the output format.

## Postman

Import `postman-collection.json`. Set `baseUrl=http://localhost:3000`.
# Chatbridge
