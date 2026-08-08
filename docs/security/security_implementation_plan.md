# Security Center Implementation Plan

**Target**: Developer Control Center (DCC)
**Date**: 2026-08-08

## Overview
This roadmap outlines the systematic rollout of the Developer Control Center Security Scanner. The implementation adheres strictly to Clean Architecture, decoupling the scanning engines in Rust from the React presentation layer, ensuring high-performance async I/O.

## Phase 1: Security Architecture & Domain Foundations
- **Scope**: Define domain models, IPC event structures, and the core Rust `SecurityScanEngine` scaffolding.
- **Tasks**:
  - Define `SecurityFinding`, `SecuritySeverity`, `SecurityCategory` in TypeScript and Rust.
  - Create the `SecurityScanner` trait in Rust.
  - Implement `SecurityScanEngine` with Tokio task spawning and CancellationToken support.
  - Implement the Tauri command `start_security_scan(project_id)`.
  - Establish the `emit_all` IPC bridge for typed events (`SecurityScanStarted`, `SecurityFindingDetected`).
- **Dependency**: None.

## Phase 2: Secret Scanner Core
- **Scope**: Implement regex-based and entropy-based secret detection.
- **Tasks**:
  - Create `SecretScanner` implementing the `SecurityScanner` trait.
  - Add logic to scan `.env`, `application.yml`, config files, and standard code extensions.
  - Implement pattern matching for API Keys, AWS credentials, JWTs, and Private Keys.
  - Implement Evidence Redaction (e.g. `sk_live_********6789`) to prevent logging secrets in plaintext.
- **Dependency**: Requires Phase 1 (Engine).

## Phase 3: Dependency Scanner Foundations
- **Scope**: Detect and parse dependency manifests without network calls.
- **Tasks**:
  - Create `DependencyScanner`.
  - Implement parsing for `package.json` and `pom.xml`.
  - Detect outdated versions or usage of known deprecated packages via static rule mapping (Phase 3 will not yet query OSV/NPM Audit).
- **Dependency**: Requires Phase 1 (Engine).

## Phase 4: Configuration & Environment Scanner
- **Scope**: Identify insecure settings or misconfigurations.
- **Tasks**:
  - Create `ConfigurationScanner`.
  - Analyze YAML/JSON files for common misconfigurations (e.g. `debug: true`, permissive CORS, disabled CSRF).
- **Dependency**: Requires Phase 1 (Engine).

## Phase 5: Git Security Interface
- **Scope**: Lay the groundwork for scanning version control history.
- **Tasks**:
  - Create `GitSecurityScanner` trait/abstraction.
  - Implement basic `.gitignore` awareness for the main file walker to optimize scan speed.
  - (Full Git history parsing deferred to later iteration).
- **Dependency**: Requires Phase 1 (Engine).

## Phase 6: Permission Scanner
- **Scope**: Analyze sensitive file permissions.
- **Tasks**:
  - Create `PermissionScanner`.
  - Check file masks of SSH keys, configuration files, or build artifacts to ensure they are not universally readable/writable.
- **Dependency**: Requires Phase 1 (Engine).

## Phase 7: Security Dashboard & UI
- **Scope**: Build the React interface for viewing security findings.
- **Tasks**:
  - Add `🔐 Security` to the main sidebar routing.
  - Build `SecurityOverview` displaying total counts by severity.
  - Build the `SecurityScoreCalculator` abstraction (rendering "Not Evaluated" initially).
  - Implement live progress bars connecting to the IPC events.
- **Dependency**: Requires Phase 1 (Domain/IPC definitions).

## Phase 8: AI Security Analyst
- **Scope**: Integrate LLM evaluation of findings.
- **Tasks**:
  - Send sanitized findings to the AI for remediation advice and deep-context analysis.
- **Dependency**: Requires Phase 7 (UI) and Phase 2-4 (Findings).

---
**Status**: PENDING APPROVAL.
