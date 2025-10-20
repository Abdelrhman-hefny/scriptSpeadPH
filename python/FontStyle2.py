# =====================================================================
# File: scripts/build_styles_manifest.py
# Purpose: استخراج ستايلات النص (Gradient/Stroke/Glow/Shadow) لكل فقاعة
# Inputs:
#   --config <path/to/temp-title.json>  (يحوي folder_url)
#   [--bubbles <path/to/all_bubbles.json>]  (اختياري؛ افتراضي inside folder_url)
#   --out <path/to/styles_manifest.json>
#   [--stops 6] [--debug-dir <dir>] [--textmask-dir <dir_with_alpha_masks_per_page>]
#
# Usage (Windows example):
#   python scripts/build_styles_manifest.py ^
#     --config "C:\Users\abdoh\Downloads\testScript\config\temp-title.json" ^
#     --out "C:\Users\abdoh\Downloads\222\styles_manifest.json" ^
#     --stops 6 --debug-dir "C:\Users\abdoh\Downloads\222\debug"
#
# Notes:
# - يتعامل مع شكل all_bubbles.json: مفاتيح مثل "02_mask": [ {id, points:[[x,y],...4]] , ...]
# - يحاول إيجاد صورة الصفحة باسم مطابق: 02.png/02.jpg/... داخل folder_url.
# - اختياري: --textmask-dir لو عندك أقنعة نص للصفحات (PNG بألفا > 0 = نص).
# =====================================================================
import os
import re
import json
import math
import glob
import argparse
from typing import List, Dict, Tuple, Optional
import numpy as np
from PIL import Image

# -------------------- IO utils --------------------
IMG_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff"]

def norm(p: str) -> str:
    return os.path.normpath(p)

def load_image(path: str) -> np.ndarray:
    img = Image.open(path).convert("RGBA")
    return np.asarray(img, dtype=np.uint8)

