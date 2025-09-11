from PIL import Image
import os
import sys

# تأكد أن المستخدم أعطى مجلد كأرجومنت
if len(sys.argv) < 2:
    print("Usage: convert_webp.py <folder_path>")
    sys.exit(1)

input_folder = "C:/Users/abdoh/Downloads/Compressed/4_JPG"

# اذهب لكل ملف في المجلد
for filename in os.listdir(input_folder):
    if filename.lower().endswith(".webp"):
        file_path = os.path.join(input_folder, filename)
        img = Image.open(file_path)

        # تغيير الحجم
        img = img.resize((800, 14000))

        # حفظ بدقة 95
        save_path = os.path.join(input_folder, os.path.splitext(filename)[0] + ".jpg")
        img.save(save_path, "JPEG", quality=95)
        print(f"Converted: {filename} -> {save_path}")

print("All WebP images converted successfully!")
