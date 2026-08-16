# Security Center — Phase 3C-2: Security Scan Plan UI Observability & Review

## 1. Overview
In Phase 3C-2, the **Security Center** was enhanced to make the backend deterministic `SecurityScanPlan` observable and understandable directly in the user interface.

- **Component**: [`src/features/security/components/SecurityScanPlanCard.tsx`](file:///E:/Github%20project/Developer-Control-Center/src/features/security/components/SecurityScanPlanCard.tsx)
- **Container**: [`src/features/security/pages/SecurityOverview.tsx`](file:///E:/Github%20project/Developer-Control-Center/src/features/security/pages/SecurityOverview.tsx)
- **Role**: Pure Informational Renderer (Observability only — no manual overrides or capability toggles in UI).

---

## 2. Architecture & Data Flow

```
   Project Discovery (ProjectScanner)
               │
               ▼
   SecurityProjectContext
               │
               ▼
   SecurityScanPlanner (Rust)
               │
               ▼
   SecurityScanPlan (IPC: get_security_scan_plan_cmd)
               │
               ▼
   React SecurityScanPlanCard (Observability Renderer)
```

1. **Single Source of Truth**:
   - `ProjectScanner`: Discovers project metadata (languages, frameworks, build tools, package managers, manifests, Git).
   - `SecurityScanPlanner`: Deterministically plans capabilities and OSV dependency targets based on scan mode (`QUICK`, `GIT_EXPOSURE`, `FULL`).
   - `SecurityEngine`: Executes scans using the plan.
   - `SecurityScanPlanCard`: Purely renders the backend-generated plan without calculating or duplicating planning rules in frontend.

2. **Project & Mode Synchronization**:
   - When the user changes project target, `scanPlan` is immediately reset to prevent displaying stale metadata while fetching the new plan.
   - When the user changes scan mode (`QUICK` ↔ `GIT_EXPOSURE` ↔ `FULL`), `getScanPlan` is invoked with the updated mode and the UI updates in real-time.

---

## 3. UI Information Architecture

### A. Scan Plan Header
- Title with icon and scan mode badge (`QUICK`, `GIT_EXPOSURE`, `FULL`).
- Target project name and path badge with normalized path.
- Architecture type (`Single project`, `Monorepo`, `Workspace`, `Standard`).
- Git repository status indicator (`Git Repo` / `Non-Git`).
- Mode description explaining the scope of analysis.

### B. Project Intelligence Badges
- **Languages**: Badges for detected languages (or `Unknown`).
- **Frameworks**: Badges for detected frameworks (or `Not detected`).
- **Build & Package Tools**: Badges for build tools and package managers (or `Not detected`).
- **Manifests**: Badges for discovered manifest files (e.g. `package.json`, `pom.xml`, `Cargo.toml`).

### C. Scan Capabilities Grid
- **Secrets**: `✓ Enabled` / `— Not included`
- **Configuration**: `✓ Enabled` / `— Not included`
- **Dependencies**: `✓ Enabled` (shows number of OSV manifest targets) / `— Not included`
- **Git Exposure**: `✓ Enabled` / `— Not included` / `— Not available` (when project is not a Git repo)

### D. Planning Details & Notes
- List of OSV dependency targets (e.g. `package.json (npm)`).
- Backend deterministic planning notes from `SecurityScanPlanner`.

### E. Safe States
- **No Target Selected**: Informative empty state prompting project selection.
- **Loading State**: Non-blocking spinner (`Analyzing Project...`).
- **Error State**: Non-blocking warning banner (`Scan Plan Unavailable`).

---

## 4. Verification & Validation

- `cargo check --manifest-path src-tauri/Cargo.toml`: **PASS** (0 errors).
- `npm run build`: **PASS** (0 TypeScript / Vite build errors).
- **Regression Protection**: Zero modifications to scanner detection logic, process execution, folder safety guards, or CI/CD pipelines.
