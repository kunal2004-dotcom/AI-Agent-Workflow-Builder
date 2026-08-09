# FlowMind — Technical Write-Up

## 1. Schema Reasoning

The schema is designed around **multi-tenancy as a first principle**, not bolted on later.

**`organizations`** is the root tenant. Every other entity traverses back to it through a chain of foreign keys. This single traversal path is what makes org isolation provable rather than just assumed — there is no way to reach a workflow, step, or run that doesn't go through its organization.

**`org_members`** is the permission anchor. Rather than storing role in a JWT claim (which requires token re-issuance on role change), roles live in this table. Every Hasura permission filter performs a live join against `org_members` at query time, so a role change takes effect on the next GraphQL request, not the next login.

**`workflow_steps`** uses a JSONB `config` column by design. Step types have fundamentally different configurations (an `llm_call` needs prompts and temperature; a `conditional_branch` needs a JS expression). A normalized approach would require a union table or EAV pattern, both worse for GraphQL. JSONB is indexed, queryable, and mirrors how n8n/Zapier store node configs. The trade-off is that JSON-schema validation moves to the Action handler and frontend form layer.

**`workflow_runs` + `step_runs`** are separate tables (not a single execution log) so that GraphQL subscriptions can filter at the step level. The subscription `step_runs(where: { workflow_run_id: { _eq: $id } })` lets the frontend render a live timeline card per step without fetching the full run. The `status` column is the WebSocket-visible state; `context JSONB` on `workflow_runs` carries the accumulated outputs between steps.

**`org_monthly_usage` view** aggregates run counts and average duration per org per calendar month. This is used for the quota indicator and could be extended into a computed field on `organizations` for GraphQL access.

---

## 2. Two Permission Layers — How They're Enforced Differently

### Layer 1 — Hasura Row-Level Permissions (Structural Org Isolation)

Hasura permissions are declarative YAML that the engine evaluates at the database level. For every table, every role, every operation, the filter condition walks the foreign-key graph to `org_members`:

```yaml
# workflow_steps — insert permission for "user" role
check:
  _and:
    - workflow:
        organization:
          org_members:
            _and:
              - user_id: { _eq: X-Hasura-User-Id }
              - role: { _in: [owner, editor] }
    - _or:
        - type: { _nin: [db_write, notify] }  # editors can insert these
        - workflow:                             # owners can insert any type
            organization:
              org_members:
                _and:
                  - user_id: { _eq: X-Hasura-User-Id }
                  - role: { _eq: owner }
```

The key property is that **Hasura never exposes a 403 for cross-org data** — it returns an empty array. An Org B user who guesses an Org A workflow UUID gets `{ "data": { "workflows_by_pk": null } }`, not an error. This makes it impossible to infer data existence from response codes.

Subscriptions have the same `filter` applied, so a live subscription to another org's step_runs simply delivers no events.

### Layer 2 — Action Handler Code-Level Gating (Mid-Execution Decisions)

The Action handler pattern (`trigger-workflow-run.ts`, `approve-step.ts`) is separate from Hasura permissions by necessity: **the approval decision happens mid-execution**, not at row-read/write time. There is no Hasura permission model for "allow this mutation only if the run is currently paused and the caller is an editor in the same org." That's an application-level invariant.

The `approveStep` handler enforces it explicitly:

```typescript
// 1. Fetch the step_run → get its org_id (via nested joins, admin secret)
// 2. Look up the approver in org_members for THAT org
const member = await hasuraAdmin(GET_ORG_MEMBER, { org_id: orgId, user_id: approverId });
if (!member || !['owner', 'editor'].includes(member.role)) {
  return res.status(403).json({ ... });
}
// 3. Verify the step is currently paused (not already approved by someone else)
if (stepRun.status !== 'paused') return res.status(400).json({ ... });
// 4. Only then update + resume
```

This means even if someone crafts a raw GraphQL mutation to `update_step_runs_by_pk`, they hit the Hasura permission layer (no update_permission for "user" role on step_runs — all mutations go through admin secret inside functions only).

**Summary of the difference:**  
Layer 1 governs *which rows you can see or touch* — purely structural, declarative, and enforced before any code runs.  
Layer 2 governs *whether a specific action is semantically valid at this moment* — runtime, stateful, enforced in code.

---

## 3. Approval Gate Pause/Resume Implementation

When the executor encounters an `approval_gate` step:

1. A `step_run` row is created with `status = 'paused'`
2. `workflow_runs` is updated to `status = 'paused'`, `current_step_index = i`  
3. The executor function **returns immediately** — it does not block or poll
4. The Action handler returns `{ status: 'paused' }` to the caller
5. The frontend subscription receives the `step_run.status = 'paused'` event and renders the `ApprovalGateCard`

On approval (via `approveStep` Action):

1. Role is verified in code (Layer 2, as above)
2. The step_run is updated: `status = 'completed'`, `approved_by = approverId`, `approved_at = NOW()`
3. `workflow_runs` is set to `status = 'running'`
4. The **executor is re-entered** starting from `current_step_index + 1` with the stored `context` from `workflow_runs.context`
5. If another `approval_gate` is hit downstream, the run pauses again

This design avoids polling/long-polling: the function executes synchronously (Hasura Action timeout = 300s), the DB is the source of truth for state, and the frontend uses a WebSocket subscription to observe changes. No separate job queue is needed.

**Cross-org safety on approval:** Even if an attacker discovers a `step_run_id` from Org A (e.g., via logs), calling `approveStep` with it will fail at the org membership check — the approver's user_id is not in Org A's `org_members`, so the handler returns 403 before touching any data.
