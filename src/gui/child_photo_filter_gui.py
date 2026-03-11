"""
小孩照片篩選工具 - GUI界面
基於臉部識別技術精準找出班級照片中的小孩
"""
import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
import threading
import os
import json
import sys
import traceback
from datetime import datetime
from typing import Optional, List, Dict
import logging
from PIL import Image, ImageTk
import numpy as np
import random

from src.core.face_recognition_service import FaceRecognitionService

class ModernTheme:
    """現代化主題配置"""
    # 顏色配置
    PRIMARY = "#2196F3"
    PRIMARY_DARK = "#1976D2"
    PRIMARY_LIGHT = "#BBDEFB"
    SECONDARY = "#FFC107"
    BACKGROUND = "#FAFAFA"
    SURFACE = "#FFFFFF"
    ERROR = "#F44336"
    SUCCESS = "#4CAF50"
    WARNING = "#FF9800"
    TEXT_PRIMARY = "#212121"
    TEXT_SECONDARY = "#757575"
    BORDER = "#E0E0E0"
    
    # 字體配置
    FONT_FAMILY = "Microsoft YaHei UI" if sys.platform == "win32" else "Arial"
    FONT_LARGE = (FONT_FAMILY, 16, "bold")
    FONT_MEDIUM = (FONT_FAMILY, 12)
    FONT_SMALL = (FONT_FAMILY, 10)
    
    # 間距配置
    SPACING_SMALL = 5
    SPACING_MEDIUM = 10
    SPACING_LARGE = 20

class PhotoPreviewFrame(ttk.Frame):
    """照片預覽框架"""
    def __init__(self, parent, title="照片預覽"):
        super().__init__(parent)
        self.title = title
        self.current_image = None
        self.current_photo_path = None
        self.setup_ui()
    
    def setup_ui(self):
        """設置UI"""
        # 標題
        title_label = ttk.Label(self, text=self.title, font=ModernTheme.FONT_MEDIUM)
        title_label.pack(pady=ModernTheme.SPACING_SMALL)
        
        # 圖片顯示區域
        self.image_frame = ttk.Frame(self, relief="sunken", borderwidth=1)
        self.image_frame.pack(fill="both", expand=True, padx=ModernTheme.SPACING_MEDIUM, 
                             pady=ModernTheme.SPACING_SMALL)
        
        self.image_label = ttk.Label(self.image_frame, text="無照片", 
                                    background=ModernTheme.SURFACE)
        self.image_label.pack(expand=True, fill="both")
        
        # 照片信息
        self.info_frame = ttk.Frame(self)
        self.info_frame.pack(fill="x", padx=ModernTheme.SPACING_MEDIUM, 
                            pady=ModernTheme.SPACING_SMALL)
        
        self.info_label = ttk.Label(self.info_frame, text="", font=ModernTheme.FONT_SMALL)
        self.info_label.pack(side="left")
    
    def display_image(self, image_path, max_size=(300, 300)):
        """顯示圖片"""
        try:
            if not os.path.exists(image_path):
                self.clear_display()
                return
            
            # 打開並調整圖片大小
            image = Image.open(image_path)
            image.thumbnail(max_size, Image.Resampling.LANCZOS)
            
            # 轉換為Tkinter可用的格式
            photo = ImageTk.PhotoImage(image)
            
            # 更新顯示
            self.image_label.configure(image=photo, text="")
            self.image_label.image = photo  # 保持引用
            
            # 更新信息
            file_size = os.path.getsize(image_path) / (1024 * 1024)  # MB
            img_size = f"{image.width}x{image.height}"
            file_name = os.path.basename(image_path)
            
            info_text = f"{file_name} | {img_size} | {file_size:.2f}MB"
            self.info_label.configure(text=info_text)
            
            self.current_photo_path = image_path
            self.current_image = image
            
        except Exception as e:
            self.clear_display()
            self.info_label.configure(text=f"無法載入圖片: {str(e)}")
    
    def clear_display(self):
        """清除顯示"""
        self.image_label.configure(image="", text="無照片")
        self.image_label.image = None
        self.info_label.configure(text="")
        self.current_photo_path = None
        self.current_image = None

