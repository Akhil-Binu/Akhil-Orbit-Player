# Developer Contribution Guidelines

Welcome to Orbit Player! We welcome community contributions to help improve our client-side media player and document workstation.

---

## 1. Local Development Setup

### Prerequisites
* Node.js (version 18 or higher)
* npm (version 9 or higher)
* A modern browser supporting File System Access API (Chrome, Edge, Chromium)

### Installation Steps
1. Fork and clone the repository:
   ```bash
   git clone https://github.com/Akhil-Binu/teachable.git
   cd teachable
   ```
2. Install project dependencies:
   ```bash
   npm install
   ```
3. Start the local development server:
   ```bash
   npm run dev
   ```
4. Generate a synthetic test course to verify local playback:
   ```bash
   node generate_mock_course.cjs
   ```
   Load the generated `mock_course` directory using the folder picker in the player interface.

---

## 2. Project Architecture & Directory Layout

* `src/components/`: Primary UI modules (VideoPlayer, PDFViewer, OfficeViewer, ArchiveViewer, Sidebar, NotesPanel).
* `src/utils/mediaMetadata.ts`: Low-level container demuxers (MP4 ISO box parsing, Matroska EBML scanner).
* `src/utils/fileSystem.ts`: File System Access API wrappers and folder tree indexers.
* `src/utils/storage.ts`: IndexedDB and localStorage persistence managers for notes and timestamps.
* `src/types/`: TypeScript interface definitions for courses, lectures, media tracks, and notes.

---

## 3. Coding Standards & Conventions

* **TypeScript**: Strict type checking is enforced across all components. Avoid using `any`.
* **State Management**: Prefer local component state and React hooks (`useMemo`, `useCallback`, `useRef`) for performance-sensitive rendering.
* **Component Styling**: Use Tailwind CSS utility classes. Maintain responsive layout constraints and dark-mode styling.
* **Client-Side Privacy**: All processing must remain strictly on the user's machine. Do not introduce any network tracking or remote telemetry calls.

---

## 4. Verification & Testing

Before submitting your changes, execute the build verification:
```bash
npm run build
npm run lint
```
Ensure that TypeScript compiles without warnings and Vite builds the distribution bundle cleanly.

---

## 5. Pull Request Submission

1. Create a descriptive feature branch:
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. Write concise, imperative commit messages:
   ```bash
   git commit -m "feat: add support for WebVTT cue styling"
   ```
3. Push to your fork and submit a Pull Request against the `main` branch.
4. Fill in the provided Pull Request template with testing details and screenshots.
