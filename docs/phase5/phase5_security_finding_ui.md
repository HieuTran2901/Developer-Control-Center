# Phase 5 Step 3: Security Finding UI

## 1. UI Structure
The Security Center UI (`SecurityActiveFindings.tsx`) has been refactored to cleanly distinguish between Dependency findings and other security findings (Secrets, Configuration).
When a finding is identified as a `DEPENDENCY` (either via category or metadata type), it now uses a dedicated, highly structured presentation layout optimized for dependency vulnerabilities.

## 2. Dependency Finding Presentation
The dependency vulnerability card is organized into strict logical sections, prioritizing clarity and reducing visual clutter:
- **Summary**: The OSV `description` is displayed immediately as the first readable text.
- **Affected Dependency**: Ecosystem, Package name, and Version are displayed in a compact, scan-friendly grid.
- **Vulnerability**: Primary `vulnerabilityId` and any `aliases` (e.g. CVEs) are explicitly displayed.
- **Fixed Version**: Distinct display of the `fixedVersion` if provided.
- **Location**: The project path where the vulnerability was detected, truncated defensively but fully readable via tooltip.
- **Why it matters**: The full OSV `details` (markdown/text) is rendered within a safe, scrollable container (`max-h-60 whitespace-pre-wrap break-words`).
- **References**: Actionable, safely truncated links to OSV databases or advisories (domain names extracted).
- **Remediation**: The backend-generated recommended action.

## 3. Missing Metadata Behavior
- **Fixed Version**: If OSV provides no verified fixed version (or the backend cannot extract one), the UI displays a neutral italicized state: *"No verified fixed version provided by OSV."* rather than inventing a fix.
- **Aliases/References**: If no aliases or references are provided, their respective sections are entirely omitted (hidden) to save space.
- **Primary ID**: Fallbacks to 'N/A' if missing, though the backend guarantees an ID.
- **Details**: Falls back to the standard finding `description` if `details` is omitted.

## 4. Responsive Behavior
The Security Center UI uses standard Tailwind breakpoints (`md:grid-cols-2`) to reflow finding cards correctly at various viewports (1024x768 through 1920x1080):
- Uses `min-w-0`, `break-words`, `break-all`, and `truncate` to prevent horizontal overflow from long Windows paths or massive package names.
- References use `flex-wrap` and `max-w-[200px]` truncation to prevent buttons from overflowing the container.
- Horizontal scrolling is completely eliminated at the `SecurityOverview` level, isolating scrollbars strictly to the OSV details container (`max-h-60 overflow-y-auto`).

## 5. Secret/Configuration Compatibility
The implementation uses a strict conditional branch (`isDependency && meta`). All existing Secret and Configuration finding logic is preserved within the `else` block, ensuring no regressions. Secret evidence remains safely redacted and presented identically to Phase 4.

## 6. Accessibility Considerations
- Links use `target="_blank" rel="noopener noreferrer"`.
- Badges and cards use semantic hierarchy (`<h4>` titles for sections).
- Text contrast ratios remain compliant with the current theme (`text-muted-foreground` and standard `bg-surface`).
- Focus states and keyboard navigability are inherited from the existing button/link implementations.
- Color alone is not used to denote severity; text labels explicitly state the severity level.

## 7. Known Limitations
- The OSV `details` text often contains markdown formatting. Without a dedicated markdown parser (e.g., `react-markdown`), the UI renders it as pre-formatted text (`whitespace-pre-wrap`). This is acceptable and readable, but lists or code blocks will render as raw characters.
- Long contiguous strings in `details` are forcibly broken (`break-words`) to prevent horizontal overflow, which might slightly misalign ascii art or strict tabular data in advisories.
