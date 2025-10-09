import subprocess
import os
import sys
import time
import warnings
from pathlib import Path

# Fix encoding for Windows terminal
os.environ["PYTHONIOENCODING"] = "utf-8"
warnings.filterwarnings("ignore", category=UserWarning)


def clean_with_source(folder_path, repo_path):
    # Use Path objects for reliable path manipulation
    folder_path = Path(folder_path)
    repo_path = Path(repo_path)

    if not folder_path.exists():
        print(f"❌ Folder not found: {folder_path}")
        return

    # Define the path to the pcleaner main.py script
    pcleaner_main_path = repo_path / "pcleaner" / "main.py"

    if not pcleaner_main_path.exists():
        print(f"❌ pcleaner main.py not found at: {pcleaner_main_path}")
        return

    # Set the CWD to the pcleaner directory to mimic the successful manual command
    cwd_path = repo_path / "pcleaner"

    # The command now executes main.py directly and REMOVES the problematic '--no-profile'
    command = [
        sys.executable,
        str(pcleaner_main_path),  # Path to the main.py file
        "clean",
        str(folder_path),
        # Removed the problematic '--no-profile'
    ]

    print(f"🧹 Starting cleaning using local source at: {cwd_path}\n")

    start_time = time.time()

    process = subprocess.Popen(
        command,
        cwd=str(cwd_path),  # Set CWD to the directory containing main.py
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        bufsize=1,
    )

    # ... (rest of the code to handle output and timing)
    for line in process.stdout:
        sys.stdout.write(line)
        sys.stdout.flush()

    process.wait()

    end_time = time.time()
    duration = end_time - start_time

    if process.returncode == 0:
        print(f"\n✅ Cleaning completed successfully using source code!")
        print(f"⏱ Duration: {duration:.2f} seconds ({duration/60:.2f} min)")
    else:
        print(
            f"\n⚠️ An error occurred while cleaning. Process returned code: {process.returncode}"
        )


# Example usage
repo = r"C:\Users\abdoh\Downloads\testScript\PanelCleaner"
folder = r"C:\Users\abdoh\Downloads\01"
clean_with_source(folder, repo)
