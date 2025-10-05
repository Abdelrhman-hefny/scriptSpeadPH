from ultralytics import YOLO
import os
import json
import cv2
import numpy as np
import easyocr

# 🔹 إعداد المسارات
model_path = "model/yolov8m.pt"  # استخدم نموذجًا محسنًا من https://huggingface.co/ogkalu/comic-speech-bubble-detector-yolov8m
image_folder = "images"
output_path = "C:/Users/abdoh/Downloads/01/cleaned/all_bubbles.json"

# 🔹 تحميل نموذج YOLO
model = YOLO(model_path)

# 🔹 تحميل EasyOCR لتتبع النصوص
reader = easyocr.Reader(['en', 'ja'], gpu=True)  # دعم الإنجليزية واليابانية

# ==========================
# 🔹 معالجة الصورة لإبراز النصوص والفقاعات الملونة
# ==========================
def preprocess_image(img):
    # تحويل إلى HSV وزيادة التشبع والتباين
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)
    s = cv2.add(s, 50)  # زيادة التشبع لإبراز الفقاعات الملونة
    s = np.clip(s, 0, 255)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    v = clahe.apply(v)
    hsv_enhanced = cv2.merge([h, s, v])
    enhanced = cv2.cvtColor(hsv_enhanced, cv2.COLOR_HSV2BGR)

    # 🔹 تحسين النصوص باستخدام adaptive thresholding
    gray = cv2.cvtColor(enhanced, cv2.COLOR_BGR2GRAY)
    thresh = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2)
    enhanced = cv2.addWeighted(enhanced, 0.8, cv2.cvtColor(thresh, cv2.COLOR_GRAY2BGR), 0.2, 0)
    return enhanced

# ==========================
# 🔹 التحقق من وجود نصوص داخل الفقاعة
# ==========================
def has_text(image, box):
    x1, y1, x2, y2 = map(int, box)
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(image.shape[1], x2), min(image.shape[0], y2)
    if x2 <= x1 or y2 <= y1:
        return False
    crop = image[y1:y2, x1:x2]
    if crop.size == 0:
        return False
    results = reader.readtext(crop, detail=0)  # قراءة النصوص فقط
    return len(results) > 0  # إرجاع True إذا وُجد نص

# ==========================
# 🔹 تقسيم الصورة الطويلة
# ==========================
def slice_image(image, slice_height=2500, overlap=300):
    h, w = image.shape[:2]
    slices = []
    start_y = 0
    while start_y < h:
        end_y = min(start_y + slice_height, h)
        slices.append((image[start_y:end_y, :].copy(), start_y))
        if end_y >= h:
            break
        start_y = end_y - overlap
    return slices

# ==========================
# 🔹 IOU لحساب التكرار
# ==========================
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

# ==========================
# 🔹 دالة حذف الفقاعات المكررة
# ==========================
def remove_duplicates(boxes, iou_thresh=0.7, dist_thresh=100):
    unique = []
    for box in boxes:
        duplicate = False
        x1, y1, x2, y2 = box
        cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
        for ux1, uy1, ux2, uy2 in unique:
            ucx, ucy = (ux1 + ux2) / 2, (uy1 + uy2) / 2
            iou = box_iou(box, (ux1, uy1, ux2, uy2))
            dist = np.hypot(cx - ucx, cy - ucy)
            if iou > iou_thresh or dist < dist_thresh:
                duplicate = True
                break
        if not duplicate:
            unique.append(box)
    return unique

# ==========================
# 🔹 المعالجة الرئيسية
# ==========================
all_bubbles = {}
image_files = sorted([f for f in os.listdir(image_folder) if f.lower().endswith((".jpg", ".png"))])

