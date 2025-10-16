# -*- coding: utf-8 -*-
# FontStyle.py — robust bubbles normalizer + rich diagnostics
import json, os, sys, glob
import cv2
import numpy as np
from typing import List, Dict, Any, Tuple

# ============ ثابت: مسار temp-title.json ============
TEMP_JSON_PATH = r"C:\Users\abdoh\Downloads\testScript\config\temp-title.json"

# ============ عتبات تجاهل الأبيض/أسود ============
WHITE_BG_MIN   = 220
BLACK_TEXT_MAX = 60
WHITE_BG_COVER = 0.70
TEXT_COVER_MIN = 0.02

# ============ امتدادات الصور المحتملة ============
ORIG_EXTS = [".jpg", ".jpeg", ".png", ".JPG", ".JPEG", ".PNG"]

# ============ قراءة الإعدادات ============
def read_temp_config(path: str) -> Dict[str, Any]:
    if not os.path.isfile(path):
        raise FileNotFoundError("ملف الإعدادات غير موجود: " + path)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

# ============ البحث الذكي عن ملف الفقاعات ============
def smart_find_bubbles_json(folder: str, cli_override: str = None) -> str:
    if cli_override:
        p = os.path.normpath(cli_override)
        if os.path.isfile(p): return p
        raise FileNotFoundError("المسار الممرر لملف الفقاعات غير موجود: " + p)

    candidates = [
        os.path.join(folder, "bubbles.json"),
        os.path.join(folder, "all_bubbles.json"),
    ]
    for c in candidates:
        if os.path.isfile(c): return c

    patterns = [
        os.path.join(folder, "bubbles-*.json"),
        os.path.join(folder, "*bubbles*.json"),
        os.path.join(folder, "*bubble*.json"),
    ]
    matches = []
    for pat in patterns:
        matches.extend(glob.glob(pat))
    matches = [m for m in matches if os.path.isfile(m)]
    if not matches:
        raise FileNotFoundError("لم يتم العثور على أي ملف فقاعات داخل: " + folder)
    matches.sort(key=lambda p: os.path.getmtime(p), reverse=True)
    return matches[0]

# ============ تحميل الفقاعات (يدعم أكثر من شكل) ============
def _normalize_box(box: Dict[str, Any]) -> Dict[str, int]:
    """
    يعيد صندوقًا بصيغة موحّدة x,y,w,h؛ يدعم x1,y1,x2,y2 أو x,y,w,h.
    """
    # حاول x1,y1,x2,y2
    if all(k in box for k in ("x1","y1","x2","y2")):
        x1 = int(round(float(box["x1"])))
        y1 = int(round(float(box["y1"])))
        x2 = int(round(float(box["x2"])))
        y2 = int(round(float(box["y2"])))
        x = min(x1, x2); y = min(y1, y2)
        w = max(0, abs(x2 - x1)); h = max(0, abs(y2 - y1))
        return {"x": x, "y": y, "w": w, "h": h}
    # حاول x,y,w,h
    x = int(round(float(box.get("x", 0))))
    y = int(round(float(box.get("y", 0))))
    w = int(round(float(box.get("w", 0))))
    h = int(round(float(box.get("h", 0))))
    return {"x": x, "y": y, "w": w, "h": h}

