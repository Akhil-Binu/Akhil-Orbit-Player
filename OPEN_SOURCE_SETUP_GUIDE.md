# Open-Source Project Setup & Complete Repository Specification

This reference manual documents all required and recommended setup fields, discoverability metadata, governance specifications, package configurations, and release workflows for **Orbit Player** (`teachable`).

---

## 1. Repository Creation Form Fields

| Field | Requirement | Document Guidance / Best Practice | Orbit Player Specification & Filled Value |
| :--- | :--- | :--- | :--- |
| **Repository Name** | Required | Short, memorable, lowercase, and hyphenated (e.g., `fast-api-validator`). Avoid generic names. | **`teachable`** (Public display identifier: **`akhil-orbit-player`**)<br>• Clean, memorable, lowercase, and directly identifies the course workstation. |
| **Owner** | Required | Your personal user account or an organization profile. | **`Akhil-Binu`**<br>• Personal profile: `https://github.com/Akhil-Binu`<br>• Optional future organization: `orbit-player-org`. |
| **Description** | Optional (Recommended) | A single concise sentence explaining what the project does and the problem it solves. | **`Ultra-fast, 100% private offline course player and media workstation supporting multi-track audio (VLC parity), document inspection, and zero remote data storage.`** |
| **Visibility** | Required | Must be set to Public for an open-source project. | **`Public`**<br>• Mandatory for public inspection, open collaboration, community issues, and forking. |
| **Add a README file** | Recommended | Check this box to initialize the repository with a README.md. | **`Enabled / Checked`**<br>• Initialized with root `README.md` containing architecture diagrams, feature matrix, and setup instructions. |
| **Add .gitignore** | Recommended | Select a preset template matching your language/environment (e.g., Node, Python, Rust, Go) to avoid committing logs, dependencies, and secrets. | **`Node` Template**<br>• Excludes `node_modules/`, `dist/`, `.env*`, `.DS_Store`, npm debug logs, and local browser cache directories. |
| **Choose a license** | Strongly Recommended | Open-source code legally requires an explicit license (e.g., MIT, Apache 2.0, or GPL-3.0) to grant others permission to use, modify, and share it. | **`MIT License`** (SPDX ID: `MIT`)<br>• Grants permissive community rights for personal and commercial adaptation while preserving copyright attribution. |

---

## 2. Discoverability & About Fields (Repository Settings)

These fields are configured in the **About** section (gear icon in the top right of the repository homepage):

### 2.1 Website URL
* **Field Value**: `https://akhil-orbit-player.vercel.app/`
* **Purpose**: Provides visitors with immediate one-click access to the production deployment running on edge infrastructure.

### 2.2 Topics / Tags
Add the following 10 targeted tags to maximize indexing in GitHub Explore and Topic search:
1. `video-player` — Identifies the HTML5 and custom container media player.
2. `audio-tracks` — Surfaces the multi-audio track demuxing capability.
3. `vlc-parity` — Highlights support for multi-language release group containers.
4. `matroska` — Identifies EBML container parsing for `.mkv` files.
5. `offline-first` — Indexes the zero-network offline architecture.
6. `client-side` — Signals 100% local processing with zero server uploads.
7. `course-player` — Targets learners, students, and educators.
8. `pdf-viewer` — Identifies embedded PDF.js canvas rendering.
9. `react19` — Tags modern React 19 component stack.
10. `typescript` — Tags strict type-safe codebase.

### 2.3 Include in Home / Releases Checkboxes
* [x] **Releases**: Checked. Displays the latest release (`v1.2.0`), release notes, and download packages in the sidebar.
* [x] **Packages**: Checked. Surfaces published packages (npm or GitHub Package Registry).
* [x] **Environments**: Checked. Shows the live deployment status of the Vercel production environment.

---

## 3. Core Open-Source Configuration & Governance Files

