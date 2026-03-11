"""
臉部識別服務單元測試
"""
import unittest
import os
import tempfile
import shutil
import numpy as np
from PIL import Image
import json
import sys

# 添加src目錄到Python路徑
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from src.core.face_recognition_service import FaceRecognitionService, FaceDetection, ChildMatch, ProcessingStats, ProgressCallback

class TestFaceRecognitionService(unittest.TestCase):
    """臉部識別服務測試類"""
    
    def setUp(self):
        """測試前設置"""
        self.service = FaceRecognitionService()
        self.test_dir = tempfile.mkdtemp(prefix="face_recognition_test_")
        
        # 創建測試圖片
        self.create_test_images()
    
    def tearDown(self):
        """測試後清理"""
        # 清理測試目錄
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir)
    
    def create_test_images(self):
        """創建測試圖片"""
        # 創建參考照資料夾
        self.ref_dir = os.path.join(self.test_dir, "reference")
        os.makedirs(self.ref_dir, exist_ok=True)
        
        # 創建班級照片資料夾
        self.class_dir = os.path.join(self.test_dir, "class_photos")
        os.makedirs(self.class_dir, exist_ok=True)
        
        # 創建一些測試圖片（簡單的彩色方塊）
        for i in range(3):
            # 參考照
            img = Image.new('RGB', (200, 200), color=(100 + i*50, 150, 200))
            img.save(os.path.join(self.ref_dir, f"child_ref_{i}.jpg"))
        
        for i in range(5):
            # 班級照片
            img = Image.new('RGB', (400, 300), color=(200, 100 + i*30, 150))
            img.save(os.path.join(self.class_dir, f"class_photo_{i}.jpg"))
    
    def test_initialize_model(self):
        """測試模型初始化"""
        # 初始化模型
        result = self.service.initialize_model()
        self.assertTrue(result, "模型初始化應該成功")
        self.assertIsNotNone(self.service.app, "應用程式對象不應為None")
    
    def test_assess_image_quality(self):
        """測試圖片質量評估"""
        # 測試現有圖片
        image_path = os.path.join(self.ref_dir, "child_ref_0.jpg")
        quality = self.service.assess_image_quality(image_path)
        
        self.assertIn("overall", quality, "質量評估結果應包含overall分數")
        self.assertIn("sharpness", quality, "質量評估結果應包含sharpness分數")
        self.assertIn("brightness", quality, "質量評估結果應包含brightness分數")
        self.assertIn("contrast", quality, "質量評估結果應包含contrast分數")
        
        # 檢查分數範圍
        self.assertGreaterEqual(quality["overall"], 0.0, "overall分數應大於等於0")
        self.assertLessEqual(quality["overall"], 1.0, "overall分數應小於等於1")
        
        # 測試不存在的圖片
        non_existent_path = os.path.join(self.test_dir, "non_existent.jpg")
        quality = self.service.assess_image_quality(non_existent_path)
        self.assertEqual(quality["overall"], 0.0, "不存在的圖片應返回0分")
    
    def test_detect_faces(self):
        """測試臉部偵測"""
        # 初始化模型
        self.service.initialize_model()
        
        # 測試偵測臉部
        image_path = os.path.join(self.ref_dir, "child_ref_0.jpg")
        faces = self.service.detect_faces(image_path)
        
        # 由於我們使用的是簡單的彩色方塊，可能偵測不到臉部
        # 這裡主要測試函數是否正常執行
        self.assertIsInstance(faces, list, "偵測結果應為列表")
        
        # 測試不存在的圖片
        non_existent_path = os.path.join(self.test_dir, "non_existent.jpg")
        faces = self.service.detect_faces(non_existent_path)
        self.assertEqual(len(faces), 0, "不存在的圖片應返回空列表")
    
    def test_build_reference_gallery(self):
        """測試建立參考照庫"""
        # 初始化模型
        self.service.initialize_model()
        
        # 建立參考照庫
        result = self.service.build_reference_gallery(self.ref_dir)
        
        # 由於我們使用的是簡單的彩色方塊，可能偵測不到臉部
        # 這裡主要測試函數是否正常執行
        self.assertIsInstance(result, bool, "建立結果應為布爾值")
    
    def test_find_child_in_image(self):
        """測試在圖片中尋找小孩"""
        # 初始化模型
        self.service.initialize_model()
        
        # 建立參考照庫（可能為空）
        self.service.build_reference_gallery(self.ref_dir)
        
        # 尋找小孩
        image_path = os.path.join(self.class_dir, "class_photo_0.jpg")
        match = self.service.find_child_in_image(image_path)
        
        # 由於我們使用的是簡單的彩色方塊，可能偵測不到臉部
        # 這裡主要測試函數是否正常執行
        self.assertTrue(match is None or isinstance(match, ChildMatch), "匹配結果應為None或ChildMatch對象")
    
    def test_add_manual_correction(self):
        """測試添加手動標記校正"""
        image_path = os.path.join(self.class_dir, "class_photo_0.jpg")
        bbox = (10, 10, 50, 50)
        similarity = 0.8
        reference = os.path.join(self.ref_dir, "child_ref_0.jpg")
        
        # 添加校正
        self.service.add_manual_correction(
            image_path, 'confirm', bbox, similarity, reference
        )
        
        # 檢查校正是否添加
        self.assertIn(image_path, self.service.manual_corrections, "校正應已添加")
        
        correction = self.service.manual_corrections[image_path]
        self.assertEqual(correction['action'], 'confirm', "校正動作應為confirm")
        self.assertEqual(correction['bbox'], bbox, "校正邊界框應匹配")
        self.assertEqual(correction['similarity'], similarity, "校正相似度應匹配")
        self.assertEqual(correction['reference'], reference, "校正參考照應匹配")
    
    def test_save_and_load_manual_corrections(self):
        """測試保存和加載手動標記校正"""
        # 添加一些校正
        for i in range(3):
            image_path = os.path.join(self.class_dir, f"class_photo_{i}.jpg")
            bbox = (10, 10, 50, 50)
            similarity = 0.8
            reference = os.path.join(self.ref_dir, "child_ref_0.jpg")
            
            self.service.add_manual_correction(
                image_path, 'confirm', bbox, similarity, reference
            )
        
        # 保存校正
        corrections_file = os.path.join(self.test_dir, "corrections.json")
        self.service.save_manual_corrections(corrections_file)
        
        # 檢查文件是否創建
        self.assertTrue(os.path.exists(corrections_file), "校正文件應已創建")
        
        # 創建新服務實例並加載校正
        new_service = FaceRecognitionService()
        new_service.load_manual_corrections(corrections_file)
        
        # 檢查校正是否加載
        self.assertEqual(len(new_service.manual_corrections), 3, "應加載3個校正")
    
    def test_clear_cache(self):
        """測試清除緩存"""
        # 創建一些緩存文件
        cache_file = os.path.join(self.service.cache_dir, "test_cache.pkl")
        with open(cache_file, 'w') as f:
            f.write("test")
        
        # 清除緩存
        self.service.clear_cache()
        
        # 檢查緩存文件是否刪除
        self.assertFalse(os.path.exists(cache_file), "緩存文件應已刪除")
    
    def test_progress_callback(self):
        """測試進度回調"""
        # 創建進度回調
        callback_called = {"called": False, "current": 0, "total": 0, "message": ""}
        
        def test_callback(current, total, message):
            callback_called["called"] = True
            callback_called["current"] = current
            callback_called["total"] = total
            callback_called["message"] = message
        
        progress = ProgressCallback(test_callback)
        
        # 更新進度
        progress.update(5, 10, "測試消息")
        
        # 檢查回調是否被調用
        self.assertTrue(callback_called["called"], "回調應被調用")
        self.assertEqual(callback_called["current"], 5, "當前進度應為5")
        self.assertEqual(callback_called["total"], 10, "總進度應為10")
        self.assertEqual(callback_called["message"], "測試消息", "消息應匹配")
        
        # 檢查進度百分比
        self.assertEqual(progress.get_progress(), 50.0, "進度百分比應為50%")
    
    def test_processing_stats(self):
        """測試處理統計"""
        # 創建統計對象
        stats = ProcessingStats(
            total_images=100,
            processed_images=80,
            found_children=40,
            processing_time=120.5
        )
        
        # 檢查屬性
        self.assertEqual(stats.total_images, 100, "總圖片數應為100")
        self.assertEqual(stats.processed_images, 80, "已處理圖片數應為80")
        self.assertEqual(stats.found_children, 40, "找到的小孩數應為40")
        self.assertEqual(stats.processing_time, 120.5, "處理時間應為120.5")
        
        # 檢查默認值
        self.assertEqual(stats.similarity_distribution, {}, "相似度分布應為空字典")
        self.assertEqual(stats.confidence_distribution, {}, "信心分布應為空字典")
        self.assertEqual(stats.child_clusters, {}, "小孩聚類應為空字典")


if __name__ == '__main__':
    unittest.main()
