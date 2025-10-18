# file: C:\Users\abdoh\Downloads\testScript\detector_cpu_ko_fast.py
from ultralytics import YOLO
import os
import json
import cv2
import numpy as np
from PIL import Image
import subprocess
import time
from datetime import datetime
import traceback
import math
import gc
import sys

# شريط التقدّم الخفيف
try:
    from tqdm import tqdm
except ImportError:
    def tqdm(x, **kwargs):  # fallback صامت إذا لم تتوفر tqdm
        return x

# 🚨 استيراد torch للتحقق من وجود GPU بشكل آمن
try:
    import torch
except ImportError:
    pass  # سيتم التعامل مع عدم وجوده لاحقًا

# ===== (تم حذف إعداد اللوج كليًا) =====

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

    # ===== OCR (كوري فقط) =====
    ocr_model = "paddle"  # إجبار الكورية فقط
    ocr_device = "cpu"
    if 'torch' in locals() and 'torch' in globals() and torch.cuda.is_available():
        ocr_device = "gpu"

    OCR_TYPE = None
    try:
        from paddleocr import PaddleOCR
        ocr = PaddleOCR(use_textline_orientation=True, lang="korean", device=ocr_device)
        OCR_TYPE = "paddle"
    except Exception:
        try:
            import easyocr
            gpu_status = (ocr_device == "gpu")
            ocr_ko = easyocr.Reader(["ko"], gpu=gpu_status)  # كوري فقط
            OCR_TYPE = "easy"
        except Exception:
            OCR_TYPE = None  # بدون OCR عند عدم توفر المكتبات

    # ===== إعدادات الكشف =====
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

    # فلتر نسبة الأبعاد ضد الفقاعات الشريطية
    AR_MAX_WIDE = 6.0   # عرض/ارتفاع كبير جدًا
    AR_MAX_TALL = 6.0   # ارتفاع/عرض كبير جدًا
    RIBBON_H_FRAC = 0.035  # أقصى ارتفاع للشريط كجزء من ارتفاع الصفحة
    RIBBON_W_FRAC = 0.035  # أقصى عرض للشريط العمودي

    # ===== دوال مساعدة =====
    def preprocess_image(img):
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe_l = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        l = clahe_l.apply(l)
        lab_enhanced = cv2.merge([l, a, b])
        enhanced_lab = cv2.cvtColor(lab_enhanced, cv2.COLOR_LAB2BGR)

        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        h, s, v = cv2.split(hsv)
        v = cv2.equalizeHist(v)
        clahe_s = cv2.createCLAHE(clipLimit=4.0, tileGridSize=(8, 8))
        s = clahe_s.apply(s)
        hsv_enhanced = cv2.merge([h, s, v])
        enhanced_hsv = cv2.cvtColor(hsv_enhanced, cv2.COLOR_HSV2BGR)

        hsl = cv2.cvtColor(img, cv2.COLOR_BGR2HLS)
        H, L, S = cv2.split(hsl)
        L = cv2.equalizeHist(L)
        hsl_enhanced = cv2.merge([H, L, S])
        enhanced_hsl = cv2.cvtColor(hsl_enhanced, cv2.COLOR_HLS2BGR)

        final = cv2.addWeighted(enhanced_lab, 0.5, enhanced_hsv, 0.3, 0)
        final = cv2.addWeighted(final, 0.8, enhanced_hsl, 0.2, 0)

        gray = cv2.cvtColor(final, cv2.COLOR_BGR2GRAY)
        final_bgr = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
        final = cv2.addWeighted(final, 0.8, final_bgr, 0.2, 0)
        return final

    def smart_slice_image(image, target_h, overlap, delta=200):
        """تقطيع بارتفاع ثابت لتسريع العملية."""
        h, w = image.shape[:2]
        if h <= target_h:
            return [(image.copy(), 0)]
        slices = []
        step = max(1, target_h - overlap)
        for y in range(0, h, step):
            y_end = min(y + target_h, h)
            slices.append((image[y:y_end, :].copy(), y))
            if y_end == h:
                break
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
        return (inter_area / area_small) >= CONTAINMENT_THRESHOLD if area_small > 0 else False

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
                    x1 = min(boxes[i][0], fb[0]); y1 = min(boxes[i][1], fb[1])
                    x2 = max(boxes[i][2], fb[2]); y2 = max(boxes[i][3], fb[3])
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

    # --- تحميل ماسك خارجي من مجلد cleaned لكل صورة (01_mask.png, 02_mask.png, ...) ---
    def load_external_mask(cleaned_dir, idx, thr=10):
        mask_path = os.path.join(cleaned_dir, f"{idx:02d}_mask.png")
        m = cv2.imread(mask_path, cv2.IMREAD_UNCHANGED)
        if m is None:
            return None
        if m.ndim == 3 and m.shape[2] == 4:
            a = m[:, :, 3]
            return (a > thr).astype(np.uint8) * 255
        if m.ndim == 3:
            g = cv2.cvtColor(m, cv2.COLOR_BGR2GRAY)
            return (g < 250).astype(np.uint8) * 255
        if m.ndim == 2:
            return (m > thr).astype(np.uint8) * 255
        return None

    # --- استخراج صناديق من الماسك الخارجي مباشرةً (لتحسين الـ recall) ---
    def boxes_from_ext_mask(ext_mask, min_w, min_h, min_area):
        if ext_mask is None:
            return []
        cnts, _ = cv2.findContours((ext_mask > 0).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        out = []
        for c in cnts:
            x, y, w, h = cv2.boundingRect(c)
            if w < min_w or h < min_h or (w * h) < min_area:
                continue
            out.append([float(x), float(y), float(x + w), float(y + h)])
        return out

    # 🌟 has_text: طريقة خفيفة جدًا + استخدام ماسك cleaned للتأكيد
    def has_text(image, box, ext_mask=None):
        x1, y1, x2, y2 = map(int, box)
        crop = image[y1:y2, x1:x2]
        if crop.size == 0:
            return False

        # تأكيد سريع بالماسك الخارجي (لو موجود)
        if ext_mask is not None:
            m = ext_mask[y1:y2, x1:x2]
            if m.size > 0:
                overlap = float(cv2.countNonZero(m)) / float(m.size)
                if overlap > 0.01:  # ≥1%
                    return True

        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        _, thresh = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY_INV)
        h, w = thresh.shape[:2]
        center = thresh[int(h * 0.25):int(h * 0.75), int(w * 0.1):int(w * 0.9)]
        if center.size == 0:
            return False

        ink = float(np.count_nonzero(center)) / float(center.size)
        if ink >= 0.015:
            return True
        if ink < 0.005:
            return False

        bw = (center > 0).astype(np.uint8)
        row_changes = np.mean(np.sum(np.abs(np.diff(bw, axis=1)), axis=1)) / max(1, center.shape[1])
        col_changes = np.mean(np.sum(np.abs(np.diff(bw, axis=0)), axis=0)) / max(1, center.shape[0])
        return (row_changes > 0.06) and (col_changes > 0.04)

    def get_box_center(box):
        x1, y1, x2, y2 = box
        return (x1 + x2) / 2, (y1 + y2) / 2

    # ===== معالجة كل الصفحات (كما هي + tqdm للصور) =====
    image_files = sorted(
        [
            f
            for f in os.listdir(image_folder)
            if f.lower().endswith((".png", ".jpg", ".jpeg"))
        ]
    )

    all_bubbles = {}

    cleaned_dir = os.path.join(base, "cleaned")  # مجلد الماسكات الخارجية

    for idx, img_file in enumerate(tqdm(image_files, desc="Progress", unit="img"), start=1):
        img_path = os.path.join(image_folder, img_file)
        image = cv2.imread(img_path)
        if image is None:
            continue

        # حمل ماسك الصورة الحالية (إن وُجد)
        ext_mask = load_external_mask(cleaned_dir, idx)

        enhanced = preprocess_image(image)
        all_boxes, all_scores = [], []
        h, w = image.shape[:2]

        # عتبات ديناميكية تبعًا لحجم الصفحة
        MIN_W = max(MIN_DIM_THRESHOLD, int(0.02 * w))
        MIN_H = max(MIN_DIM_THRESHOLD, int(0.02 * h))
        MIN_AREA_REL = max(MIN_BUBBLE_AREA, int(0.0015 * (w * h)))

        # شرائح ثابتة
        slices = smart_slice_image(enhanced, SLICE_HEIGHT, SLICE_OVERLAP, delta=200)

        # YOLO
        for slice_img, offset_y in slices:
            results = model(
                slice_img, imgsz=YOLO_IMG_SIZE, conf=CONFIDENCE_THRESHOLD, iou=IOU_THRESHOLD, verbose=False
            )
            for r in results:
                xyxy = r.boxes.xyxy.cpu().numpy()
                confs = r.boxes.conf.cpu().numpy()
                if xyxy.size:
                    xyxy[:, 1] += offset_y
                    xyxy[:, 3] += offset_y
                    all_boxes.extend(xyxy.tolist())
                    all_scores.extend(confs.tolist())
            del slice_img

        # صناديق إضافية من ماسك cleaned لتحسين الـ recall
        ext_boxes = boxes_from_ext_mask(ext_mask, MIN_W, MIN_H, MIN_AREA_REL)
        if ext_boxes:
            all_boxes.extend(ext_boxes)
            all_scores.extend([0.99] * len(ext_boxes))  # سكور مرتفع لاعتبارها قوية

        # دمج وتنظيف
        merged_boxes, merged_scores = merge_and_clean_boxes(all_boxes, all_scores)

        valid_bubbles = []
        for (x1, y1, x2, y2) in merged_boxes:
            exp = BOX_EXPANSION_PIXELS
            x1e = max(0, int(x1 - exp)); y1e = max(0, int(y1 - exp))
            x2e = min(w, int(x2 + exp)); y2e = min(h, int(y2 + exp))

            width = x2e - x1e; height = y2e - y1e
            area = width * height
            if area <= 0:
                continue

            # فلتر الشريطيات (وهميات عريضة-قصيرة أو طويلة-نحيفة)
            ar = (width / max(1, height))
            if (ar > AR_MAX_WIDE and height <= int(RIBBON_H_FRAC * h)) or ((1.0 / ar) > AR_MAX_TALL and width <= int(RIBBON_W_FRAC * w)):
                continue

            # فلتر أبعاد/مساحة ديناميكي
            if width < MIN_W or height < MIN_H or area < MIN_AREA_REL:
                # الصغير جدًا لا يمر إلا لو تداخل ماسك كفاية + نص فعلي
                small_ok = False
                if ext_mask is not None:
                    sub = ext_mask[y1e:y2e, x1e:x2e]
                    if sub.size > 0:
                        overlap = float(cv2.countNonZero(sub)) / float(sub.size)
                        if overlap >= 0.01 and has_text(image, (x1e, y1e, x2e, y2e), ext_mask=ext_mask):
                            small_ok = True
                if not small_ok:
                    continue

            # تحقق نص نهائي (سريع) ويأخذ الماسك بالحسبان
            if has_text(image, (x1e, y1e, x2e, y2e), ext_mask=ext_mask):
                cx, cy = get_box_center((x1e, y1e, x2e, y2e))
                polygon = [
                    [int(x1e), int(y1e)],
                    [int(x2e), int(y1e)],
                    [int(x2e), int(y2e)],
                    [int(x1e), int(y2e)],
                ]
                valid_bubbles.append({"center_x": cx, "center_y": cy, "points": polygon})

        key = f"{idx:02d}_mask"
        all_bubbles[key] = [
            {"id": i + 1, "points": vb["points"]}
            for i, vb in enumerate(sorted(valid_bubbles, key=lambda b: (b["center_y"], b["center_x"])))
        ]

        del image, enhanced, all_boxes, all_scores, merged_boxes, merged_scores, ext_mask, ext_boxes
        gc.collect()

    # ===== حفظ النتيجة وتشغيل Photoshop (كما هي) =====
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_bubbles, f, indent=2, ensure_ascii=False)

    ai_clean = bool(cfg.get("ai_clean", False))
    dont_open_after_clean = bool(cfg.get("dont_Open_After_Clean", False))  # ← false = run, true = skip

    python_cleaner = r"C:\Users\abdoh\Downloads\testScript\python\clean_text_regions_from_config.py"
    jsx_script = r"C:\Users\abdoh\Downloads\testScript\scripts\script.jsx"
    pspath = cfg.get(
        "pspath", r"C:\Program Files\Adobe\Adobe Photoshop CC 2019\Photoshop.exe"
    )

    try:
        if dont_open_after_clean:
            pass
        else:
            if ai_clean:
                if os.path.exists(python_cleaner):
                    subprocess.run([sys.executable, python_cleaner], check=True)
            else:
                pass
    except Exception:
        pass

except Exception:
    success = False
finally:
    if not success:
        time.sleep(2)
    os._exit(0)


#يعمل 2