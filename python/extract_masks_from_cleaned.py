#!/usr/bin/env python3
"""
Script to extract mask files from cleaned folder and copy them back
This handles cases where Panel Cleaner saves masks in cleaned folder but with different naming
"""

import os
import shutil
import sys
from pathlib import Path
import glob

def find_mask_files_in_cleaned(cleaned_folder: str) -> list[str]:
    """
    Find mask files in cleaned folder with various naming patterns
    
    :param cleaned_folder: path to the cleaned folder
    :return: list of mask file paths
    """
    mask_patterns = [
        "*_mask.png",
        "*mask*.png", 
        "*_mask.jpg",
        "*mask*.jpg",
        "*_mask.jpeg",
        "*mask*.jpeg",
        "*_mask.webp",
        "*mask*.webp"
    ]
    
    mask_files = []
    for pattern in mask_patterns:
        mask_files.extend(glob.glob(os.path.join(cleaned_folder, pattern)))
    
    return mask_files

def ensure_masks_in_cleaned(original_folder: str) -> bool:
    """
    Ensure mask files are available in cleaned folder
    If they don't exist, try to find them in original folder and copy them
    
    :param original_folder: path to the original folder
    :return: True if successful, False otherwise
    """
    original_path = Path(original_folder)
    cleaned_path = original_path / "cleaned"
    
    if not cleaned_path.exists():
        print(f" cleaned folder not found: {cleaned_path}")
        return False
    
    # Check if masks already exist in cleaned folder
    existing_masks = find_mask_files_in_cleaned(str(cleaned_path))
    if existing_masks:
        print(f" Found {len(existing_masks)} mask files already in cleaned folder")
        for mask in existing_masks:
            print(f"  - {os.path.basename(mask)}")
        return True
    
    # If no masks in cleaned folder, look in original folder
    print("🔍 No masks found in cleaned folder, checking original folder...")
    original_masks = find_mask_files_in_cleaned(str(original_path))
    
    if not original_masks:
        print(" No mask files found in original folder either")
        return False
    
    print(f" Found {len(original_masks)} mask files in original folder")
    
    # Copy masks to cleaned folder
    copied_count = 0
    for mask_file in original_masks:
        try:
            mask_path = Path(mask_file)
            dest_path = cleaned_path / mask_path.name
            
            # Skip if file already exists in destination
            if dest_path.exists():
                print(f"  Mask already exists, skipping: {mask_path.name}")
                continue
            
            # Copy the mask file
            shutil.copy2(mask_file, str(dest_path))
            print(f" Copied: {mask_path.name}")
            copied_count += 1
            
        except Exception as e:
            print(f" Failed to copy {mask_path.name}: {e}")
    
    print(f"🎉 Successfully copied {copied_count} mask files to cleaned folder")
    return True

def main():
    """Main function"""
    print("=" * 60)
    print("🔄 MASK ENSURANCE UTILITY")
    print("Ensuring mask files are available in cleaned folder")
    print("=" * 60)
    
    if len(sys.argv) < 2:
        print("Usage:")
        print(f"  python {sys.argv[0]} <original_folder_path>")
        print("\nExample:")
        print(f"  python {sys.argv[0]} C:\\Users\\abdoh\\Downloads\\MyProject")
        return
    
    original_folder = sys.argv[1]
    
    # Remove quotes if present
    original_folder = original_folder.strip('"')
    
    print(f" Original folder: {original_folder}")
    
    success = ensure_masks_in_cleaned(original_folder)
    
    if success:
        print(" Mask ensurance completed successfully!")
    else:
        print(" Mask ensurance failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()

