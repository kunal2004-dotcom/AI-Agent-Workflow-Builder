# ⚡ FlowMind — AI Agent Workflow Builder

A full-stack mini n8n built on **nhost + Hasura + PostgreSQL + GraphQL + Next.js**.  
Chain AI agent steps, trigger them multiple ways, gate everything behind two permission layers, and watch execution happen live with zero page refreshes.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Vercel (Next.js 14)                  │
│        Auth • Workflow Builder • Live Run Viewer        │
└──────────────────────┬──────────────────────────────────┘
                       │ GraphQL (WebSocket for subscriptions)
┌──────────────────────▼──────────────────────────────────┐
│              nhost Cloud (ap-south-1)                   │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │   Hasura    │  │   nhost Auth │  │  PostgreSQL 14 │  │
│  │   GraphQL   │  │   JWT + RBAC │  │  (schema below)│  │
│  └──────┬──────┘  └──────────────┘  └────────────────┘  │
│         │                                               │
│  ┌──────▼──────────────────────────────────────────┐   │
│  │          nhost Serverless Functions              │   │
│  │  trigger-workflow-run.ts  approve-step.ts        │   │
│  │  webhook-trigger.ts  cron-trigger.ts             │   │
│  │  db-event-trigger.ts  create-organization.ts     │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                       │ REST API calls
          ┌────────────▼────────────┐
          │     Groq API (free)     │
          │  llama-3.3-70b-versatile│
          └─────────────────────────┘
```

---

## 🚀 Quick Start — Local Development

### Prerequisites
- Node.js 18+
- Docker Desktop (running)
- nhost CLI: `npm install -g nhost`

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/ai-agent-workflow-builder.git
cd ai-agent-workflow-builder

# Install function dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Configure Secrets

```bash
# Edit .secrets with your values
cp .secrets .secrets.example  # keep example clean
```

The `.secrets` file (never commit this):
```env
NHOST_ADMIN_SECRET=nhost-admin-secret
NHOST_WEBHOOK_SECRET=nhost-webhook-secret-local
NHOST_JWT_SECRET=nhost-jwt-secret-key-32-chars-min!!
GROQ_API_KEY=your_groq_api_key_here
```

### 3. Start Local Stack

```bash
# Start Postgres, Hasura, Auth, Functions
nhost up

# In a separate terminal — start Next.js
cd frontend
NEXT_PUBLIC_NHOST_SUBDOMAIN=local NEXT_PUBLIC_NHOST_REGION= npm run dev
```

Services:
| Service | Local URL |
|---------|-----------|
| Next.js | http://localhost:3000 |
| Hasura Console | http://localhost:1337/v1/console |
| GraphQL API | http://localhost:1337/v1/graphql |
| Auth | http://localhost:1337/v1/auth |
| Functions | http://localhost:1337/v1/functions |

---

## ☁️ Cloud Deployment

### nhost Cloud Setup

1. Log in to [nhost.io](https://nhost.io)
2. Open your project: **jzslrsysqhsxqhljcmek** (ap-south-1)
3. Go to **Database → SQL** and run the migration:
   ```
   nhost/migrations/default/1700000000000_init_schema/up.sql
   ```
4. Go to **Hasura Console → Settings → Metadata → Import Metadata** and import the files in `nhost/metadata/`

5. Add secrets in nhost dashboard (Settings → Secrets):
   ```
   GROQ_API_KEY = your_groq_api_key_here
   NHOST_WEBHOOK_SECRET = (generate a random string)
   ```

6. Push functions — nhost auto-deploys from GitHub or you can use nhost CLI:
   ```bash
   nhost deploy
   ```

### Hasura Actions Setup (Cloud)

In Hasura Console → Actions, create these actions pointing to:
```
https://jzslrsysqhsxqhljcmek.functions.ap-south-1.nhost.run/v1/trigger-workflow-run
https://jzslrsysqhsxqhljcmek.functions.ap-south-1.nhost.run/v1/approve-step
https://jzslrsysqhsxqhljcmek.functions.ap-south-1.nhost.run/v1/create-organization
```

Or import from `nhost/metadata/actions.yaml`.

### Cron Trigger (Cloud)

In Hasura Console → Scheduled Events, create:
- **Name:** `scheduled_workflow_runner`
- **Webhook:** `https://jzslrsysqhsxqhljcmek.functions.ap-south-1.nhost.run/v1/cron-trigger`
- **Cron:** `*/5 * * * *`

### DB Event Trigger (Cloud)

In Hasura Console → Events → Create Event Trigger:
- **Table:** `public.watched_events`
- **Operations:** INSERT
- **Webhook:** `https://jzslrsysqhsxqhljcmek.functions.ap-south-1.nhost.run/v1/db-event-trigger`

### Vercel Deployment

```bash
cd frontend
vercel --prod

# Set environment variables in Vercel dashboard:
# NEXT_PUBLIC_NHOST_SUBDOMAIN = jzslrsysqhsxqhljcmek
# NEXT_PUBLIC_NHOST_REGION = ap-south-1
```

---

## 📊 Data Model

```
organizations
  ├── org_members (user_id, role: owner|editor|viewer)
  └── workflows
        ├── workflow_steps (type, config JSONB, order_index)
        ├── workflow_triggers (type: manual|webhook|scheduled|db_event, config)
        └── workflow_runs (status: pending|running|paused|completed|failed)
              └── step_runs (status, input, output, error, approved_by, approved_at)

View: org_monthly_usage (runs this month, avg duration, completed/failed counts)
```

