# -*- coding: utf-8 -*-
"""
Speech-bubble detector (no-cut, aligned coords)
- Edge guard لمنع قصّ عند حدود الشرائح (مُعطّل عمليًا بالقيمة 0)
- NMS + دمج احتواء للصناديق المتجاورة + حذف الصغير داخل الكبير
- فصل توسعة الـOCR عن توسعة الباث (PATH_PAD_PX)
- توسيع الباث PATH_PAD_PX + محاولة fitEllipse/rect
- EasyOCR فقط
- بدون حفظ لوج في ملف خارجي (Console فقط)
"""

from ultralytics import YOLO
import os, sys, json, cv2, numpy as np
from PIL import Image
import subprocess, logging, time, traceback
from datetime import datetime
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

# =========================
# لوج للكونسول فقط
# =========================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger(__name__)
success = True

try:
    # =========================
    # قراءة الإعدادات والمسارات
    # =========================
    cfg_path = Path(r"C:\Users\abdoh\Downloads\testScript\config\temp-title.json")
    with cfg_path.open(encoding="utf-8") as f:
        cfg = json.load(f)
    if "title" not in cfg:
        raise KeyError("Config missing key: 'title'")

    folder = cfg["title"]
    base = Path(r"C:\Users\abdoh\Downloads") / folder
    image_folder = base
    output_path = base / "all_bubbles.json"

    pspath = Path(cfg.get("pspath", r"C:\Program Files\Adobe\Adobe Photoshop CC 2019\Photoshop.exe"))
    jsx_script = Path(r"C:\Users\abdoh\Downloads\testScript\scripts\script.jsx")

    model_path = Path(r"C:\Users\abdoh\Downloads\testScript\model") / cfg.get("model_filename", "comic-speech-bubble-detector.pt")
    if not model_path.exists():
        raise FileNotFoundError(f"Model not found: {model_path}")
    model = YOLO(str(model_path))

    # =========================
    # OCR → EasyOCR فقط
    # =========================
    import easyocr
    ocr_ja = easyocr.Reader(["en", "ja"], gpu=False)
    ocr_ko = easyocr.Reader(["en", "ko"], gpu=False)
    OCR_TYPE = "easy"
    logger.info("✅ Using EasyOCR only.")

    # =========================
    # إعدادات قابلة للتعديل (من الـ config)
    # =========================
    CONFIDENCE_THRESHOLD = float(cfg.get("conf_threshold", 0.18))
    NMS_IOU_THRESHOLD   = float(cfg.get("nms_iou_threshold", 0.55))
    SLICE_OVERLAP       = int(cfg.get("slice_overlap", 320))
    SLICE_HEIGHT        = int(cfg.get("slice_height", 3000))
    MIN_BUBBLE_AREA     = int(cfg.get("min_bubble_area", 1000))
    MIN_DIM_THRESHOLD   = int(cfg.get("min_dim_threshold", 60))
    YOLO_IMG_SIZE       = int(cfg.get("yolo_img_size", 896))
    OCR_MAX_WORKERS     = int(cfg.get("ocr_max_workers", 0))   # 0 = تسلسل
    EXPAND_FOR_OCR      = int(cfg.get("expand_for_ocr", 16))   # توسيع قبل OCR

    DEBUG_SAVE          = bool(cfg.get("debug_save", False))
    EDGE_GUARD          = int(cfg.get("edge_guard", 0))        # عدم حذف صناديق الحواف (نعتمد على التداخل + NMS)
    MERGE_CONTAINMENT   = float(cfg.get("merge_containment", 0.75))  # دمج أسهل للصناديق المحتواة

    # لتغطية الفقاعة بالكامل
    PATH_PAD_PX       = int(cfg.get("path_pad_px", 4))         # توسيع الباث قبل التصدير
    FIT_ELLIPSE_TRY   = bool(cfg.get("fit_ellipse_try", True)) # جرّب fitEllipse من الأبيض
    ELLIPSE_POINTS    = int(cfg.get("ellipse_points", 64))     # نقاط الباث للإهليلج

    DEBUG_DIR = base / "debug"
    if DEBUG_SAVE:
        DEBUG_DIR.mkdir(parents=True, exist_ok=True)

    # =========================
    # دوال مساعدة
    # =========================
    def preprocess_image(img: np.ndarray) -> np.ndarray:
        """تحسين تباين الصورة (يتعامل مع BGR/Gray/Alpha بأمان)."""
        if img is None or img.size == 0:
            raise ValueError("preprocess_image: empty image")

        if len(img.shape) == 2:
            img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        elif img.shape[2] == 4:
            img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)

        if img.dtype != np.uint8:
            img = cv2.normalize(img, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)

        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        h, s, v = cv2.split(hsv)
        v = cv2.equalizeHist(v)
        s = cv2.createCLAHE(clipLimit=4.0, tileGridSize=(8, 8)).apply(s)
        hsv_enhanced = cv2.cvtColor(cv2.merge([h, s, v]), cv2.COLOR_HSV2BGR)

        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        l = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(l)
        enhanced_lab = cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)

        return cv2.addWeighted(enhanced_lab, 0.6, hsv_enhanced, 0.4, 0)

    def smart_slice_image(image: np.ndarray, target_h: int, overlap: int, delta: int = 200):
        """تقطيع ذكي باختيار خط قطع منخفض الحواف (Sobel) مع تداخل ثابت."""
        h, w = image.shape[:2]
        slices, y_start = [], 0
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        sobel = np.abs(cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3))
        while y_start < h:
            y_cut = min(y_start + target_h, h)
            if y_cut == h:
                slices.append((image[y_start:h, :].copy(), y_start)); break
            best_cut, best_score = y_cut, float("inf")
            y_min = max(y_start + overlap + 1, y_cut - delta)
            y_max = min(h - 1, y_cut + delta)
            for yc in range(y_min, y_max + 1):
                cost = float(np.sum(sobel[yc:yc+1, :]))
                if cost < best_score: best_score, best_cut = cost, yc
            slices.append((image[y_start:best_cut, :].copy(), y_start))
            y_start = best_cut - overlap
        return slices

    def box_iou(b1, b2) -> float:
        x1, y1, x2, y2 = b1; X1, Y1, X2, Y2 = b2
        ix1, iy1, ix2, iy2 = max(x1, X1), max(y1, Y1), min(x2, X2), min(y2, Y2)
        iw, ih = max(0.0, ix2 - ix1), max(0.0, iy2 - iy1)
        inter = iw * ih
        a1 = max(0.0, x2 - x1) * max(0.0, y2 - y1)
        a2 = max(0.0, X2 - X1) * max(0.0, Y2 - Y1)
        u = a1 + a2 - inter
        return inter / u if u > 0 else 0.0

    def nms_numpy(boxes: np.ndarray, scores: np.ndarray, iou_thr: float) -> list:
        if boxes.size == 0: return []
        idxs = scores.argsort()[::-1]
        keep = []
        while idxs.size > 0:
            i = idxs[0]; keep.append(i)
            if idxs.size == 1: break
            rest = idxs[1:]
            ious = np.array([box_iou(boxes[i], boxes[j]) for j in rest])
            idxs = rest[ious <= iou_thr]
        return keep

    def expand_box(box, w_max, h_max, pad=0):
        x1, y1, x2, y2 = map(int, box)
        if pad <= 0: return [x1, y1, x2, y2]
        return [max(0, x1 - pad), max(0, y1 - pad), min(w_max, x2 + pad), min(h_max, y2 + pad)]

    def ellipse_from_white(image_bgr, box, points_n=64):
        """إرجاع نقاط إهليلج يغطي أكبر مساحة بيضاء داخل الصندوق؛ أو None."""
        x1, y1, x2, y2 = map(int, box)
        crop = image_bgr[y1:y2, x1:x2]
        if crop.size == 0:
            return None
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        thr = cv2.threshold(gray, 220, 255, cv2.THRESH_BINARY)[1]
        thr = cv2.morphologyEx(thr, cv2.MORPH_CLOSE, np.ones((3,3), np.uint8), iterations=1)
        cnts = cv2.findContours(thr, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cnts = cnts[0] if len(cnts) == 2 else cnts[1]
        if not cnts:
            return None
        cnt = max(cnts, key=cv2.contourArea)
        if len(cnt) < 5:
            return None
        ellipse = cv2.fitEllipse(cnt)  # ((cx,cy),(w,h),angle)
        (cx, cy), (ew, eh), ang = ellipse
        ang = np.deg2rad(ang)
        pts = []
        for k in range(points_n):
            t = (k / points_n) * 2 * np.pi
            px = cx + (ew/2.0)*np.cos(t)*np.cos(ang) - (eh/2.0)*np.sin(t)*np.sin(ang)
            py = cy + (ew/2.0)*np.cos(t)*np.sin(ang) + (eh/2.0)*np.sin(t)*np.cos(ang)
            pts.append([int(px) + x1, int(py) + y1])
        return pts

    def has_text(image: np.ndarray, box, backend: str) -> bool:
        x1, y1, x2, y2 = map(int, box)
        h_img, w_img = image.shape[:2]
        # توسعة OCR فقط
        x1e, y1e, x2e, y2e = expand_box([x1, y1, x2, y2], w_img, h_img, pad=EXPAND_FOR_OCR)
        crop = image[y1e:y2e, x1e:x2e]
        if crop.size == 0 or (x2e - x1e) <= 1 or (y2e - y1e) <= 1:
            return False
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        # تعزيز تباين بسيط يساعد مع النص الأسود على الرمادي
        gray = cv2.convertScaleAbs(gray, alpha=1.4, beta=10)
        # EasyOCR فقط
        return bool(ocr_ja.readtext(gray, detail=0) or ocr_ko.readtext(gray, detail=0))

    def get_box_center(b):
        x1, y1, x2, y2 = b
        return (x1 + x2) / 2.0, (y1 + y2) / 2.0

    # =========================
    # معالجة الصور
    # =========================
    image_files = sorted([f for f in os.listdir(image_folder) if f.lower().endswith((".png", ".jpg", ".jpeg"))])
    logger.info(f"🔍 Found {len(image_files)} images in {image_folder}")
    all_bubbles = {}

    for idx, img_file in enumerate(image_files, start=1):
        t0 = time.time()
        img_path = image_folder / img_file
        image = cv2.imread(str(img_path))
        if image is None:
            logger.warning(f"⚠️ Can't read image: {img_path}")
            continue

        try:
            enhanced = preprocess_image(image)
        except Exception as e:
            logger.error(f"Preprocess failed for {img_path}: {e}")
            continue

        H, W = image.shape[:2]

        # تقطيع ذكي
        slices = smart_slice_image(enhanced, SLICE_HEIGHT, SLICE_OVERLAP, delta=200)

        # كشف (لا نحذف عند الحواف لأن EDGE_GUARD=0)
        raw_boxes, raw_scores = [], []
        for sid, (slice_img, offset_y) in enumerate(slices):
            sh = slice_img.shape[0]
            results = model(slice_img, imgsz=YOLO_IMG_SIZE, conf=CONFIDENCE_THRESHOLD, verbose=False)
            for r in results:
                if r.boxes is None or r.boxes.xyxy is None: continue
                boxes_np = r.boxes.xyxy.cpu().numpy()
                scores_np = r.boxes.conf.cpu().numpy()
                for (x1, y1, x2, y2), sc in zip(boxes_np, scores_np):
                    y1f, y2f = y1 + offset_y, y2 + offset_y
                    raw_boxes.append([float(x1), float(y1f), float(x2), float(y2f)])
                    raw_scores.append(float(sc))

        key = f"{idx:02d}_mask"
        if not raw_boxes:
            all_bubbles[key] = []
            logger.info(f"ℹ️ {img_file}: no YOLO boxes.")
            continue

        boxes_arr = np.array(raw_boxes, dtype=np.float32)
        scores_arr = np.array(raw_scores, dtype=np.float32)

        # فلترة أولية (مساحة/أبعاد)
        keep = []
        for i, (x1, y1, x2, y2) in enumerate(boxes_arr):
            w, h = (x2 - x1), (y2 - y1)
            if w <= 0 or h <= 0: continue
            if (w * h) < MIN_BUBBLE_AREA: continue
            if min(w, h) < MIN_DIM_THRESHOLD: continue
            keep.append(i)
        if not keep:
            all_bubbles[key] = []
            logger.info(f"ℹ️ {img_file}: filtered by size.")
            continue
        boxes_arr, scores_arr = boxes_arr[keep], scores_arr[keep]

        # NMS
        keep_idx = nms_numpy(boxes_arr, scores_arr, NMS_IOU_THRESHOLD)
        boxes_arr, scores_arr = boxes_arr[keep_idx], scores_arr[keep_idx]

        # دمج احتواء
        def containment(a, b):
            ax1, ay1, ax2, ay2 = a; bx1, by1, bx2, by2 = b
            ix1, iy1, ix2, iy2 = max(ax1, bx1), max(ay1, by1), min(ax2, bx2), min(ay2, by2)
            inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
            area_a = max(0, ax2 - ax1) * max(0, ay2 - ay1)
            return (inter / area_a) if area_a > 0 else 0.0

        used = np.zeros(len(boxes_arr), dtype=bool)
        merged_boxes, merged_scores = [], []
        for i in range(len(boxes_arr)):
            if used[i]: continue
            bi, si = boxes_arr[i].copy(), scores_arr[i]
            for j in range(i + 1, len(boxes_arr)):
                if used[j]: continue
                bj = boxes_arr[j]
                if containment(bi, bj) >= MERGE_CONTAINMENT or containment(bj, bi) >= MERGE_CONTAINMENT:
                    x1 = min(bi[0], bj[0]); y1 = min(bi[1], bj[1])
                    x2 = max(bi[2], bj[2]); y2 = max(bi[3], bj[3])
                    bi = np.array([x1, y1, x2, y2], dtype=np.float32)
                    si = max(si, scores_arr[j]); used[j] = True
            merged_boxes.append(bi); merged_scores.append(si); used[i] = True

        # حذف أي صندوق محتوى بالكامل تقريبًا داخل صندوق آخر (>90%)
        filtered_boxes, filtered_scores = [], []
        for i, a in enumerate(merged_boxes):
            keep_it = True
            for j, b in enumerate(merged_boxes):
                if i == j: continue
                if containment(a, b) > 0.90:   # a داخل b
                    keep_it = False
                    break
            if keep_it:
                filtered_boxes.append(a)
                filtered_scores.append(merged_scores[i])

        boxes_nms  = np.array(filtered_boxes, dtype=np.float32)
        scores_nms = np.array(filtered_scores, dtype=np.float32)

        # OCR + بناء الباث
        valid_bubbles = []

        def ocr_job(i):
            b = boxes_nms[i].tolist()

            # أولاً: توسعة خاصة بالـOCR فقط علشان قرار وجود نص
            b_ocr = expand_box(b, W, H, pad=EXPAND_FOR_OCR)
            if not has_text(image, b_ocr, OCR_TYPE):
                return None

            # ثانيًا: نجهّز الباث النهائي (توسعة PATH_PAD_PX فقط للشكل)
            b_for_path = expand_box(b_ocr, W, H, pad=PATH_PAD_PX)
            cx, cy = get_box_center(b_for_path)

            poly = None
            if FIT_ELLIPSE_TRY:
                poly = ellipse_from_white(image, b_for_path, points_n=ELLIPSE_POINTS)
            if poly is None:
                poly = [
                    [int(b_for_path[0]), int(b_for_path[1])],
                    [int(b_for_path[2]), int(b_for_path[1])],
                    [int(b_for_path[2]), int(b_for_path[3])],
                    [int(b_for_path[0]), int(b_for_path[3])],
                ]

            return {
                "box": [int(b_ocr[0]), int(b_ocr[1]), int(b_ocr[2]), int(b_ocr[3])],
                "center": [float(cx), float(cy)],
                "score": float(scores_nms[i]),
                "points": poly
            }

        if OCR_MAX_WORKERS > 0:
            with ThreadPoolExecutor(max_workers=OCR_MAX_WORKERS) as ex:
                for fut in as_completed([ex.submit(ocr_job, i) for i in range(len(boxes_nms))]):
                    r = fut.result()
                    if r is not None: valid_bubbles.append(r)
        else:
            for i in range(len(boxes_nms)):
                r = ocr_job(i)
                if r is not None: valid_bubbles.append(r)

        # ترتيب القراءة
        valid_bubbles.sort(key=lambda b: (b["center"][1], b["center"][0]))

        if DEBUG_SAVE:
            dbg = image.copy()
            for vb in valid_bubbles:
                x1, y1, x2, y2 = vb["box"]
                cv2.rectangle(dbg, (x1, y1), (x2, y2), (0, 255, 0), 2)
                for p in vb["points"]:
                    cv2.circle(dbg, (int(p[0]), int(p[1])), 1, (0, 0, 255), -1)
            cv2.imwrite(str(DEBUG_DIR / f"{idx:02d}_debug.jpg"), dbg)

        all_bubbles[key] = [{"id": i + 1, **vb} for i, vb in enumerate(valid_bubbles)]
        logger.info(f"✅ {img_file}: {len(valid_bubbles)} bubbles. (time {time.time() - t0:.2f}s)")

    # =========================
    # حفظ النتيجة
    # =========================
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(all_bubbles, f, indent=2, ensure_ascii=False)
    logger.info(f"💾 Saved: {output_path}")

    # =========================
    # تشغيل Photoshop (اختياري)
    # =========================
    if bool(cfg.get("openAfterClean", True)):
        try:
            if not pspath.exists(): raise FileNotFoundError(f"Photoshop not found: {pspath}")
            if not jsx_script.exists(): raise FileNotFoundError(f"JSX not found: {jsx_script}")
            logger.info("🚀 Launching Photoshop…")
            subprocess.run(f'"{pspath}" -r "{jsx_script}"', shell=True, check=True)
            logger.info("✅ Photoshop script executed.")
        except Exception as e:
            logger.error(f"❌ Photoshop error: {e}")
    else:
        logger.info("⏭️ Skipped Photoshop (openAfterClean=False).")

except Exception:
    logger.error(traceback.format_exc())
    success = False
finally:
    logger.info("=== 🏁 Finished detector script ===")
    if not success: time.sleep(2)
    sys.exit(0 if success else 1)
