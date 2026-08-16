# Developer Control Center

Developer Control Center is a powerful desktop application built with React, Tauri, and Rust that provides an integrated environment to manage, start, and monitor various development projects (Spring Boot, React, Node.js...) via a graphical interface.

## Current Features
- Dashboard with System Health and Project Overview.
- Dynamic Project Cards showing Service Status and PID.
- In-memory Process State Management (Mock and Real).
- Real Process Spawning via Rust `tokio::process`.
- Async Log Streaming (stdout/stderr) with Circular Buffer.
- Realtime Terminal UI using DOM manipulation for high performance.
- Terminal Virtualization (DOM Pruning) and Toolbar features (Copy, Clear, Auto Scroll).

## Current Architecture
- **Frontend:** React, TypeScript, Tailwind CSS, Vite.
- **Backend:** Rust, Tauri.
- **Pattern:** Clean Architecture (Domain -> Application -> Infrastructure -> Presentation).
- **Communication:** Tauri IPC (Commands + Events) and Frontend EventBus.

## Build Status
- **Frontend:** PASS
- **Backend Rust:** PASS
- **Tauri:** PASS
- **Documentation:** UPDATED

## Current Milestone
✓ Process Lifecycle Management (Phase 4)

## Next Milestone
🟡 ANSI Color Parsing & Resource Monitoring (Phase 3C)

## Documentation Navigation
- [Architecture](architecture.md)
- [Setup](setup.md)
- [Roadmap](roadmap.md)
- [Decisions](decisions.md)
- [Desktop API](api/desktop-api.md)
- [Audit Reports](reports/desktop-audit.md)
- [Capability Tests](reports/capability-test.md)
- [AI Quota OAuth & RFC 7636 PKCE Report](reports/oauth_token_exchange_pkce_hardening_report.md)





