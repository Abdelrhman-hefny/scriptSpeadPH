import os, cv2, json, numpy as np
from glob import glob
from pathlib import Path
import argparse, re
import subprocess

CONFIG_JSON   = r"C:\Users\abdoh\Downloads\testScript\config\temp-title.json"
DOWNLOADS_DIR = r"C:\Users\abdoh\Downloads"

# ── Progress Bar خفيف ──
try:
    from tqdm import tqdm
    def pwrite(msg: str):  # يطبع بدون كسر الشريط
        tqdm.write(str(msg))
except ImportError:
    def tqdm(x, **kwargs):  # fallback صامت إذا لم تتوفر tqdm
        return x
    def pwrite(msg: str):
        print(msg)

def get_local_base_from_cfg(cfg: dict) -> Path:
    title      = (cfg.get("title") or "Untitled").strip()
    folder     = (cfg.get("folder") or "").strip()
    folder_url = (cfg.get("folder_url") or "").strip()
    if folder and os.path.isdir(folder):         return Path(folder)
    if folder_url and os.path.isdir(folder_url): return Path(folder_url)
    return Path(DOWNLOADS_DIR) / title

def load_work_dir() -> Path:
    with open(CONFIG_JSON, "r", encoding="utf-8") as f:
        cfg = json.load(f)
    base = get_local_base_from_cfg(cfg)
    return base / "cleaned"

def load_mask_alpha_to_binary(path_rgba, thr=10):
    m = cv2.imread(str(path_rgba), cv2.IMREAD_UNCHANGED)
    if m is None: raise ValueError(f"Mask not found: {path_rgba}")
    if m.ndim >= 3 and m.shape[2] >= 4:
        alpha = m[:, :, 3]; return ((alpha > thr).astype(np.uint8) * 255)
    if m.ndim == 2: return ((m > thr).astype(np.uint8) * 255)
    raise ValueError(f"Unsupported mask format: {path_rgba}")

def ring_from_mask(mask, dilate=9, erode=3):
    k = np.ones((3,3), np.uint8)
    dil = cv2.dilate(mask, k, iterations=dilate)
    ero = cv2.erode(mask,  k, iterations=erode)
    ring = cv2.bitwise_and(dil, cv2.bitwise_not(ero))
    if cv2.countNonZero(ring) < 50:
        ring = cv2.dilate(mask, k, iterations=dilate+6)
    return ring

def ring_stats(img_bgr, mask):
    ring = ring_from_mask(mask)
    idx = np.where(ring > 0)
    if len(idx[0]) == 0:
        ring = cv2.bitwise_not(mask); idx = np.where(ring > 0)
    px = img_bgr[idx]
    median = np.median(px, axis=0).astype(np.uint8)
    std = float(np.std(px, axis=0).mean())
    return median, std, idx

def inpaint_telea(img, mask, radius=3):
    return cv2.inpaint(img, (mask>0).astype(np.uint8)*255, radius, cv2.INPAINT_TELEA)

def inpaint_navier(img, mask, radius=3):
    return cv2.inpaint(img, (mask>0).astype(np.uint8)*255, radius, cv2.INPAINT_NS)

def inpaint_biharmonic(img, mask):
    from skimage.restoration import inpaint
    img_f = img.astype(np.float32) / 255.0
    m = (mask > 0).astype(bool)
    out = np.empty_like(img_f)
    for c in range(3):
        out[..., c] = inpaint.inpaint_biharmonic(img_f[..., c], m)
    return np.clip(out * 255.0, 0, 255).astype(np.uint8)

def plane_fit_fill(img, mask, ring_idx):
    h, w = mask.shape
    yy, xx = np.indices((h, w))
    inside = (mask > 0)
    y_r, x_r = ring_idx
    A = np.stack([x_r.astype(np.float32), y_r.astype(np.float32), np.ones_like(x_r, np.float32)], axis=1)
    out = img.copy()
    for c in range(3):
        z = img[y_r, x_r, c].astype(np.float32)
        coeffs, *_ = np.linalg.lstsq(A, z, rcond=None)
        a, b, c0 = coeffs
        plane = (a*xx + b*yy + c0).astype(np.float32)
        out[..., c][inside] = np.clip(plane[inside], 0, 255).astype(np.uint8)
    edge = cv2.GaussianBlur(mask, (0,0), 1.2)
    edge = (edge/255.0)[:, :, None]
    out = (out*edge + img*(1-edge)).astype(np.uint8)
    return out

IMG_EXTS = [".png", ".jpg", ".jpeg", ".webp"]

