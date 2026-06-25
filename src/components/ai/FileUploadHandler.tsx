/**
 * D3VONN.IO File Upload Handler
 * Handles drag-and-drop and click-to-upload for the /chat workspace.
 * Supported: .txt, .md, .csv, .json, .pdf (text extraction), .js, .ts, .py
 * On upload: reads text → ingestDocument() → Pinecone upsert
 */

import React, { useCallback, useRef, useState } from 'react';
import { ingestDocument, IngestResult } from '../../services/ai/ragService';

const ACCEPTED_TYPES = [
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'application/pdf',
  'text/javascript',
  'text/typescript',
  'application/x-python',
  'text/x-python',
];

const ACCEPTED_EXTENSIONS = ['.txt', '.md', '.csv', '.json', '.pdf', '.js', '.ts', '.py', '.jsx', '.tsx'];
const MAX_FILE_SIZE_MB = 10;

interface FileUploadHandlerProps {
  userId?: string;
  onIngestComplete?: (result: IngestResult) => void;
  onIngestStart?: (filename: string) => void;
}

interface UploadState {
  filename: string;
  status: 'ingesting' | 'done' | 'error';
  chunks?: number;
  error?: string;
}

async function extractText(file: File): Promise<string> {
  // PDF: read as ArrayBuffer and extract text via basic byte scanning
  // For production, a proper PDF parser (pdf.js) would be used server-side
  if (file.type === 'application/pdf') {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let text = '';
    // Extract readable ASCII text from PDF bytes (basic extraction)
    for (let i = 0; i < bytes.length; i++) {
      const c = bytes[i];
      if (c >= 32 && c < 127) {
        text += String.fromCharCode(c);
      } else if (c === 10 || c === 13) {
        text += ' ';
      }
    }
    // Clean up PDF artifacts
    text = text.replace(/[^\x20-\x7E\n]/g, ' ').replace(/\s{3,}/g, '\n').trim();
    return text;
  }

  // All text-based formats
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve((e.target?.result as string) || '');
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export const FileUploadHandler: React.FC<FileUploadHandlerProps> = ({
  userId,
  onIngestComplete,
  onIngestStart,
}) => {
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext) && !ACCEPTED_TYPES.includes(file.type)) {
      setUploads(prev => [...prev, {
        filename: file.name,
        status: 'error',
        error: `Unsupported file type: ${ext}`,
      }]);
      return;
    }

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setUploads(prev => [...prev, {
        filename: file.name,
        status: 'error',
        error: `File too large (max ${MAX_FILE_SIZE_MB}MB)`,
      }]);
      return;
    }

    setUploads(prev => [...prev, { filename: file.name, status: 'ingesting' }]);
    onIngestStart?.(file.name);

    try {
      const text = await extractText(file);
      const result = await ingestDocument(text, file.name, userId);

      setUploads(prev =>
        prev.map(u =>
          u.filename === file.name
            ? {
                ...u,
                status: result.success ? 'done' : 'error',
                chunks: result.chunksIngested,
                error: result.error,
              }
            : u
        )
      );
      onIngestComplete?.(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setUploads(prev =>
        prev.map(u =>
          u.filename === file.name ? { ...u, status: 'error', error: message } : u
        )
      );
      onIngestComplete?.({ success: false, chunksIngested: 0, filename: file.name, error: message });
    }
  }, [userId, onIngestComplete, onIngestStart]);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(processFile);
  }, [processFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  return (
    <div className="w-full">
      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${isDragging ? '#7080FF' : '#334155'}`,
          background: isDragging ? 'rgba(112,128,255,0.05)' : 'rgba(15,23,42,0.6)',
          padding: '16px',
          cursor: 'pointer',
          transition: 'border-color 0.2s, background 0.2s',
          textAlign: 'center',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS.join(',')}
          style={{ display: 'none' }}
          onChange={e => handleFiles(e.target.files)}
        />
        <div style={{ fontFamily: 'monospace', fontSize: '13px', color: '#94A3B8' }}>
          <span style={{ color: '#7080FF', fontSize: '20px' }}>+</span>
          <br />
          Drop files to ingest into memory
          <br />
          <span style={{ color: '#475569', fontSize: '11px' }}>
            {ACCEPTED_EXTENSIONS.join(' ')} · max {MAX_FILE_SIZE_MB}MB
          </span>
        </div>
      </div>

      {/* Upload Status List */}
      {uploads.length > 0 && (
        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {uploads.map((u, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontFamily: 'monospace',
                fontSize: '12px',
                padding: '4px 8px',
                background: 'rgba(15,23,42,0.8)',
                border: `1px solid ${u.status === 'done' ? '#059669' : u.status === 'error' ? '#EF4444' : '#334155'}`,
              }}
            >
              <span style={{
                color: u.status === 'done' ? '#7080FF' : u.status === 'error' ? '#EF4444' : '#F59E0B',
              }}>
                {u.status === 'done' ? '[DONE]' : u.status === 'error' ? '[ERR]' : '[...]'}
              </span>
              <span style={{ color: '#E2E8F0', flex: 1 }}>{u.filename}</span>
              {u.status === 'done' && (
                <span style={{ color: '#94A3B8' }}>{u.chunks} chunks indexed</span>
              )}
              {u.status === 'error' && (
                <span style={{ color: '#EF4444' }}>{u.error}</span>
              )}
              {u.status === 'ingesting' && (
                <span style={{ color: '#F59E0B' }}>ingesting...</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileUploadHandler;
