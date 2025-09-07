import cv2
import numpy as np
import json
import os

# المسار الحالي (نفس مجلد السكربت)
script_dir = os.path.dirname(os.path.abspath(__file__))

# اسم الصورة الهدف (يمكن تغييره لاحقًا حسب الحاجة)
png_path = os.path.join(script_dir, "02.png")
if not os.path.exists(png_path):
    raise FileNotFoundError("لم يتم العثور على الملف 02.png في نفس مجلد السكربت")

# قراءة PNG الشفافة
im = cv2.imread(png_path, cv2.IMREAD_UNCHANGED)
if im is None:
    raise RuntimeError("فشل في قراءة الصورة: {}".format(png_path))

# التأكد من وجود قناة ألفا
if im.shape[2] < 4:
    raise ValueError("الصورة لا تحتوي على قناة ألفا (RGBA)")

alpha = im[:, :, 3]
_, binary = cv2.threshold(alpha, 10, 255, cv2.THRESH_BINARY)

contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

# حفظ كل الفقاعات في JSON بصيغة [{x,y}, ...]
all_bubbles = []
for cnt in contours:
    bubble = [{"x": int(p[0][0]), "y": int(p[0][1])} for p in cnt]
    all_bubbles.append(bubble)

json_path = os.path.join(script_dir, "bubbles.json")
with open(json_path, "w", encoding="utf-8") as f:
    json.dump(all_bubbles, f)
