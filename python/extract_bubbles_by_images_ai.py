from ultralytics import YOLO
import os
import json
import cv2
import numpy as np
import re # تم إعادة إضافة استيراد re
from PIL import Image

# محاولة استيراد MangaOCR، وإلا استخدام EasyOCR
try:
    from manga_ocr import MangaOcr
    USE_MANGA_OCR = True
    print("✅ Using MangaOCR for text validation (specialized for manga).")
except ImportError:
    import easyocr
    USE_MANGA_OCR = False
    print("⚠️ MangaOCR not found, falling back to EasyOCR. Install with: pip install manga-ocr")

# ==========================
# 🔹 إعداد المسارات والنموذج
# ==========================
MODEL_FILENAME = "comic-speech-bubble-detector.pt"
model_path = os.path.join("C:/Users/abdoh/Downloads/testScript/model", MODEL_FILENAME)
cfg_path = r"C:\Users\abdoh\Downloads\testScript\config\temp-title.json"
with open(cfg_path, encoding="utf-8") as f:
    cfg = json.load(f)

# المجلد الأساسي
folder = cfg["title"]
base = os.path.join(r"C:\Users\abdoh\Downloads", folder)

# المسارات المطلوبة
image_folder = base
output_path = os.path.join(base, "cleaned", "all_bubbles.json")

print(image_folder)
print(output_path)

# إعدادات الحساسية
CONFIDENCE_THRESHOLD = 0.05
IOU_THRESHOLD = 0.6
SLICE_OVERLAP = 300
SLICE_HEIGHT = 2500
MIN_BUBBLE_AREA = 2000
CONTAINMENT_THRESHOLD = 0.95
MIN_DIM_THRESHOLD = 100  # تصفية الفقاعات التي عرضها أو ارتفاعها أقل من 100 بكسل
# تم تثبيت YOLO_IMG_SIZE عند 640 كما في الكود الذي قدمته مؤخراً
YOLO_IMG_SIZE = 640 

# تحميل النموذج
try:
    model = YOLO(model_path)
    print(f"✅ تم تحميل النموذج: {MODEL_FILENAME}")
except Exception as e:
    print(f"❌ خطأ أثناء تحميل النموذج: {e}")
    exit()

# تحميل OCR (مع دعم منفصل لـ ja و ko)
if USE_MANGA_OCR:
    try:
        ocr = MangaOcr()
        print("✅ MangaOCR loaded successfully.")
    except Exception as e:
        print(f"⚠️ Failed to load MangaOCR: {e}. Falling back to EasyOCR.")
        USE_MANGA_OCR = False
        try:
            ocr_ja = easyocr.Reader(['en', 'ja'], gpu=True)
            ocr_ko = easyocr.Reader(['en', 'ko'], gpu=True)
            print("✅ EasyOCR loaded (GPU) for English, Japanese, and Korean.")
        except Exception as e:
            ocr_ja = easyocr.Reader(['en', 'ja'], gpu=False)
            ocr_ko = easyocr.Reader(['en', 'ko'], gpu=False)
            print(f"✅ EasyOCR loaded (CPU) for English, Japanese, and Korean: {e}")
else:
    try:
        ocr_ja = easyocr.Reader(['en', 'ja'], gpu=True)
        ocr_ko = easyocr.Reader(['en', 'ko'], gpu=True)
        print("✅ EasyOCR loaded (GPU) for English, Japanese, and Korean.")
    except Exception as e:
        ocr_ja = easyocr.Reader(['en', 'ja'], gpu=False)
        ocr_ko = easyocr.Reader(['en', 'ko'], gpu=False)
        print(f"✅ EasyOCR loaded (CPU) for English, Japanese, and Korean: {e}")

# ==========================
# 🔹 تحسين الصورة
# ==========================
def preprocess_image(img):
    """تحسين الصورة لزيادة وضوح الفقاعات."""
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

# ==========================
# 🔹 تقسيم الصورة الطويلة
# ==========================
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
        y_start += (slice_height - overlap)
    return slices

# ==========================
# 🔹 IOU لحساب التداخل
# ==========================
def box_iou(box1, box2):
    x1, y1, x2, y2 = box1
    X1, Y1, X2, Y2 = box2
    inter_x1 = max(x1, X1)
    inter_y1 = max(y1, Y1)
    inter_x2 = min(x2, X2)
    inter_y2 = min(y2, Y2)
    inter_area = max(0, inter_x2 - inter_x1) * max(0, inter_y2 - inter_y1)
    area1 = max(0, (x2 - x1)) * max(0, (y2 - y1))
    area2 = max(0, (X2 - X1)) * max(0, (Y2 - Y1))
    union = area1 + area2 - inter_area
    return inter_area / union if union > 0 else 0

