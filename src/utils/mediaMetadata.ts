/**
 * Universal media metadata parser and audio track extractor
 * Inspects MP4/MOV, MKV/WebM, AVI, and MPEG-TS containers directly in the browser
 * to detect and extract embedded audio tracks identical to VLC Player.
 */

export interface DetectedAudioTrack {
  id: string;
  trackId: number;
  label: string;
  language?: string;
  languageCode?: string;
  codec?: string;
  channels?: number;
  sampleRate?: number;
  isEmbedded: true;
}

const LANGUAGE_MAP: Record<string, string> = {
  eng: 'English', en: 'English',
  spa: 'Spanish', es: 'Spanish',
  fra: 'French', fr: 'French', fre: 'French',
  deu: 'German', de: 'German', ger: 'German',
  ita: 'Italian', it: 'Italian',
  por: 'Portuguese', pt: 'Portuguese',
  rus: 'Russian', ru: 'Russian',
  hin: 'Hindi', hi: 'Hindi',
  jpn: 'Japanese', ja: 'Japanese',
  kor: 'Korean', ko: 'Korean',
  zho: 'Chinese', zh: 'Chinese', chi: 'Chinese',
  ara: 'Arabic', ar: 'Arabic',
  ben: 'Bengali', bn: 'Bengali',
  pan: 'Punjabi', pa: 'Punjabi',
  tam: 'Tamil', ta: 'Tamil',
  tel: 'Telugu', te: 'Telugu',
  mar: 'Marathi', mr: 'Marathi',
  tur: 'Turkish', tr: 'Turkish',
  vie: 'Vietnamese', vi: 'Vietnamese',
  nld: 'Dutch', nl: 'Dutch', dut: 'Dutch',
  pol: 'Polish', pl: 'Polish',
  ukr: 'Ukrainian', uk: 'Ukrainian',
  swe: 'Swedish', sv: 'Swedish',
  ind: 'Indonesian', id: 'Indonesian',
  tha: 'Thai', th: 'Thai',
  ell: 'Greek', el: 'Greek',
  ces: 'Czech', cs: 'Czech',
  dan: 'Danish', da: 'Danish',
  fin: 'Finnish', fi: 'Finnish',
  hun: 'Hungarian', hu: 'Hungarian',
  nor: 'Norwegian', no: 'Norwegian',
  ron: 'Romanian', ro: 'Romanian',
  und: 'Undetermined'
};

function resolveLanguageName(code: string): string {
  const clean = code.trim().toLowerCase();
  return LANGUAGE_MAP[clean] || (clean.length <= 3 && clean !== 'und' ? clean.toUpperCase() : clean);
}

// ==========================================
// 1. MP4 / MOV Container Parser
// ==========================================

interface Mp4Box {
  type: string;
  start: number;
  end: number;
  size: number;
}

function scanMp4Boxes(view: DataView, start: number, end: number): Mp4Box[] {
  let pos = start;
  const boxes: Mp4Box[] = [];
  while (pos + 8 <= end) {
    let size = view.getUint32(pos);
    let type = '';
    for (let i = 0; i < 4; i++) {
      type += String.fromCharCode(view.getUint8(pos + 4 + i));
    }
    let headerSize = 8;
    if (size === 1 && pos + 16 <= end) {
      size = Number(view.getBigUint64(pos + 8));
      headerSize = 16;
    } else if (size === 0) {
      size = end - pos;
    }
    if (size < 8 || pos + size > end) break;
    boxes.push({ type, start: pos + headerSize, end: pos + size, size });
    pos += size;
  }
  return boxes;
}

function decodeMp4LanguageCode(code: number): string {
  const c1 = String.fromCharCode(((code >> 10) & 0x1f) + 0x60);
  const c2 = String.fromCharCode(((code >> 5) & 0x1f) + 0x60);
  const c3 = String.fromCharCode((code & 0x1f) + 0x60);
  return (c1 + c2 + c3).toLowerCase();
}

/**
 * Robustly finds and reads the MP4/MOV 'moov' atom from anywhere in the file.
 * Handles both fast-start (moov at start) and non-fast-start (moov at tail or after mdat).
 */
async function findAndReadMp4Moov(file: File): Promise<ArrayBuffer | null> {
  const fileSize = file.size;

  // 1. Box walk from the beginning of the file
  let offset = 0;
  let steps = 0;
  while (offset + 8 <= fileSize && steps < 100) {
    steps++;
    const headerBuf = await file.slice(offset, Math.min(fileSize, offset + 16)).arrayBuffer();
    if (headerBuf.byteLength < 8) break;
    const view = new DataView(headerBuf);
    let size = view.getUint32(0);
    let type = '';
    for (let i = 0; i < 4; i++) {
      type += String.fromCharCode(view.getUint8(4 + i));
    }

    if (size === 1) {
      if (headerBuf.byteLength < 16) break;
      size = Number(view.getBigUint64(8));
    } else if (size === 0) {
      size = fileSize - offset;
    }

    if (size < 8) break;

    if (type === 'moov') {
      const moovSliceSize = Math.min(size, 64 * 1024 * 1024); // Cap at 64MB for safety
      return await file.slice(offset, offset + moovSliceSize).arrayBuffer();
    }

    if (offset + size > fileSize) break;
    offset += size;
  }

  // 2. Fallback: Search for 'moov' signature in the first 32MB and trailing 32MB
  const ranges = [
    { start: 0, end: Math.min(fileSize, 32 * 1024 * 1024) },
    { start: Math.max(0, fileSize - 32 * 1024 * 1024), end: fileSize }
  ];

  for (const range of ranges) {
    if (range.end - range.start < 8) continue;
    const chunkBuf = await file.slice(range.start, range.end).arrayBuffer();
    const chunkBytes = new Uint8Array(chunkBuf);
    for (let i = 0; i <= chunkBytes.length - 8; i++) {
      // 'm', 'o', 'o', 'v'
      if (
        chunkBytes[i + 4] === 0x6d &&
        chunkBytes[i + 5] === 0x6f &&
        chunkBytes[i + 6] === 0x6f &&
        chunkBytes[i + 7] === 0x76
      ) {
        const view = new DataView(chunkBuf, i, 8);
        const boxSize = view.getUint32(0);
        if (boxSize >= 8 && boxSize <= 64 * 1024 * 1024) {
          const globalBoxStart = range.start + i;
          return await file.slice(globalBoxStart, Math.min(fileSize, globalBoxStart + boxSize)).arrayBuffer();
        }
      }
    }
  }

  return null;
}