| Governance File | Location | Content Specification & Implementation Details |
| :--- | :--- | :--- |
| **README.md** | `/README.md` | Primary project storefront. Includes project overview, live demo and release badges, architecture flowcharts, VLC-parity audio parsing details, document engine notes, quickstart instructions (`npm run dev`), and keyboard shortcut tables. |
| **LICENSE** | `/LICENSE` | Explicit open-source license attribution granting permissive community reuse under the MIT terms with copyright credited to Akhil Binu (2026). |
| **CONTRIBUTING.md** | `/CONTRIBUTING.md` | Comprehensive contributor onboarding. Details prerequisites (Node 18+), local installation, mock course generator (`node generate_mock_course.cjs`), directory layout, coding conventions, and PR testing requirements. |
| **CODE_OF_CONDUCT.md** | `/CODE_OF_CONDUCT.md` | Community standards establishing a respectful, collaborative, and inclusive environment with an explicit contact address (`AkhilBinuRoom@gmail.com`) for reporting issues. |
| **SECURITY.md** | `/SECURITY.md` | Vulnerability disclosure policy. Documents the client-side zero-telemetry threat model, supported release lines (`1.1.x`), and private disclosure procedures with a 48-hour initial response SLA. |
| **Issue Templates** | `/.github/ISSUE_TEMPLATE/` | Standardized forms for incoming issues: `bug_report.md` (capturing OS, browser engine, media container type, and error logs) and `feature_request.md` (capturing capability pitches and use cases). |

---

## 4. Package Manifest Metadata (`package.json`)

The project's `package.json` contains full package metadata required for open-source discoverability and registry publication:

```json
{
  "name": "teachable",
  "version": "1.2.0",
  "description": "Ultra-fast, 100% private offline-first course player and media workstation",
  "author": "Akhil Binu <AkhilBinuRoom@gmail.com>",
  "contributors": [
    "Akhil Binu <AkhilBinuRoom@gmail.com>"
  ],
  "license": "MIT",
  "homepage": "https://akhil-orbit-player.vercel.app/",
  "repository": {
    "type": "git",
    "url": "https://github.com/Akhil-Binu/teachable.git"
  },
  "bugs": {
    "url": "https://github.com/Akhil-Binu/teachable/issues"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "keywords": [
    "orbit-player",
    "course-player",
    "video-player",
    "multi-track-audio",
    "vlc-parity",
    "matroska",
    "mp4-demuxer",
    "pdfjs",
    "react19",
    "typescript"
  ]
}
```

---

## 5. Releasing the First Package & Creating Releases

### 5.1 Git Tagging
Follow Semantic Versioning (`MAJOR.MINOR.PATCH`):
* **Major**: Incompatible breaking architectural changes.
* **Minor**: Backward-compatible new functionality (e.g. `v1.2.0` Encrypted Course Container `.orbit` engine).
* **Patch**: Backward-compatible bug fixes (e.g. `v1.1.5` Mark as Completed button & lesson progress controls).

Create and push an annotated git tag:
```bash
git tag -a v1.2.0 -m "Release v1.2.0 - Encrypted Course Container (.orbit) & In-Memory Decryption"
git push origin v1.2.0
```

### 5.2 GitHub Release Creation
Create a structured release on GitHub to distribute production assets and inform users:
1. Navigate to **Releases** > **Draft a new release**.
2. Select tag **`v1.2.0`** and target branch **`main`**.
3. Set Title: `v1.2.0 - Encrypted Course Container (.orbit) & In-Memory Decryption`.
4. Provide structured release notes:
   - **Overview**: Brief summary of improvements.
   - **Fixes**: Details of container parsing upgrades (EBML SeekHead resolution, MP4 atom parsing).
   - **UI Enhancements**: Expanded audio track selection menu with release group labels.
   - **Verification**: Cross-browser testing and CI status.
5. Attach distribution build artifacts (`dist.zip` generated via `npm run build`).
6. Click **Publish release**.

Alternatively, create the release directly via GitHub CLI:
```bash
gh release create v1.1.4 \
  --title "v1.1.4 - Fix MKV SeekHead & Multi-Audio Stream Detection (VLC Parity)" \
  --notes "Resolves EBML SeekHead parsing to detect all embedded audio tracks matching VLC."
```

### 5.3 Publishing to Package Registries (npm / GitHub Packages)
To distribute components to npm:
1. Verify clean production compilation:
   ```bash
   npm run build
   ```
2. Preview the publication tarball to ensure test files and mock courses are omitted:
   ```bash
   npm pack --dry-run
   ```
3. Authenticate with npm:
   ```bash
   npm login
   ```
4. Publish the package:
   ```bash
   npm publish --access public
   ```
5. For automated CI/CD publication, configure an `NPM_TOKEN` secret in GitHub Repository Settings (`Settings` > `Secrets and variables` > `Actions`) and trigger publishing automatically on release publication.