def save_png(arr: np.ndarray, path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    Image.fromarray(arr).save(path)

def find_page_image(folder: str, label: str) -> Optional[str]:
    # 1) exact filename: 02.png / 02.jpg ...
    for ext in IMG_EXTS:
        p = os.path.join(folder, f"{label}{ext}")
        if os.path.exists(p):
            return p
    # 2) any file startswith label + non-digit or dot/underscore
    patt = os.path.join(folder, f"{label}*")
    cands = [p for p in glob.glob(patt) if os.path.splitext(p)[1].lower() in IMG_EXTS]
    if cands:
        # prefer shortest name
        cands.sort(key=lambda x: len(os.path.basename(x)))
        return cands[0]
    return None

def load_config(config_path: str) -> Dict:
    with open(config_path, "r", encoding="utf-8") as f:
        return json.load(f)

def load_bubbles(bubbles_path: str) -> Dict[str, List[Dict]]:
    with open(bubbles_path, "r", encoding="utf-8") as f:
        return json.load(f)

# -------------------- math/color helpers --------------------
def rgb_to_luma(rgb: np.ndarray) -> np.ndarray:
    r = rgb[..., 0].astype(np.float32)
    g = rgb[..., 1].astype(np.float32)
    b = rgb[..., 2].astype(np.float32)
    return 0.2126*r + 0.7152*g + 0.0722*b

def color_distance(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    d = (a.astype(np.float32) - b.astype(np.float32))
    return np.sqrt((d[...,0]**2 + d[...,1]**2 + d[...,2]**2) + 1e-6)

def clamp01(x: np.ndarray) -> np.ndarray:
    return np.clip(x, 0.0, 1.0)

# -------------------- convolution / sobel (no SciPy) --------------------
def conv2_valid(img: np.ndarray, kernel: np.ndarray) -> np.ndarray:
    ih, iw = img.shape
    kh, kw = kernel.shape
    oh, ow = ih-kh+1, iw-kw+1
    out = np.zeros((oh, ow), dtype=np.float32)
    k = np.flip(np.flip(kernel, 0), 1)
    for i in range(oh):
        for j in range(ow):
            out[i, j] = np.sum(img[i:i+kh, j:j+kw] * k)
    return out

def sobel_gradients(gray: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    sx = np.array([[1,0,-1],[2,0,-2],[1,0,-1]], dtype=np.float32)
    sy = sx.T
    gx = conv2_valid(gray, sx)
    gy = conv2_valid(gray, sy)
    gx = np.pad(gx, ((1,1),(1,1)), mode="edge")
    gy = np.pad(gy, ((1,1),(1,1)), mode="edge")
    return gx, gy

# -------------------- morphology (binary lightweight) --------------------
def dilate(bin_img: np.ndarray, iters: int=1) -> np.ndarray:
    out = bin_img.copy()
    for _ in range(max(1, iters)):
        pad = np.pad(out, ((1,1),(1,1)), mode="constant", constant_values=0)
        nb = (
            pad[0:-2,0:-2] | pad[0:-2,1:-1] | pad[0:-2,2:] |
            pad[1:-1,0:-2] | pad[1:-1,1:-1] | pad[1:-1,2:] |
            pad[2:,0:-2]   | pad[2:,1:-1]   | pad[2:,2:]
        )
        out = (nb>0).astype(np.uint8)
    return out

def erode(bin_img: np.ndarray, iters: int=1) -> np.ndarray:
    out = bin_img.copy()
    for _ in range(max(1, iters)):
        pad = np.pad(out, ((1,1),(1,1)), mode="constant", constant_values=0)
        nb = (
            pad[0:-2,0:-2] & pad[0:-2,1:-1] & pad[0:-2,2:] &
            pad[1:-1,0:-2] & pad[1:-1,1:-1] & pad[1:-1,2:] &
            pad[2:,0:-2]   & pad[2:,1:-1]   & pad[2:,2:]
        )
        out = (nb>0).astype(np.uint8)
    return out

def open_morph(bin_img: np.ndarray, k:int=1) -> np.ndarray:
    return dilate(erode(bin_img, k), k)

def close_morph(bin_img: np.ndarray, k:int=1) -> np.ndarray:
    return erode(dilate(bin_img, k), k)

# -------------------- geometry helpers --------------------
def rect_from_points(points: List[List[int]]) -> Tuple[int,int,int,int]:
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    x0, x1 = int(min(xs)), int(max(xs))
    y0, y1 = int(min(ys)), int(max(ys))
    return x0, y0, x1-x0, y1-y0

def bbox_from_mask(m: np.ndarray) -> Optional[Tuple[int,int,int,int]]:
    ys, xs = np.where(m>0)
    if ys.size == 0: return None
    y0, y1 = int(ys.min()), int(ys.max())
    x0, x1 = int(xs.min()), int(xs.max())
    return x0, y0, x1-x0+1, y1-y0+1

def shift_mask(mask: np.ndarray, dx: int, dy: int) -> np.ndarray:
    h, w = mask.shape
    out = np.zeros_like(mask)
    xs_src = slice(max(0,-dx), min(w, w-dx))
    ys_src = slice(max(0,-dy), min(h, h-dy))
    xs_dst = slice(max(0, dx), min(w, w+dx))
    ys_dst = slice(max(0, dy), min(h, h+dy))
    out[ys_dst, xs_dst] = mask[ys_src, xs_src]
    return out

# -------------------- core estimations --------------------
def median_color(arr: np.ndarray, mask: np.ndarray) -> np.ndarray:
    if mask.sum() == 0:
        return np.median(arr.reshape(-1,3), axis=0)
    return np.median(arr[mask>0], axis=0)

def angle_from_vectors(gx: np.ndarray, gy: np.ndarray, mask: np.ndarray) -> float:
    mag = np.hypot(gx, gy)
    mag *= (mask>0)
    if mag.sum() == 0: return 0.0
    vx = (gx * mag).sum() / (mag.sum()+1e-6)
    vy = (gy * mag).sum() / (mag.sum()+1e-6)
    ang = math.degrees(math.atan2(vy, vx))
    if ang < 0: ang += 180.0
    return float(ang)

def estimate_text_mask_from_crop(rgb: np.ndarray) -> np.ndarray:
    h, w, _ = rgb.shape
    gray = rgb_to_luma(rgb)
    gx, gy = sobel_gradients(gray)
    mag = np.hypot(gx, gy)

    bg0 = median_color(rgb[...,:3], np.ones((h,w), dtype=np.uint8))
    dist0 = color_distance(rgb[...,:3], bg0)

    t_color = np.percentile(dist0, 70.0)
    t_grad  = np.percentile(mag,   60.0)
    mask0 = (dist0 > max(10.0, t_color)) & (mag > max(10.0, t_grad))
    mask0 = mask0.astype(np.uint8)
    mask0 = open_morph(close_morph(mask0, 1), 1)

    inv = (mask0==0).astype(np.uint8)
    bg = median_color(rgb[...,:3], inv)
    dist = color_distance(rgb[...,:3], bg)
    t_color2 = np.percentile(dist[inv>0], 65.0) if inv.sum()>0 else np.percentile(dist, 65.0)
    mask = ((dist > max(8.0, t_color2)) | (mag > max(8.0, np.percentile(mag,55.0)))).astype(np.uint8)
    mask = close_morph(open_morph(mask, 1), 1)

    if mask.sum() > 0.5*h*w:
        mask = (mag > np.percentile(mag, 75.0)).astype(np.uint8)
    elif mask.sum() < 0.001*h*w:
        mask = (mag > np.percentile(mag, 85.0)).astype(np.uint8)
    return mask

def sample_gradient_stops(rgb: np.ndarray, text_mask: np.ndarray, angle_deg: float, k:int=6) -> List[Dict]:
    h, w, _ = rgb.shape
    yy, xx = np.mgrid[0:h, 0:w]
    t = math.radians(angle_deg)
    u, v = math.cos(t), math.sin(t)
    proj = (xx*u + yy*v)
    sel = (text_mask>0)
    if sel.sum() == 0:
        sel = np.ones((h,w), dtype=bool)
    p = proj[sel]
    pmin, pmax = p.min(), p.max()
    norm = np.zeros_like(proj, dtype=np.float32)
    norm[sel] = (proj[sel]-pmin)/(pmax-pmin+1e-6)
    stops = []
    for tt in np.linspace(0.0, 1.0, k):
        lo, hi = max(0.0, tt-0.02), min(1.0, tt+0.02)
        band = (sel) & (norm>=lo) & (norm<=hi)
        if band.sum() < 20:
            band = (sel) & (np.abs(norm - tt) <= 0.05)
        cols = rgb[band]
        if cols.size == 0:
            cols = rgb[sel]
        med = np.median(cols, axis=0)
        r,g,b = [int(np.clip(x,0,255)) for x in med[:3]]
        stops.append({
            "pos": float(round(tt,3)),
            "color": "#{:02X}{:02X}{:02X}".format(r,g,b),
            "rgb": [r,g,b]
        })
    stops[0]["pos"] = 0.0
    stops[-1]["pos"] = 1.0
    return stops

def ring_at(mask: np.ndarray, r: int) -> np.ndarray:
    if r<=0: return np.zeros_like(mask)
    d_r  = dilate(mask, r)
    d_r1 = dilate(mask, max(0, r-1))
    ring = ((d_r==1) & (d_r1==0)).astype(np.uint8)
    ring[mask>0] = 0
    return ring

def detect_stroke(rgb: np.ndarray, text_mask: np.ndarray, max_r:int=6) -> Dict:
    gray = rgb_to_luma(rgb)
    best = {"present": False}
    bg = median_color(rgb[...,:3], (text_mask==0).astype(np.uint8))
    best_score, best_k = 0.0, None
    best_color = None

    for k in range(1, max_r+1):
        ring = ring_at(text_mask, k)
        n = int(ring.sum())
        if n < 40: 
            continue
        cols = rgb[ring>0][:,:3].astype(np.float32)
        var = float(np.mean(np.var(cols, axis=0)))
        dist_bg = float(np.mean(color_distance(cols, bg)))
        score = (n**0.5) * (dist_bg / (var + 1e-3))
        if score > best_score:
            best_score = score
            med = np.median(cols, axis=0)
            best_color = [int(med[0]), int(med[1]), int(med[2])]
            best_k = k

    if best_k is not None and best_score > 25.0:
        opac = float(np.clip(color_distance(np.array(best_color), bg)/180.0, 0.2, 1.0))
        best = {
            "present": True,
            "width_px": int(best_k),
            "color": "#{:02X}{:02X}{:02X}".format(*best_color),
            "rgb": best_color,
            "opacity": round(float(opac), 2)
        }
    return best

def detect_outer_glow(rgb: np.ndarray, text_mask: np.ndarray, max_r:int=12) -> Dict:
    bg = median_color(rgb[...,:3], (text_mask==0).astype(np.uint8))
    bg_l = float(np.mean(bg))
    diffs, colors = [], []
    for k in range(2, max_r+1):
        ring = ring_at(text_mask, k)
        n = int(ring.sum())
        if n < 50:
            diffs.append(0.0); colors.append([0,0,0]); continue
        cols = rgb[ring>0][:,:3]
        med = np.median(cols, axis=0)
        colors.append(med.tolist())
        diffs.append(float(np.mean(rgb_to_luma(cols)) - bg_l))
    if not diffs:
        return {"present": False}

    peak_idx = int(np.argmax(np.abs(diffs)))
    peak_val = diffs[peak_idx]
    if abs(peak_val) < 6.0:
        return {"present": False}

    target = 0.2 * abs(peak_val)
    size_idx = peak_idx
    for i in range(peak_idx+1, len(diffs)):
        if abs(diffs[i]) <= target:
            size_idx = i
            break
    size_px = int(max(2, size_idx+2))

    col = [int(x) for x in colors[peak_idx]]
    opacity = float(np.clip(abs(peak_val)/60.0, 0.15, 0.8))
    return {
        "present": True,
        "color": "#{:02X}{:02X}{:02X}".format(*col),
        "rgb": col,
        "size_px": size_px,
        "opacity": round(opacity, 2)
    }

def detect_drop_shadow(rgb: np.ndarray, text_mask: np.ndarray) -> Dict:
    gray = rgb_to_luma(rgb)
    bg_l = float(np.median(gray[(text_mask==0)])) if (text_mask==0).sum()>0 else float(np.median(gray))
    angles = [0,45,90,135,180,225,270,315]
    best = {"present": False}
    best_score = 0.0

    for ang in angles:
        rad = math.radians(ang)
        ux, uy = math.cos(rad), math.sin(rad)
        for d in range(2, 11):
            dx = int(round(ux*d))
            dy = int(round(uy*d))
            sm = shift_mask(text_mask, dx, dy).astype(np.uint8)
            region = (sm>0) & (text_mask==0)
            n = int(region.sum())
            if n < 50:
                continue
            vals = gray[region]
            mean_l = float(np.mean(vals))
            diff = mean_l - bg_l   # ظل = أغمق من الخلفية
            var = float(np.var(vals))
            score = (-diff) * (n**0.5) / (math.sqrt(var+1e-3)+1.0)
            if diff < -4.0 and score > best_score:
                blur = 2
                best_score = score
                col = int(np.median(vals))
                best = {
                    "present": True,
                    "angle": float(ang),
                    "distance_px": int(d),
                    "size_px": int(blur),
                    "color": "#{:02X}{:02X}{:02X}".format(col, col, col),
                    "opacity": round(float(np.clip((-diff)/60.0, 0.15, 0.8)), 2)
                }
    return best

# -------------------- main per-bubble process --------------------
def build_text_mask_from_external(mask_rgba: np.ndarray, rect: Tuple[int,int,int,int]) -> Optional[np.ndarray]:
    x,y,w,h = rect
    H, W = mask_rgba.shape[:2]
    x2, y2 = min(x+w, W), min(y+h, H)
    if x>=W or y>=H or x2<=x or y2<=y: 
        return None
    crop_a = mask_rgba[y:y2, x:x2, 3]  # alpha
    return (crop_a > 0).astype(np.uint8)

def process_bubble(rgb_full: np.ndarray,
                   rect: Tuple[int,int,int,int],
                   external_text_mask: Optional[np.ndarray],
                   stops:int,
                   debug_dir: Optional[str],
                   page_label: str,
                   bubble_id: str) -> Dict:
    H, W, _ = rgb_full.shape
    x,y,w,h = rect
    x2, y2 = min(x+w, W), min(y+h, H)
    crop = rgb_full[y:y2, x:x2, :3]
    if crop.size == 0:
        return {"id": str(bubble_id), "error": "empty_crop", "bubble_rect": {"x":x,"y":y,"w":w,"h":h}}

    if external_text_mask is not None:
        text_mask = external_text_mask
    else:
        text_mask = estimate_text_mask_from_crop(crop)

    tb = bbox_from_mask(text_mask)
    gray = rgb_to_luma(crop)
    gx, gy = sobel_gradients(gray)
    angle = angle_from_vectors(gx, gy, text_mask)
    stops_list = sample_gradient_stops(crop, text_mask, angle, k=stops)
    stroke = detect_stroke(crop, text_mask)
    glow   = detect_outer_glow(crop, text_mask)
    shadow = detect_drop_shadow(crop, text_mask)

    if debug_dir:
        os.makedirs(debug_dir, exist_ok=True)
        # visualize mask
        dbg = np.zeros((crop.shape[0], crop.shape[1], 4), dtype=np.uint8)
        dbg[..., :3] = crop
        m = (text_mask>0)
        dbg[m, 1] = 255  # highlight in green (WHY: لمراجعة جودة القناع)
        save_png(dbg, os.path.join(debug_dir, f"{page_label}_bubble_{bubble_id}_mask.png"))

        # stroke ring preview
        st = ring_at(text_mask, stroke["width_px"]) if stroke.get("present") else np.zeros_like(text_mask)
        dbg2 = crop.copy()
        dbg2 = np.concatenate([dbg2, np.full((*dbg2.shape[:2],1),255,dtype=np.uint8)], axis=-1)
        dbg2[st>0] = [255,0,0,255]
        save_png(dbg2, os.path.join(debug_dir, f"{page_label}_bubble_{bubble_id}_stroke.png"))

    return {
        "id": str(bubble_id),
        "bubble_rect": {"x": x, "y": y, "w": w, "h": h},
        "text_bbox_in_bubble": ({"x": tb[0], "y": tb[1], "w": tb[2], "h": tb[3]} if tb else None),
        "gradient": {
            "type": "linear",
            "angle": round(float(angle), 2),
            "stops": [{"pos": s["pos"], "color": s["color"], "rgb": s["rgb"]} for s in stops_list]
        },
        "stroke": stroke,
        "outer_glow": glow,
        "drop_shadow": shadow
    }

# -------------------- glue: pages loop --------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", required=True, help="Path to temp-title.json")
    ap.add_argument("--bubbles", default=None, help="Override all_bubbles.json path (optional)")
    ap.add_argument("--out", required=True, help="Output styles_manifest.json")
    ap.add_argument("--stops", type=int, default=6)
    ap.add_argument("--debug-dir", default=None)
    ap.add_argument("--textmask-dir", default=None, help="Optional dir of per-page text masks with alpha")
    args = ap.parse_args()

    cfg = load_config(norm(args.config))
    folder = norm(cfg.get("folder_url",""))
    if not folder or not os.path.isdir(folder):
        raise FileNotFoundError(f"folder_url not found: {folder}")

    bubbles_path = norm(args.bubbles) if args.bubbles else os.path.join(folder, "all_bubbles.json")
    if not os.path.exists(bubbles_path):
        raise FileNotFoundError(f"bubbles json not found: {bubbles_path}")
    pages = load_bubbles(bubbles_path)

    manifest = {
        "schema": "v1.text_style_manifest",
        "source_folder": folder,
        "bubbles_json": bubbles_path,
        "items": []  # per page
    }

    # preload external text masks per page if provided
    mask_cache: Dict[str, np.ndarray] = {}
    if args.textmask_dir:
        for ext in IMG_EXTS:
            for p in glob.glob(os.path.join(args.textmask_dir, f"*{ext}")):
                name = os.path.splitext(os.path.basename(p))[0]
                try:
                    mask_cache[name] = load_image(p)
                except Exception:
                    pass

    # iterate pages
    for key, arr in pages.items():
        if not key.endswith("_mask"):
            continue
        label = key.replace("_mask","")
        img_path = find_page_image(folder, label)
        if img_path is None:
            # fallback: try numeric without leading zeros (e.g., "2")
            label2 = str(int(label)) if label.isdigit() else label
            img_path = find_page_image(folder, label2)
        if img_path is None:
            print(f"[WARN] page {label}: image not found in {folder}, skip.")
            continue

        rgb_full = load_image(img_path)
        H, W = rgb_full.shape[:2]

        # external mask page match (by basename == label or label2)
        ext_mask_rgba = None
        if args.textmask_dir:
            cand = None
            base = os.path.splitext(os.path.basename(img_path))[0]
            if base in mask_cache:
                cand = base
            elif label in mask_cache:
                cand = label
            elif label.isdigit() and str(int(label)) in mask_cache:
                cand = str(int(label))
            if cand:
                ext_mask_rgba = mask_cache[cand]

        page_entry = {
            "page_label": label,
            "image_path": norm(img_path),
            "bubbles": []
        }

        for b in (arr or []):
            bid = str(b.get("id", ""))
            pts = b.get("points", [])
            if not pts or len(pts) < 4:
                print(f"[WARN] page {label} bubble {bid}: invalid points, skip.")
                continue
            x,y,w,h = rect_from_points(pts)
            # clamp to image
            x = max(0, min(x, W-1)); y = max(0, min(y, H-1))
            w = max(1, min(w, W - x)); h = max(1, min(h, H - y))
            ext_text_mask = None
            if ext_mask_rgba is not None:
                ext_text_mask = build_text_mask_from_external(ext_mask_rgba, (x,y,w,h))
            item = process_bubble(rgb_full, (x,y,w,h), ext_text_mask, args.stops, args.debug_dir, label, bid)
            item["polygon_points"] = pts
            page_entry["bubbles"].append(item)

        manifest["items"].append(page_entry)
        print(f"[OK] page {label}: {len(page_entry['bubbles'])} bubbles processed.")

    os.makedirs(os.path.dirname(norm(args.out)), exist_ok=True)
    with open(norm(args.out), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f"[DONE] wrote: {norm(args.out)}")

if __name__ == "__main__":
    main()
