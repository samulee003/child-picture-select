"""
小孩照片篩選工具 - 主程式
"""
import sys
import os
import tkinter as tk
from tkinter import messagebox

# 添加src目錄到Python路徑
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

try:
    from src.gui.child_photo_filter_gui import ChildPhotoFilterGUI
except ImportError as e:
    print(f"導入錯誤: {e}")
    print("請確保已安裝所需套件: pip install -r requirements.txt")
    sys.exit(1)

def main():
    """主函數"""
    try:
        root = tk.Tk()
        
        # 設定應用程式圖示（如果有）
        try:
            root.iconbitmap('icon.ico')
        except:
            pass
        
        # 建立應用程式
        app = ChildPhotoFilterGUI(root)
        
        # 設置關閉事件處理
        def on_closing():
            try:
                # 保存設置
                app.save_settings()
            except Exception:
                pass
            root.destroy()
        
        root.protocol("WM_DELETE_WINDOW", on_closing)
        
        # 啟動GUI
        root.mainloop()
        
    except Exception as e:
        messagebox.showerror("錯誤", f"程式啟動失敗: {e}")
        print(f"程式啟動失敗: {e}")

if __name__ == "__main__":
    main()