for idx, img_file in enumerate(image_files, start=1):
    img_path = os.path.join(image_folder, img_file)
    image = cv2.imread(img_path)
    if image is None:
        print(f"⚠️ لم يتمكن من قراءة الصورة: {img_path}")
        continue

    image = preprocess_image(image)
    h, w, _ = image.shape
    bubbles = []
    boxes = []

    # تقسيم لو الصورة طويلة
    slices = slice_image(image) if h > 4000 else [(image, 0)]

    for slice_img, offset_y in slices:
        results = model(slice_img, imgsz=1280, conf=0.05)  # خفض conf لكشف المزيد
        for r in results:
            if r.boxes:
                for box, score in zip(r.boxes.xyxy, r.boxes.conf):
                    if score < 0.05:
                        continue
                    x1, y1, x2, y2 = box.tolist()
                    x1, y1, x2, y2 = x1, y1 + offset_y, x2, y2 + offset_y
                    if (x2 - x1) * (y2 - y1) < 2000:  # تجاهل الفقاعات الصغيرة
                        continue
                    # 🔹 التحقق من وجود نصوص داخل الفقاعة
                    if has_text(image, (x1, y1, x2, y2)):
                        boxes.append((x1, y1, x2, y2))

    # 🧩 إزالة التكرارات
    boxes = remove_duplicates(boxes)

    for x1, y1, x2, y2 in boxes:
        bubbles.append([[x1, y1], [x2, y1], [x2, y2], [x1, y2]])

    key = f"{idx:02d}_mask"
    all_bubbles[key] = [{"id": i + 1, "points": [[int(x), int(y)] for x, y in b]} for i, b in enumerate(bubbles)]
    print(f"✅ Processed {img_file}, found {len(bubbles)} text-containing bubbles.")

# ==========================
# 🔹 حفظ النتائج
# ==========================
os.makedirs(os.path.dirname(output_path), exist_ok=True)
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(all_bubbles, f, indent=2)

print(f"\n🎉 All text-containing bubbles saved to:\n{output_path}")


# بيانات زياده 




#######################


###################

from ultralytics import YOLO
import os
import json
import cv2
import numpy as np

model_path = "model/model.pt"
image_folder = "images"
output_path = r"C:\Users\abdoh\Downloads\01\cleaned\all_bubbles.json"

model = YOLO(model_path)

# ==========================
# 🔹 تحسين معالجة الصورة (للخلفيات الغامقة والملونة)
# ==========================
def preprocess_image(img):
    # تحويل إلى HSV و LAB
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # زيادة التباين في قناة الإضاءة (V و L)
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    hsv[:, :, 2] = clahe.apply(hsv[:, :, 2])
    lab[:, :, 0] = clahe.apply(lab[:, :, 0])

    # دمج النسخ الثلاثة في صورة واحدة لتقوية الفقاعات
    hsv_bgr = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)
    lab_bgr = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
    enhanced = cv2.addWeighted(hsv_bgr, 0.4, lab_bgr, 0.4, 0)
    enhanced = cv2.addWeighted(enhanced, 0.8, cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR), 0.2, 0)

    # تجربة threshold بسيط للمناطق الداكنة جدًا (يساعد الفقاعات الغامقة)
    dark_mask = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                      cv2.THRESH_BINARY_INV, 31, 5)
    dark_mask = cv2.cvtColor(dark_mask, cv2.COLOR_GRAY2BGR)
    enhanced = cv2.addWeighted(enhanced, 0.85, dark_mask, 0.15, 0)

    return enhanced

# ==========================
# 🔹 تقسيم الصورة الطويلة
# ==========================
def slice_image(image, slice_height=2500, overlap=150):
    h, w = image.shape[:2]
    slices = []
    start_y = 0
    while start_y < h:
        end_y = min(start_y + slice_height, h)
        slices.append((image[start_y:end_y, :].copy(), start_y))
        if end_y >= h:
            break
        start_y = end_y - overlap
    return slices

# ==========================
# 🔹 IOU لحساب التكرار
# ==========================
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

# ==========================
# 🔹 دالة حذف الفقاعات المكررة
# ==========================
def remove_duplicates(boxes, iou_thresh=0.6, dist_thresh=50):
    unique = []
    for box in boxes:
        duplicate = False
        x1, y1, x2, y2 = box
        cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
        for ux1, uy1, ux2, uy2 in unique:
            ucx, ucy = (ux1 + ux2) / 2, (uy1 + uy2) / 2
            iou = box_iou(box, (ux1, uy1, ux2, uy2))
            dist = np.hypot(cx - ucx, cy - ucy)
            if iou > iou_thresh or dist < dist_thresh:
                duplicate = True
                break
        if not duplicate:
            unique.append(box)
    return unique

