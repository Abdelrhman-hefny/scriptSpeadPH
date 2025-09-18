#!/usr/bin/env python3
"""
Script to extract bubble coordinates from mask files
"""

import sys
import json
import cv2
import numpy as np
from pathlib import Path
from PIL import Image

def extract_bubble_contours(mask_image: Image.Image) -> list[dict]:
    """
    Extract contours from a mask image and return as a list of dictionaries
    
    :param mask_image: PIL Image of the mask
    :return: list of dictionaries with bubble contours and id
    """
    # Convert PIL image to OpenCV format
    mask_array = np.array(mask_image)
    
    # Convert to grayscale if needed
    if len(mask_array.shape) == 3:
        mask_array = cv2.cvtColor(mask_array, cv2.COLOR_RGB2GRAY)
    
    # Ensure array is uint8 for OpenCV
    if mask_array.dtype == bool:
        mask_array = mask_array.astype(np.uint8) * 255
    elif mask_array.dtype != np.uint8:
        mask_array = mask_array.astype(np.uint8)
    
    # Find contours
    contours, _ = cv2.findContours(mask_array, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # Convert contours to desired format
    bubble_data = []
    for i, contour in enumerate(contours):
        # Skip very small contours (noise)
        if cv2.contourArea(contour) < 100:
            continue
            
        # Simplify contour to reduce number of points
        epsilon = 0.02 * cv2.arcLength(contour, True)
        simplified_contour = cv2.approxPolyDP(contour, epsilon, True)
        
        # Convert to list of points [x, y]
        points = [[int(point[0][0]), int(point[0][1])] for point in simplified_contour]
        
        bubble_data.append({
            "id": i + 1,
            "points": points
        })
    
    return bubble_data

def save_bubble_coordinates(bubble_data: list[dict], output_path: Path) -> None:
    """
    Save bubble coordinates to a JSON file
    
    :param bubble_data: list of bubble contour data
    :param output_path: path to save JSON file
    """
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(bubble_data, f, indent=2, ensure_ascii=False)
        print(f"Saved {len(bubble_data)} bubbles to: {output_path}")
    except Exception as e:
        print(f"Failed to save file: {e}")

def process_mask_file(mask_path: Path) -> list[dict]:
    """
    Process a single mask file and extract bubble coordinates
    
    :param mask_path: path to mask file
    :return: list of bubble data
    """
    if not mask_path.exists():
        print(f"File not found: {mask_path}")
        return []
    
    print(f"Processing file: {mask_path}")
    
    # Read mask image
    try:
        mask_image = Image.open(mask_path)
        print(f"Image size: {mask_image.size}")
    except Exception as e:
        print(f"Failed to read image: {e}")
        return []
    
    # Extract bubble coordinates
    bubble_data = extract_bubble_contours(mask_image)
    print(f"Found {len(bubble_data)} bubbles")
    
    if not bubble_data:
        print("No bubbles detected in the image")
        return []
    
    # Print sample details
    for bubble in bubble_data:
        print(f"  Bubble {bubble['id']}: {len(bubble['points'])} points")
        if bubble['points']:
            x_coords = [p[0] for p in bubble['points']]
            y_coords = [p[1] for p in bubble['points']]
            min_x, max_x = min(x_coords), max(x_coords)
            min_y, max_y = min(y_coords), max(y_coords)
            print(f"    Bounding box: ({min_x}, {min_y}) to ({max_x}, {max_y})")
    
    return bubble_data

def main():
    """Main function"""
    print("Bubble coordinates extractor from mask files")
    print("=" * 50)
    
    if len(sys.argv) < 2:
        print("Usage:")
        print(f"  python {sys.argv[0]} <mask_file>")
        print(f"  python {sys.argv[0]} <folder_with_mask_files>")
        print("\nExamples:")
        print(f"  python {sys.argv[0]} image_mask.png")
        print(f"  python {sys.argv[0]} C:\\path\\to\\folder")
        return
    
    input_path = Path(sys.argv[1])
    
    if input_path.is_file():
        # Process single file
        bubble_data = process_mask_file(input_path)
        if bubble_data:
            output_path = input_path.parent / f"{input_path.stem}_bubbles.json"
            save_bubble_coordinates(bubble_data, output_path)
    elif input_path.is_dir():
        # Process all mask files in folder
        mask_files = (
            list(input_path.glob("*_mask.png")) +
            list(input_path.glob("*mask*.png")) +
            list(input_path.glob("*_mask.jpg")) +
            list(input_path.glob("*mask*.jpg"))
        )
        
        if not mask_files:
            print(f"No mask files found in: {input_path}")
            print("Looking for files ending with '_mask.png' or containing 'mask' in the name")
            return
        
        print(f"Found {len(mask_files)} mask files")
        
        all_data = {}
        
        for mask_file in sorted(mask_files):
            print(f"\n{'='*50}")
            bubble_data = process_mask_file(mask_file)
            all_data[mask_file.stem] = bubble_data
        
        # Save one JSON file with all results
        output_path = input_path / "all_bubbles.json"
        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(all_data, f, indent=2, ensure_ascii=False)
            print(f"\nAll results saved to: {output_path}")
        except Exception as e:
            print(f"Failed to save file: {e}")
    else:
        print(f"Invalid path: {input_path}")

if __name__ == "__main__":
    main()
