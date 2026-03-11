"""
臉部識別服務 - 基於InsightFace實現精準小孩識別"""

import os

import json

import numpy as np

import cv2

from PIL import Image

try:

    # 註冊HEIC/HEIF讀取支援
    from pillow_heif import register_heif

    register_heif()

    _HEIF_ENABLED = True

except Exception:
    # 忽略：若未安裝，仍可使用一般格式
    _HEIF_ENABLED = False

import insightface

from insightface.app import FaceAnalysis

from sklearn.metrics.pairwise import cosine_similarity

from sklearn.cluster import DBSCAN

import logging

from typing import List, Dict, Tuple, Optional, Callable, Any

from dataclasses import dataclass, asdict

import pickle

import hashlib

from datetime import datetime

import threading

import queue

import time

from concurrent.futures import ThreadPoolExecutor, as_completed



@dataclass

class FaceDetection:

    """臉部偵測結果"""

    bbox: Tuple[int, int, int, int]  # x, y, w, h

    embedding: np.ndarray  # 512維特徵向量
    confidence: float

    age: Optional[int] = None

    gender: Optional[str] = None

    image_path: Optional[str] = None  # 添加圖片路徑



@dataclass

class ChildMatch:

    """小孩匹配結果"""

    image_path: str

    face_bbox: Tuple[int, int, int, int]

    similarity_score: float

    reference_image: str

    confidence: str  # 'high', 'medium', 'low'

    child_id: Optional[str] = None  # 添加小孩ID，用於多小孩識別



@dataclass

class ProcessingStats:

    """處理統計信息"""

    total_images: int = 0

    processed_images: int = 0

    found_children: int = 0

    processing_time: float = 0.0

    similarity_distribution: Dict[str, int] = None  # 相似度分布
    confidence_distribution: Dict[str, int] = None  # 信心分布

    child_clusters: Dict[str, List[str]] = None  # 小孩聚類結果
    

    def __post_init__(self):

        if self.similarity_distribution is None:

            self.similarity_distribution = {}

        if self.confidence_distribution is None:

            self.confidence_distribution = {}

        if self.child_clusters is None:

            self.child_clusters = {}



class ProgressCallback:

    """進度回調類"""

    def __init__(self, callback: Optional[Callable[[int, int, str], None]] = None):

        self.callback = callback

        self.current = 0

        self.total = 0

        self.message = ""

    

    def update(self, current: int, total: int, message: str = ""):

        """更新進度"""

        self.current = current

        self.total = total

        self.message = message

        

        if self.callback:

            self.callback(current, total, message)

    

    def get_progress(self) -> float:

        """獲取進度百分比"""

        if self.total == 0:

            return 0.0

        return (self.current / self.total) * 100