# ==========================
# 🔹 المعالجة الرئيسية
# ==========================
all_bubbles = {}
image_files = sorted([f for f in os.listdir(image_folder) if f.lower().endswith((".jpg", ".png"))])

for idx, img_file in enumerate(image_files, start=1):
    img_path = os.path.join(image_folder, img_file)
    image = cv2.imread(img_path)
    if image is None:
        print(f"⚠️ لم يتمكن من قراءة الصورة: {img_path}")
        continue

    image = preprocess_image(image)
    h, w, _ = image.shape
    bubbles = []
    boxes = []

    slices = slice_image(image) if h > 4000 else [(image, 0)]

    for slice_img, offset_y in slices:
        results = model(slice_img, imgsz=1280, conf=0.25)
        for r in results:
            if r.boxes:
                for box, score in zip(r.boxes.xyxy, r.boxes.conf):
                    if score < 0.25:
                        continue
                    x1, y1, x2, y2 = box.tolist()
                    x1, y1, x2, y2 = x1, y1 + offset_y, x2, y2 + offset_y
                    if (x2 - x1) * (y2 - y1) < 2000:
                        continue
                    boxes.append((x1, y1, x2, y2))

    boxes = remove_duplicates(boxes)

    for x1, y1, x2, y2 in boxes:
        bubbles.append([[x1, y1], [x2, y1], [x2, y2], [x1, y2]])

    key = f"{idx:02d}_mask"
    all_bubbles[key] = [{
        "id": i + 1,
        "points": [[int(x), int(y)] for x, y in b]
    } for i, b in enumerate(bubbles)]

    print(f"✅ Processed {img_file}, found {len(bubbles)} bubbles.")

# ==========================
# 🔹 حفظ النتائج
# ==========================
os.makedirs(os.path.dirname(output_path), exist_ok=True)
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(all_bubbles, f, indent=2)

print(f"\n🎉 All unique bubbles saved to:\n{output_path}")


# حلت مشكله التداخل واكتشتفت النصوص الصغيره التي بجانب الفقاعه واكتشتفت فقاعات اكث ولكن ليس الكل + حجمها كبير











#############
#
###########
from ultralytics import YOLO
import os
import json
import cv2
import numpy as np

# ==========================
# 🔹 إعداد المسارات
# ==========================
model_path = "model/model.pt"
image_folder = "images"
output_path = "C:/Users/abdoh/Downloads/01/cleaned/all_bubbles.json"

model = YOLO(model_path)

# ==========================
# 🔹 دالة تحسين الصورة قبل الكشف
# ==========================
def enhance_image_for_detection(image):
    # تحويل الصورة إلى HSV لتحسين الإضاءة
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)

    # رفع الإضاءة والتباين
    v = cv2.equalizeHist(v)

    # تقليل التشبع لتقليل تأثير الألوان الزاهية
    s = cv2.addWeighted(s, 0.7, np.zeros_like(s), 0, 0)

    hsv = cv2.merge([h, s, v])
    enhanced = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)

    # تحويل لتدرج رمادي خفيف مع زيادة التباين
    gray = cv2.cvtColor(enhanced, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (3, 3), 0)
    gray = cv2.addWeighted(gray, 1.5, cv2.medianBlur(gray, 5), -0.5, 0)

    # دمج الصورة المحسّنة مع الأصلية لإبراز الفقاعات الغامقة
    final = cv2.addWeighted(enhanced, 0.7, cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR), 0.3, 0)
    return final

# ==========================
# 🔹 دالة تقسيم الصورة الطويلة
# ==========================
def slice_image(image, slice_height=2500, overlap=100):
    h, w = image.shape[:2]
    slices = []
    start_y = 0
    while start_y < h:
        end_y = min(start_y + slice_height, h)
        slices.append((image[start_y:end_y, :].copy(), start_y))
        if end_y >= h:
            break
        start_y = end_y - overlap
    return slices

# ==========================
# 🔹 حساب نسبة التداخل لمنع التكرار
# ==========================
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

