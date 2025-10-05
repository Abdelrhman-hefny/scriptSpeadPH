import os
import sys
import gdown
import logging
import subprocess
import time
import json

# ===== Load config from JSON =====
config_path = r"C:\Users\abdoh\Downloads\testScript\config\temp-title.json"

if not os.path.exists(config_path):
    print(f"[ERROR] Config JSON not found at: {config_path}")
    sys.exit(1)

with open(config_path, "r", encoding="utf-8") as f:
    config = json.load(f)

my_text_temp_title = config.get("title", "Untitled")
my_text_temp_url = config.get("folder_url", "")
chosen_team = config.get("team", "unknown")
pspath = config.get("pspath", "")
manga_type = config.get("mangaType", "korian")

# ===== Batch file path =====
bat_file = r"C:\Users\abdoh\Downloads\testScript\batch\watch_clean.bat"

def run_panel_cleaner(target_folder: str) -> None:
    """Run Panel Cleaner with text extraction and ensure masks."""
    cleaned_folder = os.path.join(target_folder, "cleaned")
    print("🧹 Running Panel Cleaner...")
    logging.info("Running Panel Cleaner with text extraction...")

    try:
        subprocess.run(
            [
                "powershell",
                "-Command",
                f"pcleaner-cli clean '{target_folder}' --extract-text --cache-masks",
            ],
            check=True,
        )
        # Wait until cleaned folder appears
        while not os.path.exists(cleaned_folder):
            time.sleep(1)

        print("✅ Cleaning done, cleaned folder created.")
        logging.info("Panel Cleaner finished successfully.")
    except Exception as e:
        logging.error(f"Panel Cleaner failed: {e}")
        print(f"[ERROR] Panel Cleaner failed: {e}")
        return

    # Ensure mask files exist
    print("📁 Ensuring mask files are available in cleaned folder...")
    try:
        subprocess.run(
            [
                sys.executable,
                os.path.join(os.path.dirname(__file__), "extract_masks_from_cleaned.py"),
                target_folder,
            ],
            check=True,
        )
        print("✅ Mask files ensured successfully.")
    except Exception as e:
        print(f"[ERROR] Failed to ensure mask files: {e}")

# ====== MAIN SCRIPT ======
print("Start downloading or processing files...")

if os.path.exists(my_text_temp_url):
    # ===== Local folder detected =====
    local_folder = my_text_temp_url
    logging.info(f"Local folder detected: {local_folder}")
    print(f"📁 Local folder detected: {local_folder}")

    cleaned_folder = os.path.join(local_folder, "cleaned")

    if os.path.exists(cleaned_folder):
        print("🟡 Cleaned folder already exists. Skipping Panel Cleaner...")
    else:
        run_panel_cleaner(local_folder)

else:
    # ===== Google Drive URL detected =====
    downloads_folder = os.path.join(r"C:\Users\abdoh\Downloads", my_text_temp_title)

    if os.path.exists(downloads_folder):
        timestamp = time.strftime("%Y%m%d_%H%M%S")
        downloads_folder = os.path.join(r"C:\Users\abdoh\Downloads", f"{my_text_temp_title}_{timestamp}")

    os.makedirs(downloads_folder, exist_ok=True)
    print("📂 Folder created:", downloads_folder)

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
        print("✅ All files downloaded successfully")

        cleaned_folder = os.path.join(downloads_folder, "cleaned")

        if os.path.exists(cleaned_folder):
            print("🟡 Cleaned folder already exists. Skipping Panel Cleaner...")
        else:
            run_panel_cleaner(downloads_folder)

    except Exception as e:
        logging.error(f"Error during download: {e}")
        print(f"[ERROR] Error during download. Check log: {log_file}")

# ===== After cleaning or skipping, launch Photoshop batch =====
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
print("✅ Script finished successfully.")
