import React, { useCallback, useState } from 'react';

interface DragDropZoneProps {
  onFilesDrop: (files: string[]) => void;
  onFolderDrop?: (folder: string) => void;
  accept?: 'files' | 'folders' | 'both';
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function DragDropZone({
  onFilesDrop,
  onFolderDrop,
  accept = 'files',
  disabled = false,
  children,
  className = '',
  style = {},
}: DragDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [_dragCounter, setDragCounter] = useState(0);

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (disabled) return;

      setDragCounter(prev => prev + 1);
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDragOver(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (disabled) return;

      setDragCounter(prev => {
        const newCount = prev - 1;
        if (newCount === 0) {
          setIsDragOver(false);
        }
        return newCount;
      });
    },
    [disabled]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (disabled) return;

      if (e.dataTransfer.dropEffect === 'none') {
        e.dataTransfer.dropEffect = 'copy';
      }
    },
    [disabled]
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (disabled) return;

      setIsDragOver(false);
      setDragCounter(0);

      const items = Array.from(e.dataTransfer.items);
      const files: string[] = [];
      const folders: string[] = [];

      for (const item of items) {
        if (item.kind === 'file') {
          const entry = item.webkitGetAsEntry();
          if (entry) {
            if (entry.isFile) {
              const file = item.getAsFile();
              if (file) {
                files.push(file.path);
              }
            } else if (entry.isDirectory && (accept === 'folders' || accept === 'both')) {
              folders.push(entry.fullPath);
            }
          }
        }
      }

      // Handle files first
      if (files.length > 0 && (accept === 'files' || accept === 'both')) {
        onFilesDrop(files);
      }

      // Then handle folders
      if (folders.length > 0 && onFolderDrop && (accept === 'folders' || accept === 'both')) {
        for (const folder of folders) {
          onFolderDrop(folder);
        }
      }
    },
    [disabled, accept, onFilesDrop, onFolderDrop]
  );

  const baseStyle: React.CSSProperties = {
    position: 'relative',
    transition: 'all 0.2s ease',
    ...style,
  };

  const dragOverStyle: React.CSSProperties = {
    ...baseStyle,
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
    borderColor: '#4a90e2',
    borderWidth: '2px',
    borderStyle: 'dashed',
  };

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
    border: '2px dashed #4a90e2',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    pointerEvents: 'none',
  };

  const overlayTextStyle: React.CSSProperties = {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: '12px 24px',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '500',
    color: '#4a90e2',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  };

  return (
    <div
      className={className}
      style={isDragOver ? dragOverStyle : baseStyle}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}
      {isDragOver && (
        <div style={overlayStyle}>
          <div style={overlayTextStyle}>
            {accept === 'folders'
              ? '拖放資料夾到這裡'
              : accept === 'files'
                ? '拖放檔案到這裡'
                : '拖放檔案或資料夾到這裡'}
          </div>
        </div>
      )}
    </div>
  );
}
