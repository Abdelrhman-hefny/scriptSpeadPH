import os, re
from google.colab import drive, files
import gdown

# ربط جوجل درايف
drive.mount('/content/drive')

# إدخال رابط الفولدر
drive_link = input("📂 من فضلك أدخل رابط فولدر جوجل درايف: ").strip()
# drive_link = ""

# استخراج ID الفولدر
match = re.search(r'/folders/([a-zA-Z0-9_-]+)', drive_link)
if not match:
    raise ValueError("❌ رابط غير صحيح")
folder_id = match.group(1)

# مسار تحميل الفولدر
input_path = "/content/input_files"
os.makedirs(input_path, exist_ok=True)

print("⬇️ جاري تحميل الملفات ...")
gdown.download_folder(id=folder_id, output=input_path, quiet=False)

print(f"📂 جاري معالجة الملفات في: {input_path}")

# تشغيل pcleaner كأمر CLI
!pcleaner clean "$input_path" -c

# الناتج بيكون فولدر cleaned داخل نفس المكان
output_path = os.path.join(input_path, "cleaned")

# ضغط الناتج للتحميل
!zip -r cleaned_files.zip "$output_path"
files.download("cleaned_files.zip")



-----------------------


import os, re, importlib.util
from google.colab import drive, files

# ✅ دالة تفحص المكتبة
def ensure_package(pkg_name, install_name=None):
    if install_name is None:
        install_name = pkg_name
    if importlib.util.find_spec(pkg_name) is None:
        print(f"📦 جاري تثبيت المكتبة: {install_name} ...")
        os.system(f"pip install {install_name}")
    else:
        print(f"✅ المكتبة {pkg_name} مثبتة بالفعل")

# فحص وتثبيت المكتبات المطلوبة
ensure_package("gdown")
ensure_package("pcleaner")

import gdown

# ربط جوجل درايف
drive.mount('/content/drive')

# إدخال رابط الفولدر
drive_link = input("📂 من فضلك أدخل رابط فولدر جوجل درايف: ").strip()

# استخراج ID الفولدر
match = re.search(r'/folders/([a-zA-Z0-9_-]+)', drive_link)
if not match:
    raise ValueError("❌ رابط غير صحيح")
folder_id = match.group(1)

# مسار تحميل الفولدر
input_path = "/content/input_files"
os.makedirs(input_path, exist_ok=True)

print("⬇️ جاري تحميل الملفات ...")
gdown.download_folder(id=folder_id, output=input_path, quiet=False)

print(f"📂 جاري معالجة الملفات في: {input_path}")

# تشغيل pcleaner كأمر CLI
os.system(f"pcleaner clean \"{input_path}\" -c")

# الناتج بيكون فولدر cleaned داخل نفس المكان
output_path = os.path.join(input_path, "cleaned")

# ضغط الناتج للتحميل
os.system(f"zip -r cleaned_files.zip \"{output_path}\"")
files.download("cleaned_files.zip")
