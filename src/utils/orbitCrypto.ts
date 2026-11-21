import JSZip from 'jszip';
import type { CourseData, CourseFile, CourseFolder } from './fileSystem';
import { parseFileList, getFileObject, getFileType, compareNames, matchSubtitles, matchAudioTracks } from './fileSystem';

/**
 * Orbit Encrypted Container (.orbit) Format Specification
 * --------------------------------------------------------
 * Version 2 (Streaming / On-Demand):
 * [0..7]   (8B)  : ASCII "ORBITENC"
 * [8..9]   (2B)  : Format Version = 2 (Uint16BE: 0x0002)
 * [10..25] (16B) : PBKDF2 Salt
 * [26..N]  (...) : Sequential encrypted file streams (AES-256-GCM, 12B IV per file, 16B auth tag appended)
 * [N..M]   (...) : Encrypted Manifest JSON (AES-256-GCM)
 * [M..M+24](24B) : Trailer:
 *                  - [0..11]  (12B) : Manifest IV
 *                  - [12..15] (4B)  : Manifest Ciphertext Length (Uint32BE)
 *                  - [16..23] (8B)  : ASCII "ORBITEND"
 *
 * Version 1 (Legacy Monolithic):
 * [0..7]   (8B)  : ASCII "ORBITENC"
 * [8..9]   (2B)  : Format Version = 1 (Uint16BE: 0x0001)
 * [10..25] (16B) : PBKDF2 Salt
 * [26..37] (12B) : AES-GCM IV
 * [38..]   (...) : AES-256-GCM Ciphertext (Monolithic ZIP payload + 16B tag)
 */

export const ORBIT_MAGIC = 'ORBITENC';
export const ORBIT_MAGIC_END = 'ORBITEND';
export const FORMAT_VERSION = 2;
export const SALT_LENGTH = 16;
export const IV_LENGTH = 12;

// Orbit Player application-bound secret key (Site-Specific Signature)
export const ORBIT_APP_SECRET = 'ORBIT_PLAYER_V1_SITE_BOUND_CLIENT_KEY_AKHIL_2026_@9$kL#mZ!';
export const PBKDF2_ITERATIONS = 100000;

export interface OrbitManifestFile {
  name: string;
  path: string;
  size: number;
  offset: number;
  cipherLength: number;
  iv: string; // base64
  mimeType?: string;
}

export interface OrbitManifest {
  title: string;
  version: number;
  files: OrbitManifestFile[];
}

export function getMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    ogg: 'video/ogg',
    mkv: 'video/x-matroska',
    mov: 'video/quicktime',
    m4v: 'video/x-m4v',
    avi: 'video/x-msvideo',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    aac: 'audio/aac',
    flac: 'audio/flac',
    m4a: 'audio/mp4',
    pdf: 'application/pdf',
    vtt: 'text/vtt',
    srt: 'text/plain',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    html: 'text/html',
    md: 'text/markdown',
    txt: 'text/plain',
    json: 'application/json',
    zip: 'application/zip'
  };
  return map[ext] || 'application/octet-stream';
}

