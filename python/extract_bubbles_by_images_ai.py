from ultralytics import YOLO
import os, json, cv2, numpy as np, subprocess, logging, time, gc, sys, traceback
from PIL import Image
from datetime import datetime

try:
    import torch
except ImportError:
    pass

log_file = rf"C:\Users\abdoh\Downloads\testScript\log\detector_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.FileHandler(log_file, encoding="utf-8"), logging.StreamHandler()],
)
logger = logging.getLogger(__name__)

DOWNLOADS_DIR = r"C:\Users\abdoh\Downloads"

def resolve_base_from_cfg(cfg: dict) -> str:
    title      = (cfg.get("title") or "Untitled").strip()
    folder     = (cfg.get("folder") or "").strip()
    folder_url = (cfg.get("folder_url") or "").strip()
    if folder and os.path.isdir(folder):        return folder
    if folder_url and os.path.isdir(folder_url): return folder_url
    return os.path.join(DOWNLOADS_DIR, title)

success = True
try:
    cfg_path = r"C:\Users\abdoh\Downloads\testScript\config\temp-title.json"
    with open(cfg_path, encoding="utf-8") as f:
        cfg = json.load(f)

    base = resolve_base_from_cfg(cfg)
    image_folder = base
    output_path = os.path.join(base, "all_bubbles.json")

    MODEL_FILENAME = "comic-speech-bubble-detector.pt"
    model_path = os.path.join(r"C:\Users\abdoh\Downloads\testScript\model", MODEL_FILENAME)
    model = YOLO(model_path)

    ocr_model = cfg.get("ocr_model", "paddle")
    ocr_device = "cpu"
    if 'torch' in locals() and 'torch' in globals() and torch.cuda.is_available():
        ocr_device = "gpu"

    if ocr_model == "paddle":
        try:
            from paddleocr import PaddleOCR
            lang = "korean" if cfg.get("mangaType") in ["korian", "korean"] else "japan"
            ocr = PaddleOCR(use_textline_orientation=True, lang=lang, device=ocr_device)
            OCR_TYPE = "paddle"; logger.info(f"✅ Using PaddleOCR with lang={lang} on device={ocr_device}.")
        except Exception:
            ocr_model = "manga"
    if ocr_model == "manga":
        try:
            from manga_ocr import MangaOcr
            ocr = MangaOcr(); OCR_TYPE = "manga"; logger.info("✅ Using MangaOCR for text validation.")
        except Exception:
            ocr_model = "easy"
    if ocr_model == "easy":
        import easyocr
        OCR_TYPE = "easy"; logger.warning("⚠️ Using EasyOCR.")
        gpu_status = (ocr_device == "gpu")
        ocr_ja = easyocr.Reader(["en", "ja"], gpu=gpu_status)
        ocr_ko = easyocr.Reader(["en", "ko"], gpu=gpu_status)

    CONFIDENCE_THRESHOLD = 0.15
    IOU_THRESHOLD = 0.7
    MERGE_IOU_THRESHOLD = 0.5
    SLICE_OVERLAP = 300
    SLICE_HEIGHT = 4000
    MIN_BUBBLE_AREA = 1000
    CONTAINMENT_THRESHOLD = 0.95
    MIN_DIM_THRESHOLD = 50
    YOLO_IMG_SIZE = 1280
    BOX_EXPANSION_PIXELS = 10

    def preprocess_image(img):
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB); l,a,b = cv2.split(lab)
        l = cv2.createCLAHE(3.0,(8,8)).apply(l)
        enhanced_lab = cv2.cvtColor(cv2.merge([l,a,b]), cv2.COLOR_LAB2BGR)

        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV); h,s,v = cv2.split(hsv)
        v = cv2.equalizeHist(v); s = cv2.createCLAHE(4.0,(8,8)).apply(s)
        enhanced_hsv = cv2.cvtColor(cv2.merge([h,s,v]), cv2.COLOR_HSV2BGR)

        hsl = cv2.cvtColor(img, cv2.COLOR_BGR2HLS); H,L,S = cv2.split(hsl)
        L = cv2.equalizeHist(L)
        enhanced_hsl = cv2.cvtColor(cv2.merge([H,L,S]), cv2.COLOR_HLS2BGR)

        final = cv2.addWeighted(enhanced_lab,0.5,enhanced_hsv,0.3,0)
        final = cv2.addWeighted(final,0.8,enhanced_hsl,0.2,0)
        gray = cv2.cvtColor(final, cv2.COLOR_BGR2GRAY)
        return cv2.addWeighted(final,0.8,cv2.cvtColor(gray,cv2.COLOR_GRAY2BGR),0.2,0)

    def smart_slice_image(image, target_h, overlap, delta=200):
        h, w = image.shape[:2]; slices = []; y_start = 0
        while y_start < h:
            y_cut = min(y_start + target_h, h)
            if y_cut == h:
                slices.append((image[y_start:h, :].copy(), y_start)); break
            best_cut, best_score = y_cut, float("inf")
            for dy in range(-delta, delta + 1):
                yc = y_cut + dy
                if yc <= y_start + overlap or yc >= h: continue
                line = cv2.cvtColor(image[yc:yc+1,:], cv2.COLOR_BGR2GRAY)
                cost = np.sum(np.abs(np.diff(line[0].astype(np.int32))))
                if cost < best_score: best_score, best_cut = cost, yc
            slices.append((image[y_start:best_cut, :].copy(), y_start))
            y_start = best_cut - overlap
        return slices

    def box_iou(a,b):
        x1,y1,x2,y2=a; X1,Y1,X2,Y2=b
        ix1,iy1=max(x1,X1),max(y1,Y1); ix2,iy2=min(x2,X2),min(y2,Y2)
        inter=max(0,ix2-ix1)*max(0,iy2-iy1); A=(x2-x1)*(y2-y1); B=(X2-X1)*(Y2-Y1)
        U=A+B-inter; return inter/ U if U>0 else 0

    def is_contained(small, large):
        x1,y1,x2,y2=small; X1,Y1,X2,Y2=large
        ix1,iy1=max(x1,X1),max(y1,Y1); ix2,iy2=min(x2,X2),min(y2,Y2)
        inter=max(0,ix2-ix1)*max(0,iy2-iy1); A=(x2-x1)*(y2-y1)
        return (inter/ A)>=CONTAINMENT_THRESHOLD if A>0 else False

    def merge_and_clean_boxes(boxes_raw, scores_raw):
        if not boxes_raw: return [], []
        idx = np.argsort(-np.array(scores_raw)); boxes=np.array(boxes_raw)[idx]; scores=np.array(scores_raw)[idx]
        final_boxes=[]; final_scores=[]; picked=[]
        for i in range(len(boxes)):
            if scores[i] < CONFIDENCE_THRESHOLD: continue
            keep=True
            for j in picked:
                if box_iou(boxes[i], final_boxes[j]) > MERGE_IOU_THRESHOLD:
                    fb=final_boxes[j]; x1=min(boxes[i][0],fb[0]); y1=min(boxes[i][1],fb[1]); x2=max(boxes[i][2],fb[2]); y2=max(boxes[i][3],fb[3])
                    final_boxes[j]=[x1,y1,x2,y2]; final_scores[j]=max(scores[i],final_scores[j]); keep=False; break
            if keep: final_boxes.append(boxes[i].tolist()); final_scores.append(scores[i]); picked.append(len(final_boxes)-1)
        rem=set()
        for i in range(len(final_boxes)):
            for j in range(len(final_boxes)):
                if i!=j and is_contained(final_boxes[i], final_boxes[j]): rem.add(i)
        fb=np.array(final_boxes); fs=np.array(final_scores)
        final_boxes =[b.tolist() for k,b in enumerate(fb) if k not in rem]
        final_scores=[s.item() for k,s in enumerate(fs) if k not in rem]
        return final_boxes, final_scores

    def has_text(image, box):
        x1,y1,x2,y2=map(int,box); crop=image[y1:y2, x1:x2]
        if crop.size==0: return False
        gray=cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
        text_found=False
        if OCR_TYPE=="paddle":
            result=ocr.ocr(gray, cls=True)
            if result and result[0]:
                text=" ".join([ln[1][0] for ln in result[0]]); text_found=bool(text.strip())
        elif OCR_TYPE=="manga":
            text=ocr(Image.fromarray(gray)); text_found=bool(text.strip())
        else:
            import easyocr  # already imported above, but safe
            ja=" ".join(ocr_ja.readtext(gray, detail=0)); ko=" ".join(ocr_ko.readtext(gray, detail=0))
            text_found=bool((ja+" "+ko).strip())
        if not text_found:
            _,th=cv2.threshold(gray,200,255,cv2.THRESH_BINARY_INV)
            k=np.ones((3,3),np.uint8); dil=cv2.dilate(th,k,1)
            h,w=dil.shape[:2]; cc=dil[int(h*0.25):int(h*0.75), int(w*0.1):int(w*0.9)]
            if cc.size>0 and (np.sum(cc>0)/cc.size)>0.015: return True
        return text_found

    image_files = sorted([f for f in os.listdir(image_folder) if f.lower().endswith((".png",".jpg",".jpeg"))])
    logger.info(f"🔍 Found {len(image_files)} images in {image_folder}")

    all_bubbles={}
    for idx, img_file in enumerate(image_files, start=1):
        img_path=os.path.join(image_folder, img_file)
        image=cv2.imread(img_path)
        if image is None:
            logger.warning(f"⚠️ Can't read image: {img_path}"); continue
        enhanced=preprocess_image(image); all_boxes=[]; all_scores=[]; h,w=image.shape[:2]
        slices=smart_slice_image(enhanced, 4000, 300, 200)
        for slice_img, off_y in slices:
            results=model(slice_img, imgsz=1280, conf=0.15, iou=0.7, verbose=False)
            for r in results:
                for box,score in zip(r.boxes.xyxy.cpu().numpy(), r.boxes.conf.cpu().numpy()):
                    x1,y1,x2,y2=box; y1+=off_y; y2+=off_y
                    all_boxes.append([x1,y1,x2,y2]); all_scores.append(score)
            del slice_img
        merged_boxes, _ = merge_and_clean_boxes(all_boxes, all_scores)
        val=[]
        for box in merged_boxes:
            x1,y1,x2,y2=box; exp=10
            x1e=max(0,x1-exp); y1e=max(0,y1-exp); x2e=min(w,x2+exp); y2e=min(h,y2+exp)
            if (x2e-x1e)*(y2e-y1e) < 1000 or (x2e-x1e) < 50 or (y2e-y1e) < 50: continue
            if has_text(image, [x1e,y1e,x2e,y2e]):
                val.append({"center_x": (x1e+x2e)/2, "center_y": (y1e+y2e)/2,
                            "points": [[int(x1e),int(y1e)],[int(x2e),int(y1e)],
                                       [int(x2e),int(y2e)],[int(x1e),int(y2e)]]})
        key=f"{idx:02d}_mask"
        all_bubbles[key]=[{"id":i+1, "points":v["points"]} for i,v in enumerate(sorted(val, key=lambda b:(b["center_y"], b["center_x"])))]
        logger.info(f"✅ {img_file}: {len(val)} valid bubbles found. (Total boxes before validation: {len(merged_boxes)})")
        del image, enhanced, all_boxes, all_scores, merged_boxes; gc.collect()

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path,"w",encoding="utf-8") as f:
        json.dump(all_bubbles,f,indent=2,ensure_ascii=False)
    logger.info(f"💾 Saved all bubble data to: {output_path}")

    ai_clean = bool(cfg.get("ai_clean", False))
    dont_open_after_clean = bool(cfg.get("dont_Open_After_Clean", False))
    python_cleaner = r"C:\Users\abdoh\Downloads\testScript\python\clean_text_regions_from_config.py"

    try:
        if dont_open_after_clean:
            logger.info("⏭️ dont_Open_After_Clean=True → Skipping any Photoshop launch from detector.")
        else:
            if ai_clean:
                logger.info("🧠 ai_clean=True → Running Python cleaner script (no JSX from cleaner).")
                if not os.path.exists(python_cleaner):
                    raise FileNotFoundError(f"Cleaner script not found: {python_cleaner}")
                env = os.environ.copy(); env["SKIP_JSX"]="1"
                subprocess.run([sys.executable, python_cleaner], check=True, env=env)
                logger.info("✅ Python cleaner executed successfully.")
            else:
                logger.info("🎨 ai_clean=False → Detector will NOT launch Photoshop here (BAT handles it).")
    except Exception as e:
        logger.error(f"❌ Post-processing step failed: {e}")

except Exception:
    logger.error(traceback.format_exc()); success=False
finally:
    logger.info("=== 🏁 Finished detector script ===")
    if not success: time.sleep(2)
    os._exit(0)
