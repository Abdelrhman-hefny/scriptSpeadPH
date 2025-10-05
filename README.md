````markdown
# 🧩 testScript — Photoshop Scripts for Manga Text Automation

## 📖 Overview

**testScript** automates the process of inserting manga dialogue text into **speech bubbles** within PSD files.  
It intelligently matches text lines to bubble paths, centers them visually, and applies typography rules automatically.

### ✨ Main Features

- Reads text from `manga_text.txt`, supporting page markers, font keys, and style tags.
- Matches each text line to bubble paths (`Path → Selection → Text Layer`).
- Dynamically adjusts font size and alignment, accounting for bubble tails.
- Smart text shaping for natural lens-like paragraph distribution.
- Multiple speed modes: **Fast**, **Ultra Fast**, and **Review After First Page**.
- Supports batch processing of mu ltiple PSD files via `links.txt`.

---

## 📂 Project Structure

```py

testScript/
├─ scripts/
│ ├─ scriptSPead.jsx # Main Photoshop script
│ ├─ convirtToWeb.jsx # Helper script for web export
│ └─ ... # Other helper scripts
├─ lib/
│ ├─ psHelpers.jsx # Common helpers (trim/toNum/…)
│ ├─ textReader.jsx # Reads and splits manga text
│ ├─ teamLoader.jsx # Loads team/font configs
│ ├─ splitSubpaths.jsx # Splits Work Path into named paths
│ ├─ fileUtils.jsx # Logging utilities
│ ├─ colorUtils.jsx # Bubble brightness and color sampling
│ ├─ textFX.jsx # Optional text effects
│ ├─ textUtils.jsx # Text manipulation tools
│ └─ bubble_text_centering_solution.jsx # Advanced bubble centering logic
├─ config/
│ ├─ teams.json # Font/team configuration
│ └─ json2.js
├─ manga_text.txt # Main text file (auto-created on first run)
├─ links.txt # (Optional) PSD file list for batch processing
├─ links_resolved.txt # Resolved links (if generated externally)
└─ README.md
```
````

---

## ⚙️ Requirements

- **Adobe Photoshop** (Windows, ExtendScript `.jsx` support required)
- Required fonts installed locally (fallbacks applied automatically)
- _(Optional)_ Python for external AI text cleaning or pre-processing tools

---

## 🚀 Quick Start

1. Open **Adobe Photoshop**.
2. Go to `File → Scripts → Browse` and select `scripts/scriptSPead.jsx`.
3. In the setup dialog:
   - Choose a **team** from `config/teams.json`
   - Set the base font size
   - Choose **Fast** or **Ultra Fast** mode
   - Optionally enable “Stop after first page” for review
4. On the first run, `manga_text.txt` will be auto-generated — edit it as shown below.
5. Either open your PSD files manually or list them in `links.txt` for automated processing.

---

## 📝 Text File Format (`manga_text.txt`)

Each page and bubble are mapped line by line.

**Rules:**

- Use `page N` to mark the start of each page.
- Each line after that represents one bubble.
- Special tags and keys are supported.

**Supported tags:**
| Tag | Description |
|------|--------------|
| `SFX:` | Sound effect text |
| `ST:` | Small/translated sound text |
| `[]:` | System or narration box |
| `OT:` | ALLCAPS shout |
| `//:` | Inherit previous font |
| `#` | Comment line (ignored) |

**Font keys:**
If the line starts with a key defined in `fontMap` (from `teams.json`), the corresponding font will be used automatically.

**Example:**

```js

page 1
MainFont Hello there!
ST: Action line
[]: SYSTEM MESSAGE
//: continues with previous font
page 2
OT: SHOUTING LINE

```

---

## 🎯 Bubble Text Placement Logic

- Bubble paths are detected and ordered intelligently.
- Each path is converted to a **Selection**.
- A **Paragraph Text Layer** is created inside the selection.
- Font and size are applied according to team settings and tags.
- Text wrapping is automatically shaped into a "lens" pattern:
  - Narrower lines at the top and bottom
  - Wider lines in the center
- TyperTools-style centering adjusts alignment while respecting bubble tails.

---

## 🔗 Batch Processing with `links.txt`

You can specify a list of PSD files to process automatically.

**Rules:**

- One file path per line (absolute or relative).
- Empty lines and those starting with `#` are ignored.
- If `links_resolved.txt` exists, it will take priority.

**Example:**

```js

# Absolute paths

D:/manga/001.psd
D:/manga/002.psd

# Relative paths

psds/003.psd
psds/004.psd

```

> Tip: You can generate `links_resolved.txt` automatically using an external Python script that downloads or resolves remote paths.

---

## ⚙️ Team Configuration (`config/teams.json`)

Each team profile defines its own settings, including:

- `defaultFont`: Main font used
- `minFontSize`: Minimum allowed font size
- `boxPaddingRatio`: Text margin inside the bubble
- `fontMap`: Key → Font mapping

**Example:**

```json
{
  "rezo": {
    "defaultFont": "CC Wild Words",
    "minFontSize": 14,
    "boxPaddingRatio": 0.1,
    "fontMap": {
      "OT|YELL": "Impact",
      "ST": "Arial Narrow",
      "SYS": "Helvetica Bold"
    }
  }
}
```

---

## 🧾 Logs and Output

| Mode       | Output file                      | Description        |
| ---------- | -------------------------------- | ------------------ |
| Normal     | `photoshop_text_log_verbose.txt` | Detailed log       |
| Ultra Fast | `photoshop_text_errors.txt`      | Only errors logged |

All PSDs are automatically saved after text insertion.

---

## 🧠 Common Issues & Solutions

| Issue              | Cause                                  | Solution                                  |
| ------------------ | -------------------------------------- | ----------------------------------------- |
| Missing font       | Font not installed                     | Install it or edit `teams.json`           |
| Wrong bubble order | Unsplit or unordered paths             | Use `splitSubpaths.jsx`                   |
| Misaligned text    | TyperTools disabled in Ultra Fast mode | Switch to normal mode                     |
| Text overflow      | Font too large                         | Reduce base font size or increase padding |
| PSD not opening    | Invalid path                           | Check `links.txt` or use absolute paths   |

---

## 🧩 Development Notes

- Helper modules under `lib/` can be modified independently.
- All design-related tuning (fonts, padding, etc.) should remain in `teams.json`.
- Core logic (`scriptSPead.jsx`) is optimized for modular customization.
- Adding new text layout or centering algorithms is supported via separate files.

---

## 👨‍💻 Project Info

- **Developer:** abderhman20
- **Last Updated:** 2025-09-23
- **License:** Open Source (for personal or internal use)

---
