#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Smart Stitch Runner
تشغيل Smart Stitch لتحويل ملفات JPG إلى WebP
"""

import sys
import os
import subprocess
import tempfile
from pathlib import Path

def main():
    # التحقق من وجود معامل (مسار المجلد)
    if len(sys.argv) < 2:
        print("خطأ: يجب تمرير مسار المجلد كمعامل")
        print("الاستخدام: python smart_stitch_runner.py <مسار_المجلد>")
        sys.exit(1)
    
    # الحصول على مسار المجلد
    folder_path = sys.argv[1]
    
    # التحقق من وجود المجلد
    if not os.path.exists(folder_path):
        print(f"خطأ: المجلد غير موجود: {folder_path}")
        sys.exit(1)
    
    # مسار Smart Stitch
    smart_stitch_path = r"C:\Users\abdoh\Downloads\testScript\SmartStitch-3.1\SmartStitchConsole.py"
    
    # التحقق من وجود Smart Stitch
    if not os.path.exists(smart_stitch_path):
        print(f"خطأ: Smart Stitch غير موجود في: {smart_stitch_path}")
        sys.exit(1)
    
    print(f"بدء تشغيل Smart Stitch...")
    print(f"المجلد المستهدف: {folder_path}")
    
    try:
        # تشغيل Smart Stitch
        cmd = [
            "python",
            smart_stitch_path,
            "-i", folder_path,
            "-sh", "15000",
            "-cw", "800", 
            "-t", ".webp",
            "-lq", "95"
        ]
        
        # تشغيل الأمر مع تسجيل المخرجات
        result = subprocess.run(
            cmd,
            cwd=folder_path,
            capture_output=True,
            text=True,
            encoding='utf-8',
            timeout=300  # مهلة 5 دقائق
        )
        
        # حفظ اللوج في ملف مؤقت
        log_file = os.path.join(tempfile.gettempdir(), "smart_stitch_log.txt")
        with open(log_file, 'w', encoding='utf-8') as f:
            f.write(result.stdout)
            if result.stderr:
                f.write("\n--- STDERR ---\n")
                f.write(result.stderr)
        
        # التحقق من وجود ملفات WebP بدلاً من الاعتماد على كود الإرجاع
        webp_files = list(Path(folder_path).glob("*.webp"))
        
        if len(webp_files) > 0:
            print("تم تشغيل Smart Stitch بنجاح")
            print(f"تم إنشاء {len(webp_files)} ملف WebP")
            sys.exit(0)
        else:
            print(f"خطأ في تشغيل Smart Stitch. كود الإرجاع: {result.returncode}")
            print(f"تحقق من ملف اللوج: {log_file}")
            sys.exit(1)
            
    except Exception as e:
        print(f"خطأ أثناء تشغيل Smart Stitch: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
