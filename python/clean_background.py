# clean_text_regions_from_config.py
import os, cv2, json, numpy as np
from glob import glob
from pathlib import Path
import argparse, re

# --------- إعداد: قراءة مسار الفصل من JSON ---------
CONFIG_JSON = r"C:\Users\abdoh\Downloads\testScript\config\temp-title.json"

def load_work_dir():
    with open(CONFIG_JSON, "r", encoding="utf-8") as f:
        cfg = json.load(f)
    base = Path(cfg["folder_url"])  # مثال: C:/Users/abdoh/Downloads/21_seren_shes
    work = base / "cleaned"         # نشتغل فقط هنا
    return work

# --------- أدوات عامة ---------
def load_mask_alpha_to_binary(path_rgba, thr=10):
    m = cv2.imread(str(path_rgba), cv2.IMREAD_UNCHANGED)
    if m is None:
        raise ValueError(f"Mask not found: {path_rgba}")
    # RGBA → استخدم alpha
    if m.ndim >= 3 and m.shape[2] >= 4:
        alpha = m[:, :, 3]
        return ((alpha > thr).astype(np.uint8) * 255)
    # أو ماسك رمادي مباشر
    if m.ndim == 2:
        return ((m > thr).astype(np.uint8) * 255)
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

# --------- طرق الترميم ---------
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

# --------- منطق التشغيل على مجلد cleaned ---------
IMG_EXTS = [".png", ".jpg", ".jpeg", ".webp"]

def find_clean_image_for_mask(mask_path: Path) -> Path | None:
    """
    من NN_mask.png → ابحث عن NN_clean.(png/jpg/…)
    """
    base = mask_path.stem  # "NN_mask"
    # استخرج الرقم أو الاسم الأساس قبل "_mask"
    core = re.sub(r"[_-]mask$", "", base, flags=re.IGNORECASE)
    folder = mask_path.parent
    for ext in IMG_EXTS:
        cand = folder / f"{core}_clean{ext}"
        if cand.exists(): return cand
    # احتياط: لو الصورة بدون "_clean"
    for ext in IMG_EXTS:
        cand = folder / f"{core}{ext}"
        if cand.exists(): return cand
    return None

def clean_one(mask_path: Path, mode="auto", erode_iters=1, telea_radius=4):
    img_path = find_clean_image_for_mask(mask_path)
    if not img_path:
        print(f"لا توجد صورة مقابلة للماسك: {mask_path.name}")
        return

    img = cv2.imread(str(img_path), cv2.IMREAD_COLOR)
    if img is None:
        print("Skip (bad image):", img_path); return

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

    # استبدال الصورة في نفس مكانها ونفس الاسم
    cv2.imwrite(str(img_path), out)
    print(f" Overwrote: {img_path.name}   [mask={mask_path.name}]")

def main():
    ap = argparse.ArgumentParser(description="Clean text regions in-place using masks in 'cleaned' folder from config JSON.")
    ap.add_argument("--mode", default="auto", choices=["auto","telea","navier","biharmonic","fill"], help="طريقة الترميم")
    ap.add_argument("--radius", type=int, default=3, help="نصف قطر Telea/Navier")
    ap.add_argument("--erode", type=int, default=1, help="تنحيف الماسك عند الحواف")
    args = ap.parse_args()

    work_dir = load_work_dir()  # …\21_seren_shes\cleaned
    if not work_dir.exists():
        print(f" مجلد غير موجود: {work_dir}")
        return

    # اعمل فقط على الأقنعة *_mask.png
    masks = sorted(Path(work_dir).glob("*_mask.png"))
    if not masks:
        print(f"لا توجد أقنعة *_mask.png داخل: {work_dir}")
        return

    for mp in masks:
        clean_one(mp, mode=args.mode, erode_iters=args.erode, telea_radius=args.radius)

    print("Done.")

    # ==== منطق تشغيل JSX بعد التنظيف بناءً على dont_Open_After_Clean ====
    try:
        import json, os, subprocess

        # نقرأ الإعدادات
        with open(CONFIG_JSON, "r", encoding="utf-8") as f:
            cfg = json.load(f)

        # دالة تحويل القيم إلى Boolean
        def truthy(v):
            return str(v).strip().lower() in ("1", "true", "yes", "y", "on")

        dont_open_after_clean = truthy(cfg.get("dont_Open_After_Clean", False))

        photoshop_exe = cfg.get(
            "pspath",
            r"C:\Program Files\Adobe\Adobe Photoshop CC 2019\Photoshop.exe"
        )
        jsx_script = r"C:\Users\abdoh\Downloads\testScript\scripts\script.jsx"

        if dont_open_after_clean:
            print("⏭️ dont_Open_After_Clean=True → Skipping Photoshop JSX script.")
        else:
            print("🚀 Running Photoshop JSX script...")
            if not os.path.exists(photoshop_exe):
                raise FileNotFoundError(f"Photoshop not found: {photoshop_exe}")
            if not os.path.exists(jsx_script):
                raise FileNotFoundError(f"JSX script not found: {jsx_script}")
            subprocess.run(f'"{photoshop_exe}" -r "{jsx_script}"', shell=True, check=True)
            print("✅ Photoshop script executed successfully.")

    except Exception as e:
        print(f"❌ Failed to decide/run JSX script: {e}")

if __name__ == "__main__":
    main()



# work