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

createFile(
  path.join(targetDir, '02_Core Mechanics', '2.4 - Course Curriculum Reference.csv'),
  `Topic,Unit,Estimated Time,Difficulty,Status
Introduction & Setup,Unit 1,15 mins,Beginner,Active
File System APIs,Unit 2,30 mins,Intermediate,Active
Advanced Formats,Unit 3,45 mins,Advanced,Active
Quizzes & Self Checks,Unit 4,20 mins,Intermediate,Planned`
);

// Create Sample XLSX Spreadsheet
function createSampleXlsx() {
  const XLSX = require('xlsx');
  const wb = XLSX.utils.book_new();
  
  // Sheet 1: Course Summary
  const summaryData = [
    ["Module", "Lessons", "Duration (min)", "Type", "Status"],
    ["Unit 1: Getting Started", 5, 45, "Foundational", "Complete"],
    ["Unit 2: Core Mechanics", 5, 60, "Technical", "In Progress"],
    ["Unit 3: Advanced Formats", 4, 75, "Advanced", "Planned"],
    ["Total", 14, 180, "Full Course", "Active"]
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, ws1, "Summary");

  // Sheet 2: Student Scores
  const scoresData = [
    ["Student Name", "Quiz 1", "Quiz 2", "Project Grade", "Overall %"],
    ["Alex Rivers", 95, 100, 92, "95.6%"],
    ["Maria Garcia", 88, 92, 95, "91.6%"],
    ["Liam Chen", 100, 96, 98, "98.0%"],
    ["Zoe Bennett", 90, 85, 89, "88.0%"]
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(scoresData);
  XLSX.utils.book_append_sheet(wb, ws2, "Grades");

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const xlsxPath = path.join(targetDir, '02_Core Mechanics', '2.5 - Student Performance & Metrics.xlsx');
  fs.writeFileSync(xlsxPath, buffer);
  console.log(`Created file: ${xlsxPath}`);
}

// Create Sample PPTX Presentation
async function createSamplePptx() {
  const JSZip = require('jszip');
  const zip = new JSZip();

  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/slides/slide3.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
</Types>`);

  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`);

  zip.file("ppt/presentation.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldIdLst>
    <p:sldId id="256" r:id="rId1"/>
    <p:sldId id="257" r:id="rId2"/>
    <p:sldId id="258" r:id="rId3"/>
  </p:sldIdLst>
</p:presentation>`);

  // Slide 1
  zip.file("ppt/slides/slide1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp><p:txBody><a:p><a:t>Akhil Orbit Player Architecture Overview</a:t></a:p></p:txBody></p:sp>
      <p:sp><p:txBody>
        <a:p><a:t>100% Client-Side Offline Course Player</a:t></a:p>
        <a:p><a:t>Direct Local Folder Reading via File System Access API</a:t></a:p>
        <a:p><a:t>Zero Server Dependencies or Cloud Uploads</a:t></a:p>
      </p:txBody></p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`);

  // Slide 2
  zip.file("ppt/slides/slide2.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp><p:txBody><a:p><a:t>Extensive Document &amp; Media Support</a:t></a:p></p:txBody></p:sp>
      <p:sp><p:txBody>
        <a:p><a:t>Videos (.mp4, .webm) with dynamic VTT subtitles</a:t></a:p>
        <a:p><a:t>Documents (.docx, .pptx, .xlsx, .pdf, .csv)</a:t></a:p>
        <a:p><a:t>Interactive Quizzes (.html) &amp; Web Shortcuts (.url)</a:t></a:p>
        <a:p><a:t>Compressed Archives (.zip) with in-browser tree exploration</a:t></a:p>
      </p:txBody></p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`);

  // Slide 3
  zip.file("ppt/slides/slide3.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp><p:txBody><a:p><a:t>Key Takeaways &amp; Best Practices</a:t></a:p></p:txBody></p:sp>
      <p:sp><p:txBody>
        <a:p><a:t>Keep your course folders organized with numerical prefixes</a:t></a:p>
        <a:p><a:t>Take notes in Markdown and export them anytime</a:t></a:p>
        <a:p><a:t>Bookmark important video timestamps for quick review</a:t></a:p>
      </p:txBody></p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`);

  const content = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const pptxPath = path.join(targetDir, '01_Welcome & Getting Started', '1.4 - Orbit Lecture Deck.pptx');
  fs.writeFileSync(pptxPath, content);
  console.log(`Created file: ${pptxPath}`);
}