def find_clean_image_for_mask(mask_path: Path) -> Path | None:
    base = mask_path.stem
    core = re.sub(r"[_-]mask$", "", base, flags=re.IGNORECASE)
    folder = mask_path.parent
    for ext in IMG_EXTS:
        cand = folder / f"{core}_clean{ext}"
        if cand.exists(): return cand
    for ext in IMG_EXTS:
        cand = folder / f"{core}{ext}"
        if cand.exists(): return cand
    return None

def clean_one(mask_path: Path, mode="auto", erode_iters=1, telea_radius=4):
    img_path = find_clean_image_for_mask(mask_path)
    if not img_path:
        pwrite(f"لا توجد صورة مقابلة للماسك: {mask_path.name}")
        return
    img = cv2.imread(str(img_path), cv2.IMREAD_COLOR)
    if img is None:
        pwrite(f"Skip (bad image): {img_path}")
        return

    mask = load_mask_alpha_to_binary(mask_path)
    k = np.ones((3,3), np.uint8)
    mask_tight = cv2.erode(mask, k, iterations=erode_iters)

    median, ring_std, ring_idx = ring_stats(img, mask_tight)

    if mode == "auto":
        filled = plane_fit_fill(img, mask_tight, ring_idx)
        out = inpaint_telea(filled, mask_tight, radius=max(1, telea_radius-1))
    elif mode == "telea":
        out = inpaint_telea(img, mask_tight, radius=telea_radius)
    elif mode == "navier":
        out = inpaint_navier(img, mask_tight, radius=telea_radius)
    elif mode == "biharmonic":
        out = inpaint_biharmonic(img, mask_tight)
    elif mode == "fill":
        fill = np.full_like(img, median)
        edge = cv2.GaussianBlur(mask_tight, (0,0), 1.2)
        edge = (edge/255.0)[:, :, None]
        base = (fill*edge + img*(1-edge)).astype(np.uint8)
        out  = inpaint_telea(base, mask_tight, radius=max(1, telea_radius-1))
    else:
        raise ValueError("Unknown mode")

    cv2.imwrite(str(img_path), out)
    # تم إلغاء الطباعة التفصيلية "Overwrote: ..." لتخفيف الإخراج

def main():
    ap = argparse.ArgumentParser(description="Clean text regions in-place using masks in 'cleaned' folder from config JSON.")
    ap.add_argument("--mode",   default="auto", choices=["auto","telea","navier","biharmonic","fill"])
    ap.add_argument("--radius", type=int, default=3)
    ap.add_argument("--erode",  type=int, default=1)
    args = ap.parse_args()

    work_dir = load_work_dir()
    if not work_dir.exists():
        pwrite(f" مجلد غير موجود: {work_dir}")
        return

    masks = sorted(Path(work_dir).glob("*_mask.png"))
    if not masks:
        pwrite(f"لا توجد أقنعة *_mask.png داخل: {work_dir}")
        return

    # ── Progress Bar بدل الطباعة لكل ملف ──
    for mp in tqdm(masks, desc="Cleaning masks", unit="mask"):
        clean_one(mp, mode=args.mode, erode_iters=args.erode, telea_radius=args.radius)

    pwrite("Done.")

    try:
        with open(CONFIG_JSON, "r", encoding="utf-8") as f:
            cfg = json.load(f)

        def truthy(v): return str(v).strip().lower() in ("1", "true", "yes", "y", "on")

        dont_open_after_clean = truthy(cfg.get("dont_Open_After_Clean", False))
        photoshop_exe = cfg.get("pspath", r"C:\Program Files\Adobe\Adobe Photoshop CC 2019\Adobe Photoshop CC 2019\Photoshop.exe")
        jsx_script    = r"C:\Users\abdoh\Downloads\testScript\scripts\script.jsx"

        skip_jsx  = os.getenv("SKIP_JSX", "0") == "1"
        allow_jsx = os.getenv("ALLOW_JSX", "0") == "1"

        if skip_jsx:
            pwrite("SKIP_JSX=1 → skipping Photoshop JSX launch from cleaner.")
        elif dont_open_after_clean:
            pwrite("⏭️ dont_Open_After_Clean=True → Skipping Photoshop JSX script.")
        elif not allow_jsx:
            pwrite("SKIP: cleaner will not launch Photoshop (ALLOW_JSX != 1).")
        else:
            pwrite("🚀 Running Photoshop JSX script from cleaner...")
            if not os.path.exists(photoshop_exe): raise FileNotFoundError(f"Photoshop not found: {photoshop_exe}")
            if not os.path.exists(jsx_script):    raise FileNotFoundError(f"JSX script not found: {jsx_script}")
            subprocess.run(f'"{photoshop_exe}" -r "{jsx_script}"', shell=True, check=True)
            pwrite("✅ Photoshop script executed successfully.")

    except Exception as e:
        pwrite(f"❌ Failed to decide/run JSX script: {e}")

if __name__ == "__main__":
    main()