class FaceRecognitionService:

    """臉部識別服務"""

    

    def __init__(self, model_name: str = 'buffalo_l'):

        """
        初始化臉部識別服務

        Args:
            model_name: InsightFace模型名稱 ('buffalo_l', 'buffalo_m', 'buffalo_s')
        """

        self.model_name = model_name

        self.app = None

        self.reference_gallery = {}  # {image_path: embedding}

        self.reference_embeddings = []  # 參考照片嵌入向量
        self.reference_paths = []  # 對應參考照片路徑

        self.child_profiles = {}  # {child_id: [reference_paths]}

        self.manual_corrections = {}  # 手動標記校正 {image_path: corrected_result}

        

        # 設置日誌

        logging.basicConfig(level=logging.INFO)

        self.logger = logging.getLogger(__name__)

        

        # 設置緩存目錄

        self.cache_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'cache')

        os.makedirs(self.cache_dir, exist_ok=True)

        

        # 多線程相關設置
        self.processing_lock = threading.Lock()

        self.stop_processing = False

        

    def initialize_model(self, progress_callback: Optional[Callable[[int, int, str], None]] = None):
        """
        初始化InsightFace模型
        
        Args:
            progress_callback: 進度回調函數 (current, total, message)
        """
        try:
            # 如果有進度回調，通知開始下載
            if progress_callback:
                progress_callback(0, 100, "正在初始化模型...")
            
            # 創建模型分析器
            self.app = FaceAnalysis(name=self.model_name, providers=['CPUExecutionProvider'])
            
            # 如果有進度回調，通知準備階段
            if progress_callback:
                progress_callback(20, 100, "正在準備模型...")
            
            # 準備模型（這一步可能會下載模型文件）
            self.app.prepare(ctx_id=0, det_size=(640, 640))
            
            # 如果有進度回調，通知完成
            if progress_callback:
                progress_callback(100, 100, "模型初始化完成")
            
            self.logger.info(f"InsightFace模型 {self.model_name} 初始化成功")
            return True
            
        except Exception as e:
            self.logger.error(f"模型初始化失敗: {e}")
            
            # 如果有進度回調，通知錯誤
            if progress_callback:
                progress_callback(0, 100, f"模型初始化失敗: {e}")
            
            return False
    

    def _get_image_hash(self, image_path: str) -> str:

        """獲取圖片哈希值，用於緩存"""

        try:

            with open(image_path, 'rb') as f:

                return hashlib.md5(f.read()).hexdigest()

        except Exception:

            return ""

    

    def _get_cache_path(self, image_path: str) -> str:

        """獲取緩存文件路徑"""

        image_hash = self._get_image_hash(image_path)

        if not image_hash:

            return None

        return os.path.join(self.cache_dir, f"{image_hash}.pkl")

    

    def _load_from_cache(self, image_path: str) -> Optional[List[FaceDetection]]:

        """從緩存載入偵測結果"""

        cache_path = self._get_cache_path(image_path)

        if not cache_path or not os.path.exists(cache_path):

            return None

        

        try:

            with open(cache_path, 'rb') as f:

                return pickle.load(f)

        except Exception:

            return None

    

    def _save_to_cache(self, image_path: str, faces: List[FaceDetection]):

        """將偵測結果保存到緩存"""

        cache_path = self._get_cache_path(image_path)

        if not cache_path:

            return

        

        try:

            with open(cache_path, 'wb') as f:

                pickle.dump(faces, f)

        except Exception as e:

            self.logger.warning(f"保存緩存失敗: {e}")



    def _imread_unicode(self, image_path: str) -> Optional[np.ndarray]:
        """
        以支援Unicode/中文路徑的方式讀取圖片
        使用 OpenCV，若失敗則退回 Pillow + OpenCV
        """
        # 嘗試 OpenCV（支援寬字符路徑）
        img = cv2.imdecode(np.fromfile(image_path, dtype=np.uint8), cv2.IMREAD_COLOR)
        if img is not None:
            return img

        # 退回 Pillow
        try:
            # 使用上下文管理器確保資源釋放
            with Image.open(image_path) as pil_img:
                # 轉換為RGB模式以確保一致性
                if pil_img.mode != 'RGB':
                    pil_img = pil_img.convert('RGB')
                # 創建副本以避免原始圖片被修改
                img_array = np.array(pil_img)
                # 轉換為BGR格式（OpenCV標準）
                return cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
        except Exception as read_err:
            self.logger.error(f"讀取圖片失敗 {image_path}，錯誤: {read_err}")
            return None

    def preprocess_image(self, image_path: str, target_size: int = 1024) -> Optional[np.ndarray]:
        """
        圖片預處理
        
        Args:
            image_path: 圖片路徑
            target_size: 目標尺寸
            
        Returns:
            預處理後的圖片
        """
        try:
            # Unicode 安全讀取圖片
            img = self._imread_unicode(image_path)
            if img is None:
                raise ValueError(f"無法讀取圖片 {image_path}")
            
            # 檢查圖片尺寸，避免處理過大的圖片
            h, w = img.shape[:2]
            max_dimension = max(h, w)
            
            # 如果圖片太大，先進行初步縮放
            if max_dimension > target_size * 2:  # 超過目標尺寸2倍
                scale = (target_size * 2) / max_dimension
                new_w, new_h = int(w * scale), int(h * scale)
                img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)
                h, w = img.shape[:2]
                max_dimension = max(h, w)
            
            # 調整尺寸（保持長寬比）
            if max_dimension > target_size:
                scale = target_size / max_dimension
                new_w, new_h = int(w * scale), int(h * scale)
                # 使用高質量縮放
                img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)
            
            # 增強對比度（使用CLAHE）
            lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)
            
            # 創建CLAHE對象
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
            l = clahe.apply(l)
            
            lab = cv2.merge([l, a, b])
            img = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
            
            return img
        except Exception as e:
            self.logger.error(f"圖片預處理失敗 {image_path}: {e}")
            return None

    

    def assess_image_quality(self, image_path: str) -> Dict[str, float]:

        """
        評估圖片質量

        

        Args:
            image_path: 圖片路徑

            

        Returns:
            質量評估結果字典

        """

        try:

            img = self._imread_unicode(image_path)

            if img is None:

                return {"overall": 0.0}

            

            # 計算清晰度（拉普拉斯方差）
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

            sharpness = cv2.Laplacian(gray, cv2.CV_64F).var()

            

            # 計算亮度
            brightness = np.mean(gray) / 255.0

            

            # 計算對比度
            contrast = np.std(gray) / 255.0

            

            # 綜合評分 - 權重：清晰度0.5，亮度0.3，對比度權重0.2

            # 清晰度標準（100以上為良好）
            normalized_sharpness = min(sharpness / 100.0, 1.0)

            

            # 亮度評分（0.3-0.7為最佳）
            brightness_score = 1.0 - abs(brightness - 0.5) * 2.0

            

            # 對比度評分（0.2以上為良好）
            contrast_score = min(contrast / 0.2, 1.0)

            

            overall = (normalized_sharpness * 0.5 + brightness_score * 0.3 + contrast_score * 0.2)

            

            return {

                "overall": overall,

                "sharpness": normalized_sharpness,

                "brightness": brightness_score,

                "contrast": contrast_score

            }

        except Exception as e:

            self.logger.error(f"質量評估失敗 {image_path}: {e}")

            return {"overall": 0.0}

    

    def detect_faces(self, image_path: str, use_cache: bool = True) -> List[FaceDetection]:

        """
        偵測圖片中的人臉

        

        Args:
            image_path: 圖片路徑

            use_cache: 是否使用緩存

            

        Returns:
            臉部偵測結果列表

        """

        if self.app is None:

            self.logger.error("模型未初始化")

            return []

        

        # 嘗試從緩存載入
        if use_cache:

            cached_faces = self._load_from_cache(image_path)

            if cached_faces:

                self.logger.debug(f"從緩存載入偵測結果 {image_path}")

                return cached_faces

        

        try:

            # 預處理圖片
            img = self.preprocess_image(image_path)

            if img is None:

                return []

            

            # 偵測人臉
            faces = self.app.get(img)

            

            detections = []

            for face in faces:

                # 特徵向量
                embedding = face.embedding

                

                # 邊界框
                bbox = face.bbox.astype(int)

                x, y, w, h = bbox[0], bbox[1], bbox[2] - bbox[0], bbox[3] - bbox[1]

                

                # 年齡和性別
                age = getattr(face, 'age', None)

                gender = getattr(face, 'gender', None)

                

                detection = FaceDetection(

                    bbox=(x, y, w, h),

                    embedding=embedding,

                    confidence=face.det_score,

                    age=age,

                    gender=gender,

                    image_path=image_path

                )

                detections.append(detection)

            

            # 保存到緩存
            if use_cache and detections:

                self._save_to_cache(image_path, detections)

            

            self.logger.info(f"{image_path} 中偵測到 {len(detections)} 張人臉")

            return detections

            

        except Exception as e:

            self.logger.error(f"人臉偵測失敗 {image_path}: {e}")

            return []

    

    def build_reference_gallery(self, reference_folder: str, child_profiles: Optional[Dict] = None) -> bool:

        """
        建立參考照片庫

        

        Args:
            reference_folder: 參考照片資料夾路徑
            child_profiles: 小孩配置 {child_id: [reference_paths]}

            

        Returns:
            是否建立成功

        """

        if not os.path.exists(reference_folder):

            self.logger.error(f"參考照片資料夾不存在: {reference_folder}")

            return False

        

        self.reference_gallery.clear()

        self.reference_embeddings.clear()

        self.reference_paths.clear()

        self.child_profiles.clear()

        

        # 如果提供了小孩配置，使用多小孩邏輯
        if child_profiles:

            self.child_profiles = child_profiles

            for child_id, ref_paths in child_profiles.items():

                for ref_path in ref_paths:

                    if os.path.exists(ref_path):

                        faces = self.detect_faces(ref_path)

                        if faces:

                            # 選擇最大的人臉
                            largest_face = max(faces, key=lambda f: f.bbox[2] * f.bbox[3])

                            self.reference_gallery[ref_path] = largest_face.embedding

                            self.reference_embeddings.append(largest_face.embedding)

                            self.reference_paths.append(ref_path)

                            self.logger.info(f"載入參考照片: {ref_path}, 小孩ID: {child_id}")

        else:

            # 單小孩邏輯

            # 支援的圖片格式，不包括heif，否則用戶可能無法使用
            image_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp'}

            if _HEIF_ENABLED:

                image_extensions.update({'.heic', '.heif'})

            

            try:

                total = 0

                unreadable = 0

                no_face = 0

                for filename in os.listdir(reference_folder):

                    if any(filename.lower().endswith(ext) for ext in image_extensions):

                        total += 1

                        image_path = os.path.join(reference_folder, filename)

                        try:

                            # 偵測人臉
                            faces = self.detect_faces(image_path)

                            if faces:

                                # 選擇最大的人臉（通常最清晰）
                                largest_face = max(faces, key=lambda f: f.bbox[2] * f.bbox[3])

                                self.reference_gallery[image_path] = largest_face.embedding

                                self.reference_embeddings.append(largest_face.embedding)

                                self.reference_paths.append(image_path)

                                self.logger.info(f"載入參考照片: {filename}, 人臉大小: {largest_face.bbox[2]}x{largest_face.bbox[3]}")

                            else:

                                no_face += 1

                                self.logger.warning(f"參考照片中未偵測到人臉: {filename}")

                        except Exception as read_err:

                            unreadable += 1

                            self.logger.error(f"讀取照片失敗: {filename}，錯誤: {read_err}")

                

                if not self.reference_gallery:

                    self.logger.error(f"找不到有效的參考照片（總計{total}, 無法讀取{unreadable}, 無人臉{no_face}）")

                    return False

                

                self.logger.info(f"參考照片庫建立完成，共{len(self.reference_gallery)} 張照片；總計{total}, 無法讀取{unreadable}, 無人臉{no_face}")

                return True

                

            except Exception as e:

                self.logger.error(f"建立參考照片庫失敗: {e}")

                return False

        

        return True

    

    def find_child_in_image(self, image_path: str, threshold: float = 0.65, 

                           child_id: Optional[str] = None) -> Optional[ChildMatch]:

        """
        在圖片中尋找小孩

        

        Args:
            image_path: 圖片路徑

            threshold: 相似度閾值
            child_id: 小孩ID（用於多小孩識別）

        Returns:
            匹配結果或None

        """

        if not self.reference_embeddings:

            self.logger.error("參考照片庫為空")

            return None

        

        # 檢查手動標記
        if image_path in self.manual_corrections:

            correction = self.manual_corrections[image_path]

            if correction['action'] == 'confirm':  # 確認正確
                return ChildMatch(

                    image_path=image_path,

                    face_bbox=correction['bbox'],

                    similarity_score=correction['similarity'],

                    reference_image=correction['reference'],

                    confidence=self._get_confidence_level(correction['similarity']),

                    child_id=correction.get('child_id')

                )

            elif correction['action'] == 'reject':  # 錯誤識別
                return None

        

        try:

            # 偵測圖片中的人臉
            faces = self.detect_faces(image_path)

            

            if not faces:

                return None

            

            best_match = None

            best_score = 0.0

            

            # 對比每張人臉與參考照片庫
            for face in faces:

                # 計算與參考照片相似度
                similarities = cosine_similarity([face.embedding], self.reference_embeddings)[0]

                max_similarity = np.max(similarities)

                best_ref_idx = np.argmax(similarities)

                

                if max_similarity > best_score and max_similarity >= threshold:

                    best_score = max_similarity

                    best_match = ChildMatch(

                        image_path=image_path,

                        face_bbox=face.bbox,

                        similarity_score=max_similarity,

                        reference_image=self.reference_paths[best_ref_idx],

                        confidence=self._get_confidence_level(max_similarity),

                        child_id=child_id

                    )

            

            return best_match

            

        except Exception as e:

            self.logger.error(f"尋找小孩失敗 {image_path}: {e}")

            return None

    

    def find_all_children_in_image(self, image_path: str, threshold: float = 0.65) -> List[ChildMatch]:

        """
        在圖片中尋找所有小孩（多小孩模式）

        

        Args:
            image_path: 圖片路徑

            threshold: 相似度閾值

            

        Returns:
            匹配結果列表

        """

        if not self.reference_embeddings:

            self.logger.error("參考照片庫為空")

            return []

        

        # 檢查手動標記
        if image_path in self.manual_corrections:

            correction = self.manual_corrections[image_path]

            if correction['action'] == 'confirm':  # 確認正確
                return [ChildMatch(

                    image_path=image_path,

                    face_bbox=correction['bbox'],

                    similarity_score=correction['similarity'],

                    reference_image=correction['reference'],

                    confidence=self._get_confidence_level(correction['similarity']),

                    child_id=correction.get('child_id')

                )]

            elif correction['action'] == 'reject':  # 錯誤識別
                return []

        

        try:

            # 偵測圖片中的人臉
            faces = self.detect_faces(image_path)

            

            if not faces:

                return []

            

            matches = []

            

            # 對比每張人臉與參考照片庫
            for face in faces:

                # 計算與參考照片相似度
                similarities = cosine_similarity([face.embedding], self.reference_embeddings)[0]

                max_similarity = np.max(similarities)

                best_ref_idx = np.argmax(similarities)

                

                if max_similarity >= threshold:

                    match = ChildMatch(

                        image_path=image_path,

                        face_bbox=face.bbox,

                        similarity_score=max_similarity,

                        reference_image=self.reference_paths[best_ref_idx],

                        confidence=self._get_confidence_level(max_similarity)

                    )

                    matches.append(match)

            

            return matches

            

        except Exception as e:

            self.logger.error(f"尋找小孩失敗 {image_path}: {e}")

            return []

    

    def add_manual_correction(self, image_path: str, action: str, bbox: Tuple[int, int, int, int], 

                            similarity: float, reference: str, child_id: Optional[str] = None):

        """
        添加手動標記校正

        

        Args:
            image_path: 圖片路徑

            action: 操作 ('confirm' 或 'reject')

            bbox: 人臉邊界框
            similarity: 相似度
            reference: 參考照片路徑

            child_id: 小孩ID

        """

        self.manual_corrections[image_path] = {

            'action': action,

            'bbox': bbox,

            'similarity': similarity,

            'reference': reference,

            'child_id': child_id,

            'timestamp': datetime.now().isoformat()

        }

    

    def cluster_faces(self, image_paths: List[str], eps: float = 0.4, min_samples: int = 2) -> Dict[str, List[str]]:

        """
        對偵測到的人臉進行聚類，識別不同小孩

        

        Args:
            image_paths: 圖片路徑列表

            eps: DBSCAN的eps參數

            min_samples: DBSCAN的min_samples參數

            

        Returns:
            聚類結果 {cluster_id: [image_paths]}

        """

        all_faces = []

        image_to_faces = {}

        

        # 收集所有人臉
        for image_path in image_paths:

            faces = self.detect_faces(image_path)

            if faces:

                image_to_faces[image_path] = faces

                for face in faces:

                    all_faces.append((image_path, face))

        

        if not all_faces:

            return {}

        

        # 提取特徵向量
        embeddings = np.array([face.embedding for _, face in all_faces])

        

        # 使用DBSCAN進行聚類
        clustering = DBSCAN(eps=eps, min_samples=min_samples, metric='cosine').fit(embeddings)

        labels = clustering.labels_

        

        # 組織結果
        clusters = {}

        for i, (image_path, face) in enumerate(all_faces):

            cluster_id = str(labels[i])

            if cluster_id not in clusters:

                clusters[cluster_id] = []

            clusters[cluster_id].append(image_path)

        

        return clusters

    

    def _get_confidence_level(self, similarity_score: float) -> str:

        """根據相似度判斷信心水平"""
        if similarity_score >= 0.75:

            return 'high'

        elif similarity_score >= 0.65:

            return 'medium'

        else:

            return 'low'

    

    def _process_single_image(self, image_path: str, threshold: float, 

                           quality_threshold: float) -> Tuple[Optional[ChildMatch], Dict[str, float]]:

        """
        處理單張圖片

        

        Args:
            image_path: 圖片路徑

            threshold: 相似度閾值
            quality_threshold: 質量閾值

        Returns:
            (匹配結果, 質量評估結果)

        """

        try:

            # 評估圖片質量
            quality = self.assess_image_quality(image_path)

            if quality['overall'] < quality_threshold:

                return None, quality

            

            # 尋找小孩
            match = self.find_child_in_image(image_path, threshold)

            return match, quality

        except Exception as e:

            self.logger.error(f"處理失敗 {image_path}: {e}")

            return None, {"overall": 0.0}

    

    def batch_process_folder(self, input_folder: str, output_folder: str, 

                           threshold: float = 0.65, copy_files: bool = True,

                           quality_threshold: float = 0.3, multithread: bool = False,

                           thread_count: int = 4,

                           progress_callback: Optional[ProgressCallback] = None) -> Dict:

        """
        批量處理資料夾

        Args:
            input_folder: 輸入資料夾
            output_folder: 輸出資料夾
            threshold: 相似度閾值
            copy_files: 是否複製檔案
            quality_threshold: 質量閾值
            multithread: 是否使用多線程
            thread_count: 線程數
            progress_callback: 進度回調

            

        Returns:
            處理結果統計

        """

        if not os.path.exists(input_folder):

            self.logger.error(f"輸入資料夾不存在: {input_folder}")

            return {}

        

        # 設置停止標誌
        with self.processing_lock:

            self.stop_processing = False

        

        # 建立輸出資料夾
        os.makedirs(output_folder, exist_ok=True)

        

        # 支援的圖片格式
        image_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp'}

        if _HEIF_ENABLED:

            image_extensions.update({'.heic', '.heif'})

        

        # 收集所有圖片路徑
        image_paths = []

        for filename in os.listdir(input_folder):

            if any(filename.lower().endswith(ext) for ext in image_extensions):

                image_path = os.path.join(input_folder, filename)

                image_paths.append(image_path)

        

        # 統計信息
        stats = ProcessingStats(

            total_images=len(image_paths),

            similarity_distribution={'high': 0, 'medium': 0, 'low': 0},

            confidence_distribution={'high': 0, 'medium': 0, 'low': 0}

        )

        

        results = {

            'total_images': len(image_paths),

            'found_child': 0,

            'matches': [],

            'errors': [],

            'stats': asdict(stats),

            'quality_filtered': 0

        }

        

        start_time = datetime.now()

        

        try:

            if multithread and len(image_paths) > 1:

                # 多線程處理
                self._batch_process_multithread(

                    image_paths, threshold, quality_threshold, 

                    thread_count, progress_callback, results, stats

                )

            else:

                # 單線程處理
                self._batch_process_singlethread(

                    image_paths, threshold, quality_threshold, 

                    progress_callback, results, stats, output_folder, copy_files

                )

            

            # 計算處理時間
            end_time = datetime.now()

            stats.processing_time = (end_time - start_time).total_seconds()

            

            # 對找到的小孩進行聚類
            if results['matches']:

                matched_images = [os.path.join(input_folder, match['image']) for match in results['matches']]

                clusters = self.cluster_faces(matched_images)

                stats.child_clusters = clusters

            

            # 更新結果統計
            results['stats'] = asdict(stats)

            

            # 保存結果報告
            report_path = os.path.join(output_folder, 'child_detection_report.json')

            with open(report_path, 'w', encoding='utf-8') as f:

                json.dump(results, f, ensure_ascii=False, indent=2)

            

            self.logger.info(f"處理完成: {results['found_child']}/{results['total_images']} 張照片找到小孩")

            return results

            

        except Exception as e:

            self.logger.error(f"處理失敗: {e}")

            results['errors'].append(str(e))

            return results

    

    def _batch_process_singlethread(self, image_paths: List[str], threshold: float, 

                                 quality_threshold: float, progress_callback: Optional[ProgressCallback],

                                 results: Dict, stats: ProcessingStats, 

                                 output_folder: str, copy_files: bool):

        """單線程批量處理"""
        for i, image_path in enumerate(image_paths):

            # 檢查是否停止
            with self.processing_lock:

                if self.stop_processing:

                    break

            

            # 更新進度
            if progress_callback:

                progress_callback.update(i, len(image_paths), f"處理 {os.path.basename(image_path)}")

            

            # 處理單張圖片
            match, quality = self._process_single_image(image_path, threshold, quality_threshold)

            

            if quality['overall'] < quality_threshold:

                results['quality_filtered'] += 1

                self.logger.info(f"跳過低質量圖片 {image_path}, 質量分數: {quality['overall']:.2f}")

                continue

            

            if match:

                results['found_child'] += 1

                results['matches'].append({

                    'image': os.path.basename(image_path),

                    'similarity': match.similarity_score,

                    'confidence': match.confidence,

                    'reference': os.path.basename(match.reference_image),

                    'bbox': match.face_bbox,

                    'quality': quality

                })

                

                # 更新統計
                stats.similarity_distribution[match.confidence] += 1

                stats.confidence_distribution[match.confidence] += 1

                

                # 複製檔案
                if copy_files:

                    output_path = os.path.join(output_folder, os.path.basename(image_path))

                    if not os.path.exists(output_path):

                        import shutil

                        shutil.copy2(image_path, output_path)

                        self.logger.info(f"複製檔案: {os.path.basename(image_path)}")

            

            stats.processed_images += 1

        

        # 更新最終進度
        if progress_callback:

            progress_callback.update(len(image_paths), len(image_paths), "處理完成")

    

    def _batch_process_multithread(self, image_paths: List[str], threshold: float, 

                                quality_threshold: float, thread_count: int,

                                progress_callback: Optional[ProgressCallback],

                                results: Dict, stats: ProcessingStats):

        """多線程批量處理"""
        # 使用線程池
        with ThreadPoolExecutor(max_workers=thread_count) as executor:

            # 提交任務
            future_to_path = {

                executor.submit(self._process_single_image, path, threshold, quality_threshold): path

                for path in image_paths

            }

            

            # 完成任務
            completed = 0

            for future in as_completed(future_to_path):

                # 檢查是否停止
                with self.processing_lock:

                    if self.stop_processing:

                        break

                

                path = future_to_path[future]

                completed += 1

                

                # 更新進度
                if progress_callback:

                    progress_callback.update(completed, len(image_paths), f"處理 {os.path.basename(path)}")

                

                try:

                    match, quality = future.result()

                    

                    if quality['overall'] < quality_threshold:

                        results['quality_filtered'] += 1

                        self.logger.info(f"跳過低質量圖片 {path}, 質量分數: {quality['overall']:.2f}")

                    elif match:

                        results['found_child'] += 1

                        results['matches'].append({

                            'image': os.path.basename(path),

                            'similarity': match.similarity_score,

                            'confidence': match.confidence,

                            'reference': os.path.basename(match.reference_image),

                            'bbox': match.face_bbox,

                            'quality': quality

                        })

                        

                        # 更新統計
                        stats.similarity_distribution[match.confidence] += 1

                        stats.confidence_distribution[match.confidence] += 1

                    

                    stats.processed_images += 1

                    

                except Exception as e:

                    self.logger.error(f"處理失敗 {path}: {e}")

                    results['errors'].append(f"{path}: {str(e)}")

        

        # 多線程處理後，製作輸出檔案
        if results['matches']:

            import shutil

            for match in results['matches']:

                try:

                    src_path = os.path.join(os.path.dirname(image_paths[0]), match['image'])

                    dst_path = os.path.join(os.path.dirname(image_paths[0]), '..', 'output', match['image'])

                    os.makedirs(os.path.dirname(dst_path), exist_ok=True)

                    if not os.path.exists(dst_path):

                        shutil.copy2(src_path, dst_path)

                        self.logger.info(f"複製檔案: {match['image']}")

                except Exception as e:

                    self.logger.error(f"複製檔案失敗 {match['image']}: {e}")

        

        # 更新最終進度
        if progress_callback:

            progress_callback.update(len(image_paths), len(image_paths), "處理完成")

    

    def stop_batch_processing(self):

        """停止處理"""
        with self.processing_lock:

            self.stop_processing = True

        self.logger.info("已發送停止信號")

    

    def save_manual_corrections(self, file_path: str):

        """保存手動標記校正"""

        try:

            with open(file_path, 'w', encoding='utf-8') as f:

                json.dump(self.manual_corrections, f, ensure_ascii=False, indent=2)

            self.logger.info(f"手動標記校正已保存到: {file_path}")

        except Exception as e:

            self.logger.error(f"保存手動標記校正失敗: {e}")

    

    def load_manual_corrections(self, file_path: str):

        """載入手動標記校正"""

        try:

            if os.path.exists(file_path):

                with open(file_path, 'r', encoding='utf-8') as f:

                    self.manual_corrections = json.load(f)

                self.logger.info(f"手動標記校正已從 {file_path} 載入")

        except Exception as e:

            self.logger.error(f"載入手動標記校正失敗: {e}")

    

    def clear_cache(self):

        """清除緩存"""

        try:

            for file in os.listdir(self.cache_dir):

                file_path = os.path.join(self.cache_dir, file)

                if os.path.isfile(file_path):

                    os.remove(file_path)

            self.logger.info("緩存已清除")

        except Exception as e:

            self.logger.error(f"清除緩存失敗: {e}")



    def assess_reference_quality(self, ref_paths: List[str]) -> Dict[str, Any]:

        """
        評估參考照片質量

        
        Args:
            ref_paths: 參考照片路徑列表

            

        Returns:
            評估結果字典

        """

        if not self.app:

            self.initialize_model()

            

        if not ref_paths:

            return {

                'total_count': 0,

                'good_quality_count': 0,

                'diversity_score': 0.0,

                'age_range': None,

                'expression_variety': 0,

                'recommendations': []

            }

        

        # 分析每張參考照片
        ref_analyses = []

        age_scores = []

        expression_scores = []

        

        for ref_path in ref_paths:

            try:

                # 檢測人臉
                detections = self.detect_faces(ref_path)

                

                if not detections:

                    continue

                    

                # 使用第一張檢測到的人臉
                face = detections[0]

                

                # 評估質量
                quality = self.assess_image_quality(ref_path)

                

                # 年齡和表情基於人臉特徵
                # 這裡使用簡單方法，實際應用中可能需要更複雜的模型
                age_score = self._estimate_age_score(face)

                expression_score = self._estimate_expression_score(face)

                

                ref_analyses.append({

                    'path': ref_path,

                    'quality': quality,

                    'age_score': age_score,

                    'expression_score': expression_score,

                    'face_size': face['size']

                })

                

                age_scores.append(age_score)

                expression_scores.append(expression_score)

                

            except Exception as e:

                self.logger.warning(f"參考照片分析失敗 {ref_path}: {e}")

        

        # 計算統計信息
        total_count = len(ref_analyses)

        good_quality_count = sum(1 for analysis in ref_analyses if analysis['quality']['overall'] > 0.5)

        

        # 計算多樣性分數
        diversity_score = 0.0

        if total_count > 1:

            # 年齡多樣性
            if age_scores:

                age_range = max(age_scores) - min(age_scores)

                diversity_score += min(age_range / 10.0, 1.0) * 0.5  # 多樣性貢獻0.5
            
            # 表情多樣性
            if expression_scores:

                expression_variety = len(set(round(score) for score in expression_scores))

                diversity_score += min(expression_variety / 5.0, 1.0) * 0.5  # 多樣性貢獻0.5
        
        # 建議
        recommendations = []
        
        if total_count < 3:

            recommendations.append("建議增加參考照片（至少3-5張以提高識別確定性）")
        
        if good_quality_count / total_count < 0.7:

            recommendations.append("參考照片質量較低，建議替換為清晰、光線良好的照片")
        
        if diversity_score < 0.5:

            recommendations.append("參考照片多樣性不足，建議包含不同年齡、表情和角度的照片")
        
        # 檢查年齡範圍
        age_range = None

        if age_scores:

            min_age = min(age_scores)

            max_age = max(age_scores)

            age_range = (min_age, max_age)

            

            if max_age - min_age < 2:  # 年齡差異小於2歲

                recommendations.append("參考照片年齡範圍較窄，可能影響其他年齡段識別確定性")
        
        return {

            'total_count': total_count,

            'good_quality_count': good_quality_count,

            'diversity_score': diversity_score,

            'age_range': age_range,

            'expression_variety': len(set(round(score) for score in expression_scores)) if expression_scores else 0,

            'recommendations': recommendations,

            'analyses': ref_analyses

        }

    

    def _estimate_age_score(self, face: Dict[str, Any]) -> float:

        """
        估計年齡分數（0-10，表示嬰兒到成人）
        
        這是一個簡單實現，基於人臉特徵粗略估計
        """

        # 實際應用中，這裡應該使用專業的年齡估計模型
        # 這裡使用基於人臉大小的簡單方法
        size = face.get('size', 0)

        

        # 設定人臉大小與年齡相關是一個常見假設
        # 實際中取決於距離、解析度等因素
        if size < 50:

            return 2.0  # 設定為幼兒
        elif size < 80:

            return 5.0  # 設定為兒童
        elif size < 120:

            return 8.0  # 設定為少年
        else:

            return 10.0  # 設定為成人

    def _estimate_expression_score(self, face: Dict[str, Any]) -> float:

        """
        估計表情分數（0-10，表示表情類型）
        
        這是一個簡單實現，基於人臉特徵粗略估計
        """

        # 實際應用中，這裡應該使用專業的表情識別模型
        # 這裡使用隨機值作為示例
        import random

        return random.uniform(0, 10)

    

    def suggest_optimal_threshold(self, ref_analysis: Dict[str, Any], 

                               target_precision: float = 0.9) -> float:

        """
        根據參考照片建議最佳相似度閾值

        
        Args:
            ref_analysis: 參考照片分析結果

            target_precision: 目標精確度（0-1）

            
        Returns:
            建議的相似度閾值

        """

        # 基礎閾值
        base_threshold = 0.65

        

        # 根據參考照片質量調整
        quality_ratio = ref_analysis.get('good_quality_count', 0) / max(ref_analysis.get('total_count', 1), 1)

        

        # 質量越高，可以使用更低的閾值
        if quality_ratio > 0.9:

            quality_adjustment = -0.05

        elif quality_ratio > 0.7:

            quality_adjustment = -0.02

        elif quality_ratio < 0.5:

            quality_adjustment = 0.05

        else:

            quality_adjustment = 0.0

        

        # 多樣性調整
        diversity = ref_analysis.get('diversity_score', 0.0)

        

        # 多樣性高，可以使用更低的閾值
        if diversity > 0.8:

            diversity_adjustment = -0.03

        elif diversity > 0.5:

            diversity_adjustment = -0.01

        elif diversity < 0.3:

            diversity_adjustment = 0.03

        else:

            diversity_adjustment = 0.0

        

        # 根據參考照片數量調整
        count = ref_analysis.get('total_count', 0)

        

        # 參考照片越多，可以使用更低的閾值
        if count > 10:

            count_adjustment = -0.02

        elif count > 5:

            count_adjustment = -0.01

        elif count < 3:

            count_adjustment = 0.05

        else:

            count_adjustment = 0.0

        

        # 計算最終閾值
        suggested_threshold = base_threshold + quality_adjustment + diversity_adjustment + count_adjustment

        

        # 確保值在合理範圍內
        suggested_threshold = max(0.5, min(0.9, suggested_threshold))

        

        return suggested_threshold

    

    def auto_adjust_threshold(self, current_threshold: float, 

                           feedback_data: List[Dict[str, Any]]) -> float:

        """
        根據用戶反饋調整相似度閾值

        
        Args:
            current_threshold: 當前閾值
            feedback_data: 用戶反饋數據，元素包含{
                'image_path': 圖片路徑,
                'user_decision': 用戶決定 ('correct' 或 'incorrect'),
                'similarity': 相似度分數
            }

            
        Returns:
            調整後的閾值

        """

        if not feedback_data:

            return current_threshold

        

        # 分析反饋
        correct_decisions = [f for f in feedback_data if f['user_decision'] == 'correct']

        incorrect_decisions = [f for f in feedback_data if f['user_decision'] == 'incorrect']

        

        # 計算當前準確率
        accuracy = len(correct_decisions) / len(feedback_data) if feedback_data else 0

        

        # 如果準確率已經很高，不需要調整
        if accuracy > 0.95:

            return current_threshold

        

        # 分析錯誤類型
        false_positives = [f for f in incorrect_decisions if f['similarity'] >= current_threshold]

        false_negatives = [f for f in incorrect_decisions if f['similarity'] < current_threshold]

        

        # 計算調整量
        adjustment = 0.0

        

        # 如果太多誤報（錯誤識別）
        if len(false_positives) > len(false_negatives) * 1.5:

            # 計算誤報平均相似度
            avg_fp_similarity = sum(f['similarity'] for f in false_positives) / len(false_positives)

            # 將閾值設置為誤報平均相似度
            adjustment = (avg_fp_similarity - current_threshold) * 0.5

        

        # 如果太多漏報（錯過識別）
        elif len(false_negatives) > len(false_positives) * 1.5:

            # 計算漏報平均相似度
            avg_fn_similarity = sum(f['similarity'] for f in false_negatives) / len(false_negatives)

            # 將閾值設置為平均相似度
            adjustment = (avg_fn_similarity - current_threshold) * 0.5

        

        # 限制調整幅度，避免過度調整
        max_adjustment = 0.05

        adjustment = max(-max_adjustment, min(max_adjustment, adjustment))

        

        # 計算新閾值
        new_threshold = current_threshold + adjustment

        

        # 確保值在合理範圍內
        new_threshold = max(0.5, min(0.9, new_threshold))

        

        return new_threshold