def _extract_bubbles_array(item: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    يحاول إيجاد مصفوفة الفقاعات داخل العنصر بأي مفتاح شائع.
    """
    for key in ("bubbles","regions","boxes","items","rects","areas"):
        v = item.get(key)
        if isinstance(v, list):
            return v
    # لو العنصر نفسه قائمة صناديق (نادرًا)
    if isinstance(item, list):
        return item
    return []

def load_bubbles(bubbles_path: str) -> List[Dict[str, Any]]:
    with open(bubbles_path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    entries: List[Dict[str, Any]] = []
    if isinstance(raw, list):
        # شكل: [{"image": "...", "...": ...}, ...]
        for item in raw:
            img = item.get("image") or item.get("img") or item.get("file")
            bubbles = _extract_bubbles_array(item)
            entries.append({"image": img, "bubbles": bubbles})
    elif isinstance(raw, dict):
        # شكل: {"01.jpg": [..], "02.jpg": [...]}
        for img, bubbles in raw.items():
            entries.append({"image": img, "bubbles": bubbles if isinstance(bubbles, list) else []})
    else:
        raise ValueError("صيغة bubbles.json غير مدعومة.")

    # طبع عينة تشخيصية
    if entries:
        first = entries[0]
        print("🧩 DEBUG: example image entry keys ->", list(first.keys()))
        print("🧩 DEBUG: bubbles key type/len ->", type(first["bubbles"]).__name__, len(first["bubbles"]))
    else:
        print("⚠️ ملف الفقاعات لا يحتوي على أي عناصر.")

    # تأكد من وجود image ومصفوفة فقاعات
    normalized: List[Dict[str, Any]] = []
    for e in entries:
        if not e.get("image"):
            # عنونة ناقصة
            continue
        bubbles = _extract_bubbles_array(e) if "bubbles" not in e else e["bubbles"]
        if not isinstance(bubbles, list):
            bubbles = []
        normalized.append({"image": e["image"], "bubbles": bubbles})
    return normalized

# ============ ألوان ومساعدات ============
def bgr_to_hex(c): 
    if c is None: return None
    b,g,r = c
    return "#{:02X}{:02X}{:02X}".format(r,g,b)

def median_color(pixels):
    if pixels is None or len(pixels) == 0:
        return None
    return tuple(np.median(pixels, axis=0).astype(np.uint8).tolist())

# ============ حل اسم الصورة إلى الأصل ============
def resolve_image_path(folder: str, image_field: str, use_cleaned_fallback: bool=False) -> str:
    if not image_field:
        return ""
    # مطلق؟
    if os.path.isabs(image_field) and os.path.isfile(image_field):
        return image_field
    # كما هو
    p0 = os.path.join(folder, image_field)
    if os.path.isfile(p0):
        return p0

    name = os.path.basename(image_field)
    stem, ext = os.path.splitext(name)

    base = stem
    for suf in ("_mask","_clean"):
        if base.endswith(suf):
            base = base[:-len(suf)]

    # لو فيه امتداد جرّب في الجذر
    if ext and os.path.isfile(os.path.join(folder, stem + ext)):
        return os.path.join(folder, stem + ext)

    # جرّب الامتدادات الشائعة
    for e in ORIG_EXTS:
        cand = os.path.join(folder, base + e)
        if os.path.isfile(cand):
            return cand

    # (اختياري) fallback للـ cleaned
    if use_cleaned_fallback:
        cleaned = os.path.join(folder, "cleaned", f"{base}_clean.jpg")
        if os.path.isfile(cleaned):
            return cleaned

    return ""

# ============ بناء قناع النص ============
def robust_text_mask(bgr_roi):
    gray = cv2.cvtColor(bgr_roi, cv2.COLOR_BGR2GRAY)
    blur = cv2.medianBlur(gray, 3)
    th = cv2.adaptiveThreshold(blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                               cv2.THRESH_BINARY_INV, 31, 15)
    k = cv2.getStructuringElement(cv2.MORPH_RECT, (2,2))
    m = cv2.morphologyEx(th, cv2.MORPH_OPEN, k, 1)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, k, 1)
    # إزالة الضوضاء الصغيرة
    num, lab, stats, _ = cv2.connectedComponentsWithStats(m, 8)
    min_area = max(10, int(0.0005 * m.size))
    cleaned = np.zeros_like(m)
    for i in range(1, num):
        if stats[i, cv2.CC_STAT_AREA] >= min_area:
            cleaned[lab == i] = 255
    return cleaned

def is_white_bubble_black_text(bgr_roi, text_mask):
    roi_gray = cv2.cvtColor(bgr_roi, cv2.COLOR_BGR2GRAY)
    fg = (text_mask == 255); bg = ~fg

    if np.count_nonzero(fg) < max(10, int(TEXT_COVER_MIN * text_mask.size)):
        return False

    bg_vals = roi_gray[bg]; fg_vals = roi_gray[fg]
    white_cover = np.mean(bg_vals > WHITE_BG_MIN) if bg_vals.size else 0.0
    bg_mean = float(np.mean(bg_vals)) if bg_vals.size else 255.0
    fg_mean = float(np.mean(fg_vals)) if fg_vals.size else 0.0
    return (white_cover >= WHITE_BG_COVER) and (bg_mean >= WHITE_BG_MIN) and (fg_mean <= BLACK_TEXT_MAX)

def inner_text_mask(text_mask, erode_px=1):
    if erode_px <= 0: return text_mask.copy()
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2*erode_px+1, 2*erode_px+1))
    return cv2.erode(text_mask, k, 1)

# ============ تقديرات الألوان/التأثيرات ============
def estimate_gradient_top_bottom(bgr_roi, text_mask):
    h, w = text_mask.shape
    erode_px = max(1, min(h, w)//150)
    inner = inner_text_mask(text_mask, erode_px)

    ys, xs = np.where(inner == 255)
    if len(ys) < 5:
        return None, None

    y_min, y_max = int(np.min(ys)), int(np.max(ys))
    span = max(1, y_max - y_min)
    top_band_max = y_min + int(0.25*span)
    bot_band_min = y_max - int(0.25*span)

    top_sel = ys <= top_band_max
    bot_sel = ys >= bot_band_min

    top_pixels = bgr_roi[ys[top_sel], xs[top_sel]]
    bot_pixels = bgr_roi[ys[bot_sel], xs[bot_sel]]

    return median_color(top_pixels), median_color(bot_pixels)

def estimate_stroke(bgr_roi, text_mask, max_stroke_px=12):
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3,3))
    dil = text_mask.copy()
    last_ring = None; thickness = 0

    for t in range(1, max_stroke_px+1):
        dil = cv2.dilate(dil, k, 1)
        ring = cv2.subtract(dil, text_mask)
        if np.count_nonzero(ring) < 20: break
        last_ring = ring; thickness = t

    if last_ring is None or thickness == 0:
        return None, 0

    ys, xs = np.where(last_ring == 255)
    ring_pixels = bgr_roi[ys, xs]
    return median_color(ring_pixels), thickness

def estimate_drop_shadow(bgr_roi, text_mask, enable=True):
    if not enable: return None
    h, w = text_mask.shape
    bg = cv2.medianBlur(cv2.cvtColor(bgr_roi, cv2.COLOR_BGR2GRAY), 9)
    dil = cv2.dilate(text_mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5,5)), 2)
    border = cv2.subtract(dil, text_mask)
    ys, xs = np.where(border == 255)
    if len(xs) < 50: return None
    vals = bg[ys, xs].astype(np.float32)
    mean_bg = float(np.mean(bg))
    cand = (vals < (mean_bg - 8))
    if not np.any(cand): return None
    cs = bgr_roi[ys[cand], xs[cand]]
    color = median_color(cs)
    return {
        "color": bgr_to_hex(color),
        "opacity": 0.35,
        "offset": [3, 3],
        "blur": 6
    }

# ============ المعالجة لكل صورة ============
def process_image(img_path: str, bubbles: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], Dict[str,int]]:
    img = cv2.imread(img_path, cv2.IMREAD_COLOR)
    if img is None:
        print("❌ تعذّر فتح الصورة:", img_path)
        return [], {"total":0,"roi_empty":0,"white_black":0,"no_text":0,"ok":0}

    stats = {"total":0,"roi_empty":0,"white_black":0,"no_text":0,"ok":0}
    styles = []

    for b in bubbles:
        stats["total"] += 1
        # طبيع الصندوق لأي صيغة
        box = _normalize_box(b)
        x, y, w, h = box["x"], box["y"], box["w"], box["h"]
        bid = b.get("id", f"{x}_{y}_{w}_{h}")

        # حماية من الخروج عن الحدود
        H, W = img.shape[:2]
        x = max(0, min(x, W-1))
        y = max(0, min(y, H-1))
        w = max(0, min(w, W - x))
        h = max(0, min(h, H - y))

        roi = img[y:y+h, x:x+w]
        if roi.size == 0:
            stats["roi_empty"] += 1
            continue

        text_mask = robust_text_mask(roi)

        if is_white_bubble_black_text(roi, text_mask):
            stats["white_black"] += 1
            styles.append({"id": bid, "skip": True, "reason": "white_bubble_black_text"})
            continue

        top_c, bot_c = estimate_gradient_top_bottom(roi, text_mask)
        if top_c is None and bot_c is None:
            # لم يُرصد نص معتبر داخل الحرف
            stats["no_text"] += 1
            styles.append({"id": bid, "skip": True, "reason": "no_text_detected"})
            continue

        stroke_c, stroke_px = estimate_stroke(roi, text_mask, 12)
        shadow = estimate_drop_shadow(roi, text_mask, enable=True)

        styles.append({
            "id": bid,
            "skip": False,
            "gradient": {
                "angle_deg": 90,
                "top_color": bgr_to_hex(top_c),
                "bottom_color": bgr_to_hex(bot_c)
            },
            "stroke": {
                "color": bgr_to_hex(stroke_c) if stroke_c else None,
                "size_px": int(stroke_px) if stroke_px else 0,
                "position": "outside"
            },
            "shadow": shadow
        })
        stats["ok"] += 1

    return styles, stats

# ============ Main ============
def main():
    # خيارات CLI:
    #   python FontStyle.py
    #   python FontStyle.py --bubbles "C:\...\my_bubbles.json" --out "C:\...\styles_out.json" --use-cleaned-fallback
    bubbles_override = None
    out_override = None
    use_cleaned_fallback = ("--use-cleaned-fallback" in sys.argv)

    args = sys.argv[1:]
    for i, t in enumerate(args):
        if t == "--bubbles" and i+1 < len(args):
            bubbles_override = args[i+1]
        if t == "--out" and i+1 < len(args):
            out_override = args[i+1]

    cfg = read_temp_config(TEMP_JSON_PATH)
    folder = cfg.get("folder_url")
    if not folder:
        raise ValueError("القيمة 'folder_url' غير موجودة داخل temp-title.json")
    folder = os.path.normpath(folder)

    bubbles_path = smart_find_bubbles_json(folder, cli_override=bubbles_override)
    out_styles_json = os.path.normpath(out_override) if out_override else os.path.join(folder, "styles_out.json")
    out_meta_json   = os.path.join(folder, "styles_out_meta.json")

    print("📂 Folder:", folder)
    print("📑 Bubbles:", bubbles_path)
    print("📤 Output :", out_styles_json)

    entries = load_bubbles(bubbles_path)

    output = []
    meta = {"images": []}

    for item in entries:
        image_field = item["image"]
        img_path = resolve_image_path(folder, image_field, use_cleaned_fallback=use_cleaned_fallback)

        if not img_path:
            print("⚠️ تعذّر تحديد الصورة الأصلية لهذه القيمة في JSON:", image_field)
            output.append({"image": image_field, "styles": [], "error": "image_not_found"})
            meta["images"].append({
                "image_field": image_field, "resolved": None,
                "total": 0,"roi_empty": 0,"white_black": 0,"no_text": 0,"ok": 0,
                "note": "resolve_failed"
            })
            continue

        if not os.path.isfile(img_path):
            print("⚠️ الصورة غير موجودة، سيتم تخطيها:", img_path)
            output.append({"image": image_field, "styles": [], "error": "image_missing"})
            meta["images"].append({
                "image_field": image_field, "resolved": img_path,
                "total": 0,"roi_empty": 0,"white_black": 0,"no_text": 0,"ok": 0,
                "note": "file_missing"
            })
            continue

        styles, stats = process_image(img_path, item["bubbles"])
        output.append({"image": os.path.basename(img_path), "styles": styles})
        meta["images"].append({
            "image_field": image_field, "resolved": img_path, **stats
        })

        # طباعة تشخيص سريع
        print(f"  → {os.path.basename(img_path)} | bubbles: {stats['total']} | ok:{stats['ok']} wb:{stats['white_black']} noText:{stats['no_text']} roi0:{stats['roi_empty']}")

    with open(out_styles_json, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    with open(out_meta_json, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    print("✅ تم الحفظ:", out_styles_json)
    print("🗒️ تقرير تشخيصي:", out_meta_json)

if __name__ == "__main__":
    main()