---

## 🔐 Permission Layers

### Layer 1 — Hasura Row-Level Permissions (org isolation)

Every Hasura permission filter uses a nested `_exists` check against `org_members`:

```yaml
# Example: editor can insert workflow steps only in their own org
filter:
  workflow:
    organization:
      org_members:
        _and:
          - user_id: { _eq: X-Hasura-User-Id }
          - role: { _in: [owner, editor] }
```

This ensures Org B users can **never see Org A data**, even by guessing UUIDs — Hasura returns empty arrays, not 403s, making it impossible to confirm data existence.

### Layer 2 — Action Handler Code Checks

The `triggerWorkflowRun` and `approveStep` handlers perform explicit role checks **in application code**:

```typescript
const member = await getOrgMember(orgId, userId);  
if (!['owner', 'editor'].includes(member.role)) {
  return res.status(403).json({ message: 'Forbidden' });
}
```

This cannot be replicated by database permissions alone for mid-execution decisions (e.g., approving a paused run).

---

## 🔌 Trigger Types

| Type | How It Works |
|------|-------------|
| **Manual** | Frontend calls `triggerWorkflowRun` mutation |
| **Webhook** | POST to `/v1/functions/webhook-trigger` with `workflow_id` and `webhook_secret` |
| **Scheduled** | Hasura cron fires `/v1/functions/cron-trigger` every 5 minutes |
| **DB Event** | INSERT into `watched_events` table fires Hasura Event Trigger → `db-event-trigger` function |

**Webhook example:**
```bash
curl -X POST \
  https://jzslrsysqhsxqhljcmek.functions.ap-south-1.nhost.run/v1/webhook-trigger \
  -H "Content-Type: application/json" \
  -d '{"workflow_id": "YOUR-UUID", "webhook_secret": "YOUR-SECRET", "data": {"key": "value"}}'
```

---

## ⚙️ Step Types

| Step | What It Does | Config Keys |
|------|-------------|-------------|
| `llm_call` | Calls Groq `llama-3.3-70b-versatile` | `model`, `system_prompt`, `user_prompt`, `temperature`, `json_mode` |
| `http_request` | Generic HTTP call (retry 3x on failure) | `url`, `method`, `headers`, `body` |
| `db_write` | Executes a Hasura mutation via admin secret | `mutation`, `variables` |
| `notify` | POSTs to a Slack/generic webhook URL | `webhook_url`, `message`, `channel` |
| `conditional_branch` | JS expression evaluated against context | `condition`, `false_path` (continue/stop) |
| `approval_gate` | Pauses run until owner/editor approves | `message` |

Context variables available in prompts/conditions: `{{lastOutput}}`, `{{step_N}}`, `{{context.key}}`

---

## 📡 GraphQL API

### Key Subscription (live step progress)

```graphql
subscription StepRunProgress($workflow_run_id: uuid!) {
  step_runs(where: { workflow_run_id: { _eq: $workflow_run_id } }, order_by: { created_at: asc }) {
    id status input output error attempt_count
    approved_by approved_at started_at completed_at
    workflow_step { type config order_index }
  }
}
```

### Trigger a Run

```graphql
mutation {
  triggerWorkflowRun(input: { workflow_id: "YOUR-UUID" }) {
    run_id status message
  }
}
```

### Approve a Paused Step

```graphql
mutation {
  approveStep(input: { step_run_id: "STEP-RUN-UUID" }) {
    success message run_status
  }
}
```

---

## 🧪 Final Scenario — End-to-End Test

```
1. Register as Org A owner
2. Create workflow: llm_call → conditional_branch → http_request → approval_gate
3. Add webhook trigger
4. Trigger manually → watch live status stream
5. Hit approval_gate → approve it → run completes
6. Trigger via webhook (curl command above)
7. Register as Org B user → verify zero visibility of Org A data
8. Try Org A workflow UUID as Org B → empty response (not 401/403, proving row-level isolation)
```

---

## 📁 Project Structure

```
ai-agent-workflow-builder/
├── nhost/              ← Backend IaC
│   ├── nhost.toml
│   ├── migrations/     ← PostgreSQL DDL
│   └── metadata/       ← Hasura tables, permissions, actions, triggers
├── functions/          ← nhost serverless functions (TypeScript)
│   ├── _utils/         ← shared: hasura client, llm, executor
│   ├── trigger-workflow-run.ts
│   ├── approve-step.ts
│   ├── webhook-trigger.ts
│   ├── cron-trigger.ts
│   ├── db-event-trigger.ts
│   └── create-organization.ts
└── frontend/           ← Next.js 14 App
    └── src/
        ├── app/        ← Pages (App Router)
        ├── components/ ← Reusable components
        └── lib/        ← nhost client, GraphQL operations
```

---

## 🔑 API Keys Note

The Groq API key in `.secrets` is for the free tier (`llama-3.3-70b-versatile`).  
Rate limits: 6,000 RPM, 500,000 TPM — more than sufficient for demo.

If LLM calls are unavailable, the executor stubs will return `{ stubbed: true, content: "LLM stub response" }` with a 1s delay (see `functions/_utils/llm.ts`).