function parseMp4AudioTracksFromBuffer(buffer: ArrayBuffer): DetectedAudioTrack[] {
  const view = new DataView(buffer);
  const rootBoxes = scanMp4Boxes(view, 0, buffer.byteLength);
  const moov = rootBoxes.find(b => b.type === 'moov') || (rootBoxes.length > 0 ? null : null);
  const searchStart = moov ? moov.start : 8;
  const searchEnd = moov ? moov.end : buffer.byteLength;

  const trakBoxes = scanMp4Boxes(view, searchStart, searchEnd).filter(b => b.type === 'trak');
  const tracks: DetectedAudioTrack[] = [];

  for (let idx = 0; idx < trakBoxes.length; idx++) {
    const trak = trakBoxes[idx];
    const trakChildren = scanMp4Boxes(view, trak.start, trak.end);
    const mdia = trakChildren.find(b => b.type === 'mdia');
    if (!mdia) continue;

    const mdiaChildren = scanMp4Boxes(view, mdia.start, mdia.end);
    const hdlr = mdiaChildren.find(b => b.type === 'hdlr');
    if (!hdlr) continue;

    let handlerType = '';
    for (let i = 0; i < 4; i++) {
      handlerType += String.fromCharCode(view.getUint8(hdlr.start + 8 + i));
    }
    if (handlerType !== 'soun') continue; // Only audio tracks

    // Track ID from tkhd
    let trackId = idx + 1;
    const tkhd = trakChildren.find(b => b.type === 'tkhd');
    if (tkhd) {
      const ver = view.getUint8(tkhd.start);
      trackId = ver === 0 ? view.getUint32(tkhd.start + 12) : view.getUint32(tkhd.start + 20);
    }

    // Language from mdhd
    let langCode = 'und';
    const mdhd = mdiaChildren.find(b => b.type === 'mdhd');
    if (mdhd) {
      const ver = view.getUint8(mdhd.start);
      const langPos = ver === 0 ? mdhd.start + 20 : mdhd.start + 28;
      if (langPos + 2 <= mdhd.end) {
        langCode = decodeMp4LanguageCode(view.getUint16(langPos));
      }
    }

    // Codec, channels, sample rate from stsd
    let codec = 'AAC';
    let channels = 2;
    let sampleRate = 44100;
    const minf = mdiaChildren.find(b => b.type === 'minf');
    if (minf) {
      const minfChildren = scanMp4Boxes(view, minf.start, minf.end);
      const stbl = minfChildren.find(b => b.type === 'stbl');
      if (stbl) {
        const stblChildren = scanMp4Boxes(view, stbl.start, stbl.end);
        const stsd = stblChildren.find(b => b.type === 'stsd');
        if (stsd && stsd.start + 16 <= stsd.end) {
          let rawCodec = '';
          for (let i = 0; i < 4; i++) {
            rawCodec += String.fromCharCode(view.getUint8(stsd.start + 12 + i));
          }
          if (rawCodec === 'mp4a') codec = 'AAC';
          else if (rawCodec === 'ac-3') codec = 'AC-3';
          else if (rawCodec === 'ec-3') codec = 'E-AC-3';
          else if (rawCodec === 'Opus') codec = 'Opus';
          else if (rawCodec === 'alac') codec = 'ALAC';
          else if (rawCodec === 'fLaC') codec = 'FLAC';
          else if (rawCodec === 'samr') codec = 'AMR';
          else if (rawCodec.startsWith('dts')) codec = 'DTS';
          else codec = rawCodec.trim().toUpperCase() || 'Audio';

          if (stsd.start + 36 <= stsd.end) {
            channels = view.getUint16(stsd.start + 24) || 2;
            sampleRate = (view.getUint32(stsd.start + 32) >> 16) || 44100;
          }
        }
      }
    }

    // Optional Track Name from udta -> name
    let trackTitle = '';
    const udta = trakChildren.find(b => b.type === 'udta');
    if (udta) {
      const udtaChildren = scanMp4Boxes(view, udta.start, udta.end);
      const nameBox = udtaChildren.find(b => b.type === 'name' || b.type === 'titl');
      if (nameBox) {
        for (let i = nameBox.start; i < nameBox.end; i++) {
          const ch = view.getUint8(i);
          if (ch >= 32 && ch <= 126) trackTitle += String.fromCharCode(ch);
        }
      }
    }

    const langName = resolveLanguageName(langCode);
    const channelDesc = channels === 1 ? 'Mono' : channels === 2 ? 'Stereo' : channels === 6 ? '5.1' : `${channels}ch`;
    let label = trackTitle 
      ? `Track ${trackId}: ${trackTitle} (${langName}) [${codec}]`
      : (langCode !== 'und'
          ? `Track ${trackId}: ${langName} (${codec} ${channelDesc})`
          : `Track ${trackId}: Audio Track ${trackId} (${codec} ${channelDesc})`);

    tracks.push({
      id: `embedded_${trackId}`,
      trackId,
      label,
      language: langName,
      languageCode: langCode !== 'und' ? langCode : undefined,
      codec,
      channels,
      sampleRate,
      isEmbedded: true
    });
  }

  return tracks;
}

// ==========================================
// 2. Matroska (MKV) / WebM EBML Parser
// ==========================================

