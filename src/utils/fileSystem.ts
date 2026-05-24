export type FileType = 'video' | 'audio' | 'pdf' | 'markdown' | 'text' | 'image' | 'code' | 'html' | 'subtitle' | 'url' | 'unknown';

export interface SubtitleTrack {
  label: string;
  srclang: string;
  handle?: FileSystemFileHandle;
  file?: File;
}

export interface CourseFile {
  name: string;
  path: string;
  type: FileType;
  handle?: FileSystemFileHandle;
  file?: File;
  size: number;
  subtitles?: SubtitleTrack[];
}

export interface CourseFolder {
  name: string;
  path: string;
  files: CourseFile[];
  subfolders: CourseFolder[];
}

export interface CourseData {
  title: string;
  structure: CourseFolder;
  flatLessons: CourseFile[];
}

// Map extensions to our supported Course file types
export function getFileType(fileName: string): FileType {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  
  if (ext === 'vtt') {
    return 'subtitle';
  }
  if (ext === 'url') {
    return 'url';
  }
  if (['mp4', 'webm', 'ogg', 'mkv', 'mov'].includes(ext)) {
    return 'video';
  }
  if (['mp3', 'wav', 'aac', 'flac', 'm4a'].includes(ext)) {
    return 'audio';
  }
  if (ext === 'pdf') {
    return 'pdf';
  }
  if (ext === 'md') {
    return 'markdown';
  }
  if (ext === 'txt') {
    return 'text';
  }
  if (['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'].includes(ext)) {
    return 'image';
  }
  if (ext === 'html') {
    return 'html';
  }
  if (['css', 'js', 'ts', 'tsx', 'json', 'py', 'java', 'cpp', 'c', 'sh'].includes(ext)) {
    return 'code';
  }
  
  return 'unknown';
}

// Extends files or folder names with a sorting rank based on numerical prefixes
// E.g. "01-Intro" -> 1, "Lesson 10" -> 10, "Basics" -> Infinity (sorts last)
function getSortRank(name: string): number {
  const cleanName = name.trim();
  // Match prefix numbers like "01", "1.2", "1_2", "1-2"
  const match = cleanName.match(/^(\d+(?:\.\d+)?)/);
  if (match) {
    return parseFloat(match[1]);
  }
  return Infinity; // Put non-numbered items at the end
}

