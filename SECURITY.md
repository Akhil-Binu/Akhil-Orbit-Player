# Security Policy

## Core Privacy Architecture

Orbit Player is engineered from the ground up to operate with zero server-side transmission:
* **Zero Remote Telemetry**: All course files, audio tracks, subtitles, notes, and progress metrics stay completely on the user's local device.
* **In-Browser Processing**: Media container parsing, document rendering, and archive extraction execute strictly within the browser sandbox.
* **Storage Isolation**: Local notes and course bookmark data reside exclusively in browser-scoped IndexedDB and `localStorage`.

---

## Supported Versions

Security updates and critical defect patches are actively applied to the following release line:

| Version | Supported |
| :--- | :--- |
| `1.1.x` | Yes |
| `< 1.1.0` | No (Please update to latest release) |

---

## Reporting a Security Vulnerability

If you discover a security concern, cross-site scripting (XSS) vulnerability in document parsing, or memory isolation flaw in Orbit Player:

1. **Do not create a public issue**.
2. Email full diagnostic details, reproduction steps, and proof-of-concept material directly to the maintainer:
   * **Contact**: `AkhilBinuRoom@gmail.com`
   * **Subject**: `[SECURITY VULNERABILITY] Orbit Player - <Brief Description>`
3. Include information on your operating system, browser engine and version, and sample media/document format involved.

### Response Timeline
* **Initial Acknowledgment**: Within 48 hours of receipt.
* **Triage & Reproduction**: Within 5 business days.
* **Patch Release**: Released via GitHub as a hotfix version once resolved and verified.
