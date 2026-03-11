"""
GUI測試
"""
import unittest
import tkinter as tk
import os
import sys
import tempfile
import shutil
from unittest.mock import patch, MagicMock

# 添加src目錄到Python路徑
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from gui.child_photo_filter_gui import ChildPhotoFilterGUI, ModernTheme

class TestChildPhotoFilterGUI(unittest.TestCase):
    """GUI測試類"""
    
    def setUp(self):
        """測試前設置"""
        self.root = tk.Tk()
        self.app = ChildPhotoFilterGUI(self.root)
        self.test_dir = tempfile.mkdtemp(prefix="gui_test_")
        
        # 創建測試圖片
        self.create_test_images()
    
    def tearDown(self):
        """測試後清理"""
        self.root.destroy()
        shutil.rmtree(self.test_dir, ignore_errors=True)
    
    def create_test_images(self):
        """創建測試圖片"""
        from PIL import Image
        import numpy as np
        
        # 創建測試資料夾
        self.ref_folder = os.path.join(self.test_dir, "ref")
        self.input_folder = os.path.join(self.test_dir, "input")
        self.output_folder = os.path.join(self.test_dir, "output")
        
        os.makedirs(self.ref_folder)
        os.makedirs(self.input_folder)
        os.makedirs(self.output_folder)
        
        # 創建測試圖片
        for i in range(3):
            img = Image.fromarray(np.random.randint(0, 255, (100, 100, 3), dtype=np.uint8))
            img.save(os.path.join(self.ref_folder, f"ref_{i}.jpg"))
        
        for i in range(5):
            img = Image.fromarray(np.random.randint(0, 255, (100, 100, 3), dtype=np.uint8)
            img.save(os.path.join(self.input_folder, f"input_{i}.jpg"))
    
    def test_initialization(self):
        """測試初始化"""
        self.assertIsNotNone(self.app)
        self.assertIsNotNone(self.app.root)
        self.assertIsNotNone(self.app.face_service)
    
    def test_theme_constants(self):
        """測試主題常量"""
        self.assertTrue(hasattr(ModernTheme, 'PRIMARY'))
        self.assertTrue(hasattr(ModernTheme, 'BACKGROUND'))
        self.assertTrue(hasattr(ModernTheme, 'FONT_FAMILY'))
        self.assertTrue(hasattr(ModernTheme, 'SPACING_MEDIUM'))
    
    def test_validate_folder_input(self):
        """測試資料夾輸入驗證"""
        # 測試空路徑
        is_valid, error = self.app.validate_folder_input("", "測試資料夾")
        self.assertFalse(is_valid)
        self.assertIn("請選擇", error)
        
        # 測試不存在的路徑
        is_valid, error = self.app.validate_folder_input("/nonexistent/path", "測試資料夾")
        self.assertFalse(is_valid)
        self.assertIn("不存在", error)
        
        # 測試有效路徑
        is_valid, error = self.app.validate_folder_input(self.test_dir, "測試資料夾")
        self.assertTrue(is_valid)
        self.assertEqual(error, "")
    
    def test_validate_image_folder(self):
        """測試圖片資料夾驗證"""
        # 測試有效圖片資料夾
        is_valid, error, count = self.app.validate_image_folder(self.ref_folder, "參考照資料夾")
        self.assertTrue(is_valid)
        self.assertEqual(error, "")
        self.assertEqual(count, 3)
        
        # 測試空資料夾
        empty_folder = os.path.join(self.test_dir, "empty")
        os.makedirs(empty_folder)
        is_valid, error, count = self.app.validate_image_folder(empty_folder, "測試資料夾")
        self.assertFalse(is_valid)
        self.assertIn("沒有找到支持的圖片", error)
        self.assertEqual(count, 0)
    
    def test_validate_output_folder(self):
        """測試輸出資料夾驗證"""
        # 測試有效輸出資料夾
        is_valid, error = self.app.validate_output_folder(self.output_folder)
        self.assertTrue(is_valid)
        self.assertEqual(error, "")
        
        # 測試只讀資料夾
        readonly_folder = os.path.join(self.test_dir, "readonly")
        os.makedirs(readonly_folder)
        os.chmod(readonly_folder, 0o444)  # 只讀權限
        
        is_valid, error = self.app.validate_output_folder(readonly_folder)
        self.assertFalse(is_valid)
        self.assertIn("無法寫入", error)
    
    def test_show_friendly_error(self):
        """測試友好錯誤消息"""
        with patch('tkinter.messagebox.showerror') as mock_showerror:
            self.app.show_friendly_error("測錯誤", "測試消息", "測試建議")
            mock_showerror.assert_called_once()
            
            # 檢查是否包含建議
            args, kwargs = mock_showerror.call_args
            self.assertIn("建議: 測試建議", args[1])
    
    def test_handle_exception(self):
        """測試異常處理"""
        with patch('tkinter.messagebox.showerror') as mock_showerror:
            # 測試權限錯誤
            permission_error = PermissionError("Access denied")
            self.app.handle_exception(permission_error, "測試操作")
            
            # 檢查是否調用了友好錯誤
            mock_showerror.assert_called()
            args, kwargs = mock_showerror.call_args
            self.assertIn("權限", args[1])
    
    def test_select_folder(self):
        """測試統一資料夾選擇方法"""
        with patch('tkinter.filedialog.askdirectory') as mock_askdir:
            mock_askdir.return_value = "/test/path"
            
            # 測試不帶變量的情況
            result = self.app.select_folder("測試標題")
            self.assertEqual(result, "/test/path")
            
            # 測試帶變量的情況
            test_var = tk.StringVar()
            result = self.app.select_folder("測試標題", test_var)
            self.assertEqual(result, "/test/path")
            self.assertEqual(test_var.get(), "/test/path")
    
    def test_queue_operations(self):
        """測試隊列操作"""
        # 測試添加到隊列
        self.app.simple_ref_folder_var.set(self.ref_folder)
        self.app.simple_input_folder_var.set(self.input_folder)
        self.app.simple_output_folder_var.set(self.output_folder)
        
        initial_count = len(self.app.processing_queue)
        
        with patch('tkinter.messagebox.showinfo') as mock_showinfo:
            self.app.add_to_queue()
            self.assertEqual(len(self.app.processing_queue), initial_count + 1)
            mock_showinfo.assert_called()
        
        # 測試處理隊列中的下一個任務
        if self.app.processing_queue:
            with patch.object(self.app, 'start_simple_processing') as mock_process:
                self.app.process_next_in_queue()
                self.assertEqual(len(self.app.processing_queue), initial_count)
                mock_process.assert_called_once()
        
        # 測試清空隊列
        with patch('tkinter.messagebox.askyesno') as mock_ask:
            with patch('tkinter.messagebox.showinfo') as mock_showinfo:
                mock_ask.return_value = True
                self.app.clear_queue()
                self.assertEqual(len(self.app.processing_queue), 0)
                mock_showinfo.assert_called()
    
    def test_save_as_favorite(self):
        """測試保存為最愛功能"""
        test_image = os.path.join(self.input_folder, "input_0.jpg")
        
        with patch('tkinter.messagebox.showinfo') as mock_showinfo:
            self.app.save_as_favorite(test_image)
            mock_showinfo.assert_called()
            
            # 檢查文件是否被複製
            favorites_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'favorites')
            if os.path.exists(favorites_dir):
                favorite_files = os.listdir(favorites_dir)
                self.assertTrue(any("daily_favorite" in f for f in favorite_files))

class TestModernTheme(unittest.TestCase):
    """主題測試類"""
    
    def test_theme_values(self):
        """測試主題值"""
        # 檢查顏色值
        self.assertTrue(ModernTheme.PRIMARY.startswith("#"))
        self.assertTrue(ModernTheme.BACKGROUND.startswith("#"))
        self.assertTrue(ModernTheme.ERROR.startswith("#"))
        
        # 檢查字體設置
        self.assertIsInstance(ModernTheme.FONT_FAMILY, str)
        self.assertEqual(len(ModernTheme.FONT_LARGE), 3)  # (family, size, style)
        self.assertEqual(len(ModernTheme.FONT_MEDIUM), 3)
        self.assertEqual(len(ModernTheme.FONT_SMALL), 3)
        
        # 檢查間距設置
        self.assertIsInstance(ModernTheme.SPACING_SMALL, int)
        self.assertIsInstance(ModernTheme.SPACING_MEDIUM, int)
        self.assertIsInstance(ModernTheme.SPACING_LARGE, int)

if __name__ == '__main__':
    unittest.main()
