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

print("Start downloading files...")

if os.path.exists(my_text_temp_url):
    # ===== Local folder detected =====
    local_folder = my_text_temp_url
    logging.info(f"Local folder detected: {local_folder}")
    print(f"Local folder detected: {local_folder}")

    cleaned_folder = os.path.join(local_folder, "Cleaned")

    if os.path.exists(cleaned_folder):
        print("✅ Cleaned folder already exists, skipping cleaning.")
        logging.info("Cleaned folder already exists, skipping cleaning.")
    else:
        print("🧹 Cleaned folder not found, running Panel Cleaner...")
        logging.info("Running Panel Cleaner...")

        try:
            subprocess.run(
                ["powershell", "-Command", f"pcleaner clean '{local_folder}' -c"],
                check=True
            ) 
            while not os.path.exists(cleaned_folder):
                time.sleep(1)
            print("✅ Cleaning done, Cleaned folder created.")
            logging.info("Panel Cleaner finished successfully.")
        except Exception as e:
            logging.error(f"Panel Cleaner failed: {e}")
            print(f"[ERROR] Panel Cleaner failed: {e}")

else:
    # ===== Google Drive URL detected =====
    downloads_folder = os.path.join(r"C:\Users\abdoh\Downloads", my_text_temp_title)

    if os.path.exists(downloads_folder):
        timestamp = time.strftime("%Y%m%d_%H%M%S")  # وقت كامل
        downloads_folder = os.path.join(r"C:\Users\abdoh\Downloads", f"{my_text_temp_title}_{timestamp}")

    os.makedirs(downloads_folder, exist_ok=True)
    print("Folder created:", downloads_folder)

    log_file = os.path.join(downloads_folder, "download_log.txt")
    logging.basicConfig(
        filename=log_file,
        filemode='w',
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )
    logging.info("=== Start downloading Google Drive folder ===")

    try:
        gdown.download_folder(my_text_temp_url, output=downloads_folder, quiet=False, use_cookies=False)
        logging.info("All files downloaded successfully")
        print("All files downloaded successfully")

        print("🧹 Running Panel Cleaner on downloaded folder...")
        subprocess.run(
            ["powershell", "-Command", f"pcleaner clean '{downloads_folder}' -c"],
            check=True
        )
        while not os.path.exists(os.path.join(downloads_folder, "Cleaned")):
            time.sleep(1)
        print("✅ Cleaning done, Cleaned folder created.")

    except Exception as e:
        logging.error(f"Error during download: {e}")
        print(f"Error during download. Check log: {log_file}")

# في الآخر قبل logging.info("=== Script finished ===")
print("🚀 Launching Photoshop batch...")
try:
    subprocess.run(
        [bat_file],
        check=True,
        shell=True
    )
except Exception as e:
    print(f"[ERROR] Failed to run Photoshop batch: {e}")

logging.info("=== Script finished ===")