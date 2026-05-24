import React, { useState } from 'react';
import { Bookmark, Play, Trash2, Plus } from 'lucide-react';

export interface VideoBookmark {
  id: string;
  timestamp: number; // in seconds
  note: string;
  createdAt: number;
}

interface BookmarksPanelProps {
  bookmarks: VideoBookmark[];
  currentTime: number;
  onAddBookmark: (timestamp: number, note: string) => void;
  onDeleteBookmark: (id: string) => void;
  onSeek: (timestamp: number) => void;
}

export const BookmarksPanel: React.FC<BookmarksPanelProps> = ({
  bookmarks,
  currentTime,
  onAddBookmark,
  onDeleteBookmark,
  onSeek
}) => {
  const [newNote, setNewNote] = useState('');

  const formatTime = (secs: number) => {
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    onAddBookmark(currentTime, newNote.trim());
    setNewNote('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Bookmark size={20} className="text-primary" style={{ color: 'var(--color-primary)' }} />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Lesson Bookmarks</h3>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Bookmark current time: <code style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>{formatTime(currentTime)}</code>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Add note at current timestamp..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            style={{ flex: 1, fontSize: '0.9rem', padding: '8px 12px' }}
          />
          <button
            type="submit"
            style={{
              background: 'var(--gradient-accent)',
              border: 'none',
              borderRadius: '8px',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'white',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <Plus size={18} />
          </button>
        </div>
      </form>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          paddingRight: '4px'
        }}
      >
        {bookmarks.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '120px',
              color: 'var(--text-muted)',
              fontSize: '0.9rem',
              textAlign: 'center',
              border: '1px dashed var(--border-color)',
              borderRadius: '12px',
              padding: '16px'
            }}
          >
            <Bookmark size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
            No bookmarks yet. Add one at key moments in the video!
          </div>
        ) : (
          bookmarks
            .sort((a, b) => a.timestamp - b.timestamp)
            .map((bookmark) => (
              <div
                key={bookmark.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  padding: '12px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  gap: '8px',
                  transition: 'background var(--transition-fast)'
                }}
                className="bookmark-item"
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                  <button
                    onClick={() => onSeek(bookmark.timestamp)}
                    style={{
                      alignSelf: 'flex-start',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'var(--bg-active)',
                      color: 'var(--color-primary)',
                      border: 'none',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <Play size={10} fill="currentColor" />
                    {formatTime(bookmark.timestamp)}
                  </button>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                    {bookmark.note}
                  </p>
                </div>
                <button
                  onClick={() => onDeleteBookmark(bookmark.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'color var(--transition-fast)'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
        )}
      </div>
    </div>
  );
};