function readEbmlVint(bytes: Uint8Array, start: number): { length: number; value: number } | null {
  if (start >= bytes.length) return null;
  const first = bytes[start];
  let len = 1;
  let mask = 0x80;
  while (len <= 8 && !(first & mask)) {
    len++;
    mask >>= 1;
  }
  if (len > 8 || start + len > bytes.length) return null;
  let val = first & (mask - 1);
  for (let i = 1; i < len; i++) {
    val = (val * 256) + bytes[start + i];
  }
  return { length: len, value: val };
}

function readEbmlElementId(bytes: Uint8Array, start: number): { length: number; id: number } | null {
  if (start >= bytes.length) return null;
  const first = bytes[start];
  let len = 1;
  let mask = 0x80;
  while (len <= 4 && !(first & mask)) {
    len++;
    mask >>= 1;
  }
  if (len > 4 || start + len > bytes.length) return null;
  let id = 0;
  for (let i = 0; i < len; i++) {
    id = (id * 256) + bytes[start + i];
  }
  return { length: len, id: id >>> 0 };
}

async function findAndReadMatroskaTracks(file: File): Promise<ArrayBuffer | null> {
  const fileSize = file.size;

  // 1. Try resolving Tracks directly from Segment SeekHead
  try {
    const headSlice = await file.slice(0, Math.min(fileSize, 256 * 1024)).arrayBuffer();
    const headBytes = new Uint8Array(headSlice);

    // Find Segment ID: 0x18538067
    let segIdx = -1;
    for (let i = 0; i <= Math.min(headBytes.length - 4, 1024); i++) {
      if (headBytes[i] === 0x18 && headBytes[i + 1] === 0x53 && headBytes[i + 2] === 0x80 && headBytes[i + 3] === 0x67) {
        segIdx = i;
        break;
      }
    }

    if (segIdx !== -1) {
      const segSz = readEbmlVint(headBytes, segIdx + 4);
      if (segSz) {
        const segmentDataStart = segIdx + 4 + segSz.length;

        // Find SeekHead ID: 0x114D9B74
        let seekHeadIdx = -1;
        for (let i = segmentDataStart; i <= Math.min(headBytes.length - 4, segmentDataStart + 4096); i++) {
          if (headBytes[i] === 0x11 && headBytes[i + 1] === 0x4D && headBytes[i + 2] === 0x9B && headBytes[i + 3] === 0x74) {
            seekHeadIdx = i;
            break;
          }
        }

        if (seekHeadIdx !== -1) {
          const shSz = readEbmlVint(headBytes, seekHeadIdx + 4);
          if (shSz) {
            const shEnd = seekHeadIdx + 4 + shSz.length + shSz.value;
            let p = seekHeadIdx + 4 + shSz.length;

            while (p < shEnd && p < headBytes.length) {
              const el = readEbmlElementId(headBytes, p);
              if (!el) { p++; continue; }
              const sz = readEbmlVint(headBytes, p + el.length);
              if (!sz) { p++; continue; }
              const nextP = p + el.length + sz.length + sz.value;

              if (el.id === 0x4DBB) { // Seek entry
                let sp = p + el.length + sz.length;
                let seekId = 0;
                let seekPos = -1;

                while (sp < nextP && sp < headBytes.length) {
                  const cel = readEbmlElementId(headBytes, sp);
                  if (!cel) { sp++; continue; }
                  const csz = readEbmlVint(headBytes, sp + cel.length);
                  if (!csz) { sp++; continue; }
                  const vStart = sp + cel.length + csz.length;

                  if (cel.id === 0x53AB) { // SeekID
                    let sid = 0;
                    for (let k = 0; k < csz.value; k++) sid = (sid * 256) + headBytes[vStart + k];
                    seekId = sid >>> 0;
                  } else if (cel.id === 0x53AC) { // SeekPosition
                    let spos = 0;
                    for (let k = 0; k < csz.value; k++) spos = (spos * 256) + headBytes[vStart + k];
                    seekPos = spos;
                  }
                  sp = vStart + csz.value;
                }

                if (seekId === 0x1654AE6B && seekPos >= 0) {
                  const globalTracksOffset = segmentDataStart + seekPos;
                  return await file.slice(globalTracksOffset, Math.min(fileSize, globalTracksOffset + 16 * 1024 * 1024)).arrayBuffer();
                }
              }
              p = nextP;
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[MediaMetadata] SeekHead parse attempt failed, falling back to scanner:', err);
  }

  // 2. Fallback Scanner: searches for REAL Tracks element (filtering out SeekID false positives)
  const maxSearch = Math.min(fileSize, 48 * 1024 * 1024);
  const chunkSize = 6 * 1024 * 1024;
  let offset = 0;

  while (offset < maxSearch) {
    const end = Math.min(maxSearch, offset + chunkSize + 64);
    const chunk = await file.slice(offset, end).arrayBuffer();
    const bytes = new Uint8Array(chunk);

    for (let i = 0; i <= bytes.length - 4; i++) {
      if (bytes[i] === 0x16 && bytes[i + 1] === 0x54 && bytes[i + 2] === 0xae && bytes[i + 3] === 0x6b) {
        // Filter out SeekID payload inside SeekHead (preceded by 0x53AB)
        if (i >= 3 && bytes[i - 3] === 0x53 && bytes[i - 2] === 0xab) continue;
        if (i >= 2 && bytes[i - 2] === 0x53 && bytes[i - 1] === 0xab) continue;

        const sz = readEbmlVint(bytes, i + 4);
        if (!sz) continue;
        const pStart = i + 4 + sz.length;
        if (pStart >= bytes.length) continue;

        // Verify TrackEntry (0xAE) exists in the payload
        let hasTrackEntry = false;
        for (let j = pStart; j < Math.min(bytes.length, pStart + 64); j++) {
          if (bytes[j] === 0xae) { hasTrackEntry = true; break; }
        }

        if (hasTrackEntry) {
          const globalOffset = offset + i;
          return await file.slice(globalOffset, Math.min(fileSize, globalOffset + 16 * 1024 * 1024)).arrayBuffer();
        }
      }
    }
    offset += chunkSize;
  }

  // 3. Check trailing 16MB for files with metadata at tail
  if (fileSize > 32 * 1024 * 1024) {
    const tailStart = Math.max(0, fileSize - 16 * 1024 * 1024);
    const tailChunk = await file.slice(tailStart, fileSize).arrayBuffer();
    const bytes = new Uint8Array(tailChunk);

    for (let i = 0; i <= bytes.length - 4; i++) {
      if (bytes[i] === 0x16 && bytes[i + 1] === 0x54 && bytes[i + 2] === 0xae && bytes[i + 3] === 0x6b) {
        if (i >= 3 && bytes[i - 3] === 0x53 && bytes[i - 2] === 0xab) continue;
        if (i >= 2 && bytes[i - 2] === 0x53 && bytes[i - 1] === 0xab) continue;

        const sz = readEbmlVint(bytes, i + 4);
        if (!sz) continue;
        const pStart = i + 4 + sz.length;
        if (pStart < bytes.length) {
          let hasTrackEntry = false;
          for (let j = pStart; j < Math.min(bytes.length, pStart + 64); j++) {
            if (bytes[j] === 0xae) { hasTrackEntry = true; break; }
          }
          if (hasTrackEntry) {
            const globalOffset = tailStart + i;
            return await file.slice(globalOffset, fileSize).arrayBuffer();
          }
        }
      }
    }
  }

  return null;
}

function parseMatroskaAudioTracksFromBuffer(buffer: ArrayBuffer): DetectedAudioTrack[] {
  const bytes = new Uint8Array(buffer);
  let offset = 0;
  const tracks: DetectedAudioTrack[] = [];

  while (offset <= bytes.length - 4) {
    if (bytes[offset] === 0x16 && bytes[offset + 1] === 0x54 && bytes[offset + 2] === 0xae && bytes[offset + 3] === 0x6b) {
      if (offset >= 3 && bytes[offset - 3] === 0x53 && bytes[offset - 2] === 0xab) {
        offset++;
        continue;
      }

      const sizeVint = readEbmlVint(bytes, offset + 4);
      if (!sizeVint) break;
      const tracksEnd = offset + 4 + sizeVint.length + sizeVint.value;
      let pos = offset + 4 + sizeVint.length;

      while (pos < tracksEnd && pos < bytes.length) {
        const trackEntryEl = readEbmlElementId(bytes, pos);
        if (!trackEntryEl) { pos++; continue; }
        const entrySize = readEbmlVint(bytes, pos + trackEntryEl.length);
        if (!entrySize) { pos++; continue; }
        const entryEnd = pos + trackEntryEl.length + entrySize.length + entrySize.value;

        if (trackEntryEl.id === 0xAE) {
          let p = pos + trackEntryEl.length + entrySize.length;
          let trackNumber = tracks.length + 1;
          let trackType = 0;
          let trackName = '';
          let language = 'und';
          let codecId = 'Audio';
          let channels = 2;
          let sampleRate = 48000;

          while (p < entryEnd && p < bytes.length) {
            const childEl = readEbmlElementId(bytes, p);
            if (!childEl) { p++; continue; }
            const childSize = readEbmlVint(bytes, p + childEl.length);
            if (!childSize) { p++; continue; }
            const valStart = p + childEl.length + childSize.length;

            if (childEl.id === 0xD7 && childSize.value > 0) {
              trackNumber = bytes[valStart];
            } else if (childEl.id === 0x83 && childSize.value > 0) {
              trackType = bytes[valStart];
            } else if (childEl.id === 0x536E) {
              trackName = new TextDecoder().decode(bytes.slice(valStart, valStart + childSize.value)).trim();
            } else if (childEl.id === 0x22B59C || childEl.id === 0x22B59D) {
              const langStr = new TextDecoder().decode(bytes.slice(valStart, valStart + childSize.value)).trim();
              if (langStr) language = langStr;
            } else if (childEl.id === 0x86) {
              codecId = new TextDecoder().decode(bytes.slice(valStart, valStart + childSize.value)).trim();
            } else if (childEl.id === 0xE1) {
              // Audio sub-elements
              let ap = valStart;
              const aEnd = valStart + childSize.value;
              while (ap < aEnd && ap < bytes.length) {
                const aEl = readEbmlElementId(bytes, ap);
                if (!aEl) { ap++; continue; }
                const aSize = readEbmlVint(bytes, ap + aEl.length);
                if (!aSize) { ap++; continue; }
                const aValStart = ap + aEl.length + aSize.length;
                if (aEl.id === 0x9F && aSize.value > 0) {
                  channels = bytes[aValStart];
                } else if (aEl.id === 0xB5 && aSize.value >= 4) {
                  const view = new DataView(bytes.buffer, bytes.byteOffset + aValStart, aSize.value);
                  sampleRate = aSize.value === 4 ? Math.round(view.getFloat32(0)) : Math.round(view.getFloat64(0));
                }
                ap = aValStart + aSize.value;
              }
            }

            p = valStart + childSize.value;
          }

          // Collect Audio tracks (TrackType === 2)
          if (trackType === 2) {
            let readableCodec = codecId.replace(/^A_/, '');
            if (readableCodec.includes('AAC')) readableCodec = 'AAC';
            else if (readableCodec.includes('EAC3')) readableCodec = 'E-AC-3';
            else if (readableCodec.includes('AC3')) readableCodec = 'AC-3';
            else if (readableCodec.includes('OPUS')) readableCodec = 'Opus';
            else if (readableCodec.includes('VORBIS')) readableCodec = 'Vorbis';
            else if (readableCodec.includes('FLAC')) readableCodec = 'FLAC';
            else if (readableCodec.includes('MPEG/L3')) readableCodec = 'MP3';
            else if (readableCodec.includes('DTS')) readableCodec = 'DTS';
            else if (readableCodec.includes('TRUEHD')) readableCodec = 'TrueHD';

            const langName = resolveLanguageName(language);
            const channelDesc = channels === 1 ? 'Mono' : channels === 2 ? 'Stereo' : channels === 6 ? '5.1' : `${channels}ch`;
            // Priority: Release group track name exactly like VLC
            const label = trackName
              ? trackName
              : (language !== 'und'
                  ? `Track ${trackNumber}: ${langName} (${readableCodec} ${channelDesc})`
                  : `Track ${trackNumber}: Audio Track ${trackNumber} (${readableCodec} ${channelDesc})`);

            tracks.push({
              id: `embedded_${trackNumber}`,
              trackId: trackNumber,
              label,
              language: langName,
              languageCode: language !== 'und' ? language : undefined,
              codec: readableCodec,
              channels,
              sampleRate,
              isEmbedded: true
            });
          }

          pos = entryEnd;
        } else {
          pos = pos + trackEntryEl.length + entrySize.length + entrySize.value;
        }
      }
      break;
    }
    offset++;
  }

  return tracks;
}

// ==========================================
// 3. AVI Container Parser
// ==========================================

async function parseAviAudioTracks(file: File): Promise<DetectedAudioTrack[]> {
  try {
    const slice = await file.slice(0, Math.min(file.size, 4 * 1024 * 1024)).arrayBuffer();
    const view = new DataView(slice);
    if (slice.byteLength < 12) return [];

    let riff = '';
    for (let i = 0; i < 4; i++) riff += String.fromCharCode(view.getUint8(i));
    let avi = '';
    for (let i = 0; i < 4; i++) avi += String.fromCharCode(view.getUint8(8 + i));
    if (riff !== 'RIFF' || avi !== 'AVI ') return [];

    const tracks: DetectedAudioTrack[] = [];
    let pos = 12;

    while (pos + 8 <= slice.byteLength) {
      let fourcc = '';
      for (let i = 0; i < 4; i++) fourcc += String.fromCharCode(view.getUint8(pos + i));
      const size = view.getUint32(pos + 4, true); // Little endian
      if (fourcc === 'LIST') {
        let listType = '';
        for (let i = 0; i < 4; i++) listType += String.fromCharCode(view.getUint8(pos + 8 + i));
        if (listType === 'hdrl') {
          // Scan streams inside hdrl
          let sPos = pos + 12;
          const sEnd = pos + 8 + size;
          let streamIdx = 0;
          while (sPos + 12 <= sEnd && sPos + 12 <= slice.byteLength) {
            let sFourcc = '';
            for (let i = 0; i < 4; i++) sFourcc += String.fromCharCode(view.getUint8(sPos + i));
            const sSize = view.getUint32(sPos + 4, true);
            let sType = '';
            for (let i = 0; i < 4; i++) sType += String.fromCharCode(view.getUint8(sPos + 8 + i));

            if (sFourcc === 'LIST' && sType === 'strl') {
              streamIdx++;
              // Search strh inside strl
              let strhPos = sPos + 12;
              const strhEnd = sPos + 8 + sSize;
              let isAudio = false;
              let codec = 'Audio';
              let channels = 2;

              while (strhPos + 8 <= strhEnd && strhPos + 8 <= slice.byteLength) {
                let hFourcc = '';
                for (let i = 0; i < 4; i++) hFourcc += String.fromCharCode(view.getUint8(strhPos + i));
                const hSize = view.getUint32(strhPos + 4, true);

                if (hFourcc === 'strh' && strhPos + 16 <= slice.byteLength) {
                  let fType = '';
                  for (let i = 0; i < 4; i++) fType += String.fromCharCode(view.getUint8(strhPos + 8 + i));
                  if (fType === 'auds') isAudio = true;
                } else if (hFourcc === 'strf' && isAudio && strhPos + 16 <= slice.byteLength) {
                  const tag = view.getUint16(strhPos + 8, true);
                  channels = view.getUint16(strhPos + 10, true) || 2;
                  if (tag === 0x0055) codec = 'MP3';
                  else if (tag === 0x00ff) codec = 'AAC';
                  else if (tag === 0x2000) codec = 'AC-3';
                  else if (tag === 0x0001) codec = 'PCM';
                }
                strhPos += 8 + hSize + (hSize % 2); // Word aligned
              }

              if (isAudio) {
                const label = `Track ${streamIdx}: Audio Track ${streamIdx} (${codec} ${channels === 1 ? 'Mono' : 'Stereo'})`;
                tracks.push({
                  id: `embedded_${streamIdx}`,
                  trackId: streamIdx,
                  label,
                  codec,
                  channels,
                  isEmbedded: true
                });
              }
            }
            sPos += 8 + sSize + (sSize % 2);
          }
          break;
        }
      }
      pos += 8 + size + (size % 2);
    }
    return tracks;
  } catch (err) {
    console.warn('Error parsing AVI container audio tracks:', err);
    return [];
  }
}

// ==========================================
// 4. MPEG-TS Container Parser
// ==========================================

async function parseMpegTsAudioTracks(file: File): Promise<DetectedAudioTrack[]> {
  try {
    const slice = await file.slice(0, Math.min(file.size, 2 * 1024 * 1024)).arrayBuffer();
    const bytes = new Uint8Array(slice);
    if (bytes.length < 376) return [];

    // Verify 0x47 sync byte
    let packetSize = 188;
    if (bytes[0] === 0x47 && bytes[188] === 0x47 && bytes[376] === 0x47) {
      packetSize = 188;
    } else if (bytes[4] === 0x47 && bytes[196] === 0x47) {
      packetSize = 192;
    } else {
      return [];
    }

    const pmtPids = new Set<number>();
    const audioPids = new Map<number, { streamType: number; codec: string }>();

    // Pass 1: find PMT PID from PAT (PID 0)
    for (let i = 0; i + packetSize <= bytes.length; i += packetSize) {
      const pStart = packetSize === 192 ? i + 4 : i;
      if (bytes[pStart] !== 0x47) continue;

      const pid = ((bytes[pStart + 1] & 0x1f) << 8) | bytes[pStart + 2];
      const payloadStart = (bytes[pStart + 1] & 0x40) !== 0;

      if (pid === 0 && payloadStart) {
        // PAT
        const afc = (bytes[pStart + 3] >> 4) & 0x3;
        let pOffset = pStart + 4;
        if (afc === 2) continue;
        if (afc === 3) pOffset += 1 + bytes[pOffset];
        pOffset += 1 + bytes[pOffset]; // pointer field

        if (pOffset + 12 <= bytes.length && bytes[pOffset] === 0x00) {
          const sectionLen = ((bytes[pOffset + 1] & 0x0f) << 8) | bytes[pOffset + 2];
          let sPos = pOffset + 8;
          const sEnd = pOffset + 3 + sectionLen - 4;
          while (sPos + 4 <= sEnd && sPos + 4 <= bytes.length) {
            const progNum = (bytes[sPos] << 8) | bytes[sPos + 1];
            const pmtPid = ((bytes[sPos + 2] & 0x1f) << 8) | bytes[sPos + 3];
            if (progNum !== 0) pmtPids.add(pmtPid);
            sPos += 4;
          }
        }
      }
    }

    // Pass 2: parse PMT to find audio elementary streams
    for (let i = 0; i + packetSize <= bytes.length; i += packetSize) {
      const pStart = packetSize === 192 ? i + 4 : i;
      if (bytes[pStart] !== 0x47) continue;

      const pid = ((bytes[pStart + 1] & 0x1f) << 8) | bytes[pStart + 2];
      if (pmtPids.has(pid)) {
        const afc = (bytes[pStart + 3] >> 4) & 0x3;
        let pOffset = pStart + 4;
        if (afc === 2) continue;
        if (afc === 3) pOffset += 1 + bytes[pOffset];
        pOffset += 1 + bytes[pOffset]; // pointer field

        if (pOffset + 16 <= bytes.length && bytes[pOffset] === 0x02) {
          const sectionLen = ((bytes[pOffset + 1] & 0x0f) << 8) | bytes[pOffset + 2];
          const progInfoLen = ((bytes[pOffset + 10] & 0x0f) << 8) | bytes[pOffset + 11];
          let esPos = pOffset + 12 + progInfoLen;
          const esEnd = pOffset + 3 + sectionLen - 4;

          while (esPos + 5 <= esEnd && esPos + 5 <= bytes.length) {
            const streamType = bytes[esPos];
            const elemPid = ((bytes[esPos + 1] & 0x1f) << 8) | bytes[esPos + 2];
            const esInfoLen = ((bytes[esPos + 3] & 0x0f) << 8) | bytes[esPos + 4];

            let codec = '';
            if (streamType === 0x03 || streamType === 0x04) codec = 'MP3';
            else if (streamType === 0x0f || streamType === 0x11) codec = 'AAC';
            else if (streamType === 0x81) codec = 'AC-3';
            else if (streamType === 0x87) codec = 'E-AC-3';
            else if (streamType === 0x82 || streamType === 0x85 || streamType === 0x86) codec = 'DTS';

            if (codec && !audioPids.has(elemPid)) {
              audioPids.set(elemPid, { streamType, codec });
            }
            esPos += 5 + esInfoLen;
          }
        }
      }
    }

    const tracks: DetectedAudioTrack[] = [];
    let idx = 1;
    audioPids.forEach((info, elemPid) => {
      tracks.push({
        id: `embedded_${idx}`,
        trackId: idx,
        label: `Track ${idx}: Audio Stream ${idx} (PID 0x${elemPid.toString(16).toUpperCase()} [${info.codec}])`,
        codec: info.codec,
        isEmbedded: true
      });
      idx++;
    });

    return tracks;
  } catch (err) {
    console.warn('Error parsing MPEG-TS container audio tracks:', err);
    return [];
  }
}

// ==========================================
// 5. Main Exported Detection Function
// ==========================================

/**
 * Inspects a video file's container headers to detect all embedded audio tracks.
 * Supports MP4, MOV, M4V, MKV, WebM, AVI, and MPEG-TS.
 */
export async function detectEmbeddedAudioTracks(file: File): Promise<DetectedAudioTrack[]> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  try {
    // 1. MP4 / MOV / M4V / 3GP
    if (['mp4', 'm4v', 'mov', '3gp'].includes(ext)) {
      const moovBuf = await findAndReadMp4Moov(file);
      if (moovBuf) {
        const tracks = parseMp4AudioTracksFromBuffer(moovBuf);
        if (tracks.length > 0) return tracks;
      }
    }

    // 2. Matroska (MKV) / WebM
    if (['mkv', 'webm'].includes(ext)) {
      const tracksBuf = await findAndReadMatroskaTracks(file);
      if (tracksBuf) {
        const tracks = parseMatroskaAudioTracksFromBuffer(tracksBuf);
        if (tracks.length > 0) return tracks;
      }
    }

    // 3. AVI
    if (ext === 'avi') {
      const aviTracks = await parseAviAudioTracks(file);
      if (aviTracks.length > 0) return aviTracks;
    }

    // 4. MPEG-TS / M2TS
    if (['ts', 'm2ts', 'mts'].includes(ext)) {
      const tsTracks = await parseMpegTsAudioTracks(file);
      if (tsTracks.length > 0) return tsTracks;
    }

    // 5. Universal Signature Detection if extension was ambiguous
    const headSlice = await file.slice(0, Math.min(file.size, 64 * 1024)).arrayBuffer();
    if (isEbmlSignature(headSlice)) {
      const tracksBuf = await findAndReadMatroskaTracks(file);
      if (tracksBuf) {
        const tracks = parseMatroskaAudioTracksFromBuffer(tracksBuf);
        if (tracks.length > 0) return tracks;
      }
    }

    if (isMp4Signature(headSlice)) {
      const moovBuf = await findAndReadMp4Moov(file);
      if (moovBuf) {
        const tracks = parseMp4AudioTracksFromBuffer(moovBuf);
        if (tracks.length > 0) return tracks;
      }
    }

    if (isAviSignature(headSlice)) {
      const aviTracks = await parseAviAudioTracks(file);
      if (aviTracks.length > 0) return aviTracks;
    }

    if (isMpegTsSignature(headSlice)) {
      const tsTracks = await parseMpegTsAudioTracks(file);
      if (tsTracks.length > 0) return tsTracks;
    }
  } catch (err) {
    console.warn('[MediaMetadata] Failed to inspect embedded container audio tracks:', err);
  }

  return [];
}

function isMp4Signature(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 12) return false;
  const view = new Uint8Array(buffer, 4, 4);
  const type = String.fromCharCode(...view);
  return type === 'ftyp' || type === 'moov' || type === 'mdat' || type === 'wide' || type === 'free' || type === 'skip';
}

function isEbmlSignature(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) return false;
  const view = new Uint8Array(buffer, 0, 4);
  return view[0] === 0x1A && view[1] === 0x45 && view[2] === 0xDF && view[3] === 0xA3;
}

function isAviSignature(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 12) return false;
  const view = new Uint8Array(buffer);
  const riff = String.fromCharCode(view[0], view[1], view[2], view[3]);
  const avi = String.fromCharCode(view[8], view[9], view[10], view[11]);
  return riff === 'RIFF' && avi === 'AVI ';
}

function isMpegTsSignature(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 376) return false;
  const view = new Uint8Array(buffer);
  return (view[0] === 0x47 && view[188] === 0x47) || (view[4] === 0x47 && view[196] === 0x47);
}

