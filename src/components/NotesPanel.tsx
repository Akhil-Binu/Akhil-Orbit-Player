import React, { useState, useEffect } from 'react';
import { FileText, Edit3, Eye, Download } from 'lucide-react';

interface NotesPanelProps {
  courseId: string;
  lessonPath: string;
}

// Custom simple Markdown-to-HTML parser
function parseMarkdown(md: string): string {
  if (!md) return '<p style="color: var(--text-muted); font-style: italic;">No notes taken yet. Start typing above!</p>';

  // Step 1: Escape HTML characters for basic safety
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Step 2: Blockquotes (handle after escape, restoring &gt;)
  html = html.replace(/^&gt;\s+(.*)$/gm, '<blockquote>$1</blockquote>');

  // Step 3: Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, __, code) => {
    return `<pre><code>${code.trim()}</code></pre>`;
  });

  // Step 4: Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Step 5: Task list items
  html = html.replace(/^- \[ \] (.*)$/gm, '<li style="list-style: none;"><input type="checkbox" disabled style="margin-right: 8px;" />$1</li>');
  html = html.replace(/^- \[x\] (.*)$/gm, '<li style="list-style: none;"><input type="checkbox" checked disabled style="margin-right: 8px;" />$1</li>');

  // Step 6: Bullet lists
  html = html.replace(/^- (.*)$/gm, '<li>$1</li>');
  
  // Step 7: Headers
  html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*)$/gm, '<h1>$1</h1>');

  // Step 8: Bold & Italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Step 9: Clean up paragraphs and spacing
  const lines = html.split('\n');
  const processedLines = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('<h') || 
        trimmed.startsWith('<pre') || 
        trimmed.startsWith('</pre') ||
        trimmed.startsWith('<code') || 
        trimmed.startsWith('</code') || 
        trimmed.startsWith('<li') || 
        trimmed.startsWith('<ul') ||
        trimmed.startsWith('<blockquote>') ||
        trimmed.startsWith('</blockquote>')) {
      return line;
    }
    return `<p>${line}</p>`;
  });

  return processedLines.filter(l => l !== '').join('\n');
}

export const NotesPanel: React.FC<NotesPanelProps> = ({ courseId, lessonPath }) => {
  const storageKey = `notes_${courseId}_${lessonPath}`;
  const [noteText, setNoteText] = useState('');
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [isSaved, setIsSaved] = useState(false);

  // Load notes on mount/lesson switch
  useEffect(() => {
    const savedNote = localStorage.getItem(storageKey) || '';
    setNoteText(savedNote);
    setIsSaved(false);
  }, [storageKey]);

  // Auto-save notes
  useEffect(() => {
    if (!noteText) {
      localStorage.removeItem(storageKey);
      return;
    }
    
    const timer = setTimeout(() => {
      localStorage.setItem(storageKey, noteText);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000); // Reset indicator
    }, 1000); // Debounce save by 1 second

    return () => clearTimeout(timer);
  }, [noteText, storageKey]);

  const handleDownload = () => {
    const blob = new Blob([noteText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    // Clean up filename
    const fileName = lessonPath.split('/').pop()?.split('.')[0] || 'lesson_notes';
    link.href = url;
    link.download = `${fileName}_notes.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
      {/* Header Panel */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={20} style={{ color: 'var(--color-primary)' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Lesson Notes</h3>
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {isSaved ? 'Auto-saved' : 'Autosaving...'}
        </span>
      </div>

      {/* Tabs Menu */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', gap: '12px' }}>
        <button
          onClick={() => setMode('edit')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: mode === 'edit' ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: mode === 'edit' ? 'var(--text-primary)' : 'var(--text-secondary)',
            padding: '4px 8px',
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: 500
          }}
        >
          <Edit3 size={14} />
          Editor
        </button>
        <button
          onClick={() => setMode('preview')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: mode === 'preview' ? '2px solid var(--color-primary)' : '2px solid transparent',
            color: mode === 'preview' ? 'var(--text-primary)' : 'var(--text-secondary)',
            padding: '4px 8px',
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: 500
          }}
        >
          <Eye size={14} />
          Preview
        </button>
        {noteText.trim() && (
          <button
            onClick={handleDownload}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              marginLeft: 'auto',
              padding: '4px 8px',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'color var(--transition-fast)'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
          >
            <Download size={14} />
            Export (.md)
          </button>
        )}
      </div>

      {/* Editor or Preview Pane */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '0px' }}>
        {mode === 'edit' ? (
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Take notes for this lesson. Supports standard markdown formatting (e.g. # headers, **bold**, *italic*, - bullet points, `code` blocks, etc.)"
            style={{
              flex: 1,
              width: '100%',
              resize: 'none',
              background: 'rgba(255, 255, 255, 0.01)',
              fontSize: '0.92rem',
              lineHeight: '1.6',
              padding: '12px',
              fontFamily: 'inherit',
              borderRadius: '8px',
              border: '1px solid var(--border-color)'
            }}
          />
        ) : (
          <div
            className="markdown-body"
            dangerouslySetInnerHTML={{ __html: parseMarkdown(noteText) }}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px',
              background: 'rgba(255, 255, 255, 0.01)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)'
            }}
          />
        )}
      </div>
    </div>
  );
};
