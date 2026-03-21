import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });
    
    // Log error details
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      const errorContainerStyle: React.CSSProperties = {
        padding: '32px',
        backgroundColor: 'rgba(239,68,68,0.08)',
        border: '1px solid rgba(239,68,68,0.2)',
        borderRadius: '8px',
        margin: '16px'
      };

      const errorTitleStyle: React.CSSProperties = {
        fontSize: '18px',
        fontWeight: '600',
        color: '#f87171',
        marginBottom: '16px'
      };

      const errorMessageStyle: React.CSSProperties = {
        fontSize: '14px',
        color: 'rgba(255,255,255,0.7)',
        marginBottom: '16px',
        fontFamily: 'monospace',
        backgroundColor: 'rgba(0,0,0,0.3)',
        padding: '12px',
        borderRadius: '4px',
        border: '1px solid rgba(255,255,255,0.1)'
      };

      const buttonStyle: React.CSSProperties = {
        backgroundColor: 'rgba(59,130,246,0.2)',
        color: 'rgba(255,255,255,0.9)',
        border: '1px solid rgba(59,130,246,0.4)',
        padding: '12px 24px',
        borderRadius: '6px',
        fontSize: '14px',
        fontWeight: '500',
        cursor: 'pointer',
        marginRight: '8px'
      };

      const secondaryButtonStyle: React.CSSProperties = {
        ...buttonStyle,
        backgroundColor: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.15)'
      };

      return (
        <div style={errorContainerStyle}>
          <h2 style={errorTitleStyle}>
            應用程式發生錯誤
          </h2>
          
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', marginBottom: '16px' }}>
            很抱歉，應用程式遇到了一個意外錯誤。請嘗試重新整理頁面或重新啟動應用程式。
          </p>

          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details style={{ marginBottom: '16px' }}>
              <summary style={{ 
                cursor: 'pointer', 
                fontSize: '14px', 
                fontWeight: '500',
                marginBottom: '8px'
              }}>
                查看錯誤詳情 (開發模式)
              </summary>
              <div style={errorMessageStyle}>
                <div><strong>錯誤訊息:</strong> {this.state.error.message}</div>
                <div style={{ marginTop: '8px' }}>
                  <strong>錯誤堆疊:</strong>
                  <pre style={{ 
                    whiteSpace: 'pre-wrap', 
                    fontSize: '12px',
                    maxHeight: '200px',
                    overflow: 'auto'
                  }}>
                    {this.state.error.stack}
                  </pre>
                </div>
                {this.state.errorInfo && (
                  <div style={{ marginTop: '8px' }}>
                    <strong>組件堆疊:</strong>
                    <pre style={{ 
                      whiteSpace: 'pre-wrap', 
                      fontSize: '12px',
                      maxHeight: '200px',
                      overflow: 'auto'
                    }}>
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </div>
                )}
              </div>
            </details>
          )}

          <div>
            <button style={buttonStyle} onClick={this.handleReset}>
              重新載入
            </button>
            <button 
              style={secondaryButtonStyle} 
              onClick={() => window.location.reload()}
            >
              重新整理頁面
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}