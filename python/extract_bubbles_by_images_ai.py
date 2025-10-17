from ultralytics import YOLO
import os
import json
import cv2
import numpy as np
from PIL import Image
import subprocess
import logging
import time
from datetime import datetime
import traceback
import math 
import gc 
import sys

# 🚨 استيراد torch للتحقق من وجود GPU بشكل آمن
try:
    import torch
except ImportError:
    pass # سيتم التعامل مع عدم وجوده لاحقًا

# ===== إعداد اللوج (كما هو) =====
log_file = rf"C:\Users\abdoh\Downloads\testScript\log\detector_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.FileHandler(log_file, encoding="utf-8"), logging.StreamHandler()],
)
logger = logging.getLogger(__name__)

success = True

try:
    # ===== المسارات والإعدادات الأساسية (كما هي) =====
    cfg_path = r"C:\Users\abdoh\Downloads\testScript\config\temp-title.json"
    with open(cfg_path, encoding="utf-8") as f:
        cfg = json.load(f)

    folder = cfg["title"]
    base = os.path.join(r"C:\Users\abdoh\Downloads", folder)
    image_folder = base
    output_path = os.path.join(base, "all_bubbles.json")

    pspath = cfg.get(
        "pspath", r"C:\Program Files\Adobe\Adobe Photoshop CC 2019\Photoshop.exe"
    )
    jsx_script = r"C:\Users\abdoh\Downloads\testScript\scripts\script.jsx"

    MODEL_FILENAME = "comic-speech-bubble-detector.pt"
    model_path = os.path.join(
        r"C:\Users\abdoh\Downloads\testScript\model", MODEL_FILENAME
    )
    model = YOLO(model_path)

    # ===== OCR (كما هي) =====
    ocr_model = cfg.get("ocr_model", "paddle")
    
    # 🌟 تعيين الجهاز بشكل آمن
    ocr_device = "cpu"
    if 'torch' in locals() and 'torch' in globals() and torch.cuda.is_available():
        ocr_device = "gpu"
    
    if ocr_model == "paddle":
        try:
            from paddleocr import PaddleOCR
            lang = "korean" if cfg["mangaType"] in ["korian", "korean"] else "japan"
            ocr = PaddleOCR(use_textline_orientation=True, lang=lang, device=ocr_device)
            OCR_TYPE = "paddle"
            logger.info(f"✅ Using PaddleOCR with lang={lang} on device={ocr_device}.")
        except (ImportError, ValueError, NameError) as e:
            logger.error(f"⚠️ PaddleOCR failed: {e}. Falling back to MangaOCR/EasyOCR.")
            ocr_model = "manga"
            
    if ocr_model == "manga":
        try:
            from manga_ocr import MangaOcr
            ocr = MangaOcr()
            OCR_TYPE = "manga"
            logger.info("✅ Using MangaOCR for text validation.")
        except ImportError:
            ocr_model = "easy"
            
    if ocr_model == "easy":
        import easyocr
        OCR_TYPE = "easy"
        logger.warning("⚠️ Using EasyOCR.")
        gpu_status = (ocr_device == "gpu")
        ocr_ja = easyocr.Reader(["en", "ja"], gpu=gpu_status)
        ocr_ko = easyocr.Reader(["en", "ko"], gpu=gpu_status)

    # ===== إعدادات الكشف (تم التعديل) =====
    # 🌟 التعديل 1: رفع الثقة لتقليل الالتقاط الخاطئ (من 0.01 إلى 0.15)
    CONFIDENCE_THRESHOLD = 0.15 
    IOU_THRESHOLD = 0.7
    MERGE_IOU_THRESHOLD = 0.5
    SLICE_OVERLAP = 300
    SLICE_HEIGHT = 4000
    MIN_BUBBLE_AREA = 1000  
    CONTAINMENT_THRESHOLD = 0.95
    MIN_DIM_THRESHOLD = 50   
    YOLO_IMG_SIZE = 1280
    BOX_EXPANSION_PIXELS = 10 

    # ===== دوال مساعدة =====
    
    def preprocess_image(img):
        # 1. تحسين التباين والسطوع العام (Lab Space)
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe_l = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8)) 
        l = clahe_l.apply(l)
        lab_enhanced = cv2.merge([l, a, b])
        enhanced_lab = cv2.cvtColor(lab_enhanced, cv2.COLOR_LAB2BGR)

        # 2. تعزيز اللون والتباين (HSV Space)
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        h, s, v = cv2.split(hsv)
        v = cv2.equalizeHist(v)
        clahe_s = cv2.createCLAHE(clipLimit=4.0, tileGridSize=(8, 8))
        s = clahe_s.apply(s)
        hsv_enhanced = cv2.merge([h, s, v])
        enhanced_hsv = cv2.cvtColor(hsv_enhanced, cv2.COLOR_HSV2BGR)

        # 3. تحسين ثالث (HSL Space)
        hsl = cv2.cvtColor(img, cv2.COLOR_BGR2HLS)
        H, L, S = cv2.split(hsl)
        L = cv2.equalizeHist(L)
        hsl_enhanced = cv2.merge([H, L, S])
        enhanced_hsl = cv2.cvtColor(hsl_enhanced, cv2.COLOR_HLS2BGR)

        # 4. دمج التحسينات
        final = cv2.addWeighted(enhanced_lab, 0.5, enhanced_hsv, 0.3, 0)
        final = cv2.addWeighted(final, 0.8, enhanced_hsl, 0.2, 0)
        
        # 5. تعزيز الحواف بالأبيض والأسود
        gray = cv2.cvtColor(final, cv2.COLOR_BGR2GRAY)
        final_bgr = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
        final = cv2.addWeighted(final, 0.8, final_bgr, 0.2, 0)
        
        return final
    
    def smart_slice_image(image, target_h, overlap, delta=200):
        h, w = image.shape[:2]
        slices = []
        y_start = 0
        while y_start < h:
            y_cut = min(y_start + target_h, h)
            if y_cut == h:
                slices.append((image[y_start:h, :].copy(), y_start))
                break
            best_cut = y_cut
            best_score = float("inf")
            for dy in range(-delta, delta + 1):
                yc = y_cut + dy
                if yc <= y_start + overlap or yc >= h:
                    continue
                line = cv2.cvtColor(image[yc : yc + 1, :], cv2.COLOR_BGR2GRAY)
                cost = np.sum(np.abs(np.diff(line[0].astype(np.int32))))
                if cost < best_score:
                    best_score = cost
                    best_cut = yc
            slices.append((image[y_start:best_cut, :].copy(), y_start))
            y_start = best_cut - overlap
        return slices

    def box_iou(box1, box2):
        x1, y1, x2, y2 = box1
        X1, Y1, X2, Y2 = box2
        inter_x1 = max(x1, X1)
        inter_y1 = max(y1, Y1)
        inter_x2 = min(x2, X2)
        inter_y2 = min(y2, Y2)
        inter_area = max(0, inter_x2 - inter_x1) * max(0, inter_y2 - inter_y1)
        area1 = (x2 - x1) * (y2 - y1)
        area2 = (X2 - X1) * (Y2 - Y1)
        union = area1 + area2 - inter_area
        return inter_area / union if union > 0 else 0

    def is_contained(box_small, box_large):
        x1s, y1s, x2s, y2s = box_small
        x1l, y1l, x2l, y2l = box_large
        inter_x1 = max(x1s, x1l)
        inter_y1 = max(y1s, y1l)
        inter_x2 = min(x2s, x2l)
        inter_y2 = min(y2s, y2l)
        inter_area = max(0, inter_x2 - inter_x1) * max(0, inter_y2 - inter_y1)
        area_small = (x2s - x1s) * (y2s - y1s)
        return (
            (inter_area / area_small) >= CONTAINMENT_THRESHOLD
            if area_small > 0
            else False
        )

    def merge_and_clean_boxes(boxes_raw, scores_raw):
        if not boxes_raw:
            return [], []
        indices = np.argsort(-np.array(scores_raw))
        boxes = np.array(boxes_raw)[indices]
        scores = np.array(scores_raw)[indices]
        final_boxes = []
        final_scores = []
        
        picked_indices = []
        for i in range(len(boxes)):
            if scores[i] < CONFIDENCE_THRESHOLD:
                continue
            
            keep = True
            for j in picked_indices:
                if box_iou(boxes[i], final_boxes[j]) > MERGE_IOU_THRESHOLD:
                    fb = final_boxes[j]
                    x1 = min(boxes[i][0], fb[0])
                    y1 = min(boxes[i][1], fb[1])
                    x2 = max(boxes[i][2], fb[2])
                    y2 = max(boxes[i][3], fb[3])
                    final_boxes[j] = [x1, y1, x2, y2]
                    final_scores[j] = max(scores[i], final_scores[j])
                    keep = False
                    break
            
            if keep:
                final_boxes.append(boxes[i].tolist())
                final_scores.append(scores[i])
                picked_indices.append(len(final_boxes) - 1)
                
        to_remove = set()
        for i in range(len(final_boxes)):
            for j in range(len(final_boxes)):
                if i != j and is_contained(final_boxes[i], final_boxes[j]):
                    to_remove.add(i)
        
        final_boxes_np = np.array(final_boxes)
        final_scores_np = np.array(final_scores)

        final_boxes = [b.tolist() for idx, b in enumerate(final_boxes_np) if idx not in to_remove]
        final_scores = [s.item() for idx, s in enumerate(final_scores_np) if idx not in to_remove]
        
        return final_boxes, final_scores

    # 🌟 التعديل 2: زيادة عتبة النقاط في has_text (من 0.005 إلى 0.015)
    def has_text(image, box):
        x1, y1, x2, y2 = map(int, box)
        crop = image[y1:y2, x1:x2]
        if crop.size == 0:
            return False
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        
        text_found = False
        
        # 1. محاولة التعرف على النص باستخدام OCR
        if OCR_TYPE == "paddle":
            result = ocr.ocr(gray, cls=True)
            if result and result[0]:
                text = " ".join([line[1][0] for line in result[0]])
                text_found = bool(text.strip())
        elif OCR_TYPE == "manga":
            text = ocr(Image.fromarray(gray))
            text_found = bool(text.strip())
        elif OCR_TYPE == "easy":
            ja_text = " ".join(ocr_ja.readtext(gray, detail=0))
            ko_text = " ".join(ocr_ko.readtext(gray, detail=0))
            combined_text = (ja_text + " " + ko_text).strip()
            text_found = bool(combined_text)

        # 2. التحقق من النقاط (Ellipsis) أو علامات الترقيم (المرحلة الثانية)
        if not text_found:
            
            # 2.1. تطبيق عتبة بسيطة (Binary Inversion)
            _, thresh = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY_INV)
            
            # التوسيع (Dilation) للمساعدة في إبراز النقاط الصغيرة والخفيفة
            kernel = np.ones((3,3), np.uint8) 
            dilated = cv2.dilate(thresh, kernel, iterations=1) 
            
            # 2.2. قص الثلث الأوسط من الفقاعة
            h, w = dilated.shape[:2]
            center_crop = dilated[int(h*0.25):int(h*0.75), int(w*0.1):int(w*0.9)]
            
            # 2.3. حساب نسبة البكسلات السوداء 
            if center_crop.size > 0:
                black_pixels = np.sum(center_crop > 0)
                total_pixels = center_crop.size
                
                # العتبة الجديدة: 0.015
                if black_pixels / total_pixels > 0.015: 
                    return True
        
        return text_found

    def get_box_center(box):
        x1, y1, x2, y2 = box
        return (x1 + x2) / 2, (y1 + y2) / 2
    
    # ===== معالجة كل الصفحات (كما هي) =====
    image_files = sorted(
        [
            f
            for f in os.listdir(image_folder)
            if f.lower().endswith((".png", ".jpg", ".jpeg"))
        ]
    )
    logger.info(f"🔍 Found {len(image_files)} images in {image_folder}")

    all_bubbles = {}

    for idx, img_file in enumerate(image_files, start=1):
        img_path = os.path.join(image_folder, img_file)
        image = cv2.imread(img_path)
        if image is None:
            logger.warning(f"⚠️ Can't read image: {img_path}")
            continue

        enhanced = preprocess_image(image)
        all_boxes, all_scores = [], []
        h, w = image.shape[:2]

        slices = smart_slice_image(enhanced, SLICE_HEIGHT, SLICE_OVERLAP, delta=200)
        
        for slice_img, offset_y in slices:
            results = model(
                slice_img, imgsz=YOLO_IMG_SIZE, conf=CONFIDENCE_THRESHOLD, iou=IOU_THRESHOLD, verbose=False
            )
            for r in results:
                for box, score in zip(
                    r.boxes.xyxy.cpu().numpy(), r.boxes.conf.cpu().numpy()
                ):
                    x1, y1, x2, y2 = box
                    y1 += offset_y
                    y2 += offset_y
                    all_boxes.append([x1, y1, x2, y2])
                    all_scores.append(score)
            
            del slice_img
        
        merged_boxes, merged_scores = merge_and_clean_boxes(all_boxes, all_scores)

        valid_bubbles = []
        for box in merged_boxes:
            x1, y1, x2, y2 = box
            
            exp = BOX_EXPANSION_PIXELS
            x1_exp = max(0, x1 - exp)
            y1_exp = max(0, y1 - exp)
            x2_exp = min(w, x2 + exp)
            y2_exp = min(h, y2 + exp)
            
            box_expanded = [x1_exp, y1_exp, x2_exp, y2_exp]
            
            width = x2_exp - x1_exp
            height = y2_exp - y1_exp
            
            if width * height < MIN_BUBBLE_AREA or width < MIN_DIM_THRESHOLD or height < MIN_DIM_THRESHOLD:
                continue

            if has_text(image, box_expanded):
                cx, cy = get_box_center(box_expanded)
                
                polygon = [
                    [int(x1_exp), int(y1_exp)],
                    [int(x2_exp), int(y1_exp)],
                    [int(x2_exp), int(y2_exp)],
                    [int(x1_exp), int(y2_exp)],
                ]
                valid_bubbles.append(
                    {"center_x": cx, "center_y": cy, "points": polygon}
                )

        key = f"{idx:02d}_mask"
        all_bubbles[key] = [
            {"id": i + 1, "points": vb["points"]}
            for i, vb in enumerate(
                sorted(valid_bubbles, key=lambda b: (b["center_y"], b["center_x"]))
            )
        ]

        logger.info(f"✅ {img_file}: {len(valid_bubbles)} valid bubbles found. (Total boxes before validation: {len(merged_boxes)})")
        
        # تنظيف الذاكرة بعد كل صفحة
        del image, enhanced, all_boxes, all_scores, merged_boxes, merged_scores
        gc.collect()

    # ===== حفظ النتيجة وتشغيل Photoshop (كما هي) =====
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_bubbles, f, indent=2, ensure_ascii=False)
    logger.info(f"💾 Saved all bubble data to: {output_path}")

    # ===== بعد حفظ النتائج: اختيار ما بعد المعالجة بناءً على dont_Open_After_Clean =====
    ai_clean = bool(cfg.get("ai_clean", False))
    dont_open_after_clean = bool(cfg.get("dont_Open_After_Clean", False))  # ← false = run, true = skip

    python_cleaner = r"C:\Users\abdoh\Downloads\testScript\python\clean_text_regions_from_config.py"
    jsx_script = r"C:\Users\abdoh\Downloads\testScript\scripts\script.jsx"
    pspath = cfg.get(
        "pspath", r"C:\Program Files\Adobe\Adobe Photoshop CC 2019\Photoshop.exe"
    )

    try:
        if dont_open_after_clean:
            logger.info("⏭️ dont_Open_After_Clean=True → Skipping all post-processing scripts.")
        else:
            if ai_clean:
                logger.info("🧠 ai_clean=True → Running Python cleaner script...")
                if not os.path.exists(python_cleaner):
                    raise FileNotFoundError(f"Cleaner script not found: {python_cleaner}")
                subprocess.run([sys.executable, python_cleaner], check=True)
                logger.info("✅ Python cleaner executed successfully.")
            else:
                logger.info("🎨 ai_clean=False → Launching Photoshop JSX script...")
    except Exception as e:
        logger.error(f"❌ Post-processing step failed: {e}")


except Exception:
    logger.error(traceback.format_exc())
    success = False
finally:
    logger.info("=== 🏁 Finished detector script ===")
    if not success:
        time.sleep(2)
    os._exit(0)