# ==========================
# 🔹 الدالة الرئيسية
# ==========================
all_bubbles = {}

image_files = sorted([f for f in os.listdir(image_folder) if f.lower().endswith((".jpg", ".png", ".jpeg"))])

for idx, img_file in enumerate(image_files, start=1):
    img_path = os.path.join(image_folder, img_file)
    image = cv2.imread(img_path)
    if image is None:
        print(f"⚠️ لم يتمكن من قراءة الصورة: {img_path}")
        continue

    # ✅ تحسين الصورة لاكتشاف الفقاعات الملونة أو الداكنة
    enhanced_img = enhance_image_for_detection(image)

    h, w, _ = image.shape
    bubbles = []
    boxes = []

    # ✅ تقسيم الصورة الطويلة
    if h > 4000:
        slices = slice_image(enhanced_img)
        for slice_img, offset_y in slices:
            temp_path = f"temp_{offset_y}.jpg"
            cv2.imwrite(temp_path, slice_img)
            results = model(temp_path, imgsz=1280, conf=0.25)  # زود الحساسية قليلاً
            for r in results:
                if r.boxes:
                    for box, score in zip(r.boxes.xyxy, r.boxes.conf):
                        if score < 0.25:
                            continue
                        x1, y1, x2, y2 = box.tolist()
                        x1, y1, x2, y2 = x1, y1 + offset_y, x2, y2 + offset_y
                        if (x2 - x1) * (y2 - y1) < 2000:  # تجاهل الصناديق الصغيرة جداً
                            continue
                        duplicate = False
                        for b in boxes:
                            if box_iou(b, (x1, y1, x2, y2)) > 0.45:
                                duplicate = True
                                break
                        if not duplicate:
                            boxes.append((x1, y1, x2, y2))
                            bubbles.append([[x1, y1], [x2, y1], [x2, y2], [x1, y2]])
            os.remove(temp_path)
    else:
        results = model(enhanced_img, imgsz=1280, conf=0.25)
        for r in results:
            if r.boxes:
                for box, score in zip(r.boxes.xyxy, r.boxes.conf):
                    if score < 0.25:
                        continue
                    x1, y1, x2, y2 = box.tolist()
                    if (x2 - x1) * (y2 - y1) < 2000:
                        continue
                    duplicate = False
                    for b in boxes:
                        if box_iou(b, (x1, y1, x2, y2)) > 0.45:
                            duplicate = True
                            break
                    if not duplicate:
                        boxes.append((x1, y1, x2, y2))
                        bubbles.append([[x1, y1], [x2, y1], [x2, y2], [x1, y2]])

    # ✅ حفظ النتيجة في القاموس
    key = f"{idx:02d}_mask"
    all_bubbles[key] = [{"id": i + 1, "points": [[int(x), int(y)] for x, y in b]} for i, b in enumerate(bubbles)]
    print(f"✅ Processed {img_file}, found {len(bubbles)} unique bubbles.")

# ==========================
# 🔹 حفظ النتائج إلى JSON
# ==========================
os.makedirs(os.path.dirname(output_path), exist_ok=True)
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(all_bubbles, f, indent=2)

print(f"\n🎉 All unique bubbles saved to:\n{output_path}")



# اقرب حاجه ؟

##############
###############
#################
###########################################
from ultralytics import YOLO
import easyocr
import os
import json
import cv2
import numpy as np
from shapely.geometry import Polygon

# ==========================
# 🔹 إعداد المسارات
# ==========================
model_path = "model/model.pt"  # يمكنك تغييره إلى model/comic-speech-bubble-detector.pt لو عايز دقة أعلى
image_folder = "images"
output_path = "C:/Users/abdoh/Downloads/01/cleaned/all_bubbles.json"

model = YOLO(model_path)
ocr = easyocr.Reader(['en', 'ar'], gpu=False)

