#!/usr/bin/env python3
"""
Script to copy mask files from original folder to Cleaned folder
so they can be processed alongside the cleaned images.
"""

import os
import shutil
import sys
from pathlib import Path
import glob

def find_mask_files(folder_path: str) -> list[str]:
    """
    Find all mask files in the given folder
    
    :param folder_path: path to the folder to search
    :return: list of mask file paths
    """
    mask_patterns = [
        "*_mask.png",
        "*mask*.png", 
        "*_mask.jpg",
        "*mask*.jpg",
        "*_mask.jpeg",
        "*mask*.jpeg"
    ]
    
    mask_files = []
    for pattern in mask_patterns:
        mask_files.extend(glob.glob(os.path.join(folder_path, pattern)))
    
    return mask_files

def copy_masks_to_cleaned(original_folder: str) -> bool:
    """
    Copy all mask files from original folder to cleaned folder
    
    :param original_folder: path to the original folder containing masks
    :return: True if successful, False otherwise
    """
    original_path = Path(original_folder)
    cleaned_path = original_path / "cleaned"
    
    if not original_path.exists():
        print(f" Original folder not found: {original_folder}")
        return False
    
    if not cleaned_path.exists():
        print(f" cleaned folder not found: {cleaned_path}")
        return False
    
    # Find all mask files in the original folder
    mask_files = find_mask_files(str(original_path))
    
    if not mask_files:
        print(f"ℹ️  No mask files found in: {original_folder}")
        return True
    
    print(f" Found {len(mask_files)} mask files in: {original_folder}")
    
    copied_count = 0
    for mask_file in mask_files:
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
    print("🔄 MASK COPY UTILITY")
    print("Copying mask files from original folder to cleaned folder")
    print("=" * 60)
    
    if len(sys.argv) < 2:
        print("Usage:")
        print(f"  python {sys.argv[0]} <original_folder_path>")
        print("\nExample:")
        print(f"  python {sys.argv[0]} C:\\Users\\abdoh\\Downloads\\MyProject")
        print(f"  python {sys.argv[0]} \"C:\\Users\\abdoh\\Downloads\\My Project Folder\"")
        return
    
    original_folder = sys.argv[1]
    
    # Remove quotes if present
    original_folder = original_folder.strip('"')
    
    print(f" Original folder: {original_folder}")
    
    success = copy_masks_to_cleaned(original_folder)
    
    if success:
        print(" Mask copying completed successfully!")
    else:
        print(" Mask copying failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()
