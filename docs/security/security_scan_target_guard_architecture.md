# Security Center — Scan Target Guard & Project Selection Architecture

## 1. Overview & Context

Before this update, selecting broad filesystem targets (such as entire drive roots `C:\`, `D:\`, or system folders `C:\Windows`) could result in dangerous, resource-intensive static security scans across millions of operating system files. Furthermore, selecting a workspace root containing multiple independent projects (e.g. `E:\Github project`) would attempt to scan the entire workspace as a monolithic target rather than prompting the user to select the specific project to analyze.

To solve this without modifying or destabilizing the core Security Scanner engine, a **pre-scan target validation / guard layer** and accompanying user interface modals were implemented.

---

## 2. Architecture & Core Invariant

```text
User selects folder via dialog / changes target
                      │
                      ▼
          validateAndApplyTarget()
                      │
                      ▼
       analyze_folder_scope_cmd (IPC)
                      │
                      ▼
            FolderSafetyGuard
        (Bounded BFS + Root Rules)
                      │
       ┌──────────────┼──────────────┐
       ▼              ▼              ▼
    BLOCKED       MULTIPLE (>1)   SAFE / SINGLE (1)
(Drive/Sys Root) (Multi-project)  (Normal Project)
       │              │              │
       ▼              ▼              ▼
  Show Modal:    Show Modal:    Accept target &
"Scan Target   "Multiple      sync with session
  Too Broad"     Projects"           │
       │              │              ▼
  Target Unchanged    │        Ready to Scan
 (Scanner untouched)  │              │
                      ▼              ▼
              User chooses 1   Run Security Scan
              project to scan (Untouched Core Scanner)
```

### Core Invariant
> **Add protection around Security Center, NEVER changes inside Security Scanner.**
>
> All core security scanner rules, scanner engines, severity calculation, finding models, scan histories, and background scan runners remain 100% untouched.

---

## 3. Implemented Components

### 3.1. `SecurityTargetTooBroadModal.tsx`
- **Location**: `src/features/security/components/SecurityTargetTooBroadModal.tsx`
- **Purpose**: Warns the user when an attempted scan target is a drive root (`C:\`, `D:\`, `E:\`), Unix root (`/`, `/bin`), or protected system path (`C:\Windows`, `Program Files`).
- **Behavior**:
  - Displays the attempted folder path and reasons.
  - Explains that security scans must target a specific project/workspace rather than an entire drive.
  - Actions:
    - `[Cancel]`: Closes modal and keeps the previous valid scan target intact.
    - `[Choose Folder]`: Re-opens the folder picker dialog.
  - **No scan is ever initiated**.

### 3.2. `SecurityMultiProjectModal.tsx`
- **Location**: `src/features/security/components/SecurityMultiProjectModal.tsx`
- **Purpose**: Displays a selection modal when a folder contains multiple independent projects (e.g. `E:\Github project`).
- **Behavior**:
  - Lists all discovered project candidates with their names, full paths, manifest types, and detected languages/frameworks (e.g., `Java / TypeScript`, `Spring Boot / React`).
  - Allows selecting exactly one project candidate.
  - Actions:
    - `[Choose another folder]`: Re-opens the folder picker.
    - `[Cancel]`: Closes modal without altering the current active scan target.
    - `[Scan Selected Project]`: Confirms the selected candidate as the new active scan target.

### 3.3. `SecurityOverview.tsx` (Integration Controller)
- **Location**: `src/features/security/pages/SecurityOverview.tsx`
- **Updates**:
  - `validateAndApplyTarget(selectedPath)`: Calls backend `analyze_folder_scope_cmd` before updating `selectedTarget` and `securityService`.
  - `handleStartScan()`: Added pre-scan safety check to guarantee blocked targets cannot be scanned even if triggered programmatically.
  - State preservation: Cancelling any modal leaves `selectedTarget` completely untouched.

---

## 4. Reused Discovery & Safety Guard Engine

The guard layer reuses the unified backend discovery engine in Rust:
- **Module**: `crate::pipeline::scope::FolderSafetyGuard` (`src-tauri/src/pipeline/scope.rs`)
- **IPC Command**: `analyze_folder_scope_cmd`
- **Capabilities**:
  - Immediate rejection of drive roots & system paths without filesystem traversal.
  - Bounded Breadth-First Search (BFS) discovery with strict safety budgets (file/dir limits, 3s timeout).
  - Multi-manifest detection (Node, Maven, Gradle, Rust, Python, Go, PHP, Ruby, .NET).
  - Module rollup & aggregation (nested `frontend/` and `backend/` directories under a parent project are grouped as a single project rather than fragmented).

---

## 5. Notes for Future Maintenance & Extension

1. **Do not bypass target validation**: If programmatic target setting or new UI shortcuts are added in the future, ensure they invoke `validateAndApplyTarget` or check `analysis.classification !== 'BLOCKED'`.
2. **Preserve existing state on cancellation**: When closing warning or selection modals, always preserve the user's previous active target.
3. **Keep scanner engine decoupled**: The `securityService` and Tauri security commands should remain focused purely on scanning. Target validation belongs in the orchestration/guard layer.
