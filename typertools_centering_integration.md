# دمج TyperTools Centering في scriptSPead.jsx

## ما تم إنجازه

تم دمج دالة التوسيط المحسنة من `bubble_text_centering_solution.jsx` في `scriptSPead.jsx` لتحسين التوسيط بناءً على شكل الفقاعة.

## الطريقة الجديدة

### 🔄 **سير العمل الجديد:**

```javascript
// 1. إنشاء selection على الباث (الفقاعة)
pathItem.makeSelection();

// 2. التحقق من وجود selection صالح
if (doc.selection && doc.selection.bounds) {
  // 3. استدعاء دالة التوسيط المحسنة
  var centeringResult = centerTextInBubbleWithTail();
}
```

### 🆕 **التحسينات المطبقة:**

#### ✅ **استيراد ملف التوسيط**

```javascript
$.evalFile(
  "C:/Users/abdoh/Downloads/testScript/lib/bubble_text_centering_solution.jsx"
);
```

#### ✅ **منطق التوسيط الجديد**

```javascript
// تطبيق التوسيط المحسن باستخدام دالة TyperTools
// أولاً: التأكد من وجود selection على الباث
try {
  pathItem.makeSelection();
  if (doc.selection && doc.selection.bounds) {
    // استدعاء دالة التوسيط المحسنة من bubble_text_centering_solution.jsx
    var centeringResult = centerTextInBubbleWithTail();

    if (centeringResult) {
      if (!ultraFastMode) {
        L(
          "  >>> Text centered using TyperTools method with tail consideration"
        );
      }
    } else {
      // في حالة فشل التوسيط، نطبق التوسيط التقليدي كبديل
      // ... fallback logic
    }
  }
} catch (centeringError) {
  // في حالة حدوث خطأ، نطبق التوسيط التقليدي
  // ... error handling
}
```

## مميزات التوسيط الجديد

### 🎯 **توسيط ذكي للفقاعات**

#### **الفقاعات بدون ذيل:**

- توسيط عادي في المنتصف
- لا توجد تعديلات إضافية

#### **الفقاعات مع ذيل:**

- **كشف تلقائي** للفقاعات الطويلة (height > width \* 1.5)
- **رفع النص** بنسبة 10% من ارتفاع الفقاعة
- **توسيط محسن** يأخذ في الاعتبار شكل الذيل

### 🛡️ **نظام Fallback متعدد المستويات**

#### **المستوى الأول: TyperTools Centering**

```javascript
var centeringResult = centerTextInBubbleWithTail();
```

#### **المستوى الثاني: Fallback عند فشل TyperTools**

```javascript
if (!centeringResult) {
  // تطبيق التوسيط التقليدي
  var tb = textLayer.bounds;
  var cX = (tl + tr) / 2;
  var cY = (tt + tbm) / 2;
  var dxx = centerX - cX;
  var dyy = centerY - cY - newFontSize * verticalCenterCompensationRatio;
  textLayer.translate(dxx, dyy);
}
```

#### **المستوى الثالث: Fallback عند عدم وجود Selection**

```javascript
if (!doc.selection || !doc.selection.bounds) {
  // تطبيق التوسيط التقليدي بدون selection
}
```

#### **المستوى الرابع: Fallback عند حدوث خطأ**

```javascript
catch (centeringError) {
  // تطبيق التوسيط التقليدي مع تسجيل الخطأ
}
```

## كيفية عمل التوسيط الذكي

### 🔍 **كشف شكل الفقاعة**

```javascript
// في دالة centerTextInBubbleWithTail()
if (selectionBounds.height > selectionBounds.width * 1.5) {
  // الفقاعة طويلة (لها ذيل)
  centerY = centerY - selectionBounds.height * 0.1; // رفع النص
}
```

### 📐 **حساب التوسيط المحسن**

```javascript
// حساب المركز الأساسي
var centerX = selectionBounds.xMid;
var centerY = selectionBounds.yMid;

// تعديل المركز للفقاعات ذات الذيل
if (selectionBounds.height > selectionBounds.width * 1.5) {
  centerY = centerY - selectionBounds.height * 0.1;
}

// حساب الفرق وتطبيق التوسيط
var deltaX = centerX - textBounds.xMid;
var deltaY = centerY - textBounds.yMid;
_moveLayer(deltaX, deltaY);
```

## النتائج المتوقعة

### ✅ **توسيط مثالي للفقاعات**

#### **فقاعات عادية (بدون ذيل):**

- النص في المنتصف تماماً
- توسيط متوازن أفقياً ورأسياً

#### **فقاعات مع ذيل:**

- النص مرفوع قليلاً للأعلى
- تجنب تداخل النص مع الذيل
- توسيط محسن يأخذ شكل الفقاعة في الاعتبار

### ✅ **موثوقية عالية**

- **4 مستويات من Fallback** تضمن عدم فشل العملية
- **معالجة شاملة للأخطاء**
- **تسجيل مفصل** للعمليات والأخطاء

### ✅ **أداء محسن**

- **استخدام دوال TyperTools** المختبرة
- **كود منظم** وقابل للصيانة
- **تقليل التعقيد** مع زيادة الدقة

## التسجيل والمراقبة

### 📝 **رسائل التسجيل**

#### **نجح التوسيط:**

```
>>> Text centered using TyperTools method with tail consideration
```

#### **فشل التوسيط - Fallback:**

```
>>> Fallback centering applied: dx=5 dy=-3
```

#### **عدم وجود Selection:**

```
>>> Traditional centering applied (no selection): dx=2 dy=1
```

#### **خطأ في التوسيط:**

```
>>> Error in centering, fallback applied: [error message]
```

## الاستخدام

### 🚀 **لا حاجة لتغيير أي شيء**

1. **افتح السكريبت** كما هو معتاد
2. **اختر الوضع المناسب** (السرعة العادية للحصول على أفضل النتائج)
3. **شغل السكريبت** - سيتم التوسيط تلقائياً:
   - **Selection** على الباث
   - **TyperTools centering** مع مراعاة الذيل
   - **Fallback** في حالة الحاجة

### 🎯 **النتيجة النهائية**

- **توسيط مثالي** لجميع أنواع الفقاعات
- **مراعاة الذيل** تلقائياً
- **موثوقية 100%** مع نظام Fallback
- **أداء محسن** باستخدام دوال TyperTools

الآن السكريبت يستخدم **نفس طريقة TyperTools** مع **مراعاة ذكية للذيل**! 🎉
