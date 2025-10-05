#!/usr/bin/env python3
"""
Comprehensive script to find and copy mask files to cleaned folder
This script checks multiple possible locations where Panel Cleaner might save masks
"""

import os
import shutil
import sys
from pathlib import Path
import glob

def find_all_mask_files(folder_path: str) -> list[str]:
    """
    Find all mask files in a folder with comprehensive patterns
    
    :param folder_path: path to search in
    :return: list of mask file paths
    """
    mask_patterns = [
        "*_mask.png",
        "*_mask.jpg", 
        "*_mask.jpeg",
        "*_mask.webp",
        "*mask*.png",
        "*mask*.jpg",
        "*mask*.jpeg", 
        "*mask*.webp",
        "*_mask_*.png",
        "*_mask_*.jpg",
        "*_mask_*.jpeg",
        "*_mask_*.webp"
    ]
    
    mask_files = []
    for pattern in mask_patterns:
        mask_files.extend(glob.glob(os.path.join(folder_path, pattern)))
    
    return list(set(mask_files))  # Remove duplicates

def find_corresponding_masks(original_folder: str, cleaned_folder: str) -> dict:
    """
    Find corresponding mask files for cleaned images
    
    :param original_folder: path to original folder
    :param cleaned_folder: path to cleaned folder
    :return: dictionary mapping cleaned images to their masks
    """
    original_path = Path(original_folder)
    cleaned_path = Path(cleaned_folder)
    
    if not cleaned_path.exists():
        return {}
    
    # Find all cleaned images
    cleaned_images = []
    for ext in ['*.png', '*.jpg', '*.jpeg', '*.webp']:
        cleaned_images.extend(list(cleaned_path.glob(ext)))
    
    mask_mappings = {}
    
    for cleaned_img in cleaned_images:
        cleaned_name = cleaned_img.stem  # filename without extension
        
        # Try different naming patterns for masks
        possible_mask_names = [
            f"{cleaned_name}_mask",
            f"{cleaned_name.replace('_clean', '')}_mask",
            f"{cleaned_name.replace('_clean', '')}",
            cleaned_name.replace('_clean', ''),
            cleaned_name
        ]
        
        # Search in original folder first
        for mask_name in possible_mask_names:
            for ext in ['.png', '.jpg', '.jpeg', '.webp']:
                mask_file = original_path / f"{mask_name}{ext}"
                if mask_file.exists():
                    mask_mappings[str(cleaned_img)] = str(mask_file)
                    break
            if str(cleaned_img) in mask_mappings:
                break
        
        # If not found in original, search in cleaned folder
        if str(cleaned_img) not in mask_mappings:
            for mask_name in possible_mask_names:
                for ext in ['.png', '.jpg', '.jpeg', '.webp']:
                    mask_file = cleaned_path / f"{mask_name}{ext}"
                    if mask_file.exists():
                        mask_mappings[str(cleaned_img)] = str(mask_file)
                        break
                if str(cleaned_img) in mask_mappings:
                    break
    
    return mask_mappings

def copy_masks_to_cleaned(original_folder: str) -> bool:
    """
    Comprehensive mask copying to cleaned folder
    
    :param original_folder: path to the original folder
    :return: True if successful, False otherwise
    """
    original_path = Path(original_folder)
    cleaned_path = original_path / "cleaned"
    
    if not cleaned_path.exists():
        print(f" cleaned folder not found: {cleaned_path}")
        return False
    
    print(f" Searching for masks in: {original_folder}")
    print(f" Target cleaned folder: {cleaned_path}")
    
    # Check if Panel Cleaner created both clean images and masks
    print("\n Checking Panel Cleaner output...")
    cleaned_images = []
    for ext in ['*.png', '*.jpg', '*.jpeg', '*.webp']:
        cleaned_images.extend(list(cleaned_path.glob(ext)))
    
    print(f"Found {len(cleaned_images)} files in cleaned folder:")
    for img in cleaned_images:
        print(f"  - {img.name}")
    
    # Method 1: Find all masks in original folder
    print("\n Method 1: Searching for all mask files in original folder...")
    original_masks = find_all_mask_files(str(original_path))
    print(f"Found {len(original_masks)} mask files in original folder")
    
    # Method 2: Find corresponding masks for cleaned images
    print("\n Method 2: Finding corresponding masks for cleaned images...")
    mask_mappings = find_corresponding_masks(str(original_path), str(cleaned_path))
    print(f"Found {len(mask_mappings)} corresponding mask mappings")
    
    # Method 3: Check if masks already exist in cleaned folder
    print("\n Method 3: Checking existing masks in cleaned folder...")
    existing_masks = find_all_mask_files(str(cleaned_path))
    print(f"Found {len(existing_masks)} existing mask files in cleaned folder")
    
    # Copy masks that don't already exist
    copied_count = 0
    
    # Copy from original masks
    for mask_file in original_masks:
        mask_path = Path(mask_file)
        dest_path = cleaned_path / mask_path.name
        
        if not dest_path.exists():
            try:
                shutil.copy2(mask_file, str(dest_path))
                print(f" Copied from original: {mask_path.name}")
                copied_count += 1
            except Exception as e:
                print(f" Failed to copy {mask_path.name}: {e}")
        else:
            print(f"  Already exists: {mask_path.name}")
    
    # Copy from mappings (different names)
    for cleaned_img, mask_file in mask_mappings.items():
        mask_path = Path(mask_file)
        cleaned_img_path = Path(cleaned_img)
        
        # Create mask name based on cleaned image
        mask_name = f"{cleaned_img_path.stem}_mask{mask_path.suffix}"
        dest_path = cleaned_path / mask_name
        
        if not dest_path.exists() and mask_path.exists():
            try:
                shutil.copy2(mask_file, str(dest_path))
                print(f" Copied mapped mask: {mask_name}")
                copied_count += 1
            except Exception as e:
                print(f" Failed to copy {mask_name}: {e}")
    
    print(f"\n🎉 Total masks copied: {copied_count}")
    
    # Final check
    final_masks = find_all_mask_files(str(cleaned_path))
    print(f"📊 Final mask count in cleaned folder: {len(final_masks)}")
    
    if final_masks:
        print("📋 Mask files in cleaned folder:")
        for mask in final_masks:
            print(f"  - {os.path.basename(mask)}")
    
    return len(final_masks) > 0

def main():
    """Main function"""
    print("=" * 70)
    print(" COMPREHENSIVE MASK FINDER")
    print("Finding and copying mask files to cleaned folder")
    print("=" * 70)
    
    if len(sys.argv) < 2:
        print("Usage:")
        print(f"  python {sys.argv[0]} <original_folder_path>")
        print("\nExample:")
        print(f"  python {sys.argv[0]} C:\\Users\\abdoh\\Downloads\\MyProject")
        return
    
    original_folder = sys.argv[1]
    original_folder = original_folder.strip('"')
    
    print(f" Original folder: {original_folder}")
    
    success = copy_masks_to_cleaned(original_folder)
    
    if success:
        print("\n Comprehensive mask copying completed successfully!")
    else:
        print("\n No masks found or copying failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()