// Create Sample DOCX Document
async function createSampleDocx() {
  const JSZip = require('jszip');
  const zip = new JSZip();

  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="36"/></w:rPr><w:t>Akhil Orbit Player — Student Handbook</w:t></w:r>
    </w:p>
    <w:p><w:r><w:t>Welcome to the official handbook for Akhil Orbit Player. This document illustrates the offline Word document rendering capabilities of the player.</w:t></w:r></w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading2"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t>Chapter 1: Getting Started</w:t></w:r>
    </w:p>
    <w:p><w:r><w:t>To begin learning, simply drag and drop your course directory or click 'Select Course Folder'. The application will index your course materials instantly.</w:t></w:r></w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading2"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t>Chapter 2: Supported File Types</w:t></w:r>
    </w:p>
    <w:p><w:r><w:t>The player natively renders Word documents (.docx), PowerPoint presentations (.pptx), Excel spreadsheets (.xlsx), PDFs, Markdown, HTML quizzes, audio, and videos with closed captions.</w:t></w:r></w:p>
    <w:sectPr/>
  </w:body>
</w:document>`);

  const content = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const docxPath = path.join(targetDir, '01_Welcome & Getting Started', '1.5 - Student Guidebook.docx');
  fs.writeFileSync(docxPath, content);
  console.log(`Created file: ${docxPath}`);
}

// 5. Create Sample ZIP Archive
async function createSampleZip() {
  const JSZip = require('jszip');
  const zip = new JSZip();
  
  zip.file("README.md", `# Starter Project 🚀\n\nWelcome to the starter codebase template for Akhil Orbit Player students!\n\n## Quick Start\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\nHappy coding!`);
  zip.file("package.json", JSON.stringify({
    name: "orbit-starter-project",
    version: "1.0.0",
    scripts: {
      dev: "vite",
      build: "vite build"
    },
    dependencies: {
      react: "^19.0.0"
    }
  }, null, 2));

  const src = zip.folder("src");
  src.file("index.ts", `// Entry point\nexport function bootstrapApp(): void {\n  console.log("App initialized successfully from inside zip archive!");\n}\n\nbootstrapApp();\n`);
  src.file("styles.css", `/* Global styles */\nbody {\n  font-family: system-ui, sans-serif;\n  background: #09090b;\n  color: #ffffff;\n  margin: 0;\n  padding: 24px;\n}\n`);
  
  const components = src.folder("components");
  components.file("Header.tsx", `import React from 'react';\n\nexport const Header: React.FC = () => {\n  return (\n    <header className="header">\n      <h1>Orbit Starter App</h1>\n    </header>\n  );\n};\n`);

  const assets = zip.folder("assets");
  assets.file("config.json", JSON.stringify({
    theme: "dark",
    apiUrl: "https://api.example.com",
    features: {
      offlineMode: true,
      analytics: false
    }
  }, null, 2));
  assets.file("logo.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><circle cx="50" cy="50" r="40" fill="#6366f1"/><polygon points="35,30 75,50 35,70" fill="#ffffff"/></svg>`);

  const docs = zip.folder("docs");
  docs.file("Project Plan.docx", `Akhil Orbit Player — Embedded Project Plan\r\n\r\nChapter 1: In-Zip Document Inspection\r\nThis Word document is stored directly inside a compressed ZIP archive.\r\n\r\nChapter 2: Full Document Rendering\r\nYou can preview Word documents, PowerPoint decks, Excel sheets, and PDFs without extracting the ZIP to your hard drive.`);
  
  // CSV inside zip
  docs.file("Milestones & Tasks.csv", `Milestone,Target Date,Owner,Status
Sprint 1: Core Player,2026-08-01,Akhil,Completed
Sprint 2: Document Engine,2026-08-10,Akhil,Completed
Sprint 3: Archive Inspector,2026-08-10,Akhil,Completed
Sprint 4: Final Release,2026-08-15,Akhil,Ready`);

  // Simple HTML inside zip
  zip.file("demo_landing.html", `<!DOCTYPE html><html><body style="background:#09090b;color:white;font-family:sans-serif;padding:32px;"><h1>🚀 Live HTML Preview inside ZIP</h1><p>Akhil Orbit Player dynamically extracts and displays HTML documents from compressed archives.</p></body></html>`);

  const content = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const zipPath = path.join(targetDir, '03_Advanced Options', '3.3 - Starter Project Codebase.zip');
  fs.writeFileSync(zipPath, content);
  console.log(`Created file: ${zipPath}`);
}

function createSamplePdf() {
  const pdfContent = `%PDF-1.4
1 0 obj
<<
  /Type /Catalog
  /Pages 2 0 R
>>
endobj
2 0 obj
<<
  /Type /Pages
  /Kids [3 0 R]
  /Count 1
>>
endobj
3 0 obj
<<
  /Type /Page
  /Parent 2 0 R
  /MediaBox [0 0 612 792]
  /Contents 4 0 R
  /Resources <<
    /Font <<
      /F1 <<
        /Type /Font
        /Subtype /Type1
        /BaseFont /Helvetica
      >>
    >>
  >>
>>
endobj
4 0 obj
<<
  /Length 178
>>
stream
BT
/F1 24 Tf
50 720 Td
(Akhil Orbit Player - Course Syllabus) Tj
/F1 14 Tf
0 -40 Td
(Welcome to the offline PDF document viewer test file.) Tj
0 -25 Td
(This PDF renders offline using the built-in document engine.) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000306 00000 n 
trailer
<<
  /Size 5
  /Root 1 0 R
>>
startxref
535
%%EOF`;

  const pdfPath = path.join(targetDir, '01_Welcome & Getting Started', '1.6 - Official Course Syllabus.pdf');
  fs.writeFileSync(pdfPath, pdfContent);
  console.log(`Created file: ${pdfPath}`);
}

function createSampleLegacyFiles() {
  const docPath = path.join(targetDir, '01_Welcome & Getting Started', '1.7 - Legacy Word Notes.doc');
  const docContent = `Akhil Orbit Player — Legacy Word Document Notes\r\n\r\nThis is a legacy Microsoft Word 97-2003 binary document (.doc format).\r\n\r\nChapter 1: Offline Learning Features\r\nAll lessons, videos, slides, and spreadsheets are processed client-side without any server dependencies.\r\n\r\nChapter 2: Text Extraction Engine\r\nThe built-in document viewer can extract and display structured paragraphs from legacy documents.`;
  fs.writeFileSync(docPath, docContent);
  console.log(`Created file: ${docPath}`);

  const pptPath = path.join(targetDir, '01_Welcome & Getting Started', '1.8 - Legacy Presentation Slides.ppt');
  const pptContent = `Slide 1: Akhil Orbit Player Presentation\r\n\r\n100% Client-Side Local Course Player\r\nInstant Offline Folder Reading\r\nZero Server Uploads Required\r\n\r\nSlide 2: Comprehensive Format Support\r\nWord (.docx, .doc)\r\nPowerPoint (.pptx, .ppt)\r\nExcel & CSV (.xlsx, .csv)\r\nPDF & Markdown (.pdf, .md)`;
  fs.writeFileSync(pptPath, pptContent);
  console.log(`Created file: ${pptPath}`);
}

async function runGenerators() {
  createSampleXlsx();
  createSamplePdf();
  createSampleLegacyFiles();
  await createSamplePptx();
  await createSampleDocx();
  await createSampleZip();
  console.log('\nDone! Mock course created in: ' + targetDir);
  console.log('You can now open Akhil Orbit Player, click "Select Course Folder" or "Upload Directory (Fallback)" and select the "mock_course" folder to test the player!');
}

runGenerators().catch(err => console.error(err));



