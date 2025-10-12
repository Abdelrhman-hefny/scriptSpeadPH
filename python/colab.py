import os, re, subprocess, shutil
from google.colab import drive, files
drive.mount('/content/drive')

# = 1. تثبيت المكتبات لو مش موجودة =
try:
    import gdown
except ImportError:
    print("⚡ تثبيت gdown ...")
    !pip install -q gdown
    import gdown

try:
    import pcleaner
except ImportError:
    print("⚡ تثبيت pcleaner ...")
    !pip install -q pcleaner
    import pcleaner

# تثبيت المكتبات الإضافية للكشف عن الفقاعات
print("⚡ تثبيت ultralytics (YOLO) ...")
!pip install -q ultralytics
from ultralytics import YOLO

print("⚡ تثبيت manga-ocr ...")
!pip install -q manga-ocr
try:
    from manga_ocr import MangaOcr
except ImportError:
    print("⚠️ MangaOcr failed, falling back to easyocr")

print("⚡ تثبيت easyocr ...")
!pip install -q easyocr
import easyocr

import json
import cv2
import numpy as np
from PIL import Image
import logging
import time
from datetime import datetime
import traceback

# = 2. ربط Google Drive =
drive.mount('/content/drive', force_remount=True)

# = 3. إدخال اسم الفولدر + رابط فولدر Google Drive =
drive_link = "https://drive.google.com/drive/folders/1D0O52M0B0jW1q8lVwj4-bag1sFrGGIxE"
folder_name = "21_seren_shes"

# = 4. استخراج ID الفولدر =
match = re.search(r'/folders/([a-zA-Z0-9_-]+)', drive_link)
if not match:
    raise ValueError("❌ رابط غير صحيح")
folder_id = match.group(1)

# = 5. مسار التحميل =
final_path = f"/content/{folder_name}"
os.makedirs(final_path, exist_ok=True)

print("⬇️ جاري تحميل الملفات ...")
gdown.download_folder(id=folder_id, output=final_path, quiet=False)
print(f"📂 تم تحميل الملفات في: {final_path}")

# ===== إعداد اللوج للكشف =====
log_file = os.path.join(final_path, f"detector_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.FileHandler(log_file, encoding="utf-8"), logging.StreamHandler()],
)
logger = logging.getLogger(__name__)

success = True

try:
    # ===== المسارات للكشف (معدلة لـ Colab) =====
    # نفترض أن config موجود في المجلد المحمل أو نعرفه هنا
    # إذا كان temp-title.json موجود في final_path، استخدمه؛ وإلا حدد قيم افتراضية
    cfg_path = os.path.join(final_path, "temp-title.json")
    if os.path.exists(cfg_path):
        with open(cfg_path, encoding="utf-8") as f:
            cfg = json.load(f)
    else:
        cfg = {
            "title": folder_name,
            "mangaType": "japan",  # افتراضي
            "ocr_model": "easy",  # افتراضي
            "openAfterClean": True  # افتراضي
        }
        logger.warning("⚠️ Config file not found, using default values.")

    image_folder = final_path
    output_path = os.path.join(final_path, "all_bubbles.json")  # حفظ في المجلد الرئيسي بدلاً من cleaned

    # Photoshop غير متوفر في Colab، لذا سنتجاهل هذا الجزء أو نعلق عليه
    # pspath و jsx_script غير مدعومين هنا، سنتخطاهم

    # تحميل موديل YOLO: نفترض أنه موجود في Drive أو نحمله من URL إذا لزم
    MODEL_FILENAME = "comic-speech-bubble-detector.pt"
    model_path = "/content/drive/MyDrive/model/comic-speech-bubble-detector.pt"  # مسار الموديل داخل درايف

    if not os.path.exists(model_path):
        # إذا لم يكن موجود، يمكن تحميله من URL إذا كان معروفاً، وإلا خطأ
        raise FileNotFoundError(f"❌ Model file not found: {model_path}")
    model = YOLO(model_path)

    # ===== OCR =====
    ocr_model = cfg.get("ocr_model", "easy")
    if ocr_model == "manga":
        try:
            ocr = MangaOcr()
            OCR_TYPE = "manga"
            logger.info("✅ Using MangaOCR for text validation.")
        except ImportError:
            ocr_model = "easy"
    if ocr_model == "easy":
        OCR_TYPE = "easy"
        logger.warning("⚠️ Using EasyOCR.")
        lang = "korean" if cfg["mangaType"] in ["korian", "korean"] else "japan"
        langs = ["en", "ja"] if lang == "japan" else ["en", "ko"]
        reader = easyocr.Reader(langs, gpu=False)
        logger.info(f"✅ Using EasyOCR with langs={langs}.")

    # ===== إعدادات الكشف =====
    CONFIDENCE_THRESHOLD = 0.04
    IOU_THRESHOLD = 0.5
    SLICE_OVERLAP = 300
    SLICE_HEIGHT = 4000
    MIN_BUBBLE_AREA = 2000
    CONTAINMENT_THRESHOLD = 0.95
    MIN_DIM_THRESHOLD = 100
    YOLO_IMG_SIZE = 672

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
        return (inter_area / area_small) >= CONTAINMENT_THRESHOLD if area_small > 0 else False

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
                if box_iou(box, fb) > IOU_THRESHOLD:
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
        if OCR_TYPE == "manga":
            text = ocr(Image.fromarray(gray))
            return bool(text.strip())
        elif OCR_TYPE == "easy":
            return bool(reader.readtext(gray, detail=0))
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

        slices = smart_slice_image(enhanced, SLICE_HEIGHT, SLICE_OVERLAP, delta=200)
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
        for i, box in enumerate(merged_boxes):
            area = (box[2] - box[0]) * (box[3] - box[1])
            width = box[2] - box[0]
            height = box[3] - box[1]
            if area < MIN_BUBBLE_AREA or min(width, height) < MIN_DIM_THRESHOLD:
                continue
            contained = any(is_contained(box, other_box) for other_box in merged_boxes if other_box != box)
            if contained:
                continue
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

    # ===== Photoshop جزء: غير مدعوم في Colab، لذا نتجاهله =====
    logger.info("⚠️ Photoshop integration skipped in Colab environment.")

