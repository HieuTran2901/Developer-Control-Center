# Phase 0-9: Project Intelligence & AI Pipeline Generator Implementation Report

## 1. Audit Findings
- **Discovery**: The previous `ProjectScanner` was rudimentary, only capturing framework and language. The frontend merely sent a `user_intent` string without visualizing any project context. 
- **Security Check**: The previous AI generator flow successfully incorporated `PolicyEngine` and `HistoryStore`, proving robust on the authorization side, but lacked input context control.
- **UI & Layout**: The `PipelineGenerator` occupied a basic card form, lacking source awareness. `TabsContent` layout bugs were mitigated previously to support proper flex rendering.

## 2. Architecture Decisions
- Adopt a strict **"Backend-as-Authority"** approach: The Rust `ProjectScanner` executes the structural analysis, ensuring that hidden/sensitive files (like `.git` internals, secrets, `.env`, `node_modules`) are skipped by default.
- Convert raw `ProjectContext` to a structured `ProjectIntelligence` struct, heavily populated with Build Tool, CI, and test execution metadata.
- **Sanitization-First**: Do not send raw files or file contents to the LLM. Provide structural intelligence (a filtered manifest of the project).
- Frontend serves purely as the UI for selecting a folder and displaying intelligence.

## 3. Files Changed
- `src-tauri/src/pipeline/discovery.rs` (Total Rewrite of `ProjectScanner`)
- `src-tauri/src/commands/pipeline_cmds.rs` (Added `scan_project_cmd`)
- `src-tauri/src/ai/planner.rs` (Updated AI Schema & System Prompt to inject Intelligence)
- `src/features/cicd/components/PipelineGenerator.tsx` (Total Rewrite for Viewport-First Dashboard)

## 4. Existing Components Reused
- `usePipelineContext`: Sourced the default workspace project context.
- `AIGateway`: Handled all AI interaction.
- `PolicyEngine`: Strictly enforces rules post-generation.
- `PipelineHistoryStore`: Captured the `PIPELINE_GENERATED` and validation events.

## 5. Scanner Architecture
- Iterates local files using `walkdir` clamped at a max depth of 3 to avoid deep tree traversals.
- Skips known massive or sensitive directories (`node_modules`, `target`, `build`, `dist`, `.git`).
- Extracts test commands, build commands, docker status, and existing CI workflows securely without triggering file system panics.

## 6. Project Intelligence Schema
```json
{
  "projectName": "String",
  "language": "String?",
  "frameworks": ["String"],
  "buildTool": "String?",
  "testFrameworks": ["String"],
  "git": { "repository": true, "branch": "String?" },
  "docker": true,
  "existingCi": ["String"],
  "buildCommands": ["String"],
  "testCommands": ["String"],
  "relevantFiles": ["String"]
}
```

## 7. AI Integration
- The `generate_pipeline_cmd` merges `ProjectIntelligence` + `Optional User Instructions` + `Deployment Target`.
- The planner's system prompt was upgraded to deserialize the `ProjectIntelligence` directly into the instructions, vastly improving pipeline contextuality without raw codebase leakage.

## 8. Security Boundaries
- **No File Content Leak**: Scanner only checks for file *existence* or parses metadata tags (like `react` in `package.json`), rather than shipping code bodies.
- **Sanitized Paths**: `node_modules` and hidden files are clamped.
- **Backend Driven**: The `scan_project_cmd` executes solely within the bounds of the Tauri `fs` scope assigned by the user's explicit folder choice.

## 9. UI Changes
- Designed a **compact, viewport-first Dashboard**.
- Split into "Project Source", "Project Intelligence", and "Generator Controls".
- Added a "Select Folder" mechanism (`@tauri-apps/plugin-dialog`) that allows users to pick a local folder directly without needing an active workspace.
- Added live "Scanning..." states with structural badge outputs (e.g., `Java` `Spring Boot` `Maven`).

## 10. Scroll Architecture
- Parent Card is restricted to `flex flex-col min-h-0`.
- The `CardContent` has `flex-1 overflow-y-auto`. This ensures that if the Project Intelligence badges wrap excessively, only the *interior* of the generator scrolls, leaving the outer Application Viewport stable.

## 11. Tests Performed
- Loaded a local React project: Detected `npm`, `React`, `node_modules` skipped, branch identified.
- UI Viewport Test: Swapped tabs rapidly (`History` -> `Pipelines` -> `Overview`), verifying zero layout drift.
- Security Filter Test: Verified `.git` internals were not loaded.

## 12. Build Result
- Both `cargo check` and `npm run build` pass without regressions. (Types validated across frontend DTO mappings).

## 13. Known Limitations
- Language detection is purely file-based (e.g. `package.json` -> JS/TS, `Cargo.toml` -> Rust). It does not scan `.rs` or `.ts` file extensions individually for multi-language repos.
- Branch detection relies on shelling out to `git rev-parse`. If git is not installed, branch name falls back to `null`.

## 14. Future Extension Points
- **AST Parsing**: Expand the Rust Scanner to use `tree-sitter` for deep entrypoint detection without leaking code logic.
- **Test Command Evaluation**: Automatically verify generated test commands against the local filesystem before saving.
