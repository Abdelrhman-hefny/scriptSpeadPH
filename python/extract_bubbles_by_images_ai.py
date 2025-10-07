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

# ===== إعداد اللوج =====
log_file = rf"C:\Users\abdoh\Downloads\testScript\log\detector_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.FileHandler(log_file, encoding="utf-8"), logging.StreamHandler()],
)
logger = logging.getLogger(__name__)

success = True

try:
    # ===== المسارات =====
    cfg_path = r"C:\Users\abdoh\Downloads\testScript\config\temp-title.json"
    with open(cfg_path, encoding="utf-8") as f:
        cfg = json.load(f)

    folder = cfg["title"]
    base = os.path.join(r"C:\Users\abdoh\Downloads", folder)
    image_folder = base
    output_path = os.path.join(base, "cleaned", "all_bubbles.json")

    pspath = cfg.get(
        "pspath", r"C:\Program Files\Adobe\Adobe Photoshop CC 2019\Photoshop.exe"
    )
    jsx_script = r"C:\Users\abdoh\Downloads\testScript\scripts\script.jsx"

    MODEL_FILENAME = "comic-speech-bubble-detector.pt"
    model_path = os.path.join(
        r"C:\Users\abdoh\Downloads\testScript\model", MODEL_FILENAME
    )
    model = YOLO(model_path)

    # ===== OCR =====
    ocr_model = cfg.get("ocr_model", "paddle")  # الافتراضي PaddleOCR
    if ocr_model == "paddle":
        try:
            from paddleocr import PaddleOCR

            lang = "korean" if cfg["mangaType"] in ["korian", "korean"] else "japan"
            ocr = PaddleOCR(use_textline_orientation=True, lang=lang, device="cpu")
            OCR_TYPE = "paddle"
            logger.info(f"✅ Using PaddleOCR with lang={lang}.")
        except (ImportError, ValueError) as e:
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
        ocr_ja = easyocr.Reader(["en", "ja"], gpu=False)
        ocr_ko = easyocr.Reader(["en", "ko"], gpu=False)

    # ===== إعدادات الكشف =====
    CONFIDENCE_THRESHOLD = 0.05
    IOU_THRESHOLD = 0.6
    SLICE_OVERLAP = 300
    SLICE_HEIGHT = 2500
    MIN_BUBBLE_AREA = 2000
    CONTAINMENT_THRESHOLD = 0.95
    MIN_DIM_THRESHOLD = 100
    YOLO_IMG_SIZE = 640

    # ===== دوال مساعدة =====
    def preprocess_image(img):
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        h, s, v = cv2.split(hsv)
        v = cv2.equalizeHist(v)
        clahe_s = cv2.createCLAHE(clipLimit=4.0, tileGridSize=(8, 8))
        s = clahe_s.apply(s)
        hsv_enhanced = cv2.merge([h, s, v])
        enhanced_hsv = cv2.cvtColor(hsv_enhanced, cv2.COLOR_HSV2BGR)

        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe_l = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l = clahe_l.apply(l)
        lab_enhanced = cv2.merge([l, a, b])
        enhanced_lab = cv2.cvtColor(lab_enhanced, cv2.COLOR_LAB2BGR)

        final = cv2.addWeighted(enhanced_lab, 0.6, enhanced_hsv, 0.4, 0)
        return final

    def slice_image(image, slice_height=SLICE_HEIGHT, overlap=SLICE_OVERLAP):
        h, w = image.shape[:2]
        slices = []
        y_start = 0
        while y_start < h:
            y_end = min(y_start + slice_height, h)
            if y_end == h and y_start < h - slice_height + overlap:
                y_start = max(0, h - slice_height)
                y_end = h
            slices.append((image[y_start:y_end, :].copy(), y_start))
            if y_end == h:
                break
            y_start += slice_height - overlap
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
        boxes = np.array(boxes_raw, dtype=np.float32)
        scores = np.array(scores_raw, dtype=np.float32)
        final_boxes, final_scores = [], []
        for i, box in enumerate(boxes):
            if scores[i] < CONFIDENCE_THRESHOLD:
                continue
            keep = True
            for fb in final_boxes:
                if box_iou(box, fb) > 0.5:
                    keep = False
                    break
            if keep:
                final_boxes.append(box.tolist())
                final_scores.append(scores[i])
        return final_boxes, final_scores

    def has_text(image, box):
        x1, y1, x2, y2 = map(int, box)
        crop = image[y1:y2, x1:x2]
        if crop.size == 0:
            return False
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        if OCR_TYPE == "paddle":
            result = ocr.ocr(gray, cls=True)
            if result and result[0]:
                text = " ".join([line[1][0] for line in result[0]])
                return bool(text.strip())
            return False
        elif OCR_TYPE == "manga":
            text = ocr(Image.fromarray(gray))
            return bool(text.strip())
        elif OCR_TYPE == "easy":
            if ocr_ja.readtext(gray, detail=0) or ocr_ko.readtext(gray, detail=0):
                return True
            return False

    def get_box_center(box):
        x1, y1, x2, y2 = box
        return (x1 + x2) / 2, (y1 + y2) / 2

    # ===== معالجة كل الصفحات =====
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
        h = image.shape[0]

        slices = slice_image(enhanced) if h > SLICE_HEIGHT else [(enhanced, 0)]
        for slice_img, offset_y in slices:
            results = model(
                slice_img, imgsz=YOLO_IMG_SIZE, conf=CONFIDENCE_THRESHOLD, verbose=False
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

        merged_boxes, merged_scores = merge_and_clean_boxes(all_boxes, all_scores)

        valid_bubbles = []
        for box in merged_boxes:
            if has_text(image, box):
                cx, cy = get_box_center(box)
                polygon = [
                    [int(box[0]), int(box[1])],
                    [int(box[2]), int(box[1])],
                    [int(box[2]), int(box[3])],
                    [int(box[0]), int(box[3])],
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

        logger.info(f"✅ {img_file}: {len(valid_bubbles)} valid bubbles found.")

    # ===== حفظ النتيجة =====
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_bubbles, f, indent=2, ensure_ascii=False)
    logger.info(f"💾 Saved all bubble data to: {output_path}")

    # ===== تشغيل Photoshop JSX بعد الانتهاء من كل الصفحات =====
    open_after_clean = cfg.get("openAfterClean", True)
    if not open_after_clean:
        try:
            logger.info("🚀 Launching Photoshop for text writing...")
            subprocess.run(f'"{pspath}" -r "{jsx_script}"', shell=True, check=True)
            logger.info("✅ Photoshop script executed successfully.")
        except Exception as e:
            logger.error(f"❌ Failed to run Photoshop JSX: {e}")
    else:
        logger.info("⏭️ Skipped running Photoshop JSX because openAfterClean is True.")

except Exception:
    logger.error(traceback.format_exc())
    success = False
finally:
    logger.info("=== 🏁 Finished detector script ===")
    if not success:
        time.sleep(2)