# ==========================
# 🔹 فحص التضمين (لإزالة الفقاعات الداخلية)
# ==========================
def is_contained(box_small, box_large):
    x1_s, y1_s, x2_s, y2_s = box_small
    x1_l, y1_l, x2_l, y2_l = box_large
    area_small = max(0, (x2_s - x1_s)) * max(0, (y2_s - y1_s))
    inter_x1 = max(x1_s, x1_l)
    inter_y1 = max(y1_s, y1_l)
    inter_x2 = min(x2_s, x2_l)
    inter_y2 = min(y2_s, y2_l)
    inter_area = max(0, inter_x2 - inter_x1) * max(0, inter_y2 - inter_y1)
    return inter_area / area_small >= CONTAINMENT_THRESHOLD if area_small > 0 else False

# ==========================
# 🔹 دمج وتنظيف المربعات (مع تفضيل الأكبر)
# ==========================
def merge_and_clean_boxes(boxes_raw, scores_raw, merge_iou_thresh=IOU_THRESHOLD):
    if not boxes_raw:
        return [], []
    boxes = np.array(boxes_raw, dtype=np.float32)
    scores = np.array(scores_raw, dtype=np.float32)
    areas = [(x2 - x1) * (y2 - y1) for x1, y1, x2, y2 in boxes]
    indices = np.argsort(-np.array(areas))  # الترتيب حسب المساحة (تنازلي)
    boxes = boxes[indices]
    scores = scores[indices]
    merged_boxes = []
    merged_scores = []
    processed = set()

    for i in range(len(boxes)):
        if i in processed:
            continue
        
        current_box = boxes[i]
        current_score = scores[i]
        
        # 🌟 منطق تفضيل الأكبر في الدمج
        # إذا كانت الفقاعة الحالية (الأكبر) متداخلة مع فقاعات أصغر، سنحتفظ بالأكبر ونقوم بدمج إحداثياتهم
        overlaps_indices = [i]
        for j in range(i + 1, len(boxes)):
            if j in processed:
                continue
            
            other_box = boxes[j]
            iou = box_iou(current_box, other_box)
            
            # إذا كان التداخل عاليًا أو كانت الفقاعة الأصغر محتواة في الأكبر
            if iou > merge_iou_thresh or is_contained(other_box, current_box):
                overlaps_indices.append(j)
        
        # دمج جميع الفقاعات المتداخلة مع الأكبر في مربع واحد (هو أسلوبك الأصلي وهو جيد)
        all_overlapping_boxes = boxes[overlaps_indices]
        x1_min = np.min(all_overlapping_boxes[:, 0])
        y1_min = np.min(all_overlapping_boxes[:, 1])
        x2_max = np.max(all_overlapping_boxes[:, 2])
        y2_max = np.max(all_overlapping_boxes[:, 3])
        w_box = x2_max - x1_min
        h_box = y2_max - y1_min
        
        if w_box >= MIN_DIM_THRESHOLD and h_box >= MIN_DIM_THRESHOLD and (w_box * h_box) >= MIN_BUBBLE_AREA:
            merged_boxes.append([x1_min, y1_min, x2_max, y2_max])
            merged_scores.append(np.max(scores[overlaps_indices])) # الاحتفاظ بأعلى نتيجة
        
        # تحديد جميع الفقاعات التي تم دمجها كمعالجة
        for idx in overlaps_indices:
            processed.add(idx)

    final_boxes = []
    final_scores = []
    suppressed = np.zeros(len(merged_boxes), dtype=bool)
    
    # هذه مرحلة NMS نهائية لإزالة التداخلات المتبقية (أقل من IOU_THRESHOLD)
    for i in range(len(merged_boxes)):
        if suppressed[i]:
            continue
        final_boxes.append(merged_boxes[i])
        final_scores.append(merged_scores[i])
        for j in range(i + 1, len(merged_boxes)):
            if suppressed[j]:
                continue
            # يتم إلغاء الفقاعة (j) إذا كانت متداخلة مع (i) بمقدار > 0.15 أو محتواة فيها
            if box_iou(merged_boxes[i], merged_boxes[j]) > 0.15 or is_contained(merged_boxes[j], merged_boxes[i]):
                suppressed[j] = True
    
    return final_boxes, final_scores