class ChildPhotoFilterGUI:
    """小孩照片篩選工具GUI"""
    
    def __init__(self, root):
        self.root = root
        self.root.title("小孩照片篩選工具 - 臉部識別版 v2.0")
        self.root.geometry("1200x800")
        self.root.minsize(1000, 700)
        
        # 設置主題
        self.setup_theme()
        
        # 初始化服務
        self.face_service = FaceRecognitionService()
        self.is_processing = False
        self.processed_images = []
        self.current_preview_index = 0
        
        # 設定日誌
        self.setup_logging()
        
        # 建立界面
        self.create_widgets()
        
        # 初始化模型
        self.init_model()
    
    def setup_theme(self):
        """設置主題"""
        try:
            style = ttk.Style(self.root)
            style.theme_use('clam')
            
            # 配置各種控件樣式
            style.configure('TFrame', background=ModernTheme.BACKGROUND)
            style.configure('TLabel', background=ModernTheme.BACKGROUND, 
                           foreground=ModernTheme.TEXT_PRIMARY)
            style.configure('TLabelFrame', background=ModernTheme.BACKGROUND, 
                           foreground=ModernTheme.TEXT_PRIMARY)
            style.configure('TButton', background=ModernTheme.PRIMARY, 
                           foreground='white', borderwidth=0)
            style.map('TButton', 
                     background=[('active', ModernTheme.PRIMARY_DARK)])
            
            # 配置進度條
            style.configure('TProgressbar', background=ModernTheme.PRIMARY)
            
            # 配置標題樣式
            style.configure('Title.TLabel', font=ModernTheme.FONT_LARGE)
            style.configure('Subtitle.TLabel', font=ModernTheme.FONT_MEDIUM)
            
            # 配置輸入框
            style.configure('TEntry', fieldbackground=ModernTheme.SURFACE)
            
            # 配置標籤頁
            style.configure('TNotebook', background=ModernTheme.BACKGROUND)
            style.configure('TNotebook.Tab', background=ModernTheme.SURFACE, 
                           padding=[20, 10])
            
            # 配置簡化模式按鈕樣式
            style.configure('Accent.TButton', background=ModernTheme.PRIMARY, 
                           foreground='white', borderwidth=0)
            style.map('Accent.TButton', 
                     background=[('active', ModernTheme.PRIMARY_DARK)])
            
            self.root.configure(bg=ModernTheme.BACKGROUND)
            
        except Exception as e:
            print(f"主題設置失敗: {e}")
    
    def setup_logging(self):
        """設定日誌"""
        # 日誌檔寫到可預測的目錄：優先使用當前工作目錄，確保在 exe 同目錄
        try:
            # 嘗試多種方法確定正確的目錄
            if getattr(sys, 'frozen', False):
                # PyInstaller 打包後，使用 exe 所在目錄
                base_dir = os.path.dirname(sys.executable)
            else:
                # 開發環境，使用專案根目錄
                base_dir = os.path.dirname(os.path.abspath(__file__))
                # 向上找到專案根目錄（包含 main.py 的目錄）
                while base_dir and not os.path.exists(os.path.join(base_dir, 'main.py')):
                    parent = os.path.dirname(base_dir)
                    if parent == base_dir:  # 到達根目錄
                        break
                    base_dir = parent
        except Exception:
            base_dir = os.getcwd()

        log_path = os.path.join(base_dir, 'child_filter.log')
        # 確保目錄存在
        try:
            os.makedirs(os.path.dirname(log_path), exist_ok=True)
        except Exception:
            pass
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_path, encoding='utf-8'),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
        # 測試性輸出，確保控制台與日誌正常工作
        self.logger.info("GUI logging 初始化完成")
    
    def create_widgets(self):
        """建立GUI元件"""
        # 主容器
        main_container = ttk.Frame(self.root)
        main_container.pack(fill="both", expand=True, padx=ModernTheme.SPACING_MEDIUM, 
                           pady=ModernTheme.SPACING_MEDIUM)
        
        # 創建標題區域
        self.create_header(main_container)
        
        # 創建主內容區域（使用新的標籤頁結構）
        self.notebook = ttk.Notebook(main_container)
        self.notebook.pack(fill="both", expand=True, pady=ModernTheme.SPACING_MEDIUM)
        
        # 創建各個標籤頁
        self.create_main_tab()
        self.create_preview_tab()
        self.create_settings_tab()
        
        # 創建底部狀態欄
        self.create_status_bar(main_container)
        
        # 設置網格權重
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_container.columnconfigure(0, weight=1)
        main_container.rowconfigure(1, weight=1)
        self.notebook.columnconfigure(0, weight=1)
        self.notebook.rowconfigure(0, weight=1)
    
    def create_header(self, parent):
        """創建標題區域"""
        header_frame = ttk.Frame(parent)
        header_frame.pack(fill="x", pady=(0, ModernTheme.SPACING_MEDIUM))
        
        # 標題
        title_label = ttk.Label(header_frame, text="小孩照片篩選工具", 
                               style="Title.TLabel")
        title_label.pack(side="left")
        
        # 版本信息
        version_label = ttk.Label(header_frame, text="v2.0", 
                                style="Subtitle.TLabel")
        version_label.pack(side="right")
    
    def create_main_tab(self):
        """創建主要功能標籤頁"""
        main_tab = ttk.Frame(self.notebook)
        self.notebook.add(main_tab, text="主要功能")
        
        # 添加簡化模式切換
        mode_frame = ttk.Frame(main_tab)
        mode_frame.pack(fill="x", pady=(0, ModernTheme.SPACING_MEDIUM))
        
        # 模式選擇
        self.mode_var = tk.StringVar(value="simple")
        mode_label = ttk.Label(mode_frame, text="操作模式:", font=ModernTheme.FONT_MEDIUM)
        mode_label.pack(side="left", padx=(0, ModernTheme.SPACING_SMALL))
        
        # 模式選項
        mode_options = ttk.Frame(mode_frame)
        mode_options.pack(side="right", fill="x", expand=True)
        
        ttk.Radiobutton(
            mode_options, text="簡化模式", 
            variable=self.mode_var, value="simple",
            command=self.toggle_mode
        ).pack(side="left", padx=(0, ModernTheme.SPACING_SMALL))
        
        ttk.Radiobutton(
            mode_options, text="高級模式", 
            variable=self.mode_var, value="advanced",
            command=self.toggle_mode
        ).pack(side="left", padx=(0, ModernTheme.SPACING_SMALL))
        
        # 創建簡化模式和高級模式的容器
        self.simple_mode_frame = ttk.Frame(main_tab)
        self.advanced_mode_frame = ttk.Frame(main_tab)
        
        # 創建簡化模式界面
        self.create_simple_mode_ui(self.simple_mode_frame)
        
        # 創建高級模式界面（保留原有功能）
        self.create_advanced_mode_ui(self.advanced_mode_frame)
        
        # 初始顯示簡化模式
        self.simple_mode_frame.pack(fill="both", expand=True)
        self.advanced_mode_frame.pack_forget()
    
    def create_simple_mode_ui(self, parent):
        """創建簡化模式UI"""
        # 歡驟引導框架
        guide_frame = ttk.LabelFrame(parent, text="操作引導", padding=ModernTheme.SPACING_MEDIUM)
        guide_frame.pack(fill="x", pady=(0, ModernTheme.SPACING_MEDIUM))
        
        # 步驟指示
        self.step_var = tk.IntVar(value=1)
        steps = [
            "1. 選擇參考照資料夾",
            "2. 選擇班級照片資料夾",
            "3. 選擇輸出資料夾",
            "4. 開始篩選",
            "5. 查看結果"
        ]
        
        # 步驟顯示
        steps_frame = ttk.Frame(guide_frame)
        steps_frame.pack(fill="x", pady=ModernTheme.SPACING_SMALL)
        
        for i, step_text in enumerate(steps):
            step_frame = ttk.Frame(steps_frame)
            step_frame.pack(fill="x", pady=ModernTheme.SPACING_SMALL)
            
            # 步驟號
            step_number = ttk.Label(step_frame, text=f"{i+1}", 
                                     font=ModernTheme.FONT_MEDIUM,
                                     foreground=ModernTheme.PRIMARY)
            step_number.pack(side="left", padx=(0, ModernTheme.SPACING_SMALL))
            
            # 步驟文本
            step_label = ttk.Label(step_frame, text=step_text, 
                                     font=ModernTheme.FONT_MEDIUM)
            step_label.pack(side="left")
            
            # 當前步驟指示器
            if i == self.step_var.get() - 1:
                # 當前步驟
                indicator = ttk.Label(step_frame, text="←", 
                                         font=ModernTheme.FONT_MEDIUM,
                                         foreground=ModernTheme.PRIMARY)
                indicator.pack(side="right")
        
        # 設置按鈕框架
        settings_frame = ttk.LabelFrame(parent, text="快速設置", padding=ModernTheme.SPACING_MEDIUM)
        settings_frame.pack(fill="x", pady=(0, ModernTheme.SPACING_MEDIUM))
        
        # 參考照資料夾選擇
        ref_folder_frame = ttk.Frame(settings_frame)
        ref_folder_frame.pack(fill="x", pady=ModernTheme.SPACING_SMALL)
        
        ttk.Label(ref_folder_frame, text="參考照資料夾:").pack(side="left")
        self.simple_ref_folder_var = tk.StringVar()
        ref_entry = ttk.Entry(ref_folder_frame, textvariable=self.simple_ref_folder_var)
        ref_entry.pack(side="left", fill="x", expand=True, padx=(0, ModernTheme.SPACING_SMALL))
        ttk.Button(ref_folder_frame, text="選擇", 
                  command=self.select_simple_ref_folder).pack(side="right")
        
        # 班級照片資料夾選擇
        input_folder_frame = ttk.Frame(settings_frame)
        input_folder_frame.pack(fill="x", pady=ModernTheme.SPACING_SMALL)
        
        ttk.Label(input_folder_frame, text="班級照片資料夾:").pack(side="left")
        self.simple_input_folder_var = tk.StringVar()
        input_entry = ttk.Entry(input_folder_frame, textvariable=self.simple_input_folder_var)
        input_entry.pack(side="left", fill="x", expand=True, padx=(0, ModernTheme.SPACING_SMALL))
        ttk.Button(input_folder_frame, text="選擇", 
                  command=self.select_simple_input_folder).pack(side="right")
        
        # 輸出資料夾選擇
        output_folder_frame = ttk.Frame(settings_frame)
        output_folder_frame.pack(fill="x", pady=ModernTheme.SPACING_SMALL)
        
        ttk.Label(output_folder_frame, text="輸出資料夾:").pack(side="left")
        self.simple_output_folder_var = tk.StringVar()
        output_entry = ttk.Entry(output_folder_frame, textvariable=self.simple_output_folder_var)
        output_entry.pack(side="left", fill="x", expand=True, padx=(0, ModernTheme.SPACING_SMALL))
        ttk.Button(output_folder_frame, text="選擇", 
                  command=self.select_simple_output_folder).pack(side="right")
        
        # 處理模式選擇
        mode_frame = ttk.LabelFrame(settings_frame, text="處理模式", padding=ModernTheme.SPACING_SMALL)
        mode_frame.pack(fill="x", pady=ModernTheme.SPACING_SMALL)
        
        self.process_mode_var = tk.StringVar(value="standard")
        
        # 標準模式
        standard_radio = ttk.Radiobutton(
            mode_frame, text="標準模式 - 平衡準確性和速度", 
            variable=self.process_mode_var, value="standard"
        )
        standard_radio.pack(anchor="w", pady=ModernTheme.SPACING_SMALL)
        
        # 快速預覽模式
        quick_radio = ttk.Radiobutton(
            mode_frame, text="快速預覽 - 只顯示識別結果，跳過詳細處理", 
            variable=self.process_mode_var, value="quick"
        )
        quick_radio.pack(anchor="w", pady=ModernTheme.SPACING_SMALL)
        
        # 後台處理模式
        background_radio = ttk.Radiobutton(
            mode_frame, text="後台處理 - 在後台處理，您可以繼續使用電腦", 
            variable=self.process_mode_var, value="background"
        )
        background_radio.pack(anchor="w", pady=ModernTheme.SPACING_SMALL)
        
        # 開始篩選按鈕
        button_frame = ttk.Frame(parent)
        button_frame.pack(fill="x", pady=ModernTheme.SPACING_MEDIUM)
        
        # 檢查是否可以開始篩選
        self.update_simple_start_button()
        
        # 綁定變量更新，自動更新按鈕狀態
        self.simple_ref_folder_var.trace('w', lambda *args: self.update_simple_start_button())
        self.simple_input_folder_var.trace('w', lambda *args: self.update_simple_start_button())
        self.simple_output_folder_var.trace('w', lambda *args: self.update_simple_start_button())
        
        self.simple_start_button = ttk.Button(
            button_frame, 
            text="開始篩選", 
            command=self.start_simple_processing,
            style="Accent.TButton"
        )
        self.simple_start_button.pack(fill="x", ipady=ModernTheme.SPACING_MEDIUM)
        
        # 添加到處理隊列按鈕
        self.queue_button = ttk.Button(
            button_frame, 
            text="添加到處理隊列", 
            command=self.add_to_queue,
            state="disabled"
        )
        # 進度顯示
        progress_frame = ttk.Frame(parent)
        progress_frame.pack(fill="x", pady=(0, ModernTheme.SPACING_MEDIUM))
        
        self.simple_progress_var = tk.DoubleVar()
        progress_bar = ttk.Progressbar(progress_frame, variable=self.simple_progress_var, 
                                      maximum=100, length=400,
                                      style="SimpleProgress.Horizontal.TProgressbar")
        progress_bar.pack(fill="x", pady=ModernTheme.SPACING_SMALL)
        
        self.simple_progress_label = ttk.Label(progress_frame, text="就緒")
        self.simple_progress_label.pack(fill="x", pady=(0, ModernTheme.SPACING_SMALL))
        
        # 處理隊列狀態
        queue_frame = ttk.LabelFrame(parent, text="處理隊列", padding=ModernTheme.SPACING_MEDIUM)
        queue_frame.pack(fill="x", pady=(0, ModernTheme.SPACING_MEDIUM))
        
        # 隊列列表
        self.queue_listbox = tk.Listbox(queue_frame, height=4)
        self.queue_listbox.pack(fill="x", pady=ModernTheme.SPACING_SMALL)
        
        # 隊列按鈕
        queue_buttons_frame = ttk.Frame(queue_frame)
        queue_buttons_frame.pack(fill="x")
        
        ttk.Button(queue_buttons_frame, text="處理下一個", 
                  command=self.process_next_in_queue).pack(side="left", padx=(0, ModernTheme.SPACING_SMALL))
        
        ttk.Button(queue_buttons_frame, text="清空隊列", 
                  command=self.clear_queue).pack(side="right")
        
        # 結果預覽
        preview_frame = ttk.LabelFrame(parent, text="結果預覽", padding=ModernTheme.SPACING_MEDIUM)
        preview_frame.pack(fill="both", expand=True, pady=(0, ModernTheme.SPACING_MEDIUM))
        
        self.simple_preview = PhotoPreviewFrame(preview_frame, title="找到的照片")
        self.simple_preview.pack(fill="both", expand=True)
        
        # 初始化處理隊列
        self.processing_queue = []
    
    def create_advanced_mode_ui(self, parent):
        """創建高級模式UI（保留原有功能）"""
        # 創建左右分欄
        left_pane = ttk.Frame(parent)
        left_pane.pack(side="left", fill="both", expand=True, padx=(0, ModernTheme.SPACING_SMALL))
        
        right_pane = ttk.Frame(parent)
        right_pane.pack(side="right", fill="both", expand=True, padx=(ModernTheme.SPACING_SMALL, 0))
        
        # 左側：設置區域
        self.create_settings_panel(left_pane)
        
        # 右側：預覽和日誌區域
        self.create_preview_and_log_panel(right_pane)
    
    def toggle_mode(self):
        """切換操作模式"""
        if self.mode_var.get() == "simple":
            # 切換到簡化模式
            self.simple_mode_frame.pack(fill="both", expand=True)
            self.advanced_mode_frame.pack_forget()
            self.log_message("已切換到簡化模式")
        else:
            # 切換到高級模式
            self.simple_mode_frame.pack_forget()
            self.advanced_mode_frame.pack(fill="both", expand=True)
            self.log_message("已切換到高級模式")
    
    def select_folder(self, title="選擇資料夾", folder_var=None):
        """
        統一的資料夾選擇方法
        
        Args:
            title: 對話框標題
            folder_var: 要更新的資料夾變量
            
        Returns:
            選擇的資料夾路徑
        """
        folder = filedialog.askdirectory(title=title)
        if folder:
            if folder_var:
                folder_var.set(folder)
            return folder
        return None
    
    def select_simple_ref_folder(self):
        """選擇簡化模式參考照資料夾"""
        self.select_folder("選擇參考照資料夾", self.simple_ref_folder_var)
        self.update_simple_start_button()
    
    def select_simple_input_folder(self):
        """選擇簡化模式輸入資料夾"""
        self.select_folder("選擇班級照片資料夾", self.simple_input_folder_var)
        self.update_simple_start_button()
    
    def select_simple_output_folder(self):
        """選擇簡化模式輸出資料夾"""
        self.select_folder("選擇輸出資料夾", self.simple_output_folder_var)
        self.update_simple_start_button()
    
    def select_ref_folder(self):
        """選擇高級模式參考照資料夾"""
        self.select_folder("選擇參考照資料夾", self.ref_folder_var)
    
    def select_input_folder(self):
        """選擇高級模式輸入資料夾"""
        self.select_folder("選擇班級照片資料夾", self.input_folder_var)
    
    def select_output_folder(self):
        """選擇高級模式輸出資料夾"""
        self.select_folder("選擇輸出資料夾", self.output_folder_var)
    
    def select_child_ref_folder(self, child_id):
        """選擇小孩參考照資料夾"""
        folder = self.select_folder(f"選擇小孩 {child_id} 的參考照資料夾")
        return folder
    
    def update_simple_start_button(self):
        """更新簡化模式開始按鈕狀態"""
        # 檢查是否所有必要資料夾都已選擇
        ref_folder = self.simple_ref_folder_var.get()
        input_folder = self.simple_input_folder_var.get()
        output_folder = self.simple_output_folder_var.get()
        
        if ref_folder and input_folder and output_folder:
            self.simple_start_button.config(state="normal")
        else:
            self.simple_start_button.config(state="disabled")
    
    def start_simple_processing(self):
        """開始簡化模式處理"""
        # 檢查輸入
        ref_folder = self.simple_ref_folder_var.get()
        input_folder = self.simple_input_folder_var.get()
        output_folder = self.simple_output_folder_var.get()
        
        # 驗證參考照資料夾
        is_valid, error_message, ref_count = self.validate_image_folder(ref_folder, "參考照資料夾")
        if not is_valid:
            self.show_friendly_error("輸入錯誤", error_message, "請選擇包含清晰人臉照片的資料夾")
            return
        
        # 驗證班級照片資料夾
        is_valid, error_message, input_count = self.validate_image_folder(input_folder, "班級照片資料夾")
        if not is_valid:
            self.show_friendly_error("輸入錯誤", error_message, "請選擇包含班級照片的資料夾")
            return
        
        # 驗證輸出資料夾
        is_valid, error_message = self.validate_output_folder(output_folder)
        if not is_valid:
            self.show_friendly_error("輸出錯誤", error_message, "請選擇有足夠空間的資料夾")
            return
        
        # 檢查參考照片數量
        if ref_count < 3:
            if not messagebox.askyesno("參考照片數量不足", 
                                   f"參考照片資料夾中只有 {ref_count} 張照片。\n建議至少提供3-5張照片以提高識別準確性。\n\n是否繼續？"):
                return
        
        # 獲取處理模式
        process_mode = self.process_mode_var.get()
        
        # 同步到高級模式
        self.ref_folder_var.set(ref_folder)
        self.input_folder_var.set(input_folder)
        self.output_folder_var.set(output_folder)
        
        # 根據模式進行不同處理
        if process_mode == "quick":
            # 快速預覽模式 - 只顯示識別結果，跳過詳細處理
            self.start_quick_preview_mode(ref_folder, input_folder, output_folder)
        elif process_mode == "background":
            # 後台處理模式 - 在後台處理，用戶可以繼續使用電腦
            self.start_background_processing_mode(ref_folder, input_folder, output_folder)
        else:
            # 標準模式 - 完整處理
            self.start_standard_processing_mode(ref_folder, input_folder, output_folder)
    
    def start_quick_preview_mode(self, ref_folder, input_folder, output_folder):
        """快速預覽模式處理"""
        self.log_message("快速預覽模式：正在初始化...")
        self.simple_progress_label.config(text="快速預覽模式初始化中...")
        self.simple_progress_var.set(5)
        
        def quick_preview_thread():
            try:
                # 初始化模型，帶進度回調
                def model_progress(current, total, message):
                    # 計算進度百分比 (5% - 15%)
                    progress = int(5 + (current / total) * 10)
                    self.simple_progress_var.set(progress)
                    self.simple_progress_label.config(text=f"模型初始化: {message}")
                
                if not self.face_service.initialize_model(progress_callback=model_progress):
                    self.show_friendly_error("模型錯誤", "模型初始化失敗", "請檢查網路連接和磁盤空間")
                    return
                
                # 建立參考照片庫
                self.log_message("建立參考照片庫...")
                self.simple_progress_label.config(text="建立參考照片庫...")
                self.simple_progress_var.set(15)
                
                if not self.face_service.build_reference_gallery(ref_folder):
                    self.show_friendly_error("參考照片錯誤", "建立參考照片庫失敗", "請確保參考照片中包含清晰的人臉")
                    return
                
                # 獲取輸入圖片列表
                import os
                image_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp'}
                image_paths = []
                
                try:
                    for filename in os.listdir(input_folder):
                        if any(filename.lower().endswith(ext) for ext in image_extensions):
                            image_path = os.path.join(input_folder, filename)
                            image_paths.append(image_path)
                except Exception as e:
                    self.handle_exception(e, "讀取輸入資料夾")
                    return
                
                total_images = len(image_paths)
                if total_images == 0:
                    self.show_friendly_error("輸入錯誤", "輸入資料夾中沒有找到圖片", "請確保輸入資料夾包含支持的圖片格式")
                    return
                
                # 快速預覽處理 - 只檢測人臉，不進行完整處理
                self.log_message(f"快速預覽模式：找到 {total_images} 張圖片，開始快速檢測...")
                self.simple_progress_label.config(text="快速檢測人臉中...")
                
                quick_results = []
                for i, image_path in enumerate(image_paths):
                    # 更新進度
                    progress = int(15 + (i / total_images) * 75)  # 15% - 90%
                    self.simple_progress_var.set(progress)
                    self.simple_progress_label.config(text=f"快速檢測中 {i+1}/{total_images}")
                    
                    try:
                        # 只檢測人臉，不進行完整識別
                        faces = self.face_service.detect_faces(image_path)
                        if faces:
                            # 簡單相似度計算
                            best_match = self.face_service.find_child_in_image(image_path, threshold=0.6)
                            if best_match:
                                quick_results.append({
                                    'image': os.path.basename(image_path),
                                    'path': image_path,
                                    'similarity': best_match.similarity_score,
                                    'confidence': best_match.confidence,
                                    'faces_count': len(faces)
                                })
                    except Exception as e:
                        self.log_message(f"處理圖片失敗 {os.path.basename(image_path)}: {str(e)}")
                        continue
                
                # 完成處理
                self.simple_progress_var.set(100)
                self.simple_progress_label.config(text="快速預覽完成")
                
                # 顯示結果
                self.show_quick_preview_results(quick_results, output_folder)
                
            except Exception as e:
                self.handle_exception(e, "快速預覽模式處理")
        
        # 啟動線程
        threading.Thread(target=quick_preview_thread, daemon=True).start()
    
    def start_background_processing_mode(self, ref_folder, input_folder, output_folder):
        """後台處理模式"""
        self.log_message("後台處理模式：正在初始化...")
        self.simple_progress_label.config(text="後台處理模式初始化中...")
        self.simple_progress_var.set(5)
        
        # 創建後台處理窗口
        background_window = tk.Toplevel(self.root)
        background_window.title("後台處理中")
        background_window.geometry("400x200")
        background_window.transient(self.root)
        
        # 添加說明
        info_label = ttk.Label(background_window, text="後台處理已啟動，您可以繼續使用電腦。\n處理完成後將會通知您。")
        info_label.pack(pady=20)
        
        # 進度條
        bg_progress = ttk.Progressbar(background_window, mode="indeterminate")
        bg_progress.pack(pady=10, padx=20, fill="x")
        bg_progress.start(10)
        
        # 狀態標籤
        status_label = ttk.Label(background_window, text="正在初始化模型...")
        status_label.pack(pady=5)
        
        # 關閉按鈕
        close_button = ttk.Button(background_window, text="隱藏窗口", command=background_window.withdraw)
        close_button.pack(pady=10)
        
        def background_thread():
            try:
                # 初始化模型，帶進度回調
                def model_progress(current, total, message):
                    # 更新狀態標籤
                    def update_status():
                        status_label.config(text=f"模型初始化: {message}")
                    
                    self.root.after(0, update_status)
                
                if not self.face_service.initialize_model(progress_callback=model_progress):
                    def show_error():
                        background_window.deiconify()
                        bg_progress.stop()
                        
                        for widget in background_window.winfo_children():
                            widget.destroy()
                        
                        ttk.Label(background_window, text="模型初始化失敗！").pack(pady=20)
                        ttk.Label(background_window, text="請檢查網路連接和磁盤空間").pack(pady=5)
                        
                        close_button = ttk.Button(background_window, text="關閉", command=background_window.destroy)
                        close_button.pack(pady=10)
                    
                    self.root.after(0, show_error)
                    return
                
                # 建立參考照片庫
                self.root.after(0, lambda: status_label.config(text="建立參考照片庫..."))
                self.log_message("建立參考照片庫...")
                if not self.face_service.build_reference_gallery(ref_folder):
                    def show_error():
                        background_window.deiconify()
                        bg_progress.stop()
                        
                        for widget in background_window.winfo_children():
                            widget.destroy()
                        
                        ttk.Label(background_window, text="建立參考照片庫失敗！").pack(pady=20)
                        ttk.Label(background_window, text="請確保參考照片中包含清晰的人臉").pack(pady=5)
                        
                        close_button = ttk.Button(background_window, text="關閉", command=background_window.destroy)
                        close_button.pack(pady=10)
                    
                    self.root.after(0, show_error)
                    return
                
                # 後台處理
                self.root.after(0, lambda: status_label.config(text="正在處理照片..."))
                threshold = 0.65  # 使用默認閾值
                results = self.face_service.batch_process_folder(
                    input_folder, output_folder, 
                    threshold=threshold,
                    copy_files=True,
                    quality_threshold=0.3,
                    multithread=True,
                    thread_count=4
                )
                
                # 處理完成，通知用戶
                def show_completion():
                    background_window.deiconify()  # 顯示窗口
                    bg_progress.stop()
                    
                    # 更新窗口內容
                    for widget in background_window.winfo_children():
                        widget.destroy()
                    
                    ttk.Label(background_window, text="後台處理已完成！").pack(pady=20)
                    ttk.Label(background_window, text=f"找到 {results['found_child']} 張照片").pack(pady=5)
                    
                    # 查看結果按鈕
                    result_button = ttk.Button(
                        background_window, 
                        text="查看結果", 
                        command=lambda: [self.show_simple_results(results), background_window.destroy()]
                    )
                    result_button.pack(pady=10)
                    
                    # 關閉按鈕
                    close_button = ttk.Button(background_window, text="關閉", command=background_window.destroy)
                    close_button.pack(pady=5)
                
                # 在主線程中更新UI
                self.root.after(0, show_completion)
                
            except Exception as e:
                def show_error():
                    background_window.deiconify()
                    bg_progress.stop()
                    
                    for widget in background_window.winfo_children():
                        widget.destroy()
                    
                    ttk.Label(background_window, text="後台處理失敗！").pack(pady=20)
                    ttk.Label(background_window, text=f"錯誤: {str(e)}").pack(pady=5)
                    
                    close_button = ttk.Button(background_window, text="關閉", command=background_window.destroy)
                    close_button.pack(pady=10)
                
                self.root.after(0, show_error)
                self.handle_exception(e, "後台處理模式")
        
        # 啟動後台線程
        threading.Thread(target=background_thread, daemon=True).start()
    
    def start_standard_processing_mode(self, ref_folder, input_folder, output_folder):
        """標準處理模式"""
        # 分析參考照質量
        self.log_message("正在分析參考照質量...")
        self.simple_progress_label.config(text="分析參考照質量中...")
        self.simple_progress_var.set(5)
        
        def analyze_ref_thread():
            try:
                # 初始化模型，帶進度回調
                def model_progress(current, total, message):
                    # 計算進度百分比 (5% - 15%)
                    progress = int(5 + (current / total) * 10)
                    self.simple_progress_var.set(progress)
                    self.simple_progress_label.config(text=f"模型初始化: {message}")
                
                if not self.face_service.initialize_model(progress_callback=model_progress):
                    self.show_friendly_error("模型錯誤", "模型初始化失敗", "請檢查網路連接和磁盤空間")
                    return
                
                # 建立參考照片庫
                self.log_message("建立參考照片庫...")
                self.simple_progress_label.config(text="建立參考照片庫...")
                self.simple_progress_var.set(15)
                
                if not self.face_service.build_reference_gallery(ref_folder):
                    self.show_friendly_error("參考照片錯誤", "建立參考照片庫失敗", "請確保參考照片中包含清晰的人臉")
                    return
                
                # 分析參考照片質量
                ref_paths = self.face_service.reference_paths
                ref_analysis = self.face_service.assess_reference_quality(ref_paths)
                
                # 建議最佳閾值
                suggested_threshold = self.face_service.suggest_optimal_threshold(ref_analysis)
                
                # 在主線程中更新UI
                self.root.after(0, lambda: self.show_reference_analysis(ref_analysis, suggested_threshold))
                
                # 開始批量處理
                self.root.after(100, lambda: self.start_simple_batch_processing())
                
            except Exception as e:
                self.handle_exception(e, "標準處理模式")
        
        # 啟動線程
        threading.Thread(target=analyze_ref_thread, daemon=True).start()
    
    def show_quick_preview_results(self, results, output_folder):
        """顯示快速預覽結果"""
        # 創建結果窗口
        result_window = tk.Toplevel(self.root)
        result_window.title("快速預覽結果")
        result_window.geometry("800x600")
        result_window.transient(self.root)
        
        # 結果統計
        stats_frame = ttk.Frame(result_window)
        stats_frame.pack(fill="x", padx=10, pady=10)
        
        ttk.Label(stats_frame, text=f"找到 {len(results)} 張可能的照片", 
                 font=ModernTheme.FONT_MEDIUM).pack(side="left")
        
        # 結果列表
        list_frame = ttk.Frame(result_window)
        list_frame.pack(fill="both", expand=True, padx=10, pady=5)
        
        # 創建樹形視圖
        columns = ("照片", "相似度", "信心", "人臉數")
        tree = ttk.Treeview(list_frame, columns=columns, show="headings", height=15)
        
        # 設置列
        tree.heading("照片", text="照片名稱")
        tree.heading("相似度", text="相似度")
        tree.heading("信心", text="信心水平")
        tree.heading("人臉數", text="人臉數量")
        
        tree.column("照片", width=300)
        tree.column("相似度", width=100)
        tree.column("信心", width=100)
        tree.column("人臉數", width=100)
        
        # 添加滾動條
        scrollbar = ttk.Scrollbar(list_frame, orient="vertical", command=tree.yview)
        tree.configure(yscrollcommand=scrollbar.set)
        
        tree.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
        
        # 添加結果
        for result in results:
            tree.insert("", "end", values=(
                result['image'],
                f"{result['similarity']:.2f}",
                result['confidence'],
                result['faces_count']
            ))
        
        # 按鈕框架
        button_frame = ttk.Frame(result_window)
        button_frame.pack(fill="x", padx=10, pady=10)
        
        # 全選按鈕
        def select_all():
            for item in tree.get_children():
                tree.selection_add(item)
        
        # 複製選中按鈕
        def copy_selected():
            selected_items = tree.selection()
            if not selected_items:
                messagebox.showinfo("提示", "請先選擇要複製的照片")
                return
            
            import shutil
            os.makedirs(output_folder, exist_ok=True)
            
            copied = 0
            for item in selected_items:
                values = tree.item(item, "values")
                image_name = values[0]
                
                # 找到對應的完整路徑
                for result in results:
                    if result['image'] == image_name:
                        src_path = result['path']
                        dst_path = os.path.join(output_folder, image_name)
                        shutil.copy2(src_path, dst_path)
                        copied += 1
                        break
            
            messagebox.showinfo("完成", f"已複製 {copied} 張照片到輸出資料夾")
        
        ttk.Button(button_frame, text="全選", command=select_all).pack(side="left", padx=5)
        ttk.Button(button_frame, text="複製選中", command=copy_selected).pack(side="left", padx=5)
        ttk.Button(button_frame, text="關閉", command=result_window.destroy).pack(side="right", padx=5)
    
    def show_simple_results(self, results):
        """顯示簡單結果"""
        # 更新結果統計
        self.update_simple_results(results)
        
        # 切換到結果標籤頁
        self.notebook.select(2)  # 結果標籤頁索引為2
    
    def show_reference_analysis(self, ref_analysis, suggested_threshold):
        """顯示參考照分析結果"""
        # 創建分析窗口
        analysis_window = tk.Toplevel(self.root)
        analysis_window.title("參考照分析結果")
        analysis_window.geometry("600x400")
        
        # 創建主框架
        main_frame = ttk.Frame(analysis_window)
        main_frame.pack(fill="both", expand=True, padx=10, pady=10)
        
        # 統計信息
        stats_frame = ttk.LabelFrame(main_frame, text="參考照統計", padding=ModernTheme.SPACING_MEDIUM)
        stats_frame.pack(fill="x", pady=(0, ModernTheme.SPACING_MEDIUM))
        
        # 總數和質量
        total_count = ref_analysis.get('total_count', 0)
        good_quality_count = ref_analysis.get('good_quality_count', 0)
        quality_ratio = good_quality_count / total_count if total_count > 0 else 0
        
        ttk.Label(stats_frame, text=f"參考照總數: {total_count}").pack(anchor="w")
        ttk.Label(stats_frame, text=f"高質量照片: {good_quality_count} ({quality_ratio:.1%})").pack(anchor="w")
        
        # 多樣性分數
        diversity_score = ref_analysis.get('diversity_score', 0.0)
        ttk.Label(stats_frame, text=f"多樣性分數: {diversity_score:.2f}/1.00").pack(anchor="w")
        
        # 年齡範圍
        age_range = ref_analysis.get('age_range')
        if age_range:
            min_age, max_age = age_range
            ttk.Label(stats_frame, text=f"年齡範圍: {min_age:.1f} - {max_age:.1f}").pack(anchor="w")
        
        # 表情多樣性
        expression_variety = ref_analysis.get('expression_variety', 0)
        ttk.Label(stats_frame, text=f"表情多樣性: {expression_variety} 種").pack(anchor="w")
        
        # 建議閾值
        threshold_frame = ttk.LabelFrame(main_frame, text="建議設置", padding=ModernTheme.SPACING_MEDIUM)
        threshold_frame.pack(fill="x", pady=(0, ModernTheme.SPACING_MEDIUM))
        
        ttk.Label(threshold_frame, text=f"建議相似度閾值: {suggested_threshold:.2f}").pack(anchor="w")
        
        # 閾值說明
        if suggested_threshold < 0.6:
            threshold_desc = "寬鬆模式 - 可能會包含一些錯誤匹配，但減少漏檢"
        elif suggested_threshold > 0.7:
            threshold_desc = "嚴格模式 - 減少錯誤匹配，但可能會漏檢一些照片"
        else:
            threshold_desc = "標準模式 - 平衡準確性和召回率"
        
        ttk.Label(threshold_frame, text=threshold_desc).pack(anchor="w", pady=(ModernTheme.SPACING_SMALL, 0))
        
        # 建議
        recommendations = ref_analysis.get('recommendations', [])
        if recommendations:
            rec_frame = ttk.LabelFrame(main_frame, text="改進建議", padding=ModernTheme.SPACING_MEDIUM)
            rec_frame.pack(fill="both", expand=True, pady=(0, ModernTheme.SPACING_MEDIUM))
            
            for i, rec in enumerate(recommendations, 1):
                ttk.Label(rec_frame, text=f"{i}. {rec}").pack(anchor="w", pady=ModernTheme.SPACING_SMALL)
        
        # 按鈕
        button_frame = ttk.Frame(main_frame)
        button_frame.pack(fill="x", pady=(ModernTheme.SPACING_MEDIUM, 0))
        
        ttk.Button(button_frame, text="接受建議", 
                  command=analysis_window.destroy).pack(side="right", padx=(ModernTheme.SPACING_SMALL, 0))
        
        # 自動關閉
        analysis_window.after(10000, analysis_window.destroy)  # 10秒後自動關閉
    
    def start_simple_batch_processing(self):
        """開始簡化模式批量處理"""
        input_folder = self.simple_input_folder_var.get()
        output_folder = self.simple_output_folder_var.get()
        
        self.log_message("開始批量處理...")
        self.simple_progress_label.config(text="正在處理照片...")
        
        # 創建進度回調
        from src.core.face_recognition_service import ProgressCallback
        progress_callback = ProgressCallback(self.update_simple_progress)
        
        def process_thread():
            try:
                # 執行批量處理
                results = self.face_service.batch_process_folder(
                    input_folder,
                    output_folder,
                    threshold=0.65,  # 使用默認閾值
                    copy_files=True,
                    quality_threshold=0.3,  # 使用默認質量閾值
                    multithread=True,
                    thread_count=4,
                    progress_callback=progress_callback
                )
                
                # 更新結果
                self.root.after(0, lambda: self.update_simple_results(results))
                
            except Exception as e:
                self.root.after(0, lambda: self.log_message(f"處理錯誤: {e}"))
                self.root.after(0, lambda: self.simple_progress_label.config(text=f"錯誤: {e}"))
                self.root.after(0, lambda: self.simple_progress_var.set(0))
        
        threading.Thread(target=process_thread, daemon=True).start()
    
    def update_simple_progress(self, current, total, message):
        """更新簡化模式進度"""
        progress = (current / total) * 100 if total > 0 else 0
        self.root.after(0, lambda: self.simple_progress_var.set(progress))
        self.root.after(0, lambda: self.simple_progress_label.config(text=f"{message} ({current}/{total})"))
        
        # 添加視覺化反饋 - 根據進度更新顏色
        if progress < 30:
            color = "#FF6B6B"  # 紅色 - 開始階段
        elif progress < 70:
            color = "#FFD166"  # 黃色 - 處理中
        else:
            color = "#06D6A0"  # 綠色 - 即將完成
        
        # 更新進度條顏色（通過樣式）
        style = ttk.Style()
        style.configure("SimpleProgress.Horizontal.TProgressbar", 
                       troughcolor=ModernTheme.BACKGROUND, 
                       background=color)
        
        # 更新進度條樣式
        self.root.after(0, lambda: self.simple_progress_var.set(progress))
        
        # 顯示當前處理的圖片（如果有的話）
        if "正在處理" in message and hasattr(self, 'simple_current_image'):
            self.root.after(0, lambda: self.simple_progress_label.config(
                text=f"{message} ({current}/{total}) - 當前: {os.path.basename(self.simple_current_image)}"))
    
    def update_simple_results(self, results):
        """更新簡化模式結果"""
        total = results.get('total_images', 0)
        found = results.get('found_child', 0)
        
        self.log_message(f"處理完成: {found}/{total} 張照片找到小孩")
        self.simple_progress_label.config(text="處理完成")
        self.simple_progress_var.set(100)
        
        # 清空預覽
        self.simple_preview.clear_display()
        
        # 創建結果網格視圖
        self.create_result_grid_view(results)
        
        # 顯示統計
        stats_text = f"找到 {found} 張包含小孩的照片，共處理 {total} 張照片"
        self.simple_progress_label.config(text=stats_text)
        
        # 顯示完成消息
        messagebox.showinfo("完成", f"處理完成！\n找到 {found} 張包含小孩的照片\n共處理 {total} 張照片")
        
        # 更新成就系統
        self.update_achievements(total, found)
        
        # 顯示今日發現
        self.show_daily_discovery(results)
    
    def create_result_grid_view(self, results):
        """創建結果網格視圖"""
        # 創建新窗口顯示結果網格
        grid_window = tk.Toplevel(self.root)
        grid_window.title("篩選結果")
        grid_window.geometry("900x600")
        
        # 創建主框架
        main_frame = ttk.Frame(grid_window)
        main_frame.pack(fill="both", expand=True, padx=10, pady=10)
        
        # 統計信息
        stats_frame = ttk.Frame(main_frame)
        stats_frame.pack(fill="x", pady=(0, 10))
        
        total = results.get('total_images', 0)
        found = results.get('found_child', 0)
        quality_filtered = results.get('quality_filtered', 0)
        
        stats_text = f"找到 {found} 張包含小孩的照片，共處理 {total} 張照片"
        if quality_filtered > 0:
            stats_text += f"，{quality_filtered} 張因質量過低被過濾"
        
        ttk.Label(stats_frame, text=stats_text, font=ModernTheme.FONT_MEDIUM).pack(side="left")
        
        # 導出按鈕
        ttk.Button(stats_frame, text="導出結果", 
                  command=lambda: self.export_results(results)).pack(side="right")
        
        # 創建滾動框架
        canvas = tk.Canvas(main_frame)
        scrollbar = ttk.Scrollbar(main_frame, orient="vertical", command=canvas.yview)
        scrollable_frame = ttk.Frame(canvas)
        
        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )
        
        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)
        
        # 網格佈局
        matches = results.get('matches', [])
        if matches:
            # 計算網格列數
            cols = 3
            rows = (len(matches) + cols - 1) // cols
            
            for i, match in enumerate(matches):
                row = i // cols
                col = i % cols
                
                # 創建照片框架
                photo_frame = ttk.LabelFrame(scrollable_frame, padding=5)
                photo_frame.grid(row=row, column=col, padx=5, pady=5, sticky="nsew")
                
                # 照片路徑
                image_path = os.path.join(self.simple_input_folder_var.get(), match['image'])
                
                # 創建縮略圖
                try:
                    # 加載圖片並創建縮略圖
                    from PIL import Image, ImageTk
                    
                    img = Image.open(image_path)
                    img.thumbnail((200, 200), Image.Resampling.LANCZOS)
                    photo = ImageTk.PhotoImage(img)
                    
                    # 顯示圖片
                    img_label = ttk.Label(photo_frame, image=photo)
                    img_label.image = photo  # 保持引用
                    img_label.pack()
                    
                    # 添加點擊事件
                    img_label.bind("<Button-1>", lambda e, path=image_path: self.show_full_image(path))
                    
                except Exception as e:
                    # 如果圖片加載失敗，顯示錯誤
                    error_label = ttk.Label(photo_frame, text="無法加載圖片", 
                                          foreground="red")
                    error_label.pack(pady=50)
                
                # 添加信息標籤
                similarity = match.get('similarity', 0)
                confidence = match.get('confidence', 0)
                quality = match.get('quality', {}).get('overall', 0)
                
                # 根據相似度設置顏色
                if similarity > 0.8:
                    color = "#06D6A0"  # 綠色 - 高相似度
                elif similarity > 0.7:
                    color = "#FFD166"  # 黃色 - 中等相似度
                else:
                    color = "#FF6B6B"  # 紅色 - 低相似度
                
                info_text = f"相似度: {similarity:.2f}\n信心: {confidence}\n質量: {quality:.2f}"
                info_label = ttk.Label(photo_frame, text=info_text, font=ModernTheme.FONT_SMALL)
                info_label.pack(pady=5)
                
                # 設置相似度標籤顏色
                similarity_label = ttk.Label(photo_frame, text=f"相似度: {similarity:.2f}", 
                                          foreground=color, font=ModernTheme.FONT_SMALL)
                similarity_label.pack()
                
                # 文件名
                filename_label = ttk.Label(photo_frame, text=os.path.basename(match['image']), 
                                         font=ModernTheme.FONT_SMALL)
                filename_label.pack(pady=2)
        
        # 配置網格權重
        for i in range(cols):
            scrollable_frame.columnconfigure(i, weight=1)
        
        # 打包滾動框架
        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
    
    def show_full_image(self, image_path):
        """顯示完整大小的圖片"""
        # 創建新窗口顯示完整圖片
        img_window = tk.Toplevel(self.root)
        img_window.title(f"圖片預覽 - {os.path.basename(image_path)}")
        
        try:
            # 加載圖片
            from PIL import Image, ImageTk
            
            img = Image.open(image_path)
            
            # 調整圖片大小以適應屏幕
            screen_width = img_window.winfo_screenwidth()
            screen_height = img_window.winfo_screenheight()
            
            img_width, img_height = img.size
            
            # 如果圖片太大，調整大小
            if img_width > screen_width * 0.8 or img_height > screen_height * 0.8:
                ratio = min(screen_width * 0.8 / img_width, screen_height * 0.8 / img_height)
                img_width = int(img_width * ratio)
                img_height = int(img_height * ratio)
                img = img.resize((img_width, img_height), Image.Resampling.LANCZOS)
            
            photo = ImageTk.PhotoImage(img)
            
            # 顯示圖片
            img_label = ttk.Label(img_window, image=photo)
            img_label.image = photo  # 保持引用
            img_label.pack(padx=10, pady=10)
            
            # 設置窗口大小
            img_window.geometry(f"{img_width + 20}x{img_height + 20}")
            
        except Exception as e:
            # 如果圖片加載失敗，顯示錯誤
            error_label = ttk.Label(img_window, text=f"無法加載圖片: {e}", 
                                  foreground="red")
            error_label.pack(padx=20, pady=20)
    
    def export_results(self, results):
        """導出結果到文件"""
        # 選擇導出文件路徑
        file_path = filedialog.asksaveasfilename(
            title="導出結果",
            defaultextension=".json",
            filetypes=[("JSON文件", "*.json"), ("CSV文件", "*.csv"), ("所有文件", "*.*")]
        )
        
        if not file_path:
            return
        
        try:
            if file_path.endswith('.csv'):
                # 導出為CSV
                import csv
                
                with open(file_path, 'w', newline='', encoding='utf-8') as csvfile:
                    fieldnames = ['image', 'similarity', 'confidence', 'quality']
                    writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                    
                    writer.writeheader()
                    for match in results.get('matches', []):
                        writer.writerow({
                            'image': match['image'],
                            'similarity': match.get('similarity', 0),
                            'confidence': match.get('confidence', 0),
                            'quality': match.get('quality', {}).get('overall', 0)
                        })
            else:
                # 導出為JSON
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump(results, f, ensure_ascii=False, indent=2)
            
            messagebox.showinfo("導出成功", f"結果已導出到 {file_path}")
            self.log_message(f"結果已導出到 {file_path}")
            
        except Exception as e:
            messagebox.showerror("導出失敗", f"導出結果失敗: {e}")
            self.log_message(f"導出結果失敗: {e}")
    
    def create_preview_tab(self):
        """創建結果預覽標籤頁"""
        preview_tab = ttk.Frame(self.notebook)
        self.notebook.add(preview_tab, text="結果預覽")
        
        # 結果統計
        stats_frame = ttk.LabelFrame(preview_tab, text="處理結果統計", padding=ModernTheme.SPACING_MEDIUM)
        stats_frame.pack(fill="x", pady=(0, ModernTheme.SPACING_MEDIUM))
        
        self.result_var = tk.StringVar(value="尚未開始處理")
        result_label = ttk.Label(stats_frame, textvariable=self.result_var, 
                               font=ModernTheme.FONT_MEDIUM)
        result_label.pack()
        
        # 結果預覽
        results_frame = ttk.LabelFrame(preview_tab, text="找到的照片", padding=ModernTheme.SPACING_MEDIUM)
        results_frame.pack(fill="both", expand=True)
        
        # 結果列表
        self.results_listbox = tk.Listbox(results_frame)
        self.results_listbox.pack(side="left", fill="both", expand=True)
        self.results_listbox.bind('<<ListboxSelect>>', self.on_result_select)
        
        # 結果預覽
        self.result_preview = PhotoPreviewFrame(results_frame, title="照片詳情")
        self.result_preview.pack(side="right", fill="both", expand=True, padx=(ModernTheme.SPACING_SMALL, 0))
    
    def create_settings_tab(self):
        """創建設置標籤頁"""
        settings_tab = ttk.Frame(self.notebook)
        self.notebook.add(settings_tab, text="高級設置")
        
        # 模型設置
        model_frame = ttk.LabelFrame(settings_tab, text="模型設置", padding=ModernTheme.SPACING_MEDIUM)
        model_frame.pack(fill="x", pady=(0, ModernTheme.SPACING_MEDIUM))
        
        # 模型選擇
        model_select_frame = ttk.Frame(model_frame)
        model_select_frame.pack(fill="x", pady=ModernTheme.SPACING_SMALL)
        
        ttk.Label(model_select_frame, text="識別模型:").pack(side="left")
        self.model_var = tk.StringVar(value="buffalo_l")
        model_combo = ttk.Combobox(model_select_frame, textvariable=self.model_var, 
                                  values=["buffalo_l", "buffalo_m", "buffalo_s"])
        model_combo.pack(side="left", fill="x", expand=True, padx=ModernTheme.SPACING_SMALL)
        
        # 模型信息
        model_info = ttk.Label(model_frame, 
                              text="buffalo_l: 高精度 (推薦)\n"
                                   "buffalo_m: 中等精度\n"
                                   "buffalo_s: 快速模式", 
                              font=ModernTheme.FONT_SMALL)
        model_info.pack(fill="x", pady=(ModernTheme.SPACING_SMALL, 0))
        
        # 處理設置
        process_settings_frame = ttk.LabelFrame(settings_tab, text="處理設置", padding=ModernTheme.SPACING_MEDIUM)
        process_settings_frame.pack(fill="x", pady=(0, ModernTheme.SPACING_MEDIUM))
        
        # 多線程處理
        self.multithread_var = tk.BooleanVar(value=True)
        multithread_check = ttk.Checkbutton(process_settings_frame, text="啟用多線程處理", 
                                          variable=self.multithread_var)
        multithread_check.pack(anchor="w", pady=ModernTheme.SPACING_SMALL)
        
        # 處理線程數
        thread_frame = ttk.Frame(process_settings_frame)
        thread_frame.pack(fill="x", pady=ModernTheme.SPACING_SMALL)
        
        ttk.Label(thread_frame, text="處理線程數:").pack(side="left")
        self.thread_count_var = tk.IntVar(value=4)
        thread_spin = ttk.Spinbox(thread_frame, from_=1, to=8, textvariable=self.thread_count_var)
        thread_spin.pack(side="left", padx=ModernTheme.SPACING_SMALL)
        
        # 質量過濾
        quality_frame = ttk.Frame(process_settings_frame)
        quality_frame.pack(fill="x", pady=ModernTheme.SPACING_SMALL)
        
        ttk.Label(quality_frame, text="圖片質量閾值:").pack(side="left")
        self.quality_threshold_var = tk.DoubleVar(value=0.3)
        quality_scale = ttk.Scale(quality_frame, from_=0.1, to=0.9, 
                                 variable=self.quality_threshold_var, orient=tk.HORIZONTAL)
        quality_scale.pack(side="left", fill="x", expand=True, padx=ModernTheme.SPACING_SMALL)
        
        self.quality_label = ttk.Label(quality_frame, text="0.30")
        self.quality_label.pack(side="right")
        
        # 更新質量標籤
        self.quality_threshold_var.trace('w', lambda *args: self.quality_label.configure(
            text=f"{self.quality_threshold_var.get():.2f}"))
        
        # 質量說明
        quality_info = ttk.Label(quality_frame, 
                               text="(0.3=標準, 0.5=嚴格, 0.1=寬鬆)", 
                               font=ModernTheme.FONT_SMALL)
        quality_info.pack(fill="x", pady=(ModernTheme.SPACING_SMALL, 0))
        
        # 多小孩識別
        multi_child_frame = ttk.LabelFrame(settings_tab, text="多小孩識別", padding=ModernTheme.SPACING_MEDIUM)
        multi_child_frame.pack(fill="x", pady=(0, ModernTheme.SPACING_MEDIUM))
        
        # 啟用多小孩識別
        self.multi_child_var = tk.BooleanVar(value=False)
        multi_child_check = ttk.Checkbutton(multi_child_frame, text="啟用多小孩識別", 
                                          variable=self.multi_child_var,
                                          command=self.toggle_multi_child_mode)
        multi_child_check.pack(anchor="w", pady=ModernTheme.SPACING_SMALL)
        
        # 小孩配置區域
        self.child_profiles_frame = ttk.Frame(multi_child_frame)
        self.child_profiles_frame.pack(fill="x", pady=ModernTheme.SPACING_SMALL)
        
        # 添加小孩按鈕
        add_child_button = ttk.Button(self.child_profiles_frame, text="添加小孩", 
                                    command=self.add_child_profile)
        add_child_button.pack(side="left", padx=(0, ModernTheme.SPACING_SMALL))
        
        # 小孩列表
        self.child_profiles_listbox = tk.Listbox(self.child_profiles_frame, height=4)
        self.child_profiles_listbox.pack(side="left", fill="x", expand=True)
        
        # 編輯和刪除按鈕
        child_buttons_frame = ttk.Frame(self.child_profiles_frame)
        child_buttons_frame.pack(side="right")
        
        ttk.Button(child_buttons_frame, text="編輯", 
                  command=self.edit_child_profile).pack(fill="x", pady=(0, ModernTheme.SPACING_SMALL))
        ttk.Button(child_buttons_frame, text="刪除", 
                  command=self.delete_child_profile).pack(fill="x")
        
        # 手動標記
        manual_frame = ttk.LabelFrame(settings_tab, text="手動標記", padding=ModernTheme.SPACING_MEDIUM)
        manual_frame.pack(fill="x", pady=(0, ModernTheme.SPACING_MEDIUM))
        
        # 加載和保存按鈕
        manual_buttons_frame = ttk.Frame(manual_frame)
        manual_buttons_frame.pack(fill="x", pady=ModernTheme.SPACING_SMALL)
        
        ttk.Button(manual_buttons_frame, text="加載標記", 
                  command=self.load_manual_corrections).pack(side="left", padx=(0, ModernTheme.SPACING_SMALL))
        ttk.Button(manual_buttons_frame, text="保存標記", 
                  command=self.save_manual_corrections).pack(side="left")
        
        # 清除緩存按鈕
        cache_frame = ttk.Frame(settings_tab)
        cache_frame.pack(fill="x", pady=(0, ModernTheme.SPACING_MEDIUM))
        
        ttk.Button(cache_frame, text="清除緩存", 
                  command=self.clear_cache).pack(side="left")
        
        # 保存設置按鈕
        save_button = ttk.Button(settings_tab, text="保存設置", command=self.save_settings)
        save_button.pack(pady=ModernTheme.SPACING_MEDIUM)
    
    def toggle_multi_child_mode(self):
        """切換多小孩識別模式"""
        if self.multi_child_var.get():
            self.child_profiles_frame.pack(fill="x", pady=ModernTheme.SPACING_SMALL)
        else:
            self.child_profiles_frame.pack_forget()
    
    def add_child_profile(self):
        """添加小孩配置"""
        dialog = ChildProfileDialog(self.root, "添加小孩配置")
        self.root.wait_window(dialog.dialog)
        
        if dialog.result:
            child_id, name, ref_folder = dialog.result
            if child_id and name and ref_folder:
                # 添加到小孩配置
                if not hasattr(self, 'child_profiles'):
                    self.child_profiles = {}
                
                # 收集參考照
                image_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp'}
                ref_paths = []
                
                for filename in os.listdir(ref_folder):
                    if any(filename.lower().endswith(ext) for ext in image_extensions):
                        ref_paths.append(os.path.join(ref_folder, filename))
                
                if ref_paths:
                    self.child_profiles[child_id] = {
                        'name': name,
                        'ref_folder': ref_folder,
                        'ref_paths': ref_paths
                    }
                    
                    # 更新列表框
                    self.child_profiles_listbox.insert(tk.END, f"{child_id}: {name}")
                    self.log_message(f"添加小孩配置: {child_id}: {name}, {len(ref_paths)}張參考照")
                else:
                    messagebox.showerror("錯誤", "所選資料夾中沒有找到圖片文件")
    
    def edit_child_profile(self):
        """編輯小孩配置"""
        selection = self.child_profiles_listbox.curselection()
        if not selection:
            messagebox.showinfo("提示", "請先選擇要編輯的小孩配置")
            return
        
        index = selection[0]
        child_id = list(self.child_profiles.keys())[index]
        profile = self.child_profiles[child_id]
        
        dialog = ChildProfileDialog(self.root, "編輯小孩配置", 
                                  child_id, profile['name'], profile['ref_folder'])
        self.root.wait_window(dialog.dialog)
        
        if dialog.result:
            new_child_id, name, ref_folder = dialog.result
            if new_child_id and name and ref_folder:
                # 收集參考照
                image_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp'}
                ref_paths = []
                
                for filename in os.listdir(ref_folder):
                    if any(filename.lower().endswith(ext) for ext in image_extensions):
                        ref_paths.append(os.path.join(ref_folder, filename))
                
                if ref_paths:
                    # 如果ID改變，刪除舊的
                    if new_child_id != child_id:
                        del self.child_profiles[child_id]
                    
                    # 更新配置
                    self.child_profiles[new_child_id] = {
                        'name': name,
                        'ref_folder': ref_folder,
                        'ref_paths': ref_paths
                    }
                    
                    # 更新列表框
                    self.child_profiles_listbox.delete(index)
                    self.child_profiles_listbox.insert(index, f"{new_child_id}: {name}")
                    self.log_message(f"更新小孩配置: {new_child_id}: {name}, {len(ref_paths)}張參考照")
                else:
                    messagebox.showerror("錯誤", "所選資料夾中沒有找到圖片文件")
    
    def delete_child_profile(self):
        """刪除小孩配置"""
        selection = self.child_profiles_listbox.curselection()
        if not selection:
            messagebox.showinfo("提示", "請先選擇要刪除的小孩配置")
            return
        
        index = selection[0]
        child_id = list(self.child_profiles.keys())[index]
        name = self.child_profiles[child_id]['name']
        
        if messagebox.askyesno("確認刪除", f"確定要刪除小孩配置 {child_id}: {name} 嗎？"):
            del self.child_profiles[child_id]
            self.child_profiles_listbox.delete(index)
            self.log_message(f"刪除小孩配置: {child_id}: {name}")
    
    def load_manual_corrections(self):
        """加載手動標記校正"""
        file_path = filedialog.askopenfilename(
            title="選擇手動標記文件",
            filetypes=[("JSON文件", "*.json"), ("所有文件", "*.*")]
        )
        
        if file_path:
            try:
                self.face_service.load_manual_corrections(file_path)
                self.log_message(f"手動標記校正已從 {file_path} 加載")
                messagebox.showinfo("成功", "手動標記校正加載成功")
            except Exception as e:
                messagebox.showerror("錯誤", f"加載手動標記校正失敗: {e}")
    
    def save_manual_corrections(self):
        """保存手動標記校正"""
        file_path = filedialog.asksaveasfilename(
            title="保存手動標記文件",
            defaultextension=".json",
            filetypes=[("JSON文件", "*.json"), ("所有文件", "*.*")]
        )
        
        if file_path:
            try:
                self.face_service.save_manual_corrections(file_path)
                self.log_message(f"手動標記校正已保存到 {file_path}")
                messagebox.showinfo("成功", "手動標記校正保存成功")
            except Exception as e:
                messagebox.showerror("錯誤", f"保存手動標記校正失敗: {e}")
    
    def clear_cache(self):
        """清除緩存"""
        if messagebox.askyesno("確認清除", "確定要清除所有緩存嗎？這將使下次處理變慢。"):
            try:
                self.face_service.clear_cache()
                self.log_message("緩存已清除")
                messagebox.showinfo("成功", "緩存已清除")
            except Exception as e:
                messagebox.showerror("錯誤", f"清除緩存失敗: {e}")
    
    def build_reference_gallery(self):
        """建立參考照庫"""
        ref_folder = self.ref_folder_var.get()
        if not ref_folder:
            messagebox.showerror("錯誤", "請選擇參考照資料夾")
            return
        
        if not os.path.exists(ref_folder):
            messagebox.showerror("錯誤", "參考照資料夾不存在")
            return
        
        self.log_message("正在建立參考照庫...")
        self.status_var.set("建立參考照庫中...")
        
        def build_thread():
            try:
                # 如果啟用多小孩識別，使用小孩配置
                child_profiles = None
                if self.multi_child_var.get() and hasattr(self, 'child_profiles'):
                    child_profiles = {}
                    for child_id, profile in self.child_profiles.items():
                        child_profiles[child_id] = profile['ref_paths']
                
                success = self.face_service.build_reference_gallery(ref_folder, child_profiles)
                if success:
                    count = len(self.face_service.reference_gallery)
                    self.root.after(0, lambda: self.log_message(f"參考照庫建立成功，共 {count} 張參考照"))
                    self.root.after(0, lambda: self.status_var.set("就緒"))
                    try:
                        # 顯示成功提示
                        self.root.after(0, lambda: messagebox.showinfo("參考照庫建立", f"參考照庫建立成功，共 {count} 張參考照"))
                    except Exception:
                        pass
                else:
                    self.root.after(0, lambda: self.log_message("參考照庫建立失敗"))
                    self.root.after(0, lambda: self.status_var.set("建立失敗"))
            except Exception as e:
                # 寫入日誌並顯示錯誤細節給使用者
                err_msg = ''.join(traceback.format_exception(type(e), e, e.__traceback__))
                self.root.after(0, lambda: self.log_message(f"建立參考照庫錯誤: {e}"))
                self.root.after(0, lambda: self.status_var.set("建立失敗"))
                try:
                    # 顯示錯誤對話框（包含詳細堆疊）
                    self.root.after(0, lambda: messagebox.showerror("建立參考照庫失敗", f"發生錯誤:\n{err_msg}"))
                except Exception:
                    pass
        
        threading.Thread(target=build_thread, daemon=True).start()
    
    def start_processing(self):
        """開始處理"""
        if self.is_processing:
            return
        
        # 檢查輸入
        if not self.ref_folder_var.get():
            messagebox.showerror("錯誤", "請選擇參考照資料夾")
            return
        
        if not self.input_folder_var.get():
            messagebox.showerror("錯誤", "請選擇班級照片資料夾")
            return
        
        if not self.output_folder_var.get():
            messagebox.showerror("錯誤", "請選擇輸出資料夾")
            return
        
        if not self.face_service.reference_gallery:
            messagebox.showerror("錯誤", "請先建立參考照庫")
            return
        
        # 開始處理
        self.is_processing = True
        self.process_button.config(state='disabled')
        self.progress_var.set(0)
        self.log_text.delete(1.0, tk.END)
        self.results_listbox.delete(0, tk.END)
        
        # 創建進度回調
        from src.core.face_recognition_service import ProgressCallback
        progress_callback = ProgressCallback(self.update_progress)
        
        def process_thread():
            try:
                self.root.after(0, lambda: self.log_message("開始批量處理..."))
                self.root.after(0, lambda: self.status_var.set("處理中..."))
                
                # 執行批量處理
                results = self.face_service.batch_process_folder(
                    self.input_folder_var.get(),
                    self.output_folder_var.get(),
                    self.threshold_var.get(),
                    copy_files=True,
                    quality_threshold=self.quality_threshold_var.get(),
                    multithread=self.multithread_var.get(),
                    thread_count=self.thread_count_var.get(),
                    progress_callback=progress_callback
                )
                
                # 更新結果
                self.root.after(0, lambda: self.update_results(results))
                
            except Exception as e:
                self.root.after(0, lambda: self.log_message(f"處理錯誤: {e}"))
                self.root.after(0, lambda: self.status_var.set("處理失敗"))
            finally:
                self.root.after(0, lambda: self.finish_processing())
        
        threading.Thread(target=process_thread, daemon=True).start()
    
    def update_progress(self, current: int, total: int, message: str):
        """更新進度"""
        progress = (current / total) * 100 if total > 0 else 0
        self.root.after(0, lambda: self.progress_var.set(progress))
        self.root.after(0, lambda: self.progress_label.configure(text=f"{message} ({current}/{total})"))
        self.root.after(0, lambda: self.log_message(f"進度: {progress:.1f}% - {message}"))
    
    def stop_processing(self):
        """停止處理"""
        if not self.is_processing:
            return
        
        self.is_processing = False
        self.face_service.stop_batch_processing()
        self.log_message("正在停止處理...")
        self.status_var.set("正在停止...")
        self.finish_processing()
    
    def finish_processing(self):
        """完成處理"""
        self.is_processing = False
        self.process_button.config(state='normal')
        self.progress_var.set(100)
        if self.status_var.get() not in ["處理失敗", "已停止"]:
            self.status_var.set("處理完成")
    
    def update_results(self, results: dict):
        """更新結果顯示"""
        total = results.get('total_images', 0)
        found = results.get('found_child', 0)
        quality_filtered = results.get('quality_filtered', 0)
        stats = results.get('stats', {})
        
        self.log_message(f"處理完成: {found}/{total} 張照片找到小孩，{quality_filtered} 張因質量過低被過濾")
        
        # 更新結果統計
        stats_text = f"找到 {found} 張包含小孩的照片，共處理 {total} 張照片"
        if quality_filtered > 0:
            stats_text += f"，{quality_filtered} 張因質量過低被過濾"
        
        if 'processing_time' in stats:
            stats_text += f"，處理時間 {stats['processing_time']:.1f} 秒"
        
        self.result_var.set(stats_text)
        
        # 更新結果列表
        matches = results.get('matches', [])
        self.processed_images = []
        
        for match in matches:
            image_path = os.path.join(self.input_folder_var.get(), match['image'])
            self.processed_images.append(image_path)
            
            # 添加到列表框
            quality = match.get('quality', {})
            quality_score = quality.get('overall', 0)
            list_text = f"{match['image']} (相似度: {match['similarity']:.3f}, 信心: {match['confidence']}, 質量: {quality_score:.2f})"
            self.results_listbox.insert(tk.END, list_text)
            
            self.log_message(f"找到: {match['image']} (相似度: {match['similarity']:.3f}, "
                           f"信心: {match['confidence']}, 質量: {quality_score:.2f})")
        
        # 顯示統計分析
        if 'similarity_distribution' in stats:
            self.log_message("相似度分布:")
            for level, count in stats['similarity_distribution'].items():
                self.log_message(f"  {level}: {count}")
        
        if 'child_clusters' in stats and stats['child_clusters']:
            self.log_message("小孩聚類結果:")
            for cluster_id, image_paths in stats['child_clusters'].items():
                self.log_message(f"  聚類 {cluster_id}: {len(image_paths)} 張照片")
        
        # 切換到結果預覽標籤頁
        self.notebook.select(1)
        
        # 顯示完成訊息
        messagebox.showinfo("完成", f"處理完成！\n找到 {found} 張包含小孩的照片\n共處理 {total} 張照片")
    
    def on_result_select(self, event):
        """當選擇結果列表中的項目時"""
        selection = self.results_listbox.curselection()
        if selection:
            index = selection[0]
            if 0 <= index < len(self.processed_images):
                image_path = self.processed_images[index]
                self.result_preview.display_image(image_path)
    
    def save_settings(self):
        """保存設置"""
        settings = {
            'model': self.model_var.get(),
            'threshold': self.threshold_var.get(),
            'quality_threshold': self.quality_threshold_var.get(),
            'multithread': self.multithread_var.get(),
            'thread_count': self.thread_count_var.get(),
            'multi_child': self.multi_child_var.get()
        }
        
        # 保存小孩配置
        if hasattr(self, 'child_profiles'):
            settings['child_profiles'] = {}
            for child_id, profile in self.child_profiles.items():
                settings['child_profiles'][child_id] = {
                    'name': profile['name'],
                    'ref_folder': profile['ref_folder']
                }
        
        try:
            settings_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 
                                        '..', '..', 'settings.json')
            with open(settings_path, 'w', encoding='utf-8') as f:
                json.dump(settings, f, ensure_ascii=False, indent=2)
            
            messagebox.showinfo("設置保存", "設置已保存")
            self.log_message("設置已保存")
        except Exception as e:
            messagebox.showerror("保存失敗", f"保存設置失敗: {e}")
            self.log_message(f"保存設置失敗: {e}")
    
    def load_settings(self):
        """加載設置"""
        try:
            settings_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 
                                        '..', '..', 'settings.json')
            if os.path.exists(settings_path):
                with open(settings_path, 'r', encoding='utf-8') as f:
                    settings = json.load(f)
                
                # 應用設置
                if 'model' in settings:
                    self.model_var.set(settings['model'])
                if 'threshold' in settings:
                    self.threshold_var.set(settings['threshold'])
                if 'quality_threshold' in settings:
                    self.quality_threshold_var.set(settings['quality_threshold'])
                if 'multithread' in settings:
                    self.multithread_var.set(settings['multithread'])
                if 'thread_count' in settings:
                    self.thread_count_var.set(settings['thread_count'])
                if 'multi_child' in settings:
                    self.multi_child_var.set(settings['multi_child'])
                    self.toggle_multi_child_mode()
                
                # 加載小孩配置
                if 'child_profiles' in settings:
                    self.child_profiles = {}
                    self.child_profiles_listbox.delete(0, tk.END)
                    
                    for child_id, profile in settings['child_profiles'].items():
                        # 收集參考照
                        image_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp'}
                        ref_paths = []
                        
                        if os.path.exists(profile['ref_folder']):
                            for filename in os.listdir(profile['ref_folder']):
                                if any(filename.lower().endswith(ext) for ext in image_extensions):
                                    ref_paths.append(os.path.join(profile['ref_folder'], filename))
                        
                        if ref_paths:
                            self.child_profiles[child_id] = {
                                'name': profile['name'],
                                'ref_folder': profile['ref_folder'],
                                'ref_paths': ref_paths
                            }
                            
                            # 更新列表框
                            self.child_profiles_listbox.insert(tk.END, f"{child_id}: {profile['name']}")
                
                self.log_message("設置已加載")
        except Exception as e:
            self.log_message(f"加載設置失敗: {e}")
    
    def log_message(self, message: str):
        """記錄日誌訊息"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        log_entry = f"[{timestamp}] {message}\n"
        
        self.log_text.insert(tk.END, log_entry)
        self.log_text.see(tk.END)
        self.logger.info(message)
    
    def show_daily_discovery(self, results):
        """顯示今日發現"""
        # 隨機選擇一張找到的照片
        matches = results.get('matches', [])
        if not matches:
            return
        
        # 隨機選擇一張照片
        selected_match = random.choice(matches)
        image_path = os.path.join(self.simple_input_folder_var.get(), selected_match['image'])
        
        # 創建今日發現窗口
        discovery_window = tk.Toplevel(self.root)
        discovery_window.title("✨ 今日發現")
        discovery_window.geometry("600x500")
        
        # 創建主框架
        main_frame = ttk.Frame(discovery_window)
        main_frame.pack(fill="both", expand=True, padx=10, pady=10)
        
        # 標題
        title_frame = ttk.Frame(main_frame)
        title_frame.pack(fill="x", pady=(0, 10))
        
        title_label = ttk.Label(title_frame, text="✨ 今日發現 ✨", 
                            font=ModernTheme.FONT_LARGE)
        title_label.pack(side="left")
        
        # 日期
        today = datetime.now().strftime("%Y年%m月%d日")
        date_label = ttk.Label(title_frame, text=today, 
                           font=ModernTheme.FONT_MEDIUM)
        date_label.pack(side="right")
        
        # 照片預覽
        try:
            from PIL import Image, ImageTk
            
            # 加載並調整圖片
            img = Image.open(image_path)
            
            # 調整大小以適應窗口
            img_width, img_height = img.size
            max_width, max_height = 400, 300
            
            if img_width > max_width or img_height > max_height:
                ratio = min(max_width / img_width, max_height / img_height)
                img_width = int(img_width * ratio)
                img_height = int(img_height * ratio)
                img = img.resize((img_width, img_height), Image.Resampling.LANCZOS)
            
            photo = ImageTk.PhotoImage(img)
            
            # 顯示圖片
            img_label = ttk.Label(main_frame, image=photo)
            img_label.image = photo  # 保持引用
            img_label.pack(pady=10)
            
            # 照片信息
            info_frame = ttk.Frame(main_frame)
            info_frame.pack(fill="x", pady=10)
            
            similarity = selected_match.get('similarity', 0)
            confidence = selected_match.get('confidence', 'unknown')
            quality = selected_match.get('quality', {}).get('overall', 0)
            
            # 根據相似度設置顏色
            if similarity > 0.8:
                color = "#06D6A0"  # 綠色 - 高相似度
                desc = "高度相似"
            elif similarity > 0.7:
                color = "#FFD166"  # 黃色 - 中等相似度
                desc = "中等相似"
            else:
                color = "#FF6B6B"  # 紅色 - 低相似度
                desc = "低度相似"
            
            # 相似度
            similarity_frame = ttk.Frame(info_frame)
            similarity_frame.pack(fill="x", pady=5)
            
            ttk.Label(similarity_frame, text="相似度:").pack(side="left")
            similarity_label = ttk.Label(similarity_frame, text=f"{similarity:.2f} ({desc})", 
                                     foreground=color, font=ModernTheme.FONT_MEDIUM)
            similarity_label.pack(side="right")
            
            # 其他信息
            ttk.Label(info_frame, text=f"信心等級: {confidence}").pack(anchor="w", pady=2)
            ttk.Label(info_frame, text=f"圖片質量: {quality:.2f}").pack(anchor="w", pady=2)
            ttk.Label(info_frame, text=f"文件名: {selected_match['image']}").pack(anchor="w", pady=2)
            
            # 激勵語句
            if similarity > 0.8:
                message = "這是一張非常清晰的照片！孩子的笑容燦爛奪目。"
            elif similarity > 0.7:
                message = "這張照片捕捉到了孩子美好的瞬間。"
            else:
                message = "雖然有些模糊，但這張照片仍然珍貴。"
            
            message_label = ttk.Label(info_frame, text=message, 
                                 font=ModernTheme.FONT_MEDIUM, 
                                 wraplength=500)
            message_label.pack(pady=10)
            
        except Exception as e:
            # 如果圖片加載失敗，顯示錯誤
            error_label = ttk.Label(main_frame, text=f"無法加載圖片: {e}", 
                                 foreground="red")
            error_label.pack(pady=50)
        
        # 按鈕
        button_frame = ttk.Frame(main_frame)
        button_frame.pack(fill="x", pady=10)
        
        ttk.Button(button_frame, text="保存為今日最愛", 
                  command=lambda: self.save_as_favorite(image_path)).pack(side="left")
        
        ttk.Button(button_frame, text="關閉", 
                  command=discovery_window.destroy).pack(side="right")
    
    def save_as_favorite(self, image_path):
        """保存照片為今日最愛"""
        # 創建最愛資料夾
        favorites_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 
                                  '..', '..', 'favorites')
        os.makedirs(favorites_dir, exist_ok=True)
        
        # 複製照片
        try:
            import shutil
            filename = f"daily_favorite_{datetime.now().strftime('%Y%m%d')}.jpg"
            dst_path = os.path.join(favorites_dir, filename)
            shutil.copy2(image_path, dst_path)
            
            messagebox.showinfo("已保存", f"照片已保存為今日最愛！\n保存位置: {dst_path}")
            self.log_message(f"照片已保存為今日最愛: {dst_path}")
        except Exception as e:
            messagebox.showerror("保存失敗", f"保存照片失敗: {e}")
            self.log_message(f"保存今日最愛失敗: {e}")
    
    def update_achievements(self, total_processed, total_found):
        """更新成就系統"""
        # 讀取成就數據
        achievements_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), 
                                    '..', '..', 'achievements.json')
        
        try:
            if os.path.exists(achievements_file):
                with open(achievements_file, 'r', encoding='utf-8') as f:
                    achievements = json.load(f)
            else:
                achievements = {
                    'total_processed': 0,
                    'total_found': 0,
                    'milestones': [],
                    'first_use': datetime.now().isoformat()
                }
            
            # 更新統計
            achievements['total_processed'] += total_processed
            achievements['total_found'] += total_found
            
            # 檢查里程碑
            new_milestones = []
            
            # 處理照片里程碑
            if achievements['total_processed'] >= 100 and '100_photos' not in achievements['milestones']:
                achievements['milestones'].append('100_photos')
                new_milestones.append("照片處理達人 - 已處理100張照片！")
            
            if achievements['total_processed'] >= 500 and '500_photos' not in achievements['milestones']:
                achievements['milestones'].append('500_photos')
                new_milestones.append("照片處理大師 - 已處理500張照片！")
            
            if achievements['total_processed'] >= 1000 and '1000_photos' not in achievements['milestones']:
                achievements['milestones'].append('1000_photos')
                new_milestones.append("照片處理傳奇 - 已處理1000張照片！")
            
            # 找到照片里程碑
            if achievements['total_found'] >= 50 and '50_found' not in achievements['milestones']:
                achievements['milestones'].append('50_found')
                new_milestones.append("尋寶高手 - 已找到50張目標照片！")
            
            if achievements['total_found'] >= 200 and '200_found' not in achievements['milestones']:
                achievements['milestones'].append('200_found')
                new_milestones.append("尋寶大師 - 已找到200張目標照片！")
            
            # 保存成就
            with open(achievements_file, 'w', encoding='utf-8') as f:
                json.dump(achievements, f, ensure_ascii=False, indent=2)
            
            # 顯示新成就
            if new_milestones:
                self.show_achievement_notification(new_milestones)
                
        except Exception as e:
            self.log_message(f"更新成就系統失敗: {e}")
    
    def show_achievement_notification(self, milestones):
        """顯示成就通知"""
        # 創建成就窗口
        achievement_window = tk.Toplevel(self.root)
        achievement_window.title("🏆 成就解鎖！")
        achievement_window.geometry("500x300")
        achievement_window.resizable(False, False)
        
        # 設置背景色
        achievement_window.configure(bg="#FFF8DC")  # 米色背景
        
        # 創建主框架
        main_frame = ttk.Frame(achievement_window)
        main_frame.pack(fill="both", expand=True, padx=20, pady=20)
        
        # 成就標題
        title_label = tk.Label(main_frame, text="🏆 成就解鎖！", 
                            font=("Arial", 16, "bold"), 
                            bg="#FFF8DC", fg="#DAA520")  # 金色文字
        title_label.pack(pady=(0, 20))
        
        # 成就列表
        for milestone in milestones:
            milestone_label = tk.Label(main_frame, text=f"• {milestone}", 
                                  font=("Arial", 12), 
                                  bg="#FFF8DC", fg="#333333")
            milestone_label.pack(anchor="w", pady=5)
        
        # 關閉按鈕
        close_button = ttk.Button(main_frame, text="太棒了！", 
                              command=achievement_window.destroy)
        close_button.pack(pady=20)
        
        # 居中顯示
        achievement_window.update_idletasks()
        x = (achievement_window.winfo_screenwidth() // 2) - (achievement_window.winfo_width() // 2)
        y = (achievement_window.winfo_screenheight() // 2) - (achievement_window.winfo_height() // 2)
        achievement_window.geometry(f"+{x}+{y}")
        
        # 自動關閉
        achievement_window.after(5000, achievement_window.destroy)  # 5秒後自動關閉
    def add_to_queue(self):
        """添加到處理隊列"""
        ref_folder = self.simple_ref_folder_var.get()
        input_folder = self.simple_input_folder_var.get()
        output_folder = self.simple_output_folder_var.get()
        
        if not ref_folder or not input_folder or not output_folder:
            messagebox.showerror("錯誤", "請先完成設置")
            return
        
        item = {
            'ref_folder': ref_folder,
            'input_folder': input_folder,
            'output_folder': output_folder,
            'mode': self.process_mode_var.get(),
            'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        self.processing_queue.append(item)
        self.queue_listbox.insert(tk.END, f"任務: {item['timestamp']}")
        messagebox.showinfo("已添加", "任務已添加到處理隊列")
    
    def process_next_in_queue(self):
        """處理隊列中的下一個任務"""
        if not self.processing_queue:
            messagebox.showinfo("提示", "隊列為空")
            return
        
        task = self.processing_queue.pop(0)
        self.queue_listbox.delete(0)
        
        # 設置任務參數
        self.simple_ref_folder_var.set(task['ref_folder'])
        self.simple_input_folder_var.set(task['input_folder'])
        self.simple_output_folder_var.set(task['output_folder'])
        
        # 開始處理
        self.start_simple_processing()
    
    def clear_queue(self):
        """清空處理隊列"""
        if not self.processing_queue:
            messagebox.showinfo("提示", "隊列已為空")
            return
        
        if messagebox.askyesno("確認", "確定要清空處理隊列嗎？"):
            self.processing_queue.clear()
            self.queue_listbox.delete(0, tk.END)
            messagebox.showinfo("已清空", "處理隊列已清空")
    
    def validate_folder_input(self, folder_path, folder_type="資料夾"):
        """
        驗證資料夾輸入
        
        Args:
            folder_path: 資料夾路徑
            folder_type: 資料夾類型（用於錯誤消息）
            
        Returns:
            (is_valid, error_message)
        """
        if not folder_path:
            return False, f"請選擇{folder_type}"
        
        if not os.path.exists(folder_path):
            return False, f"{folder_type}不存在: {folder_path}"
        
        if not os.path.isdir(folder_path):
            return False, f"指定的路徑不是資料夾: {folder_path}"
        
        if not os.access(folder_path, os.R_OK):
            return False, f"無法讀取{folder_type}: {folder_path}"
        
        # 檢查是否為空資料夾（對於輸入資料夾）
        if folder_type in ["參考照資料夾", "班級照片資料夾"]:
            try:
                if not os.listdir(folder_path):
                    return False, f"{folder_type}為空: {folder_path}"
            except PermissionError:
                return False, f"無法訪問{folder_type}: {folder_path}"
        
        return True, ""
    
    def validate_image_folder(self, folder_path, folder_type="資料夾"):
        """
        驗證圖片資料夾
        
        Args:
            folder_path: 資料夾路徑
            folder_type: 資料夾類型（用於錯誤消息）
            
        Returns:
            (is_valid, error_message, image_count)
        """
        is_valid, error_message = self.validate_folder_input(folder_path, folder_type)
        if not is_valid:
            return False, error_message, 0
        
        # 檢查是否包含圖片
        image_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp'}
        try:
            from src.core.face_recognition_service import _HEIF_ENABLED
            if _HEIF_ENABLED:
                image_extensions.update({'.heic', '.heif'})
        except:
            pass
        
        image_count = 0
        try:
            for filename in os.listdir(folder_path):
                if any(filename.lower().endswith(ext) for ext in image_extensions):
                    image_count += 1
        except PermissionError:
            return False, f"無法訪問{folder_type}: {folder_path}", 0
        
        if image_count == 0:
            return False, f"{folder_type}中沒有找到支持的圖片文件", 0
        
        return True, "", image_count
    
    def validate_output_folder(self, folder_path):
        """
        驗證輸出資料夾
        
        Args:
            folder_path: 資料夾路徑
            
        Returns:
            (is_valid, error_message)
        """
        is_valid, error_message = self.validate_folder_input(folder_path, "輸出資料夾")
        if not is_valid:
            return False, error_message
        
        # 檢查寫入權限
        if not os.access(folder_path, os.W_OK):
            return False, f"無法寫入輸出資料夾: {folder_path}"
        
        # 檢查磁盤空間
        try:
            import shutil
            free_space = shutil.disk_usage(folder_path).free
            free_space_gb = free_space / (1024 ** 3)
            
            if free_space_gb < 1:  # 少於1GB
                return False, f"輸出資料夾剩餘空間不足: {free_space_gb:.2f}GB"
        except:
            # 如果無法檢查磁盤空間，跳過此檢查
            pass
        
        return True, ""
    
    def show_friendly_error(self, title, message, suggestion=""):
        """
        顯示友好的錯誤消息
        
        Args:
            title: 錯誤標題
            message: 錯誤消息
            suggestion: 建議（可選）
        """
        full_message = message
        if suggestion:
            full_message += f"\n\n建議: {suggestion}"
        
        messagebox.showerror(title, full_message)
    
    def handle_exception(self, exception, context="操作"):
        """
        處理異常並顯示友好的錯誤消息
        
        Args:
            exception: 異常對象
            context: 操作上下文
        """
        error_message = f"{context}失敗: {str(exception)}"
        
        # 根據異常類型提供特定建議
        suggestion = ""
        if isinstance(exception, PermissionError):
            suggestion = "請檢查文件/資料夾權限，確保程序有足夠的訪問權限"
        elif isinstance(exception, FileNotFoundError):
            suggestion = "請檢查文件/資料夾路徑是否正確"
        elif isinstance(exception, MemoryError):
            suggestion = "系統內存不足，請關閉其他程序或重啟應用"
        elif isinstance(exception, OSError):
            suggestion = "系統錯誤，請檢查磁盤空間和文件系統狀態"
        
        # 記錄詳細錯誤
        self.log_message(f"異常: {context} - {type(exception).__name__}: {str(exception)}")
        if hasattr(exception, '__traceback__') and exception.__traceback__:
            import traceback
            self.log_message(f"堆棧跟蹤: {traceback.format_exc()}")
        
        self.show_friendly_error(f"{context}錯誤", error_message, suggestion)


def main():
    """主函數"""
    root = tk.Tk()
    app = ChildPhotoFilterGUI(root)
    root.mainloop()

if __name__ == "__main__":
    main()


class ChildProfileDialog:
    """小孩配置對話框"""
    def __init__(self, parent, title, child_id="", name="", ref_folder=""):
        self.result = None
        
        # 創建對話框
        self.dialog = tk.Toplevel(parent)
        self.dialog.title(title)
        self.dialog.geometry("400x200")
        self.dialog.resizable(False, False)
        self.dialog.transient(parent)
        self.dialog.grab_set()
        
        # 居中顯示
        self.dialog.update_idletasks()
        x = (self.dialog.winfo_screenwidth() // 2) - (self.dialog.winfo_width() // 2)
        y = (self.dialog.winfo_screenheight() // 2) - (self.dialog.winfo_height() // 2)
        self.dialog.geometry(f"+{x}+{y}")
        
        # 創建UI
        self.create_ui(child_id, name, ref_folder)
    
    def create_ui(self, child_id, name, ref_folder):
        """創建UI"""
        # 小孩ID
        id_frame = ttk.Frame(self.dialog)
        id_frame.pack(fill="x", padx=ModernTheme.SPACING_MEDIUM, pady=ModernTheme.SPACING_MEDIUM)
        
        ttk.Label(id_frame, text="小孩ID:").pack(side="left")
        self.id_entry = ttk.Entry(id_frame)
        self.id_entry.pack(side="left", fill="x", expand=True, padx=(ModernTheme.SPACING_SMALL, 0))
        self.id_entry.insert(0, child_id)
        
        # 小孩姓名
        name_frame = ttk.Frame(self.dialog)
        name_frame.pack(fill="x", padx=ModernTheme.SPACING_MEDIUM, pady=ModernTheme.SPACING_MEDIUM)
        
        ttk.Label(name_frame, text="小孩姓名:").pack(side="left")
        self.name_entry = ttk.Entry(name_frame)
        self.name_entry.pack(side="left", fill="x", expand=True, padx=(ModernTheme.SPACING_SMALL, 0))
        self.name_entry.insert(0, name)
        
        # 參考照資料夾
        ref_frame = ttk.Frame(self.dialog)
        ref_frame.pack(fill="x", padx=ModernTheme.SPACING_MEDIUM, pady=ModernTheme.SPACING_MEDIUM)
        
        ttk.Label(ref_frame, text="參考照資料夾:").pack(side="left")
        self.ref_entry = ttk.Entry(ref_frame)
        self.ref_entry.pack(side="left", fill="x", expand=True, padx=(ModernTheme.SPACING_SMALL, 0))
        self.ref_entry.insert(0, ref_folder)
        
        ttk.Button(ref_frame, text="選擇", command=self.select_ref_folder).pack(side="right")
        
        # 按鈕
        button_frame = ttk.Frame(self.dialog)
        button_frame.pack(fill="x", padx=ModernTheme.SPACING_MEDIUM, pady=ModernTheme.SPACING_MEDIUM)
        
        ttk.Button(button_frame, text="確定", command=self.ok_clicked).pack(side="right", padx=(ModernTheme.SPACING_SMALL, 0))
        ttk.Button(button_frame, text="取消", command=self.cancel_clicked).pack(side="right")
    
    def select_ref_folder(self):
        """選擇參考照資料夾"""
        # 使用父類的統一文件選擇方法
        if hasattr(self.parent, 'select_child_ref_folder'):
            folder = self.parent.select_child_ref_folder(self.child_id)
        else:
            # 後備方案
            folder = filedialog.askdirectory(title=f"選擇小孩 {self.child_id} 的參考照資料夾")
        
        if folder:
            self.ref_folder_var.set(folder)
    
    def ok_clicked(self):
        """確定按鈕點擊"""
        child_id = self.id_entry.get().strip()
        name = self.name_entry.get().strip()
        ref_folder = self.ref_entry.get().strip()
        
        if not child_id or not name or not ref_folder:
            messagebox.showerror("錯誤", "請填寫所有必填項")
            return
        
        if not os.path.exists(ref_folder):
            messagebox.showerror("錯誤", "參考照資料夾不存在")
            return
        
        self.result = (child_id, name, ref_folder)
        self.dialog.destroy()
    
    def cancel_clicked(self):
        """取消按鈕點擊"""
        self.dialog.destroy()