except Exception:
    logger.error(traceback.format_exc())
    success = False
finally:
    logger.info("=== 🏁 Finished bubble detection ===")
    if not success:
        time.sleep(2)

# = 6. تحميل الموديلات على GPU =
print("⚡ تحميل الموديلات مع CUDA ...")
subprocess.run(['pcleaner', 'load', 'models', '--cuda'])

# = 7. إنشاء profile لتفعيل inpainting =
print("⚙️ إعداد profile inpaint_profile ...")
profile_name = "inpaint_profile"
subprocess.run(['pcleaner', 'profile', 'new', profile_name])

# تعديل ملف الـ profile لتمكين inpainting
profile_path = os.path.expanduser(f"~/.config/pcleaner/profiles/{profile_name}.ini")
if os.path.exists(profile_path):
    with open(profile_path, "r") as f:
        content = f.read()
    if "enable_inpainting" not in content:
        content += "\nenable_inpainting = true\n"
    else:
        content = re.sub(r"enable_inpainting\s*=\s*false", "enable_inpainting = true", content)
    with open(profile_path, "w") as f:
        f.write(content)
    print("✅ تم تفعيل inpainting في profile")

# = 8. تشغيل pcleaner مع inpaint_profile =
print("🧹 جاري تنظيف الصور مع إعادة رسم الخلفية ...")
process = subprocess.Popen(
    ['pcleaner', 'clean', final_path, '--output_dir', os.path.join(final_path, "cleaned"), '--profile', profile_name],
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
    bufsize=1
)
for line in process.stdout:
    print(line, end="")
process.wait()

# = 9. نقل مجلد cleaned جوه الفولدر =
cleaned_path = os.path.join(final_path, "cleaned")
if not os.path.exists(cleaned_path):
    print("⚠️ مجلد cleaned غير موجود، احتمال التنظيف فشل")
else:
    print(f"✅ الصور المنضفة موجودة في: {cleaned_path}")

# = 10. ضغط الفولدر بالكامل باسم المستخدم =
zip_file = f"{folder_name}.zip"
print(f"📦 جاري ضغط الصور ومجلد cleaned فقط في {zip_file} ...")

# جمع العناصر اللي هنضغطها
items_to_zip = []

for item in os.listdir(final_path):
    item_path = os.path.join(final_path, item)
    # ضغط مجلد cleaned بالكامل
    if item == "cleaned":
        items_to_zip.append(item)
    # ضغط أي صور مباشرة في final_path
    elif os.path.isfile(item_path) and item.lower().endswith(('.png', '.jpg', '.jpeg')):
        items_to_zip.append(item)
    # إضافة ملف JSON إذا موجود
    if item == "all_bubbles.json":
        items_to_zip.append(item)

# تنفيذ ضغط الملفات
subprocess.run(['zip', '-r', zip_file] + items_to_zip, cwd=final_path)

# المسار الكامل للملف بعد إنشائه داخل المجلد
zip_full_path = os.path.join(final_path, zip_file)

print("⬇️ جاري تجهيز الملف للتحميل ...")
files.download(zip_full_path)

print("✅ انتهت العملية بنجاح")