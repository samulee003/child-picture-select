#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
簡單測試腳本：初始化模型並建立參考照庫（E:\face_ref）
"""
from src.core.face_recognition_service import FaceRecognitionService
import traceback

def main():
    s = FaceRecognitionService()
    print('Initializing model...', flush=True)
    ok = s.initialize_model()
    print('initialize_model:', ok, flush=True)

    try:
        ok2 = s.build_reference_gallery(r'E:\\face_ref')
        print('build_reference_gallery:', ok2, flush=True)
        print('reference count:', len(s.reference_gallery), flush=True)
        for p in list(s.reference_gallery.keys())[:50]:
            print('REF:', p, flush=True)
    except Exception as e:
        print('Exception while building reference gallery:', e, flush=True)
        traceback.print_exc()

if __name__ == '__main__':
    main()



