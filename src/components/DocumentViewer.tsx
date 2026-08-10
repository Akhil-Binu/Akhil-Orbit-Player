import React from 'react';
import { DocxViewer } from './DocxViewer';
import { PptxViewer } from './PptxViewer';
import { SpreadsheetViewer } from './SpreadsheetViewer';
import { PdfViewer } from './PdfViewer';
import { FileText, Download } from 'lucide-react';
import type { CourseFile } from '../utils/fileSystem';

interface DocumentViewerProps {
  lesson: CourseFile;
  fileObj: File;
  contentUrl?: string | null;
  onToggleCompleted?: (path: string) => void;
  isCompleted?: boolean;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  lesson,
  fileObj,
  contentUrl,
  onToggleCompleted,
  isCompleted = false
}) => {
  const ext = lesson.name.split('.').pop()?.toLowerCase() || '';

  // 1. PDF Documents (.pdf)
  if (ext === 'pdf' && contentUrl) {
    return (
      <PdfViewer
        lesson={lesson}
        fileObj={fileObj}
        contentUrl={contentUrl}
        onToggleCompleted={onToggleCompleted}
        isCompleted={isCompleted}
      />
    );
  }

  // 2. Word Documents (.docx, .doc, .dotx, .odt, .rtf)
  if (['docx', 'doc', 'dotx', 'odt', 'rtf'].includes(ext)) {
    return (
      <DocxViewer
        lesson={lesson}
        fileObj={fileObj}
        onToggleCompleted={onToggleCompleted}
        isCompleted={isCompleted}
      />
    );
  }

  // 3. PowerPoint Presentations (.pptx, .ppt, .ppsx, .odp)
  if (['pptx', 'ppt', 'ppsx', 'odp'].includes(ext)) {
    return (
      <PptxViewer
        lesson={lesson}
        fileObj={fileObj}
        onToggleCompleted={onToggleCompleted}
        isCompleted={isCompleted}
      />
    );
  }

  // 4. Spreadsheets (.xlsx, .xls, .csv, .tsv, .ods)
  if (['xlsx', 'xls', 'csv', 'tsv', 'ods'].includes(ext)) {
    return (
      <SpreadsheetViewer
        lesson={lesson}
        fileObj={fileObj}
        onToggleCompleted={onToggleCompleted}
        isCompleted={isCompleted}
      />
    );
  }

  // 5. General Document Fallback
  const handleDownload = () => {
    const url = URL.createObjectURL(fileObj);
    const a = document.createElement('a');
    a.href = url;
    a.download = lesson.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      gap: '16px'
    }}>
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        padding: '40px',
        textAlign: 'center',
        gap: '16px'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '16px',
          background: 'rgba(99, 102, 241, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-primary)'
        }}>
          <FileText size={32} />
        </div>

        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
            {lesson.name}
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, maxWidth: '420px' }}>
            Document format (.{ext.toUpperCase()}) is ready. Download to open directly in your local desktop application.
          </p>
        </div>

        <button
          onClick={handleDownload}
          style={{
            background: 'var(--gradient-accent)',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '8px',
            fontSize: '0.88rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: 'var(--shadow-md)'
          }}
        >
          <Download size={16} />
          Download Document
        </button>
      </div>
    </div>
  );
};
