# DEVONN.AI — Autonomous GitHub Operating System

## 1) GitHub Project setup

Create a GitHub Project with this name:

- **DEVONN.AI | Controlled Autonomy System**

Columns:

- 🔴 Backlog
- 🟠 Ready
- 🟡 In Progress
- 🟢 In Review
- 🔵 Done
- ⚠️ Blocked

Automation rules to configure in GitHub Projects:

- New issue → 🔴 Backlog
- Label `critical` → 🟠 Ready
- PR opened → 🟡 In Progress
- PR merged → 🔵 Done

---

## 2) Prebuilt issue import list

### 🔴 Phase 1 — Stabilization

1. **Fix Build Pipeline (CRITICAL)**
   - Run `npm run build` locally, identify first error, fix root cause, ensure CI passes.
   - Labels: `critical`, `phase-1`

2. **Clean Repo Structure**
   - Remove Python/root clutter, organize into `apps/server/packages/infra` structure.
   - Labels: `phase-1`

3. **Dependency Reset**
   - Delete `node_modules` and `package-lock.json`, reinstall dependencies cleanly, lock Node 20.
   - Labels: `bug`, `phase-1`

4. **CI Alignment**
   - Make GitHub Actions match local environment exactly (Node version + build steps only).
   - Labels: `critical`, `phase-4`

### 🟠 Phase 2 — Structure Hardening

5. **Modular Architecture Setup**
   - Create `apps/web`, `server`, `packages/shared`, `infra` directories.
   - Labels: `phase-2`

6. **AI Agent Layer Extraction**
   - Move all agent logic into `server/agents` and define base agent interface.
   - Labels: `agent-system`

7. **API Layer Standardization**
   - Consolidate all API routes under `server/api` and normalize request formats.
   - Labels: `phase-2`

### 🟡 Phase 3 — Controlled Automation

8. **GitHub Projects Setup**
   - Enable Kanban board with automation rules and issue lifecycle tracking.
   - Labels: `infra`

9. **Label System Setup**
   - Create labels: `critical`, `bug`, `enhancement`, `agent:planner`, `agent:debug`, `agent:deploy`.
   - Labels: `infra`

10. **CI Watchdog (SAFE MODE)**
    - Create GitHub Action that only opens issues when CI fails.
    - Labels: `critical`

### 🔵 Phase 4 — Agent System

11. **Agent Router System**
    - Auto-assign labels based on issue type (debug/planner/deploy).
    - Labels: `agent-system`

12. **Agent Registry Core**
    - Create centralized registry for AI agents and execution roles.
    - Labels: `agent-system`

---

## 3) Phased roadmap

- 🔴 Phase 1 (Now): Fix build, get CI green, clean repo
- 🟠 Phase 2: Structure repo, modularize system
- 🟡 Phase 3: Add automation (watchdog + labels)
- 🔵 Phase 4: Enable agent routing
- 🟣 Phase 5 (Future): Full autonomous PR fixing loop

---

## 4) Execution order

1. Run `npm run build`
2. Fix first error only
3. Create GitHub Project board
4. Paste issues
5. Add workflows
6. Push to activate system
