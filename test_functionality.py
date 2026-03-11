"""
小孩照片篩選工具 - 測試腳本
"""
import os
import sys
import tempfile
import shutil
from PIL import Image
import numpy as np

# 添加src目錄到Python路徑
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

def create_test_images():
    """建立測試用的假影像"""
    test_dir = tempfile.mkdtemp(prefix="child_filter_test_")
    
    # 建立參考照資料夾
    ref_dir = os.path.join(test_dir, "reference")
    os.makedirs(ref_dir, exist_ok=True)
    
    # 建立班級照片資料夾
    class_dir = os.path.join(test_dir, "class_photos")
    os.makedirs(class_dir, exist_ok=True)
    
    # 建立輸出資料夾
    output_dir = os.path.join(test_dir, "output")
    os.makedirs(output_dir, exist_ok=True)
    
    # 建立一些測試影像（簡單的彩色方塊）
    for i in range(3):
        # 參考照
        img = Image.new('RGB', (200, 200), color=(100 + i*50, 150, 200))
        img.save(os.path.join(ref_dir, f"child_ref_{i}.jpg"))
    
    for i in range(5):
        # 班級照片
        img = Image.new('RGB', (400, 300), color=(200, 100 + i*30, 150))
        img.save(os.path.join(class_dir, f"class_photo_{i}.jpg"))
    
    return test_dir, ref_dir, class_dir, output_dir

def test_face_service():
    """測試臉部識別服務"""
    print("正在建立測試環境...")
    test_dir, ref_dir, class_dir, output_dir = create_test_images()
    
    try:
        from src.core.face_recognition_service import FaceRecognitionService
        
        print("正在初始化臉部識別服務...")
        service = FaceRecognitionService()
        
        # 測試模型初始化
        if not service.initialize_model():
            print("❌ 模型初始化失敗")
            return False
        
        print("✅ 模型初始化成功")
        
        # 測試參考照庫建立
        print("正在建立參考照庫...")
        if not service.build_reference_gallery(ref_dir):
            print("❌ 參考照庫建立失敗")
            return False
        
        print(f"✅ 參考照庫建立成功，共 {len(service.reference_gallery)} 張參考照")
        
        # 測試單張照片處理
        print("正在測試單張照片處理...")
        test_image = os.path.join(class_dir, "class_photo_0.jpg")
        match = service.find_child_in_image(test_image, threshold=0.65)
        
        if match:
            print(f"✅ 找到匹配: 相似度 {match.similarity_score:.3f}")
        else:
            print("ℹ️ 未找到匹配（這是正常的，因為我們用的是假影像）")
        
        # 測試批量處理
        print("正在測試批量處理...")
        results = service.batch_process_folder(class_dir, output_dir, threshold=0.65)
        
        print(f"✅ 批量處理完成: {results['found_child']}/{results['total_images']} 張照片找到小孩")
        
        return True
        
    except Exception as e:
        print(f"❌ 測試失敗: {e}")
        return False
    
    finally:
        # 清理測試檔案
        try:
            shutil.rmtree(test_dir)
            print("🧹 測試檔案已清理")
        except:
            pass

def test_gui_import():
    """測試GUI導入"""
    try:
        from src.gui.child_photo_filter_gui import ChildPhotoFilterGUI
        print("✅ GUI模組導入成功")
        return True
    except Exception as e:
        print(f"❌ GUI模組導入失敗: {e}")
        return False

def main():
    """主測試函數"""
    print("=" * 50)
    print("小孩照片篩選工具 - 功能測試")
    print("=" * 50)
    
    # 測試GUI導入
    print("\n1. 測試GUI模組導入...")
    gui_ok = test_gui_import()
    
    # 測試臉部識別服務
    print("\n2. 測試臉部識別服務...")
    service_ok = test_face_service()
    
    # 總結
    print("\n" + "=" * 50)
    print("測試結果總結:")
    print(f"GUI模組: {'✅ 通過' if gui_ok else '❌ 失敗'}")
    print(f"臉部識別服務: {'✅ 通過' if service_ok else '❌ 失敗'}")
    
    if gui_ok and service_ok:
        print("\n🎉 所有測試通過！程式可以正常使用。")
        print("\n使用方法:")
        print("1. 安裝依賴: pip install -r requirements.txt")
        print("2. 執行程式: python main.py")
        print("3. 按照使用說明操作")
    else:
        print("\n⚠️ 部分測試失敗，請檢查錯誤訊息並安裝所需套件。")
    
    print("=" * 50)

if __name__ == "__main__":
    main()

























