# 舊版 Python GUI（Legacy）

此目錄包含舊版 Python 桌面應用程式，與目前 Electron + React 主流程無關。

- **child_photo_filter_gui.py**：Python Tkinter 主介面
- **face_recognition_service.py**：位於 `src/core/`，為 Python 版臉部辨識服務

目前主應用程式為 Electron 版（`src/main/`、`src/renderer/`），使用 InsightFace ONNX 進行臉部辨識。此 Python 版本保留供參考或相容性測試，未來可能移除。