// ==========================================
// 6. MP4 AAC Audio Track Extractor
// ==========================================

/**
 * Extracts an embedded AAC audio track from an MP4 file container into a playable audio/aac Blob.
 * Prepends ADTS headers to raw AAC samples, allowing standard HTML5 <audio> to play any
 * embedded secondary track directly in lockstep with the primary video.
 */
export async function extractMp4AudioTrack(file: File, trackId: number): Promise<string | null> {
  try {
    const moovSlice = await findAndReadMp4Moov(file);
    if (!moovSlice) return null;

    const view = new DataView(moovSlice);
    const rootBoxes = scanMp4Boxes(view, 0, moovSlice.byteLength);
    const moov = rootBoxes.find(b => b.type === 'moov');
    const mStart = moov ? moov.start : 8;
    const mEnd = moov ? moov.end : moovSlice.byteLength;

    const trakBoxes = scanMp4Boxes(view, mStart, mEnd).filter(b => b.type === 'trak');
    let targetTrak: Mp4Box | null = null;
    let fallbackTrak: Mp4Box | null = null;

    for (const trak of trakBoxes) {
      const trakChildren = scanMp4Boxes(view, trak.start, trak.end);
      const mdia = trakChildren.find(b => b.type === 'mdia');
      if (!mdia) continue;
      const mdiaChildren = scanMp4Boxes(view, mdia.start, mdia.end);
      const hdlr = mdiaChildren.find(b => b.type === 'hdlr');
      if (!hdlr) continue;
      let hType = '';
      for (let i = 0; i < 4; i++) hType += String.fromCharCode(view.getUint8(hdlr.start + 8 + i));
      if (hType !== 'soun') continue;

      const tkhd = trakChildren.find(b => b.type === 'tkhd');
      if (tkhd) {
        const ver = view.getUint8(tkhd.start);
        const tid = ver === 0 ? view.getUint32(tkhd.start + 12) : view.getUint32(tkhd.start + 20);
        if (tid === trackId) {
          targetTrak = trak;
          break;
        }
      }
      if (!fallbackTrak) fallbackTrak = trak;
    }

    const trakToExtract = targetTrak || fallbackTrak;
    if (!trakToExtract) return null;

    const trakChildren = scanMp4Boxes(view, trakToExtract.start, trakToExtract.end);
    const mdia = trakChildren.find(b => b.type === 'mdia');
    if (!mdia) return null;
    const mdiaChildren = scanMp4Boxes(view, mdia.start, mdia.end);
    const minf = mdiaChildren.find(b => b.type === 'minf');
    if (!minf) return null;
    const minfChildren = scanMp4Boxes(view, minf.start, minf.end);
    const stbl = minfChildren.find(b => b.type === 'stbl');
    if (!stbl) return null;
    const stblChildren = scanMp4Boxes(view, stbl.start, stbl.end);

    const stsd = stblChildren.find(b => b.type === 'stsd');
    const stsz = stblChildren.find(b => b.type === 'stsz');
    const stco = stblChildren.find(b => b.type === 'stco' || b.type === 'co64');
    const stsc = stblChildren.find(b => b.type === 'stsc');

    if (!stsd || !stsz || !stco || !stsc) return null;

    let isAac = false;
    let profile = 2; // AAC LC
    let freqIndex = 4; // 44100 Hz
    let channelConfig = 2; // Stereo

    for (let i = stsd.start; i < stsd.end - 4; i++) {
      if (
        view.getUint8(i) === 0x6d &&
        view.getUint8(i + 1) === 0x70 &&
        view.getUint8(i + 2) === 0x34 &&
        view.getUint8(i + 3) === 0x61
      ) {
        isAac = true;
        break;
      }
    }

    if (!isAac) return null;

    // Try to find AudioSpecificConfig inside esds
    for (let i = stsd.start; i < stsd.end - 6; i++) {
      if (
        view.getUint8(i) === 0x65 &&
        view.getUint8(i + 1) === 0x73 &&
        view.getUint8(i + 2) === 0x64 &&
        view.getUint8(i + 3) === 0x73
      ) {
        for (let j = i + 8; j < Math.min(stsd.end - 2, i + 64); j++) {
          if (view.getUint8(j) === 0x05) {
            const ascLen = view.getUint8(j + 1);
            if (ascLen >= 2) {
              const b0 = view.getUint8(j + 2);
              const b1 = view.getUint8(j + 3);
              profile = (b0 >> 3) & 0x1f || 2;
              freqIndex = ((b0 & 0x07) << 1) | ((b1 >> 7) & 0x01);
              channelConfig = (b1 >> 3) & 0x0f || 2;
              break;
            }
          }
        }
        break;
      }
    }

    // Read stsz (sample sizes)
    const stszSampleSize = view.getUint32(stsz.start + 4);
    const sampleCount = view.getUint32(stsz.start + 8);
    const sampleSizes: number[] = new Array(sampleCount);
    if (stszSampleSize !== 0) {
      sampleSizes.fill(stszSampleSize);
    } else {
      let sPos = stsz.start + 12;
      for (let i = 0; i < sampleCount; i++) {
        sampleSizes[i] = view.getUint32(sPos);
        sPos += 4;
      }
    }

    // Read stco/co64 (chunk offsets)
    const isCo64 = stco.type === 'co64';
    const chunkCount = view.getUint32(stco.start + 4);
    const chunkOffsets: number[] = new Array(chunkCount);
    let cPos = stco.start + 8;
    for (let i = 0; i < chunkCount; i++) {
      chunkOffsets[i] = isCo64
        ? Number(view.getBigUint64(cPos))
        : view.getUint32(cPos);
      cPos += isCo64 ? 8 : 4;
    }

    // Read stsc (sample to chunk)
    const stscCount = view.getUint32(stsc.start + 4);
    interface StscEntry { firstChunk: number; samplesPerChunk: number }
    const stscEntries: StscEntry[] = new Array(stscCount);
    let scPos = stsc.start + 8;
    for (let i = 0; i < stscCount; i++) {
      stscEntries[i] = {
        firstChunk: view.getUint32(scPos),
        samplesPerChunk: view.getUint32(scPos + 4)
      };
      scPos += 12;
    }

    // Calculate samples per chunk
    const samplesPerChunk: number[] = new Array(chunkCount);
    let stscIdx = 0;
    for (let c = 1; c <= chunkCount; c++) {
      if (stscIdx + 1 < stscCount && c >= stscEntries[stscIdx + 1].firstChunk) {
        stscIdx++;
      }
      samplesPerChunk[c - 1] = stscEntries[stscIdx].samplesPerChunk;
    }

    // Reconstruct AAC stream with ADTS headers
    let sampleIdx = 0;
    const aacChunks: BlobPart[] = [];

    for (let c = 0; c < chunkCount; c++) {
      const cOffset = chunkOffsets[c];
      const countInChunk = samplesPerChunk[c];
      let chunkByteLen = 0;
      for (let s = 0; s < countInChunk && sampleIdx + s < sampleCount; s++) {
        chunkByteLen += sampleSizes[sampleIdx + s];
      }

      if (chunkByteLen === 0) continue;

      const rawChunkSlice = await file.slice(cOffset, cOffset + chunkByteLen).arrayBuffer();
      const rawChunkBytes = new Uint8Array(rawChunkSlice);

      const adtsChunkBuffer = new Uint8Array(chunkByteLen + countInChunk * 7);
      let readOffset = 0;
      let writeOffset = 0;

      for (let s = 0; s < countInChunk && sampleIdx < sampleCount; s++) {
        const sSize = sampleSizes[sampleIdx];
        const packetLen = sSize + 7;

        // ADTS Header (7 bytes)
        adtsChunkBuffer[writeOffset] = 0xff;
        adtsChunkBuffer[writeOffset + 1] = 0xf1;
        adtsChunkBuffer[writeOffset + 2] = ((profile - 1) << 6) | (freqIndex << 2) | (channelConfig >> 2);
        adtsChunkBuffer[writeOffset + 3] = ((channelConfig & 3) << 6) | (packetLen >> 11);
        adtsChunkBuffer[writeOffset + 4] = (packetLen >> 3) & 0xff;
        adtsChunkBuffer[writeOffset + 5] = ((packetLen & 7) << 5) | 0x1f;
        adtsChunkBuffer[writeOffset + 6] = 0xfc;
        writeOffset += 7;

        adtsChunkBuffer.set(rawChunkBytes.subarray(readOffset, readOffset + sSize), writeOffset);
        writeOffset += sSize;
        readOffset += sSize;
        sampleIdx++;
      }

      aacChunks.push(adtsChunkBuffer);
    }

    const aacBlob = new Blob(aacChunks, { type: 'audio/aac' });
    return URL.createObjectURL(aacBlob);
  } catch (err) {
    console.warn('[MediaMetadata] Failed to extract AAC audio track from MP4:', err);
    return null;
  }
}

/**
 * Convert SubRip (.srt) subtitle text to standard WebVTT (.vtt) format for HTML5 video
 */
export function srtToVtt(srtText: string): string {
  const normalized = srtText.replace(/\r\n|\r/g, '\n').trim();
  const vttCues = normalized.replace(/(\d{1,2}:\d{2}:\d{2}),(\d{3})/g, (_match, time, ms) => {
    const parts = time.split(':');
    const hh = parts[0].padStart(2, '0');
    return `${hh}:${parts[1]}:${parts[2]}.${ms}`;
  });
  return `WEBVTT\n\n${vttCues}`;
}