function base64ToUint8(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Derive an AES-256-GCM key using PBKDF2 and the application-bound secret
 */
export async function deriveOrbitKey(salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const secretBytes = encoder.encode(ORBIT_APP_SECRET);

  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Check if a file is an Orbit Encrypted container
 */
export async function isOrbitEncryptedFile(file: File): Promise<boolean> {
  if (file.name.toLowerCase().endsWith('.orbit')) return true;
  if (file.size < 26) return false;

  try {
    const slice = await file.slice(0, 8).arrayBuffer();
    const magic = new TextDecoder().decode(slice);
    return magic === ORBIT_MAGIC;
  } catch {
    return false;
  }
}

/**
 * Build a reactive CourseData structure from decrypted V2 manifest.
 * Files are decrypted on-demand via WebCrypto when accessed.
 */
function buildCourseDataFromManifest(
  manifest: OrbitManifest,
  orbitFile: File | Blob,
  key: CryptoKey
): CourseData {
  const rootDirName = manifest.title || 'Course';
  const rootFolder: CourseFolder = {
    name: rootDirName,
    path: rootDirName,
    files: [],
    subfolders: []
  };

  // Single-file cache to prevent re-decrypting when multiple components request the active file
  let cachedActiveFile: { path: string; file: File } | null = null;

  manifest.files.forEach(meta => {
    const rawPath = meta.path.replace(/\\/g, '/');
    let parts = rawPath.split('/').filter(Boolean);
    if (parts.length > 1 && parts[0] === rootDirName) {
      parts = parts.slice(1);
    }

    let currentFolder = rootFolder;
    for (let i = 0; i < parts.length - 1; i++) {
      const folderName = parts[i];
      let nextFolder = currentFolder.subfolders.find(f => f.name === folderName);
      if (!nextFolder) {
        nextFolder = {
          name: folderName,
          path: `${currentFolder.path}/${folderName}`,
          files: [],
          subfolders: []
        };
        currentFolder.subfolders.push(nextFolder);
      }
      currentFolder = nextFolder;
    }

    const courseFile: CourseFile = {
      name: meta.name,
      path: meta.path,
      type: getFileType(meta.name),
      size: meta.size,
      getFile: async () => {
        if (cachedActiveFile && cachedActiveFile.path === meta.path) {
          return cachedActiveFile.file;
        }

        const sliceBlob = orbitFile.slice(meta.offset, meta.offset + meta.cipherLength);
        const encryptedBuffer = await sliceBlob.arrayBuffer();
        const iv = base64ToUint8(meta.iv);

        const decryptedBuffer = await window.crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: iv as unknown as BufferSource },
          key,
          encryptedBuffer
        );

        const mime = meta.mimeType || getMimeType(meta.name);
        const file = new File([decryptedBuffer], meta.name, { type: mime });
        cachedActiveFile = { path: meta.path, file };
        return file;
      }
    };

    currentFolder.files.push(courseFile);
  });

  const sortFolder = (f: CourseFolder) => {
    f.files.sort((a, b) => compareNames(a.name, b.name));
    f.subfolders.sort((a, b) => compareNames(a.name, b.name));
    f.subfolders.forEach(sortFolder);
  };

  sortFolder(rootFolder);
  matchSubtitles(rootFolder);
  matchAudioTracks(rootFolder);

  const flatLessons: CourseFile[] = [];
  const collectLessons = (f: CourseFolder) => {
    f.files.forEach(file => {
      if (['video', 'audio', 'pdf', 'markdown', 'text', 'code', 'html', 'subtitle', 'url', 'archive', 'document'].includes(file.type)) {
        flatLessons.push(file);
      }
    });
    f.subfolders.forEach(collectLessons);
  };
  collectLessons(rootFolder);

  return {
    title: rootDirName,
    structure: rootFolder,
    flatLessons
  };
}

/**
 * Export a CourseData structure into an encrypted .orbit V2 container file
 */
