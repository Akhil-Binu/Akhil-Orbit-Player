const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, 'mock_course');

function createFolder(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created folder: ${dir}`);
  }
}

function createFile(filePath, content) {
  fs.writeFileSync(filePath, content.trim(), 'utf8');
  console.log(`Created file: ${filePath}`);
}

// 1. Create directory structure
createFolder(targetDir);
createFolder(path.join(targetDir, '01_Welcome & Getting Started'));
createFolder(path.join(targetDir, '02_Core Mechanics'));
createFolder(path.join(targetDir, '03_Advanced Options'));

// 2. Create Welcome Files
createFile(
  path.join(targetDir, '01_Welcome & Getting Started', '1.1 - Welcome to Akhil Orbit Player.md'),
  `
# Welcome to Akhil Orbit Player! 🚀

This is a **Markdown (.md)** lesson file loaded directly from your local device disk. 

Akhil Orbit Player allows you to browse courses completely offline and client-side. No files are uploaded to any server.

## Features to Explore:
1. **Dynamic Sidebar**: Check off lessons as you complete them. Watch the circular progress bar react!
2. **Notes Editor**: Toggle the tab on the right to "Notes" to jot down thoughts for this lesson. Notes auto-save in your browser's \`localStorage\` and can be exported as a \`.md\` file.
3. **Advanced Queue**: When you finish a video (or manually click "Next"), Akhil Orbit Player will auto-advance to the next item in the course timeline.

> "Education is the passport to the future, for tomorrow belongs to those who prepare for it today." 
> — Malcolm X
  `
);

createFile(
  path.join(targetDir, '01_Welcome & Getting Started', '1.2 - Course Outline.txt'),
  `
AKHIL ORBIT PLAYER COURSE SYLLABUS
==================================

Unit 1: Introduction to Private Learning
- 1.1: Welcome to Akhil Orbit Player (.md)
- 1.2: Course Outline (.txt)

Unit 2: File System Core Mechanics
- 2.1: File System Access API vs Directory Uploads (.md)
- 2.2: Node.js Mock Course Generator Code (.js)

Unit 3: Offline Functionality
- 3.1: Data Persistence (LocalStorage) (.md)
- 3.2: Exporting Notes (.md)
  `
);

createFile(
  path.join(targetDir, '01_Welcome & Getting Started', '1.3 - Orbit Overview.mp4'),
  'DUMMY VIDEO DATA'
);

createFile(
  path.join(targetDir, '01_Welcome & Getting Started', '1.3 - Orbit Overview.vtt'),
  `WEBVTT

1
00:00:01.000 --> 00:00:04.000
Welcome to Akhil Orbit Player!

2
00:00:04.500 --> 00:00:08.000
You are watching a video loaded directly from your device.`
);

// 3. Create Core Mechanics Files
createFile(
  path.join(targetDir, '02_Core Mechanics', '2.1 - File Access vs Directory Inputs.md'),
  `
# Core Tech: Reading Local Files Safely 📂

Akhil Orbit Player leverages two distinct web technology layers to provide a premium offline learning dashboard:

## 1. File System Access API (\`showDirectoryPicker\`)
- **How it works**: Prompts the user to grant read access to a specific folder. 
- **Benefits**: We read files on-demand (streaming video chunks as they play) without loading whole files into memory. 
- **Support**: Chromium-based browsers (Chrome, Edge, Opera).

## 2. Directory Upload Fallback (\`webkitdirectory\`)
- **How it works**: Uses standard HTML5 file upload inputs configured for folders.
- **Benefits**: Universal support across all browsers (including Safari and Firefox).
- **Caveats**: Keeps list of File handles in memory; requires re-selecting folder upon page refresh.
  `
);

createFile(
  path.join(targetDir, '02_Core Mechanics', '2.2 - Course Generator Script.js'),
  `
// This code is currently generating this mock directory tree!
const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, 'mock_course');

