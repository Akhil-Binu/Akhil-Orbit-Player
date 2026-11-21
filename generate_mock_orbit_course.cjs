const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ORBIT_MAGIC = 'ORBITENC';     // 8 bytes
const ORBIT_MAGIC_END = 'ORBITEND'; // 8 bytes
const FORMAT_VERSION = 2;           // 2 bytes
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB chunk
const ORBIT_APP_SECRET = 'ORBIT_PLAYER_V1_SITE_BOUND_CLIENT_KEY_AKHIL_2026_@9$kL#mZ!';
const PBKDF2_ITERATIONS = 100000;

function collectAllFiles(dir, baseDir = dir) {
  let results = [];
  const items = fs.readdirSync(dir);
  for (const item of items) {
    if (item.startsWith('.') || item === 'node_modules' || item === 'Thumbs.db') continue;
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(collectAllFiles(fullPath, baseDir));
    } else {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
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

async function streamEncryptFile(fullPath, outStream, cipher) {
  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(fullPath, { highWaterMark: CHUNK_SIZE });
    readStream.on('data', chunk => {
      const enc = cipher.update(chunk);
      if (enc.length > 0) {
        const canWrite = outStream.write(enc);
        if (!canWrite) {
          readStream.pause();
          outStream.once('drain', () => readStream.resume());
        }
      }
    });
    readStream.on('end', () => {
      const finalChunk = cipher.final();
      const tag = cipher.getAuthTag();
      const tail = Buffer.concat([finalChunk, tag]);
      if (!outStream.write(tail)) {
        outStream.once('drain', resolve);
      } else {
        resolve();
      }
    });
    readStream.on('error', reject);
  });
}

async function createMockOrbitPackage() {
  const targetDirArg = process.argv[2];
  const inputDir = targetDirArg ? path.resolve(targetDirArg) : path.join(__dirname, 'mock_course');

  if (!fs.existsSync(inputDir)) {
    console.error(`Directory not found: "${inputDir}".`);
    console.log('Usage: node generate_mock_orbit_course.cjs [optional-folder-path] [optional-output-file.orbit]');
    return;
  }

  const folderName = path.basename(inputDir);
  const outputFileName = process.argv[3] 
    ? path.resolve(process.argv[3]) 
    : (targetDirArg ? path.join(path.dirname(inputDir), `${folderName}.orbit`) : path.join(__dirname, 'mock_course.orbit'));

  console.log(`1. Scanning files in "${inputDir}"...`);
  const files = collectAllFiles(inputDir);
  console.log(`   Found ${files.length} files.`);

  console.log('2. Streaming AES-256-GCM encryption (V2 format)...');
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = crypto.pbkdf2Sync(ORBIT_APP_SECRET, salt, PBKDF2_ITERATIONS, 32, 'sha256');

  const outStream = fs.createWriteStream(outputFileName);

  // Write V2 Header: 26 bytes
  const header = Buffer.alloc(26);
  header.write(ORBIT_MAGIC, 0, 8, 'ascii');
  header.writeUInt16BE(FORMAT_VERSION, 8);
  salt.copy(header, 10);
  outStream.write(header);

  let currentOffset = 26;
  const manifestFiles = [];

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const fileIv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, fileIv);
    const relInContainer = `${folderName}/${f.relPath}`;
    const startOffset = currentOffset;

    await streamEncryptFile(f.fullPath, outStream, cipher);

    const cipherLength = f.size + 16;
    currentOffset += cipherLength;

    manifestFiles.push({
      name: f.name,
      path: relInContainer,
      size: f.size,
      offset: startOffset,
      cipherLength,
      iv: fileIv.toString('base64')
    });
  }

  // Encrypt Manifest
  const manifestObj = { title: folderName, version: FORMAT_VERSION, files: manifestFiles };
  const manifestBuf = Buffer.from(JSON.stringify(manifestObj), 'utf8');
  const manifestIv = crypto.randomBytes(IV_LENGTH);
  const manifestCipher = crypto.createCipheriv('aes-256-gcm', key, manifestIv);
  const manifestEncrypted = Buffer.concat([
    manifestCipher.update(manifestBuf),
    manifestCipher.final(),
    manifestCipher.getAuthTag()
  ]);

  outStream.write(manifestEncrypted);

  // Write Trailer: 24 bytes
  const trailer = Buffer.alloc(24);
  manifestIv.copy(trailer, 0);
  trailer.writeUInt32BE(manifestEncrypted.length, 12);
  trailer.write(ORBIT_MAGIC_END, 16, 8, 'ascii');
  outStream.write(trailer);

  await new Promise(r => outStream.end(r));

  const finalStat = fs.statSync(outputFileName);
  console.log(`\n✓ Successfully generated encrypted course: ${outputFileName}`);
  console.log(`  File size: ${(finalStat.size / 1024 / 1024).toFixed(2)} MB (${finalStat.size} bytes)`);
  console.log('  Container format: V2 Streaming Container [Header 26B][Encrypted Files][Manifest][Trailer 24B]');
  console.log('  Notice: This file cannot be extracted by 7-Zip/WinRAR or played in VLC.');
  console.log('  Drag and drop it into Orbit Player (https://akhil-orbit-player.vercel.app/) to test instant playback!');
}

createMockOrbitPackage().catch(console.error);
