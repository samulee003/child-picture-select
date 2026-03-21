import React from 'react';
import type { AppInfo } from '../../types/api';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  appInfo?: AppInfo | null;
}

export function HelpModal({ isOpen, onClose, appInfo }: HelpModalProps) {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Ctrl+S', description: '儲存目前設定' },
    { key: 'Ctrl+Enter', description: '開始搜尋' },
    { key: 'Ctrl+E', description: '匯出結果' },
    { key: 'Ctrl+Delete', description: '清除結果' },
    { key: 'F1', description: '顯示說明' },
    { key: 'Esc', description: '關閉對話框' }
  ];

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  };

  const modalStyle: React.CSSProperties = {
    backgroundColor: 'rgba(15,23,42,0.98)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    padding: '32px',
    maxWidth: '500px',
    width: '90%',
    maxHeight: '80vh',
    overflow: 'auto',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '24px',
    fontWeight: '600',
    marginBottom: '24px',
    color: 'rgba(255,255,255,0.95)'
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: '24px'
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '12px',
    color: 'rgba(255,255,255,0.9)'
  };

  const shortcutListStyle: React.CSSProperties = {
    listStyle: 'none',
    padding: 0,
    margin: 0
  };

  const shortcutItemStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid rgba(255,255,255,0.08)'
  };

  const keyStyle: React.CSSProperties = {
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: '4px 8px',
    borderRadius: '4px',
    fontFamily: 'monospace',
    fontSize: '14px',
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)'
  };

  const buttonStyle: React.CSSProperties = {
    backgroundColor: 'rgba(59,130,246,0.2)',
    color: 'rgba(255,255,255,0.9)',
    border: '1px solid rgba(59,130,246,0.4)',
    padding: '12px 24px',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '500',
    cursor: 'pointer',
    marginTop: '24px'
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={titleStyle}>說明與支援資訊</h2>
        
        {appInfo && (
          <div style={sectionStyle}>
            <h3 style={sectionTitleStyle}>版本與更新</h3>
            <div style={{ color: 'rgba(255,255,255,0.8)', lineHeight: '1.6', marginBottom: '12px' }}>
              <div>應用名稱：{appInfo.appName}</div>
              <div>版本：v{appInfo.version}</div>
            </div>
            <div>
              <h4 style={{ ...sectionTitleStyle, fontSize: '16px' }}>近期更新</h4>
              <ul style={{ ...shortcutListStyle, color: 'rgba(255,255,255,0.7)' }}>
                {(appInfo.changelog || []).map((item, index) => (
                  <li key={item + index} style={{ ...shortcutItemStyle, borderBottom: index === (appInfo.changelog || []).length - 1 ? 'none' : '1px solid rgba(255,255,255,0.08)' }}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        
        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>快捷鍵列表</h3>
          <ul style={shortcutListStyle}>
            {shortcuts.map((shortcut, index) => (
              <li key={index} style={shortcutItemStyle}>
                <span>{shortcut.description}</span>
                <span style={keyStyle}>{shortcut.key}</span>
              </li>
            ))}
          </ul>
        </div>

        <div style={sectionStyle}>
          <h3 style={sectionTitleStyle}>使用提示</h3>
          <ul style={{ ...shortcutListStyle, color: 'rgba(255,255,255,0.7)' }}>
            <li style={{ ...shortcutItemStyle, borderBottom: 'none' }}>
              <span>拖放圖片檔案到參考照片區域</span>
            </li>
            <li style={{ ...shortcutItemStyle, borderBottom: 'none' }}>
              <span>拖放資料夾到搜尋資料夾區域</span>
            </li>
            <li style={{ ...shortcutItemStyle, borderBottom: 'none' }}>
              <span>點擊縮圖可放大預覽</span>
            </li>
            <li style={{ ...shortcutItemStyle, borderBottom: 'none' }}>
              <span>設定會自動儲存</span>
            </li>
          </ul>
        </div>

        <button style={buttonStyle} onClick={onClose}>
          關閉
        </button>
        {appInfo?.supportEmail && (
          <div style={{ marginTop: '16px', color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
            支援聯絡：{appInfo.supportEmail}
          </div>
        )}
      </div>
    </div>
  );
}