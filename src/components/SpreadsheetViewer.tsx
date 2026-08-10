import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  Download, Search, RefreshCw, 
  CheckCircle2, AlertTriangle, Layers, FileSpreadsheet
} from 'lucide-react';
import type { CourseFile } from '../utils/fileSystem';

interface SpreadsheetViewerProps {
  lesson: CourseFile;
  fileObj: File;
  onToggleCompleted?: (path: string) => void;
  isCompleted?: boolean;
}

export const SpreadsheetViewer: React.FC<SpreadsheetViewerProps> = ({
  lesson,
  fileObj,
  onToggleCompleted,
  isCompleted = false
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheetName, setActiveSheetName] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const rowsPerPage = 100;

  useEffect(() => {
    let isCancelled = false;

    const parseSpreadsheet = async () => {
      setLoading(true);
      setError(null);
      setWorkbook(null);
      setSheetNames([]);
      setActiveSheetName('');

      try {
        const buffer = await fileObj.arrayBuffer();
        if (isCancelled) return;

        const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
        if (wb.SheetNames.length === 0) {
          throw new Error('Spreadsheet contains no worksheets.');
        }

        if (!isCancelled) {
          setWorkbook(wb);
          setSheetNames(wb.SheetNames);
          setActiveSheetName(wb.SheetNames[0]);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          console.error('Error parsing spreadsheet:', err);
          setError((err as Error).message || 'Failed to parse spreadsheet file.');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    parseSpreadsheet();

    return () => {
      isCancelled = true;
    };
  }, [fileObj, lesson]);

  // Convert active sheet to 2D array matrix
  const sheetData = useMemo(() => {
    if (!workbook || !activeSheetName) return [];
    const sheet = workbook.Sheets[activeSheetName];
    if (!sheet) return [];
    
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '' });
    return rows;
  }, [workbook, activeSheetName]);

  // Filter rows based on search query
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return sheetData;
    const term = searchQuery.toLowerCase();
    return sheetData.filter((row, idx) => {
      if (idx === 0) return true; // keep header
      return row.some(cell => String(cell).toLowerCase().includes(term));
    });
  }, [sheetData, searchQuery]);

  // Paginated rows for high-performance rendering
  const totalPages = Math.ceil(filteredRows.length / rowsPerPage) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [filteredRows, currentPage, rowsPerPage]);

  // Helper to get column letter (A, B, C ... AA, AB)
  const getColLetter = (index: number): string => {
    let letter = '';
    while (index >= 0) {
      letter = String.fromCharCode((index % 26) + 65) + letter;
      index = Math.floor(index / 26) - 1;
    }
    return letter;
  };

  const handleDownloadOriginal = () => {
    const url = URL.createObjectURL(fileObj);
    const a = document.createElement('a');
    a.href = url;
    a.download = lesson.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    if (!workbook || !activeSheetName) return;
    const sheet = workbook.Sheets[activeSheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeSheetName}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Determine max columns
  const maxCols = useMemo(() => {
    return sheetData.reduce((max, row) => Math.max(max, row.length), 0);
  }, [sheetData]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      gap: '10px'
    }}>
      {/* Top Header Controls */}
      <div style={{
        padding: '8px 16px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#10b981'
          }}>
            <FileSpreadsheet size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>{lesson.name}</h2>
              <span style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#34d399',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '0.72rem',
                fontWeight: 600
              }}>
                Spreadsheet
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
              {sheetData.length} rows • {maxCols} columns • {(fileObj.size / 1024).toFixed(1)} KB
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Search Box */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '5px 10px'
          }}>
            <Search size={13} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search table..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.8rem',
                width: '120px'
              }}
            />
          </div>

          <button
            onClick={handleExportCsv}
            title="Export current worksheet as CSV"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              color: 'var(--text-secondary)',
              padding: '6px 12px',
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Download size={13} />
            Export CSV
          </button>

          {onToggleCompleted && (
            <button
              onClick={() => onToggleCompleted(lesson.path)}
              style={{
                background: isCompleted ? 'var(--color-success)' : 'rgba(255,255,255,0.05)',
                color: isCompleted ? 'white' : 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
                padding: '7px 12px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <CheckCircle2 size={14} />
              {isCompleted ? 'Completed' : 'Mark Done'}
            </button>
          )}

          <button
            onClick={handleDownloadOriginal}
            style={{
              background: 'var(--gradient-accent)',
              color: 'white',
              border: 'none',
              padding: '7px 14px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <Download size={14} />
            Download
          </button>
        </div>
      </div>

      {/* Main Table Grid Container */}
      <div style={{
        flex: 1,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {loading ? (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px'
          }}>
            <RefreshCw size={28} className="spin" style={{ color: 'var(--color-primary)' }} />
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Parsing spreadsheet workbook...</p>
          </div>
        ) : error ? (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px',
            textAlign: 'center',
            gap: '12px'
          }}>
            <AlertTriangle size={36} color="#ef4444" />
            <h3 style={{ color: 'var(--text-primary)', margin: 0 }}>Cannot Open Spreadsheet</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '400px' }}>{error}</p>
            <button
              onClick={handleDownloadOriginal}
              style={{
                background: 'var(--gradient-accent)',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Download Spreadsheet File
            </button>
          </div>
        ) : (
          <>
            {/* Scrollable Data Table */}
            <div style={{
              flex: 1,
              overflow: 'auto',
              position: 'relative'
            }}>
              <table style={{
                borderCollapse: 'collapse',
                width: '100%',
                fontSize: '0.96rem',
                fontFamily: 'Fira Code, monospace',
                tableLayout: 'auto'
              }}>
                <thead>
                  {/* Column Letters Row (A, B, C...) */}
                  <tr>
                    <th style={{
                      position: 'sticky',
                      top: 0,
                      left: 0,
                      zIndex: 3,
                      background: '#15151e',
                      borderBottom: '1px solid var(--border-color)',
                      borderRight: '1px solid var(--border-color)',
                      width: '45px',
                      minWidth: '45px',
                      padding: '10px 8px',
                      color: 'var(--text-muted)'
                    }} />
                    {Array.from({ length: maxCols }).map((_, colIdx) => (
                      <th
                        key={colIdx}
                        style={{
                          position: 'sticky',
                          top: 0,
                          zIndex: 2,
                          background: '#15151e',
                          borderBottom: '1px solid var(--border-color)',
                          borderRight: '1px solid rgba(255,255,255,0.06)',
                          padding: '10px 14px',
                          color: 'var(--text-muted)',
                          fontWeight: 600,
                          textAlign: 'center',
                          minWidth: '130px'
                        }}
                      >
                        {getColLetter(colIdx)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((row, rowIdx) => {
                    const actualRowIdx = (currentPage - 1) * rowsPerPage + rowIdx;
                    return (
                      <tr 
                        key={actualRowIdx} 
                        style={{
                          background: actualRowIdx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)'
                        }}
                      >
                        {/* Row Index Number */}
                        <td style={{
                          position: 'sticky',
                          left: 0,
                          zIndex: 1,
                          background: '#15151e',
                          borderRight: '1px solid var(--border-color)',
                          borderBottom: '1px solid rgba(255,255,255,0.06)',
                          padding: '8px 10px',
                          color: 'var(--text-muted)',
                          textAlign: 'center',
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          userSelect: 'none'
                        }}>
                          {actualRowIdx + 1}
                        </td>

                        {/* Row Data Cells */}
                        {Array.from({ length: maxCols }).map((_, colIdx) => {
                          const cellValue = row[colIdx] !== undefined ? String(row[colIdx]) : '';
                          const isHeader = actualRowIdx === 0 && currentPage === 1;
                          return (
                            <td
                              key={colIdx}
                              style={{
                                borderRight: '1px solid rgba(255,255,255,0.04)',
                                borderBottom: '1px solid rgba(255,255,255,0.04)',
                                padding: '9px 14px',
                                color: isHeader ? 'var(--color-primary)' : 'var(--text-primary)',
                                fontWeight: isHeader ? 600 : 400,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: '340px'
                              }}
                              title={cellValue}
                            >
                              {cellValue}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredRows.length === 0 && (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No matching data cells found.
                </div>
              )}
            </div>

            {/* Bottom Worksheets Tabs & Pagination */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 12px',
              background: 'rgba(0,0,0,0.3)',
              borderTop: '1px solid var(--border-color)',
              gap: '12px'
            }}>
              {/* Sheet tabs */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflowX: 'auto' }}>
                {sheetNames.map((name) => {
                  const isActive = name === activeSheetName;
                  return (
                    <button
                      key={name}
                      onClick={() => {
                        setActiveSheetName(name);
                        setCurrentPage(1);
                      }}
                      style={{
                        background: isActive ? 'var(--bg-active)' : 'transparent',
                        border: isActive ? '1px solid var(--border-highlight)' : '1px solid transparent',
                        color: isActive ? 'var(--color-primary)' : 'var(--text-secondary)',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: isActive ? 600 : 400,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <Layers size={12} />
                      {name}
                    </button>
                  );
                })}
              </div>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid var(--border-color)',
                      color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      cursor: currentPage === 1 ? 'default' : 'pointer',
                      fontSize: '0.75rem'
                    }}
                  >
                    Prev
                  </button>
                  <span>
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid var(--border-color)',
                      color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      cursor: currentPage === totalPages ? 'default' : 'pointer',
                      fontSize: '0.75rem'
                    }}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