# ==========================
# 🔹 تحسين الصورة قبل الكشف
# ==========================
def enhance_image(img):
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)
    v = cv2.equalizeHist(v)
    s = cv2.addWeighted(s, 0.7, np.zeros_like(s), 0, 0)
    hsv = cv2.merge([h, s, v])
    enhanced = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)
    lab = cv2.cvtColor(enhanced, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    lab = cv2.merge([l, a, b])
    enhanced = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
    return enhanced

# ==========================
# 🔹 دالة حساب IOU
# ==========================
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

# ==========================
# 🔹 حذف الفقاعات المكررة
# ==========================
def remove_duplicates(boxes, iou_thresh=0.45):
    unique = []
    for b in boxes:
        if all(box_iou(b, u) < iou_thresh for u in unique):
            unique.append(b)
    return unique

# ==========================
# 🔹 تحويل الفقاعة إلى شكل بيضاوي (أو أي شكل حر)
# ==========================
def make_ellipse_path(x1, y1, x2, y2):
    cx = (x1 + x2) / 2
    cy = (y1 + y2) / 2
    rx = (x2 - x1) / 2
    ry = (y2 - y1) / 2
    points = []
    for angle in np.linspace(0, 2*np.pi, 36):
        x = cx + rx * np.cos(angle)
        y = cy + ry * np.sin(angle)
        points.append([int(x), int(y)])
    return points

# ==========================
# 🔹 المعالجة الرئيسية
# ==========================
all_bubbles = {}
image_files = sorted([f for f in os.listdir(image_folder) if f.lower().endswith((".jpg", ".png"))])

for idx, img_file in enumerate(image_files, start=1):
    img_path = os.path.join(image_folder, img_file)
    image = cv2.imread(img_path)
    if image is None:
        print(f"⚠️ لم يتم قراءة الصورة: {img_path}")
        continue

    enhanced = enhance_image(image)
    results = model(enhanced, imgsz=1280, conf=0.25)
    boxes = []

    for r in results:
        for box, conf in zip(r.boxes.xyxy, r.boxes.conf):
            if conf < 0.25:
                continue
            x1, y1, x2, y2 = map(int, box.tolist())
            area = (x2 - x1) * (y2 - y1)
            if area < 1500:
                continue

            crop = enhanced[y1:y2, x1:x2]
            gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)

            # تحسين الكشف النصي داخل الفقاعة
            blur = cv2.medianBlur(gray, 3)
            _, binary = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

            text_result = ocr.readtext(binary)
            if len(text_result) == 0:
                continue

            # 🔹 حساب مساحة النصوص داخل الفقاعة
            text_area = 0
            for (bbox, text, conf_t) in text_result:
                if conf_t < 0.3 or not text.strip():
                    continue
                poly = Polygon(bbox)
                text_area += poly.area

            if text_area < area * 0.015:  # لازم يكون فيه نص فعلي داخل الفقاعة
                continue

            boxes.append((x1, y1, x2, y2))

    # حذف الفقاعات المكررة
    boxes = remove_duplicates(boxes)
    bubbles = []

    for (x1, y1, x2, y2) in boxes:
        ellipse_points = make_ellipse_path(x1, y1, x2, y2)
        bubbles.append(ellipse_points)

    key = f"{idx:02d}_mask"
    all_bubbles[key] = [
        {"id": i + 1, "points": [[int(x), int(y)] for x, y in b]} for i, b in enumerate(bubbles)
    ]

    print(f"✅ {img_file}: {len(bubbles)} فقاعة مكتشفة تحتوي نصوص.")

# ==========================
# 🔹 حفظ النتائج
# ==========================
os.makedirs(os.path.dirname(output_path), exist_ok=True)
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(all_bubbles, f, indent=2, ensure_ascii=False)

print(f"\n🎉 تم حفظ كل الفقاعات المكتشفة بنجاح في:\n{output_path}")


# ؟؟ اكثر دقه ولكن الففقاعات قليله


from ultralytics import YOLO
import easyocr
import os
import json
import cv2
import numpy as np
from shapely.geometry import Polygon
from PIL import Image

# ==========================
# Paths / config
# ==========================
model_path = "model/model.pt"
image_folder = "images"
output_path = "C:/Users/abdoh/Downloads/01/cleaned/all_bubbles.json"
preview_folder = "previews"  # سيُنشأ إن لم يكن موجودًا

