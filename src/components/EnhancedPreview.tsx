/**
 * 增強預覽組件
 * 支持多種預覽模式和比較功能
 */

import React, { useState } from 'react';
import type { MatchResult } from '../types/api';

interface EnhancedPreviewProps {
  results: MatchResult[];
  referenceImages?: string[];
  currentIndex?: number;
  onImageSelect?: (index: number) => void;
  onExport?: (indices: number[]) => void;
}

export function EnhancedPreview({ 
  results, 
  referenceImages, 
  currentIndex = 0, 
  onImageSelect, 
  onExport 
}: EnhancedPreviewProps) {
  const [previewMode, setPreviewMode] = useState<'thumbnail' | 'detail' | 'comparison' | 'analysis'>('thumbnail');
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [showReferencePanel, setShowReferencePanel] = useState(false);
  const [internalCurrentIndex, setInternalCurrentIndex] = useState(currentIndex);

  const handleImageClick = (index: number) => {
    onImageSelect?.(index);
    setPreviewMode('detail');
  };

  const handleComparisonMode = () => {
    setPreviewMode('comparison');
  };

  const handleAnalysisMode = () => {
    setPreviewMode('analysis');
  };

  const handleExportSelected = () => {
    if (selectedIndices.length > 0) {
      onExport?.(selectedIndices);
    }
  };

  const toggleReferencePanel = () => {
    setShowReferencePanel(!showReferencePanel);
  };

  const isSelected = (index: number) => selectedIndices.includes(index);

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      backgroundColor: '#f5f5f5'
    }}>
      {/* 左側參考照片面板 */}
      {referenceImages && (
        <div style={{
          width: '300px',
          height: '100vh',
          backgroundColor: 'white',
          borderRight: '1px solid #e2e8f0',
          padding: '16px',
          overflowY: 'auto'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
              參考照片
            </h3>
            <button
              onClick={toggleReferencePanel}
              style={{
                padding: '8px 16px',
                border: '1px solid #4a90e2',
                borderRadius: '4px',
                backgroundColor: showReferencePanel ? '#e2e8f0' : 'white',
                color: '#4a90e2',
                cursor: 'pointer'
              }}
            >
              {showReferencePanel ? '隱藏' : '顯示'} 參考照片
            </button>
          </div>
          {showReferencePanel && (
            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {referenceImages.map((img, index) => (
                <div
                  key={index}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '4px',
                    padding: '8px',
                    marginBottom: '8px',
                    cursor: 'pointer',
                    backgroundColor: isSelected(index) ? '#e3f2fd' : 'white'
                  }}
                  onClick={() => handleImageClick(index)}
                >
                  <img
                    src={`file://${img}`}
                    style={{
                      width: '100%',
                      height: '80px',
                      objectFit: 'cover',
                      borderRadius: '2px'
                    }}
                    alt={`參考照片 ${index + 1}`}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 主預覽區域 */}
      <div style={{
        flex: 1,
        height: '100vh',
        backgroundColor: 'white',
        position: 'relative'
      }}>
        {/* 預覽模式切換 */}
        <div style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          zIndex: 10
        }}>
          <select
            value={previewMode}
            onChange={(e) => setPreviewMode(e.target.value as any)}
            style={{
              padding: '8px',
              border: '1px solid #4a90e2',
              borderRadius: '4px',
              backgroundColor: 'white'
            }}
          >
            <option value="thumbnail">縮圖模式</option>
            <option value="detail">詳情模式</option>
            <option value="comparison">比較模式</option>
            <option value="analysis">分析模式</option>
          </select>
        </div>

        {/* 預覽內容 */}
        {previewMode === 'thumbnail' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '16px',
            padding: '16px',
            height: 'calc(100vh - 120px)',
            overflowY: 'auto'
          }}>
            {results.map((result, index) => (
              <div
                key={index}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  backgroundColor: isSelected(index) ? '#e3f2fd' : 'white',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => handleImageClick(index)}
              >
                <img
                  src={`file://${result.thumbPath}`}
                  style={{
                    width: '100%',
                    height: '150px',
                    objectFit: 'cover'
                  }}
                  alt={`結果照片 ${index + 1}`}
                />
                <div style={{
                  padding: '8px',
                  fontSize: '12px',
                  fontWeight: '500'
                }}>
                  相似度: {(result.score * 100).toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        )}

        {previewMode === 'detail' && internalCurrentIndex !== null && (
          <div style={{
            display: 'flex',
            height: 'calc(100vh - 120px)',
            padding: '16px'
          }}>
            {/* 當前圖片 */}
            <div style={{
              flex: 1,
              width: '60%',
              height: 'calc(100vh - 120px)',
              border: '1px solid #e2e8f0',
              borderRadius: '8px'
            }}>
              <img
                src={`file://${results[internalCurrentIndex].thumbPath}`}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain'
                }}
                alt={`當前照片 ${internalCurrentIndex + 1}`}
              />
            </div>

            {/* 詳情信息 */}
            <div style={{
              flex: 1,
              width: '40%',
              height: 'calc(100vh - 120px)',
              padding: '16px',
              border: '1px solid #e2e8f0',
              borderRadius: '8px'
            }}>
              <h3 style={{ margin: 0, fontSize: '18px' }}>
                照片信息
              </h3>
              <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
                <div><strong>路徑:</strong> {results[internalCurrentIndex].path}</div>
                <div><strong>相似度:</strong> {(results[internalCurrentIndex].score * 100).toFixed(1)}%</div>
                <div><strong>檔案大小:</strong> {results[internalCurrentIndex].path.split(/[/\\]/).pop()}</div>
              </div>
            </div>

            {/* 導航控制 */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '16px'
            }}>
              <button
                onClick={() => setInternalCurrentIndex(Math.max(0, internalCurrentIndex - 1))}
                disabled={internalCurrentIndex === 0}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #4a90e2',
                  borderRadius: '4px',
                  backgroundColor: '#f5f5f5',
                  color: '#4a90e2',
                  cursor: 'pointer'
                }}
              >
                上一張
              </button>
              
              <span style={{ fontSize: '14px' }}>
                {internalCurrentIndex + 1} / {results.length}
              </span>
              
              <button
                onClick={() => setInternalCurrentIndex(Math.min(results.length - 1, internalCurrentIndex + 1))}
                disabled={internalCurrentIndex === results.length - 1}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #4a90e2',
                  borderRadius: '4px',
                  backgroundColor: '#f5f5f5',
                  color: '#4a90e2',
                  cursor: 'pointer'
                }}
              >
                下一張
              </button>
            </div>

            {/* 操作按鈕 */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '16px'
            }}>
              <button
                onClick={() => setSelectedIndices(
                  isSelected(internalCurrentIndex) 
                    ? selectedIndices.filter(i => i !== internalCurrentIndex)
                    : [...selectedIndices, internalCurrentIndex]
                )}
                style={{
                  padding: '8px 16px',
                  border: selectedIndices.includes(internalCurrentIndex) ? '1px solid #4a90e2' : '1px solid #e2e8f0',
                  borderRadius: '4px',
                  backgroundColor: selectedIndices.includes(internalCurrentIndex) ? '#e3f2fd' : 'white',
                  color: selectedIndices.includes(internalCurrentIndex) ? '#4a90e2' : '#4a90e2',
                  cursor: 'pointer'
                }}
              >
                {selectedIndices.includes(internalCurrentIndex) ? '取消選擇' : '選擇'}
              </button>
              
              <button
                onClick={handleExportSelected}
                disabled={selectedIndices.length === 0}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #4a90e2',
                  borderRadius: '4px',
                  backgroundColor: '#4a90e2',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                匯出選擇 ({selectedIndices.length})
              </button>
            </div>
          </div>
        )}

        {previewMode === 'comparison' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            height: 'calc(100vh - 120px)',
            padding: '16px'
          }}>
            {/* 參考照片 */}
            <div style={{
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '16px'
            }}>
              <h4>參考照片</h4>
              {referenceImages && referenceImages.slice(0, 2).map((img, index) => (
                <img
                  key={index}
                  src={`file://${img}`}
                  style={{
                    width: '100%',
                    height: '120px',
                    objectFit: 'cover',
                    borderRadius: '4px'
                  }}
                  alt={`參考 ${index + 1}`}
                />
              ))}
            </div>

            {/* 比較結果 */}
            <div style={{
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '16px'
            }}>
              <h4>比較結果</h4>
              {results.slice(0, 2).map((result, index) => (
                <div key={index}>
                  <img
                    src={`file://${result.thumbPath}`}
                    style={{
                      width: '100%',
                      height: '120px',
                      objectFit: 'cover',
                      borderRadius: '4px'
                    }}
                    alt={`結果 ${index + 1}`}
                  />
                  <div style={{ fontSize: '12px', marginTop: '8px' }}>
                    相似度: {(result.score * 100).toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {previewMode === 'analysis' && (
          <div style={{
            padding: '16px',
            height: 'calc(100vh - 120px)',
            overflowY: 'auto'
          }}>
            <h3>分析結果</h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '16px'
            }}>
              {results.map((result, index) => (
                <div
                  key={index}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '16px',
                    backgroundColor: 'white'
                  }}
                >
                  <img
                    src={`file://${result.thumbPath}`}
                    style={{
                      width: '100%',
                      height: '150px',
                      objectFit: 'cover',
                      borderRadius: '4px',
                      marginBottom: '8px'
                    }}
                    alt={`分析照片 ${index + 1}`}
                  />
                  <div style={{ fontSize: '14px' }}>
                    <div><strong>相似度:</strong> {(result.score * 100).toFixed(1)}%</div>
                    <div><strong>檔案:</strong> {result.path.split(/[/\\]/).pop()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}