function createFolder(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('Created directory:', dir);
  }
}
  `
);

createFile(
  path.join(targetDir, '02_Core Mechanics', '2.3 - Core Mechanics Quiz.html'),
  `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Core Mechanics Quiz</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background-color: #09090b;
      color: #f4f4f5;
      padding: 24px;
      margin: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .quiz-container {
      background-color: rgba(30, 30, 40, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 24px;
      border-radius: 12px;
      width: 100%;
      max-width: 500px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    h1 {
      font-size: 1.5rem;
      margin-bottom: 20px;
      color: #ffffff;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding-bottom: 10px;
    }
    .question {
      margin-bottom: 20px;
    }
    .question-title {
      font-size: 1rem;
      font-weight: 500;
      margin-bottom: 10px;
    }
    .options {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    label {
      padding: 10px 14px;
      background-color: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 10px;
      transition: all 0.2s ease;
      font-size: 0.9rem;
    }
    label:hover {
      background-color: rgba(255, 255, 255, 0.06);
      border-color: rgba(99, 102, 241, 0.3);
    }
    input[type="radio"] {
      accent-color: #6366f1;
      width: 16px;
      height: 16px;
      margin: 0;
    }
    .submit-btn {
      background: linear-gradient(135deg, #6366f1 0%, #3b82f6 100%);
      color: white;
      border: none;
      padding: 12px 18px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
      margin-top: 10px;
      transition: transform 0.1s ease;
      font-size: 0.9rem;
    }
    .submit-btn:active {
      transform: scale(0.98);
    }
    .result {
      margin-top: 20px;
      font-size: 1rem;
      font-weight: 600;
      text-align: center;
      display: none;
    }
    .correct {
      color: #10b981;
    }
    .incorrect {
      color: #ef4444;
    }
  </style>
</head>
<body>
  <div class="quiz-container">
    <h1>Topic 2: Core Mechanics Quiz 📝</h1>
    
    <form id="quiz-form">
      <div class="question">
        <div class="question-title">1. Which API allows Akhil Orbit Player to stream files on-demand directly from folders?</div>
        <div class="options">
          <label>
            <input type="radio" name="q1" value="a" required>
            File System Access API (showDirectoryPicker)
          </label>
          <label>
            <input type="radio" name="q1" value="b">
            HTML5 Storage API
          </label>
          <label>
            <input type="radio" name="q1" value="c">
            WebSocket API
          </label>
        </div>
      </div>

      <div class="question">
        <div class="question-title">2. What browser layout fallback is used when showDirectoryPicker is not supported?</div>
        <div class="options">
          <label>
            <input type="radio" name="q2" value="a" required>
            Local JSON databases
          </label>
          <label>
            <input type="radio" name="q2" value="b">
            Universal standard file input with webkitdirectory
          </label>
          <label>
            <input type="radio" name="q2" value="c">
            Offline service workers
          </label>
        </div>
      </div>

      <button type="submit" class="submit-btn">Check Answers</button>
    </form>

    <div id="result-box" class="result"></div>
  </div>

  <script>
    document.getElementById('quiz-form').addEventListener('submit', function(e) {
      e.preventDefault();
      
      const q1 = document.querySelector('input[name="q1"]:checked').value;
      const q2 = document.querySelector('input[name="q2"]:checked').value;
      
      const resultBox = document.getElementById('result-box');
      resultBox.style.display = 'block';
      
      if (q1 === 'a' && q2 === 'b') {
        resultBox.className = 'result correct';
        resultBox.innerHTML = '🎉 Excellent! You got 100% correct! Great job understanding offline folder loading APIs.';
      } else {
        resultBox.className = 'result incorrect';
        resultBox.innerHTML = '❌ Some answers are incorrect. Review the lesson sheets in Topic 2 and try again!';
      }
    });
  </script>
</body>
</html>
  `
);

// 4. Create Advanced Options Files
createFile(
  path.join(targetDir, '03_Advanced Options', '3.1 - Data Persistence.md'),
  `
# Private Data Storage 🔒

All of your learning records are kept private. Here is how Akhil Orbit Player manages state:

- **Completed Lessons**: Saved in your browser's \`localStorage\` under the key \`completed_{CourseTitle}\`.
- **Personal Notes**: Autosaved in \`localStorage\` under the key \`notes_{CourseTitle}_{LessonPath}\`.
- **Video Playback Resume Position**: Saved on-the-fly as you watch, letting you resume playing from where you paused.
- **Bookmarks**: Saved under \`bookmarks_{CourseTitle}_{LessonPath}\` so you can jump to timestamps anytime.
  `
);

createFile(
  path.join(targetDir, '03_Advanced Options', '3.2 - MDN File System Access API Docs.url'),
  `[InternetShortcut]
URL=https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API`
);

console.log('\nDone! Mock course created in: ' + targetDir);
console.log('You can now open Akhil Orbit Player, click "Select Course Folder" or "Upload Directory (Fallback)" and select the "mock_course" folder to test the player!');