export async function exportEncryptedOrbitCourse(
  courseData: CourseData,
  onProgress?: (percent: number, status: string) => void
): Promise<{ blob: Blob; fileName: string }> {
  onProgress?.(5, 'Preparing course bundle...');

  const rootFolderName = courseData.title || 'Course';

  // 1. Collect all files across the course structure
  const allFiles: CourseFile[] = [...courseData.flatLessons];
  
  courseData.flatLessons.forEach(lesson => {
    if (lesson.subtitles) {
      lesson.subtitles.forEach(sub => {
        if (sub.file && !allFiles.some(f => f.path === sub.file?.name)) {
          allFiles.push({
            name: sub.file.name,
            path: `${rootFolderName}/${sub.file.name}`,
            type: 'subtitle',
            file: sub.file,
            size: sub.file.size
          });
        }
      });
    }
    if (lesson.audioTracks) {
      lesson.audioTracks.forEach(track => {
        if (track.file && !allFiles.some(f => f.path === track.file?.name)) {
          allFiles.push({
            name: track.file.name,
            path: `${rootFolderName}/${track.file.name}`,
            type: 'audio',
            file: track.file,
            size: track.file.size
          });
        }
      });
    }
  });

  // 2. Generate Salt & derive encryption key
  const salt = window.crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const cryptoKey = await deriveOrbitKey(salt);

  // 3. Encrypt files sequentially into chunks
  const encryptedBlobs: BlobPart[] = [];
  const manifestFiles: OrbitManifestFile[] = [];
  let currentOffset = 26; // After 8B Magic + 2B Version + 16B Salt

  const totalFiles = allFiles.length;
  for (let i = 0; i < totalFiles; i++) {
    const fileItem = allFiles[i];
    const pct = Math.round(5 + ((i / totalFiles) * 80));
    onProgress?.(pct, `Encrypting ${fileItem.name} (${i + 1}/${totalFiles})...`);

    const fileObj = await getFileObject(fileItem);
    const arrayBuffer = await fileObj.arrayBuffer();

    let relativePath = fileItem.path;
    if (!relativePath.startsWith(rootFolderName + '/')) {
      relativePath = `${rootFolderName}/${relativePath.replace(/^[/\\]+/, '')}`;
    }

    const fileIv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const encryptedData = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: fileIv as unknown as BufferSource },
      cryptoKey,
      arrayBuffer
    );

    const cipherLength = encryptedData.byteLength;
    encryptedBlobs.push(encryptedData);

    manifestFiles.push({
      name: fileItem.name,
      path: relativePath,
      size: fileObj.size,
      offset: currentOffset,
      cipherLength,
      iv: uint8ToBase64(fileIv),
      mimeType: fileObj.type || getMimeType(fileItem.name)
    });

    currentOffset += cipherLength;
  }

  onProgress?.(88, 'Encrypting course manifest...');

  // 4. Build and encrypt manifest
  const manifest: OrbitManifest = {
    title: rootFolderName,
    version: FORMAT_VERSION,
    files: manifestFiles
  };
  const manifestJson = JSON.stringify(manifest);
  const manifestBytes = new TextEncoder().encode(manifestJson);
  const manifestIv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const encryptedManifest = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: manifestIv as unknown as BufferSource },
    cryptoKey,
    manifestBytes
  );

  onProgress?.(95, 'Finalizing .orbit container...');

  // 5. Header (26 bytes)
  const headerBytes = new TextEncoder().encode(ORBIT_MAGIC); // 8B
  const versionBytes = new Uint8Array(2);
  new DataView(versionBytes.buffer).setUint16(0, FORMAT_VERSION, false); // 2B big-endian

  // 6. Trailer (24 bytes)
  const trailerBytes = new Uint8Array(24);
  trailerBytes.set(manifestIv, 0); // 12B IV
  new DataView(trailerBytes.buffer).setUint32(12, encryptedManifest.byteLength, false); // 4B Length
  trailerBytes.set(new TextEncoder().encode(ORBIT_MAGIC_END), 16); // 8B "ORBITEND"

  // 7. Combine all parts into single binary container
  const combinedBlob = new Blob([
    headerBytes,
    versionBytes,
    salt,
    ...encryptedBlobs,
    encryptedManifest,
    trailerBytes
  ], { type: 'application/octet-stream' });

  const safeTitle = rootFolderName.replace(/[\\/:*?"<>|]/g, '_').trim() || 'Course';
  const fileName = `${safeTitle}.orbit`;

  onProgress?.(100, 'Encryption complete!');

  return {
    blob: combinedBlob,
    fileName
  };
}

/**
 * Decrypt and import an encrypted .orbit container file into CourseData
 * Supports both V2 (streaming on-demand) and V1 (legacy monolithic ZIP).
 */
export async function importEncryptedOrbitCourse(
  orbitFile: File | Blob,
  onProgress?: (percent: number, status: string) => void
): Promise<CourseData> {
  onProgress?.(10, 'Validating .orbit container header...');

  if (orbitFile.size < 26) {
    throw new Error('Invalid .orbit file: File is too small or truncated.');
  }

  // 1. Read header (26 bytes)
  const headerBuffer = await orbitFile.slice(0, 26).arrayBuffer();
  const magic = new TextDecoder().decode(new Uint8Array(headerBuffer, 0, 8));

  if (magic !== ORBIT_MAGIC) {
    throw new Error('Unrecognized format: This file is not a valid Orbit Encrypted Course (.orbit).');
  }

  const version = new DataView(headerBuffer, 8, 2).getUint16(0, false);
  const salt = new Uint8Array(headerBuffer, 10, SALT_LENGTH);

  // V2 Container: Streaming on-demand loading
  if (version >= 2) {
    onProgress?.(25, 'Reading container metadata...');

    if (orbitFile.size < 50) {
      throw new Error('Invalid .orbit V2 file: Truncated container.');
    }

    // Read 24-byte trailer at end of file
    const trailerBuffer = await orbitFile.slice(orbitFile.size - 24, orbitFile.size).arrayBuffer();
    const magicEnd = new TextDecoder().decode(new Uint8Array(trailerBuffer, 16, 8));

    if (magicEnd !== ORBIT_MAGIC_END) {
      throw new Error('Invalid .orbit container: End marker corrupted or file is incomplete.');
    }

    const manifestIv = new Uint8Array(trailerBuffer, 0, 12);
    const manifestCipherLength = new DataView(trailerBuffer).getUint32(12, false);

    onProgress?.(45, 'Deriving AES-256 decryption key...');
    const key = await deriveOrbitKey(salt);

    onProgress?.(70, 'Decrypting course structure...');
    const manifestStart = orbitFile.size - 24 - manifestCipherLength;
    const manifestCipherBuffer = await orbitFile.slice(manifestStart, manifestStart + manifestCipherLength).arrayBuffer();

    let decryptedManifestBuffer: ArrayBuffer;
    try {
      decryptedManifestBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: manifestIv as unknown as BufferSource },
        key,
        manifestCipherBuffer
      );
    } catch (err) {
      console.error('Manifest decryption failed:', err);
      throw new Error('Decryption failed: This encrypted file cannot be opened. It may have been modified or corrupted.');
    }

    const manifestJson = new TextDecoder().decode(decryptedManifestBuffer);
    const manifest: OrbitManifest = JSON.parse(manifestJson);

    onProgress?.(90, 'Assembling course curriculum...');
    const courseData = buildCourseDataFromManifest(manifest, orbitFile, key);

    onProgress?.(100, 'Course loaded successfully!');
    return courseData;
  }

  // V1 Container: Legacy fallback for existing monolithic ZIP format
  onProgress?.(25, 'Loading legacy .orbit container...');
  const buffer = await orbitFile.arrayBuffer();
  if (buffer.byteLength < 54) {
    throw new Error('Invalid legacy .orbit file: File is too small.');
  }

  const iv = new Uint8Array(buffer, 10 + SALT_LENGTH, IV_LENGTH);
  const ciphertextOffset = 10 + SALT_LENGTH + IV_LENGTH; // 38
  const ciphertext = new Uint8Array(buffer, ciphertextOffset);

  onProgress?.(45, 'Deriving AES-256 decryption key...');
  const key = await deriveOrbitKey(salt);

  onProgress?.(65, 'Decrypting legacy course payload in memory...');
  let decryptedArrayBuffer: ArrayBuffer;
  try {
    decryptedArrayBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource },
      key,
      ciphertext as unknown as BufferSource
    );
  } catch (err) {
    console.error('Decryption failed:', err);
    throw new Error('Decryption failed: This encrypted file cannot be opened. It may have been modified or corrupted.');
  }

  onProgress?.(80, 'Extracting in-memory course structure...');
  const zip = await JSZip.loadAsync(decryptedArrayBuffer);
  const extractedFiles: File[] = [];

  const zipEntries = Object.values(zip.files).filter(entry => !entry.dir);
  const totalEntries = zipEntries.length;

  for (let i = 0; i < totalEntries; i++) {
    const entry = zipEntries[i];
    const cleanPath = entry.name.replace(/\\/g, '/');
    const pathParts = cleanPath.split('/');
    const fileName = pathParts[pathParts.length - 1];

    if (fileName.startsWith('.') || fileName === 'Thumbs.db') continue;

    const fileBlob = await entry.async('blob');
    const file = new File([fileBlob], fileName, { 
      type: fileBlob.type || 'application/octet-stream',
      lastModified: entry.date ? entry.date.getTime() : Date.now()
    });

    Object.defineProperty(file, 'webkitRelativePath', {
      value: cleanPath,
      writable: false
    });

    extractedFiles.push(file);

    if (i % 5 === 0) {
      const pct = Math.round(80 + ((i / totalEntries) * 15));
      onProgress?.(pct, `Unpacking ${fileName}...`);
    }
  }

  onProgress?.(98, 'Building course curriculum...');
  const courseData = parseFileList(extractedFiles);

  onProgress?.(100, 'Course loaded successfully!');
  return courseData;
}
