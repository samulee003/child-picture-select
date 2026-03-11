import React, { useState } from 'react';

interface ImagePreviewProps {
  src: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  onLoad?: () => void;
  onError?: (error: any) => void;
}

export function ImagePreview({
  src,
  alt = '',
  className = '',
  style = {},
  onLoad,
  onError
}: ImagePreviewProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  const handleLoad = () => {
    setIsLoaded(true);
    setHasError(false);
    onLoad?.();
  };

  const handleError = (error: any) => {
    setHasError(true);
    setIsLoaded(false);
    onError?.(error);
  };

  const handleClick = () => {
    if (isLoaded && !hasError) {
      setIsZoomed(!isZoomed);
    }
  };

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    cursor: isLoaded && !hasError ? 'pointer' : 'default',
    ...style
  };

  const imageStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: isLoaded ? 'block' : 'none',
    transition: 'transform 0.2s ease'
  };

  const zoomedImageStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: isLoaded ? 'block' : 'none',
    transition: 'transform 0.2s ease',
    position: 'fixed',
    top: '50%',
    left: '50%',
    transformOrigin: 'center',
    transform: isZoomed ? 'translate(-50%, -50%) scale(2)' : 'translate(-50%, -50%) scale(1)',
    maxWidth: '90vw',
    maxHeight: '90vh',
    zIndex: 1000,
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    borderRadius: '8px'
  };

  const placeholderStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#999',
    fontSize: '14px',
    flexDirection: 'column',
    gap: '8px'
  };

  const loadingStyle: React.CSSProperties = {
    width: '24px',
    height: '24px',
    border: '2px solid #e0e0e0',
    borderTop: '2px solid #4a90e2',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  };

  return (
    <>
      <div className={className} style={containerStyle} onClick={handleClick}>
        {!isLoaded && !hasError && (
          <div style={placeholderStyle}>
            <div style={loadingStyle} />
            <span>載入中...</span>
          </div>
        )}
        
        {hasError && (
          <div style={placeholderStyle}>
            <span style={{ fontSize: '24px' }}>🖼️</span>
            <span>載入失敗</span>
          </div>
        )}
        
        <img
          src={src}
          alt={alt}
          style={imageStyle}
          onLoad={handleLoad}
          onError={handleError}
        />
      </div>

      {isZoomed && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
          onClick={() => setIsZoomed(false)}
        >
          <img
            src={src}
            alt={alt}
            style={zoomedImageStyle}
            onClick={(e) => e.stopPropagation()}
          />
          <div
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              color: 'white',
              fontSize: '24px',
              cursor: 'pointer',
              backgroundColor: 'rgba(0,0,0,0.5)',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onClick={() => setIsZoomed(false)}
          >
            ×
          </div>
        </div>
      )}


    </>
  );
}