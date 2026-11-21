// cli/packager.js
var crypto = require("crypto");
var fs = require("fs");
var path = require("path");
var readline = require("readline");
var { execSync } = require("child_process");
var ORBIT_MAGIC = "ORBITENC";
var ORBIT_MAGIC_END = "ORBITEND";
var FORMAT_VERSION = 2;
var SALT_LENGTH = 16;
var IV_LENGTH = 12;
var CHUNK_SIZE = 4 * 1024 * 1024;
var ORBIT_APP_SECRET = "ORBIT_PLAYER_V1_SITE_BOUND_CLIENT_KEY_AKHIL_2026_@9$kL#mZ!";
var PBKDF2_ITERATIONS = 1e5;
function printBanner() {
  console.log("================================================================");
  console.log("           \u{1FA90} AKHIL ORBIT PLAYER - COURSE PACKAGER V2           ");
  console.log("      Generate Secure Streaming .orbit Containers (AES-256-GCM) ");
  console.log("================================================================\n");
}
function promptUser(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => rl.question(query, (answer) => {
    rl.close();
    resolve(answer.trim());
  }));
}
function openFolderDialog() {
  try {
    const psCommand = `Add-Type -AssemblyName System.Windows.Forms; $f = New-Object Windows.Forms.FolderBrowserDialog; $f.Description = 'Select Course Folder to Encrypt into .orbit'; if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $f.SelectedPath }`;
    const selected = execSync(`powershell.exe -NoProfile -NonInteractive -Command "${psCommand}"`, { encoding: "utf8" }).trim();
    if (selected && fs.existsSync(selected)) {
      return selected;
    }
  } catch {
  }
  return null;
}
function collectAllFiles(dir, baseDir = dir) {
  let results = [];
  const items = fs.readdirSync(dir);
  for (const item of items) {
    if (item.startsWith(".") || item === "node_modules" || item === "Thumbs.db" || item === "$RECYCLE.BIN") continue;
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(collectAllFiles(fullPath, baseDir));
    } else {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, "/");
      results.push({
        fullPath,
        relPath,
        name: item,
        size: stat.size
      });
    }
  }
  return results;
}
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
async function streamEncryptFile(fullPath, outStream, cipher) {
  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(fullPath, { highWaterMark: CHUNK_SIZE });
    readStream.on("data", (chunk) => {
      const enc = cipher.update(chunk);
      if (enc.length > 0) {
        const canWrite = outStream.write(enc);
        if (!canWrite) {
          readStream.pause();
          outStream.once("drain", () => readStream.resume());
        }
      }
    });
    readStream.on("end", () => {
      const finalChunk = cipher.final();
      const tag = cipher.getAuthTag();
      const tail = Buffer.concat([finalChunk, tag]);
      if (!outStream.write(tail)) {
        outStream.once("drain", resolve);
      } else {
        resolve();
      }
    });
    readStream.on("error", reject);
  });
}
async function run() {
  printBanner();
  let targetPath = process.argv[2];
  if (!targetPath) {
    console.log("Opening folder picker dialog...\n");
    targetPath = openFolderDialog();
    if (!targetPath) {
      console.log("No folder selected via dialog.");
      targetPath = await promptUser("Enter path of course folder (or drag & drop folder here): ");
    }
  }
  if (targetPath) {
    targetPath = targetPath.replace(/^["']|["']$/g, "").trim();
  }
  if (!targetPath || targetPath.toLowerCase() === "mock") {
    const localMock = path.join(process.cwd(), "mock_course");
    if (fs.existsSync(localMock)) {
      targetPath = localMock;
      console.log(`Using default mock course: ${targetPath}`);
    }
  }
  if (!targetPath || !fs.existsSync(targetPath)) {
    console.error(`
\u274C Error: Directory not found: "${targetPath}"`);
    await promptUser("\nPress Enter to exit...");
    process.exit(1);
  }
  const stat = fs.statSync(targetPath);
  if (!stat.isDirectory()) {
    console.error(`
\u274C Error: "${targetPath}" is a file, not a directory. Please select a folder.`);
    await promptUser("\nPress Enter to exit...");
    process.exit(1);
  }
  const folderName = path.basename(path.resolve(targetPath));
  const outputPath = process.argv[3] ? path.resolve(process.argv[3].replace(/^["']|["']$/g, "").trim()) : path.join(path.dirname(path.resolve(targetPath)), `${folderName}.orbit`);
  console.log(`\u{1F4C1} Source Folder: ${targetPath}`);
  console.log(`\u{1F4E6} Output Target: ${outputPath}
`);
  console.log("Step 1/3: Scanning course files...");
  const allFiles = collectAllFiles(targetPath);
  if (allFiles.length === 0) {
    console.error("\n\u274C Error: No files found in the selected folder.");
    await promptUser("\nPress Enter to exit...");
    process.exit(1);
  }
  const totalBytes = allFiles.reduce((acc, f) => acc + f.size, 0);
  console.log(`  \u2713 Found ${allFiles.length} files (${formatBytes(totalBytes)} total).
`);
  console.log("Step 2/3: Initializing secure streaming container...");
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = crypto.pbkdf2Sync(ORBIT_APP_SECRET, salt, PBKDF2_ITERATIONS, 32, "sha256");
  const outStream = fs.createWriteStream(outputPath);
  const header = Buffer.alloc(26);
  header.write(ORBIT_MAGIC, 0, 8, "ascii");
  header.writeUInt16BE(FORMAT_VERSION, 8);
  salt.copy(header, 10);
  outStream.write(header);
  let currentOffset = 26;
  const manifestFiles = [];
  console.log("Step 3/3: Streaming AES-256-GCM encryption in 4 MB chunks (Unlimited Size Support)...");
  const startTime = Date.now();
  let processedBytes = 0;
  for (let i = 0; i < allFiles.length; i++) {
    const fileItem = allFiles[i];
    const fileIv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, fileIv);
    const relativeInContainer = `${folderName}/${fileItem.relPath}`;
    const startFileOffset = currentOffset;
    process.stdout.write(`  [${i + 1}/${allFiles.length}] (${formatBytes(fileItem.size)}) ${fileItem.relPath}... `);
    await streamEncryptFile(fileItem.fullPath, outStream, cipher);
    const cipherLength = fileItem.size + 16;
    currentOffset += cipherLength;
    processedBytes += fileItem.size;
    manifestFiles.push({
      name: fileItem.name,
      path: relativeInContainer,
      size: fileItem.size,
      offset: startFileOffset,
      cipherLength,
      iv: fileIv.toString("base64")
    });
    console.log("\u2713");
  }
  const manifestObj = {
    title: folderName,
    version: FORMAT_VERSION,
    files: manifestFiles
  };
  const manifestJson = JSON.stringify(manifestObj);
  const manifestBuf = Buffer.from(manifestJson, "utf8");
  const manifestIv = crypto.randomBytes(IV_LENGTH);
  const manifestCipher = crypto.createCipheriv("aes-256-gcm", key, manifestIv);
  const manifestEncrypted = Buffer.concat([
    manifestCipher.update(manifestBuf),
    manifestCipher.final(),
    manifestCipher.getAuthTag()
    // 16 bytes auth tag
  ]);
  outStream.write(manifestEncrypted);
  const trailer = Buffer.alloc(24);
  manifestIv.copy(trailer, 0);
  trailer.writeUInt32BE(manifestEncrypted.length, 12);
  trailer.write(ORBIT_MAGIC_END, 16, 8, "ascii");
  outStream.write(trailer);
  await new Promise((resolve) => outStream.end(resolve));
  const durationSec = Math.max(0.1, (Date.now() - startTime) / 1e3);
  const throughput = (processedBytes / 1024 / 1024 / durationSec).toFixed(1);
  const outputStat = fs.statSync(outputPath);
  console.log("\n================================================================");
  console.log("                 \u2705 ENCRYPTION SUCCESSFUL!                      ");
  console.log("================================================================");
  console.log(`Generated:  ${outputPath}`);
  console.log(`Total Size: ${formatBytes(outputStat.size)} (${outputStat.size.toLocaleString()} bytes)`);
  console.log(`Files:      ${allFiles.length} files encrypted`);
  console.log(`Speed:      ${throughput} MB/s (Completed in ${durationSec.toFixed(1)}s)`);
  console.log(`Security:   AES-256-GCM + 100,000 PBKDF2 Iterations (V2 Streaming Container)`);
  console.log("\n\u{1F6E1}\uFE0F Security & Performance Highlights:");
  console.log("  \u2022 Unlimited Course Size: Streams multi-gigabyte courses with 0 RAM bottlenecks.");
  console.log("  \u2022 Instant Web Load: Web player reads footer manifest in < 0.1s.");
  console.log("  \u2022 On-Demand Decryption: Only active lesson video is decrypted into browser RAM.");
  console.log("  \u2022 Anti-Piracy: VLC, 7-Zip, and WinRAR cannot inspect or extract contents.");
  console.log("  \u2022 Orbit Player: Drag & drop at https://akhil-orbit-player.vercel.app/\n");
  await promptUser("Press Enter to exit...");
}
run().catch(async (err) => {
  console.error("\n\u274C Unhandled Exception:", err);
  await promptUser("\nPress Enter to exit...");
});
