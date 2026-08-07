# Roadmap

## Current Phase
**Process Integration (Real Execution & Logging)**

## Next Phase
**Terminal UI & Resource Monitoring**

## Long-term Plan
**AI Assistant, Workspace Import & Automation Scheduler**

## Milestones
- [x] ✓ Initial Clean Architecture Scaffold
- [x] ✓ Mock Process Engine
- [x] ✓ Desktop Environment Audit
- [x] ✓ Desktop UI Polish Pass
- [x] ✓ Process Runtime Foundation
- [x] ✓ Real Process Execution (Phase 1)
- [x] ✓ Process Log Streaming (stdout/stderr)
- [x] ✓ Terminal UI & Interaction (Phase 3B)
- [ ] ⬜ CPU/RAM Resource Monitor
- [ ] ⬜ AI Integration
- [ ] ⬜ Workspace Import & Configuration



## Technical Debt Register
*(As per Refactoring Governance Rule R005)*

- [x] **Zombie Process:** (Resolved in Phase 4 via force_kill_process_tree)
- [ ] **ANSI Parser:** Logs are currently monochrome. Need to parse ANSI color codes in `TerminalRenderer`.
- [ ] **Terminal Virtualization:** Currently using basic DOM Pruning. If advanced features are needed, a more robust virtualization may be required.
- [ ] **IPC Batching:** If log streams exceed thousands of lines per second, IPC calls should be batched instead of emitting line-by-line.
- [ ] **Workspace Persistence:** Currently relying on mock or hardcoded state. Need SQLite/File persistence for project configurations.