# ==========================
# 🔹 التحقق من وجود نص فقط
# ==========================
def has_text(image, box, ocr_ja, ocr_ko):
    # تم تغيير الدالة للبحث عن أي نص بدلاً من النص المعنوي الطويل، بناءً على الكود الذي قدمته في هذا الطلب
    x1, y1, x2, y2 = map(int, box)
    x1, y1 = max(0, x1-5), max(0, y1-5)
    x2, y2 = min(image.shape[1], x2+5), min(image.shape[0], y2+5)
    if x2 <= x1 or y2 <= y1:
        return False

    crop = image[y1:y2, x1:x2]
    if crop.size == 0:
        return False

    gray_crop = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    clahe_crop = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(4,4))
    processed_crop = clahe_crop.apply(gray_crop)

    try:
        if USE_MANGA_OCR:
            pil_image = Image.fromarray(processed_crop)
            text = ocr(pil_image)
            return bool(text)  # إرجاع True إذا وُجد أي نص
        else:
            # فحص بـ ocr_ja (en, ja)
            results = ocr_ja.readtext(processed_crop, detail=0)
            if results:  # إرجاع True إذا وُجد أي نص
                return True
            # فحص بـ ocr_ko (en, ko)
            results = ocr_ko.readtext(processed_crop, detail=0)
            return bool(results)  # إرجاع True إذا وُجد أي نص
    except Exception as e:
        # print(f"⚠️ OCR failed for box [{x1}, {y1}, {x2}, {y2}]: {e}") # إلغاء التعليق إذا لزم الأمر
        return False

# ==========================
# 🔹 دالة مساعدة لحساب مركز المربع
# ==========================
def get_box_center(box):
    x1, y1, x2, y2 = box
    return (x1 + x2) / 2.0, (y1 + y2) / 2.0

# ==========================
# 🔹 المعالجة الرئيسية
# ==========================
all_bubbles = {}

if not os.path.exists(image_folder):
    print(f"❌ لم يتم العثور على مجلد الصور: {image_folder}")
    exit()

image_files = sorted([f for f in os.listdir(image_folder) if f.lower().endswith((".jpg", ".png", ".jpeg"))])

for idx, img_file in enumerate(image_files, start=1):
    img_path = os.path.join(image_folder, img_file)
    image = cv2.imread(img_path)
    if image is None:
        print(f"⚠️ فشل قراءة الصورة: {img_path}")
        continue

    enhanced_img = preprocess_image(image)
    h, w, _ = image.shape
    all_boxes = []
    all_scores = []

    slices = slice_image(enhanced_img) if h > SLICE_HEIGHT else [(enhanced_img, 0)]
    for slice_img, offset_y in slices:
        results = model(slice_img, imgsz=YOLO_IMG_SIZE, conf=CONFIDENCE_THRESHOLD, iou=IOU_THRESHOLD, verbose=False)
        for r in results:
            if r.boxes:
                boxes = r.boxes.xyxy.cpu().numpy()
                scores = r.boxes.conf.cpu().numpy()
                for box, score in zip(boxes, scores):
                    if score < CONFIDENCE_THRESHOLD:
                        continue
                    x1, y1, x2, y2 = box.tolist()
                    y1 += offset_y
                    y2 += offset_y
                    w_box = x2 - x1
                    h_box = y2 - y1
                    area = w_box * h_box
                    if area < MIN_BUBBLE_AREA or w_box < MIN_DIM_THRESHOLD or h_box < MIN_DIM_THRESHOLD:
                        continue
                    all_boxes.append([x1, y1, x2, y2])
                    all_scores.append(score)

    # 🌟 تم تطبيق منطق تفضيل الفقاعة الأكبر داخل هذه الدالة
    clean_boxes, clean_scores = merge_and_clean_boxes(all_boxes, all_scores, merge_iou_thresh=IOU_THRESHOLD)

    valid_bubbles_with_centers = []
    for box in clean_boxes:
        if USE_MANGA_OCR:
            if has_text(image, box, ocr, ocr):
                cx, cy = get_box_center(box)
                polygon = [[box[0], box[1]], [box[2], box[1]], [box[2], box[3]], [box[0], box[3]]]
                valid_bubbles_with_centers.append({'center_y': cy, 'center_x': cx, 'points': polygon})
        else:
            if has_text(image, box, ocr_ja, ocr_ko):
                cx, cy = get_box_center(box)
                polygon = [[box[0], box[1]], [box[2], box[1]], [box[2], box[3]], [box[0], box[3]]]
                valid_bubbles_with_centers.append({'center_y': cy, 'center_x': cx, 'points': polygon})

    # ترتيب الفقاعات حسب center_y ثم center_x
    valid_bubbles_with_centers.sort(key=lambda b: (b['center_y'], b['center_x']))

    # تحويل إلى تنسيق JSON
    valid_bubbles = [{"id": i + 1, "points": [[int(round(x)), int(round(y))] for x, y in b['points']]}  
                     for i, b in enumerate(valid_bubbles_with_centers)]

    key = f"{idx:02d}_mask"
    all_bubbles[key] = valid_bubbles
    print(f"✅ Processed {img_file}, found {len(valid_bubbles)} valid bubbles with text, sorted by position, no overlaps, min dim 100px.")

# ==========================
# 🔹 حفظ النتائج إلى JSON
# ==========================
os.makedirs(os.path.dirname(output_path), exist_ok=True)
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(all_bubbles, f, indent=2, ensure_ascii=False)

print(f"\n🎉 All sorted, non-overlapping bubbles with text (min dim 100px) saved to:\n{output_path}")