# thresholds (الاعدادات الراجعة لنسختك الفعالة)
IMG_SZ = 1280
CONF_TH = 0.25
AREA_MIN = 1500          # تجاهل صناديق أصغر من كده
IOU_TH = 0.45
TEXT_AREA_RATIO = 0.015  # نسبة الحد الأدنى لمساحة النص داخل الصندوق لقبول الفقاعة

# init models
model = YOLO(model_path)
ocr = easyocr.Reader(['en', 'ar'], gpu=False)

os.makedirs(preview_folder, exist_ok=True)

# ==========================
# image enhancement (خفيف وفعال)
# ==========================
def enhance_image(img):
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)
    v = cv2.equalizeHist(v)
    s = cv2.addWeighted(s, 0.7, np.zeros_like(s), 0, 0)
    hsv = cv2.merge([h, s, v])
    enhanced = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)
    lab = cv2.cvtColor(enhanced, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    lab = cv2.merge([l, a, b])
    final = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
    return final

# ==========================
# IoU و إزالة التكرارات
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

def remove_duplicates(boxes, iou_thresh=IOU_TH):
    unique = []
    for b in boxes:
        if all(box_iou(b, u) < iou_thresh for u in unique):
            unique.append(b)
    return unique

# ==========================
# استخراج حواف الفقاعة (Contour) — للحصول على شكل حقيقي
# ==========================
def extract_contour_path(img, box):
    x1, y1, x2, y2 = box
    h, w = img.shape[:2]
    # clamp
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(w - 1, x2), min(h - 1, y2)
    if x2 <= x1 or y2 <= y1:
        return []
    crop = img[y1:y2, x1:x2]
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blur, 50, 150)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return []
    # اختار أكبر كونتور مع فلترة المساحة
    largest = max(contours, key=cv2.contourArea)
    if cv2.contourArea(largest) < 0.02 * ((x2 - x1) * (y2 - y1)):
        return []
    eps = 0.01 * cv2.arcLength(largest, True)
    approx = cv2.approxPolyDP(largest, eps, True)
    points = [[int(x1 + p[0][0]), int(y1 + p[0][1])] for p in approx]
    return points

# ==========================
# صياغة مسار بيضاوي احتياطي
# ==========================
def make_ellipse_path(x1, y1, x2, y2, n=36):
    cx = (x1 + x2) / 2.0
    cy = (y1 + y2) / 2.0
    rx = (x2 - x1) / 2.0
    ry = (y2 - y1) / 2.0
    pts = []
    for angle in np.linspace(0, 2 * np.pi, n, endpoint=False):
        x = cx + rx * np.cos(angle)
        y = cy + ry * np.sin(angle)
        pts.append([int(round(x)), int(round(y))])
    return pts

