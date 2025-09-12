import os
import gdown
import logging
import subprocess
import time

# ===== Temp file with title and URL =====
temp_title = r"C:\Users\abdoh\Downloads\testScript\temp-title.txt"

# فتح الملف وقراءة السطور
with open(temp_title, "r", encoding="utf-8") as f:
    lines = f.readlines()

# حفظ السطور في متغيرات
my_text_temp_title = lines[0].strip() if len(lines) >= 1 else "Folder_" + os.path.basename(os.getcwd())
my_text_temp_url = lines[1].strip() if len(lines) >= 2 else ""

# رابط باتش
bat_file = r"C:\Users\abdoh\Downloads\testScript\batch\watch_clean.bat"

# مسار مجلد التنزيل الأساسي
downloads_folder = os.path.join(r"C:\Users\abdoh\Downloads", my_text_temp_title)

# إذا المجلد موجود بالفعل
if os.path.exists(downloads_folder):
    # ضيف الثواني الحالية قبل اسم المجلد
    timestamp = time.strftime("%S")  # ثانية الحالية من 00 إلى 59
    downloads_folder = os.path.join(r"C:\Users\abdoh\Downloads", f"{my_text_temp_title}_{timestamp}")

# أنشئ المجلد
os.makedirs(downloads_folder, exist_ok=True)
print("Folder created:", downloads_folder)

# مسار ملف اللوج
log_file = os.path.join(downloads_folder, "download_log.txt")

# إعداد logging
logging.basicConfig(
    filename=log_file,
    filemode='w',
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

logging.info("=== Start downloading Google Drive folder ===")
print("Start downloading files...")

try:
    # تنزيل كل الملفات من فولدر Google Drive
    gdown.download_folder(my_text_temp_url, output=downloads_folder, quiet=False, use_cookies=False)
    logging.info("All files downloaded successfully")
    print("All files downloaded successfully")

except Exception as e:
    logging.error(f"Error during download: {e}")
    print(f"Error during download. Check log: {log_file}")

# تشغيل الباتش بعد الانتهاء من التحميل
if os.path.exists(bat_file):
    subprocess.run([bat_file], shell=True)
else:
    logging.warning(f"Batch file not found: {bat_file}")

logging.info("=== Script finished ===")
