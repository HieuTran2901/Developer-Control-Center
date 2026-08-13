# Phase 0: Project Intelligence & AI Pipeline Generator Audit

## 1. Current Architecture
- **Frontend Generator**: `PipelineGenerator.tsx` located in `src/features/cicd/components/`. It relies on `usePipelineContext` to fetch `selectedProject`. It features a simple text area for `userIntent` and a dropdown for `platform`.
- **Backend Command**: `generate_pipeline_cmd` in `src-tauri/src/commands/pipeline_cmds.rs`. It takes `user_intent` and `project_root_path`.
- **Project Scanner**: Basic scanner at `src-tauri/src/pipeline/discovery.rs` (`ProjectScanner::scan`). It naively checks for `package.json`, `Cargo.toml`, and `pom.xml`.
- **AI Planner**: `src-tauri/src/ai/planner.rs` parses the project context into a system prompt string, sends it to the LLM alongside the `userIntent`, validates the returned JSON, runs policy checks, and stores it in the history store.

## 2. Existing Reusable Components
- **PipelineContext**: Manages `selectedProject`. Can be reused to supply the workspace path.
- **Tabs/Layout**: Recent fixes in `CICDOverview.tsx` and `tabs.tsx` ensure the layout works. We must keep the generator inside `TabsContent value="pipelines"` without breaking layout.
- **PolicyEngine & HistoryStore**: Already fully integrated inside `generate_pipeline_cmd`. We must reuse this logic entirely.
- **Tauri IPC**: Uses `invoke<any>('generate_pipeline_cmd', ...)` to get the generated pipeline and security preview.

## 3. Data Flow
1. User clicks "Generate Pipeline" in UI.
2. `PipelineGenerator.tsx` invokes `generate_pipeline_cmd`.
3. Rust backend validates project root.
4. `ProjectScanner` returns `ProjectContext`.
5. `ai::planner::generate_pipeline` merges `ProjectContext` + `user_intent` into a prompt.
6. AIGateway queries LLM -> JSON Pipeline IR.
7. Validation & Policy Preview.
8. HistoryStore saves version.
9. Return to Frontend -> Render `PipelinePreview`.

## 4. Security Boundaries
- The AI should ONLY receive a sanitized `ProjectContext` (structured schema), NOT raw files or secrets.
- `.env`, `.git`, `node_modules`, `target` MUST be ignored during filesystem scan.
- Output pipeline is rigorously checked by PolicyEngine. Do NOT bypass this.

## 5. UI Layout Constraints & Scroll Ownership
- **Viewport-First**: The new UI must fit most content in the viewport.
- **Scroll Ownership**: The main application manages global scroll. The generator should NOT introduce deep nested scrolling unless necessary for a specific panel (like a file tree).
- **Tabs**: `TabsContent` is constrained by `flex-1 min-h-0 overflow-hidden`. The generator itself should fit neatly in this space.

## 6. Recommended Architecture
- **Backend Upgrade**: Enhance `ProjectScanner` in `discovery.rs` to detect tools, tests, CI files, and build commands. Return a `ProjectIntelligence` struct.
- **Command Update**: Update `generate_pipeline_cmd` or introduce a new command to explicitly return `ProjectIntelligence` so the UI can render it.
- **Frontend Upgrade**: Redesign `PipelineGenerator.tsx` into a compact dashboard. Provide options to select a local folder. Introduce a scan step before generation to display intelligence to the user.