// Compare two names alphabetically or by numeric prefix
export function compareNames(a: string, b: string): number {
  const rankA = getSortRank(a);
  const rankB = getSortRank(b);
  
  if (rankA !== rankB) {
    return rankA - rankB;
  }
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export function matchSubtitles(folder: CourseFolder) {
  const vttFiles = folder.files.filter(f => f.type === 'subtitle');
  const videoFiles = folder.files.filter(f => f.type === 'video');

  vttFiles.forEach(vtt => {
    const vttBase = vtt.name.substring(0, vtt.name.lastIndexOf('.'));
    const matchingVideo = videoFiles.find(video => {
      const videoBase = video.name.substring(0, video.name.lastIndexOf('.')).toLowerCase();
      return vttBase.toLowerCase().startsWith(videoBase);
    });

    if (matchingVideo) {
      if (!matchingVideo.subtitles) {
        matchingVideo.subtitles = [];
      }
      
      const parts = vtt.name.split('.');
      let lang = 'en';
      let label = 'English';
      
      if (parts.length > 2) {
        const potentialLang = parts[parts.length - 2].toLowerCase();
        if (potentialLang.length === 2) {
          lang = potentialLang;
          const langMap: Record<string, string> = {
            en: 'English',
            es: 'Spanish',
            fr: 'French',
            de: 'German',
            zh: 'Chinese',
            ja: 'Japanese',
            ko: 'Korean',
            pt: 'Portuguese',
            it: 'Italian',
            ru: 'Russian'
          };
          label = langMap[lang] || lang.toUpperCase();
        }
      }
      
      matchingVideo.subtitles.push({
        label,
        srclang: lang,
        handle: vtt.handle,
        file: vtt.file
      });
    }
  });

  folder.subfolders.forEach(matchSubtitles);
}

/**
 * Recursively parse directory structure using File System Access API
 */
export async function parseDirectory(
  directoryHandle: FileSystemDirectoryHandle,
  currentPath = ''
): Promise<CourseFolder> {
  const folder: CourseFolder = {
    name: directoryHandle.name,
    path: currentPath || directoryHandle.name,
    files: [],
    subfolders: []
  };

  for await (const entry of directoryHandle.values()) {
    const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
    
    if (entry.kind === 'file') {
      const file = await entry.getFile();
      const type = getFileType(entry.name);
      
      // We skip common hidden files and system trash files
      if (entry.name.startsWith('.') || entry.name === 'Thumbs.db') continue;

      folder.files.push({
        name: entry.name,
        path: entryPath,
        type,
        handle: entry,
        size: file.size
      });
    } else if (entry.kind === 'directory') {
      // Skip common hidden folders like .git, .vscode, node_modules
      if (entry.name.startsWith('.') || ['node_modules', 'dist', 'out'].includes(entry.name)) continue;

      const subFolder = await parseDirectory(entry, entryPath);
      // Only include subfolder if it has contents
      if (subFolder.files.length > 0 || subFolder.subfolders.length > 0) {
        folder.subfolders.push(subFolder);
      }
    }
  }

  // Sort files and folders numerically
  folder.files.sort((a, b) => compareNames(a.name, b.name));
  folder.subfolders.sort((a, b) => compareNames(a.name, b.name));

  return folder;
}

/**
 * Parse a flat array of Files from directory upload fallback
 */
export function parseFileList(files: FileList | File[]): CourseData {
  const fileArray = Array.from(files).filter(file => {
    const parts = file.webkitRelativePath.split('/');
    // Skip hidden files/directories
    return !parts.some(part => part.startsWith('.') || part === 'node_modules' || part === 'Thumbs.db');
  });

  if (fileArray.length === 0) {
    throw new Error('No files found in the directory.');
  }

  // Find the root folder name
  const firstPath = fileArray[0].webkitRelativePath;
  const rootDirName = firstPath.split('/')[0] || 'Local Course';

  const rootFolder: CourseFolder = {
    name: rootDirName,
    path: rootDirName,
    files: [],
    subfolders: []
  };

  // Build tree structure
  fileArray.forEach(file => {
    const relPath = file.webkitRelativePath;
    const parts = relPath.split('/');
    // parts[0] is root directory name
    
    let currentFolder = rootFolder;
    
    // Trailing parts
    for (let i = 1; i < parts.length - 1; i++) {
      const folderName = parts[i];
      const folderPath = parts.slice(0, i + 1).join('/');
      
      let nextFolder = currentFolder.subfolders.find(f => f.name === folderName);
      if (!nextFolder) {
        nextFolder = {
          name: folderName,
          path: folderPath,
          files: [],
          subfolders: []
        };
        currentFolder.subfolders.push(nextFolder);
      }
      currentFolder = nextFolder;
    }

    const fileName = parts[parts.length - 1];
    const fileType = getFileType(fileName);
    
    currentFolder.files.push({
      name: fileName,
      path: relPath,
      type: fileType,
      file: file,
      size: file.size
    });
  });

  // Sort helper function
  const sortFolder = (f: CourseFolder) => {
    f.files.sort((a, b) => compareNames(a.name, b.name));
    f.subfolders.sort((a, b) => compareNames(a.name, b.name));
    f.subfolders.forEach(sortFolder);
  };
  
  sortFolder(rootFolder);
  matchSubtitles(rootFolder);

  // Flatten active lessons for playback queue
  const flatLessons: CourseFile[] = [];
  const collectLessons = (f: CourseFolder) => {
    f.files.forEach(file => {
      // Only include playable/viewable files in general course list
      if (['video', 'audio', 'pdf', 'markdown', 'text', 'code', 'html', 'subtitle', 'url'].includes(file.type)) {
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
 * Complete directory parse to CourseData (for showDirectoryPicker)
 */
export function buildCourseDataFromFolder(rootFolder: CourseFolder): CourseData {
  matchSubtitles(rootFolder);
  const flatLessons: CourseFile[] = [];
  const collectLessons = (f: CourseFolder) => {
    f.files.forEach(file => {
      if (['video', 'audio', 'pdf', 'markdown', 'text', 'code', 'html', 'subtitle', 'url'].includes(file.type)) {
        flatLessons.push(file);
      }
    });
    f.subfolders.forEach(collectLessons);
  };
  collectLessons(rootFolder);

  return {
    title: rootFolder.name,
    structure: rootFolder,
    flatLessons
  };
}

/**
 * Read File from file system handle or raw File upload
 */
export async function getFileObject(courseFile: CourseFile): Promise<File> {
  if (courseFile.file) {
    return courseFile.file;
  }
  if (courseFile.handle) {
    return await courseFile.handle.getFile();
  }
  throw new Error(`Cannot retrieve file object for ${courseFile.path}`);
}
