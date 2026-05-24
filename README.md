# ✨ Akhil Orbit Player

[![Live Demo](https://img.shields.io/badge/Live%20Demo-https%3A%2F%2Fakhil--orbit--player.vercel.app%2F-indigo?style=for-the-badge&logo=vercel)](https://akhil-orbit-player.vercel.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

**Akhil Orbit Player** is a modern, premium, private client-side web application designed to load, organize, and play educational courses directly from your local device disk. Built with privacy and speed in mind, all operations happen entirely in your browser—**no files are ever uploaded to any server.**

🎥 **Explore the Live App:** [https://akhil-orbit-player.vercel.app/](https://akhil-orbit-player.vercel.app/)

---

## 🚀 Key Features

*   **📂 True Local Folder Loading**: Leverages the browser's advanced **File System Access API** (`showDirectoryPicker`) to read folder files on-demand. Features a universal **Directory Upload Fallback** (`webkitdirectory`) for browsers like Firefox and Safari.
*   **🎬 Custom Video Controls**: Premium HTML5 media player wrapper with support for customizable playback speeds (0.5x to 3x), Picture-in-Picture, full keyboard shortcuts, and autoplay next lesson queues.
*   **💬 Closed Captions & Transcripts**:
    *   Automatically parses and matches `.vtt` caption tracks to video files sharing the same base name.
    *   Compiles standalone `.vtt` caption files on-the-fly to beautiful, readable **HTML transcription sheets** inside sandboxed portals.
*   **📝 Interactive HTML Quizzes**: Safely renders local `.html` lessons, resources, and interactive quizzes in sandboxed frames (supports standard forms and submissions).
*   **🔗 Internet Shortcut Portals**: Parses Windows `.url` files and text shortcuts to present a premium link portal with iframe previews and quick-tab opening buttons.
*   **📓 Markdown Notes Editor**: Integrated rich note-taking editor allowing students to type lesson notes in Markdown and preview rendered HTML. Automatically saves notes to `localStorage` and supports exporting files as `.md`.
*   **📌 Video Timestamp Bookmarking**: Add bookmark logs at specific timestamps while watching a lecture. Click any bookmark to seek the video player to that exact time.

---

## 🛠️ Technology Stack

*   **Core Logic**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
*   **Build Tool**: [Vite 8](https://vite.dev/)
*   **Iconography**: [Lucide React](https://lucide.dev/)
*   **Styling**: Pure CSS (Harmonious obsidian dark theme, dynamic glassmorphic gradients, thin custom scrollbars, and hover animations).

---

## 💻 Getting Started Locally

Follow these instructions to run the project on your local machine:

### 1. Prerequisite
Ensure you have [Node.js](https://nodejs.org/) installed (LTS version recommended).

### 2. Install Dependencies
Clone the repository and run:
```bash
npm install
```

### 3. Run Development Server
```bash
npm run dev
```
Open **[http://localhost:5173/](http://localhost:5173/)** in your browser.

### 4. Create a Mock Course Folder (Optional)
To test all player features instantly, generate a mock offline course with markdown sheets, quizzes, videos, captions, and links:
```bash
node generate_mock_course.cjs
```
This will create a `mock_course/` folder in your project root. Open the web app, click **Select Course Folder**, and select this folder to inspect the sample data!

---

## 🔒 Absolute Privacy Guarantee
Because **Akhil Orbit Player** operates entirely client-side:
- **Zero network uploads** for your course material.
- **Local storage** holds your bookmarks, completion tracking, and note entries.
- High-definition videos load and seek instantly without loading bottlenecks.

---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