# ==========================
# تجربة عدة معالجة قبل الـOCR لالتقاط نصوص بيضاء/سوداء
# ==========================
def detect_text_inside_crop(crop, box_area):
    # crop: BGR numpy array
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    variants = []

    # 1 - median + Otsu
    v1 = cv2.medianBlur(gray, 3)
    _, v1b = cv2.threshold(v1, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    variants.append(v1b)

    # 2 - inverted binary (لنص أبيض على داكن)
    variants.append(cv2.bitwise_not(v1b))

    # 3 - CLAHE على الرمادي + Otsu
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    v3 = clahe.apply(gray)
    _, v3b = cv2.threshold(v3, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    variants.append(v3b)
    variants.append(cv2.bitwise_not(v3b))

    # 4 - adaptive gaussian
    try:
        v4 = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                   cv2.THRESH_BINARY, 31, 9)
        variants.append(v4)
        variants.append(cv2.bitwise_not(v4))
    except Exception:
        pass

    # 5 - morphological close to reduce noise (on v1b)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    v_close = cv2.morphologyEx(v1b, cv2.MORPH_CLOSE, kernel, iterations=1)
    variants.append(v_close)

    # نجرّب كل نسخة ونعطي الأفضل
    best_text_area = 0
    for var in variants:
        try:
            # easyocr يدعم numpy arrays و PIL.Image؛ نجرّب مباشرة numpy أولاً
            res = None
            try:
                res = ocr.readtext(var)
            except Exception:
                # fallback إلى PIL
                pil_img = Image.fromarray(var)
                res = ocr.readtext(pil_img)
        except Exception as e:
            # طبع خطأ الـOCR للdebug لكن استمر
            # print("OCR exception:", e)
            res = []

        # حساب مساحة النصوص المكتشفة
        text_area = 0.0
        for item in res:
            try:
                bbox, text, conf = item
            except Exception:
                # بعض الإصدارات تعيد (bbox, text, conf) أو عناصر مختلفة؛ نعالج بأمان
                if len(item) >= 3:
                    bbox = item[0]
                    text = item[1]
                    conf = float(item[2]) if len(item) > 2 else 0.0
                else:
                    continue

            if conf < 0.25 or not str(text).strip():
                continue
            try:
                poly = Polygon(bbox)
                text_area += abs(poly.area)
            except Exception:
                continue

        if text_area > best_text_area:
            best_text_area = text_area

        # لو لقي نص كافي نوقف
        if best_text_area >= box_area * TEXT_AREA_RATIO:
            return True, best_text_area

    return False, best_text_area

# ==========================
# Main loop
# ==========================
all_bubbles = {}
image_files = sorted([f for f in os.listdir(image_folder) if f.lower().endswith((".jpg", ".png", ".jpeg"))])

for idx, img_file in enumerate(image_files, start=1):
    img_path = os.path.join(image_folder, img_file)
    image = cv2.imread(img_path)
    if image is None:
        print(f"⚠️ لم يتم قراءة الصورة: {img_path}")
        continue

    # تعزيز الصورة
    enhanced = enhance_image(image)

    # run detector with the previously working settings
    results = model(enhanced, imgsz=IMG_SZ, conf=CONF_TH)
    candidate_boxes = []

    # gather boxes
    for r in results:
        for box, conf in zip(r.boxes.xyxy, r.boxes.conf):
            if conf < CONF_TH:
                continue
            x1, y1, x2, y2 = map(int, box.tolist())
            # clamp to image
            h, w = enhanced.shape[:2]
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w - 1, x2), min(h - 1, y2)
            if x2 <= x1 or y2 <= y1:
                continue
            area = (x2 - x1) * (y2 - y1)
            if area < AREA_MIN:
                continue

            candidate_boxes.append((x1, y1, x2, y2))

    # remove duplicates
    candidate_boxes = remove_duplicates(candidate_boxes)

    # verify with OCR (multiple variants)
    accepted = []
    preview_img = image.copy()
    for box in candidate_boxes:
        x1, y1, x2, y2 = box
        crop = enhanced[y1:y2, x1:x2]
        ok, ta = detect_text_inside_crop(crop, (x2 - x1) * (y2 - y1))
        if ok:
            accepted.append(box)
            # draw preview rectangle
            cv2.rectangle(preview_img, (x1, y1), (x2, y2), (0, 255, 0), 2)
        else:
            # ضع خفيف debug rectangle للملفات اللي لم تقبل (اختياري)
            cv2.rectangle(preview_img, (x1, y1), (x2, y2), (0, 120, 255), 1)

    # final dedupe
    accepted = remove_duplicates(accepted)

    # build contours or ellipse fallback
    bubbles = []
    for box in accepted:
        pts = extract_contour_path(enhanced, box)
        if not pts or len(pts) < 3:
            x1, y1, x2, y2 = box
            pts = make_ellipse_path(x1, y1, x2, y2)
        bubbles.append(pts)

    # save preview image
    preview_path = os.path.join(preview_folder, f"preview_{img_file}")
    cv2.imwrite(preview_path, preview_img)

    # write to JSON structure
    key = f"{idx:02d}_mask"
    all_bubbles[key] = [
        {"id": i + 1, "points": [[int(x), int(y)] for x, y in b]} for i, b in enumerate(bubbles)
    ]

    print(f"✅ {img_file}: detected {len(bubbles)} bubbles (preview saved -> {preview_path})")

# save JSON
os.makedirs(os.path.dirname(output_path), exist_ok=True)
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(all_bubbles, f, indent=2, ensure_ascii=False)

print(f"\n🎉 Saved results to:\n{output_path}")
 # دقيق وكلن فقاعته قليله 