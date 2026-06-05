# 鉄骨製作管理技術者 1級 — 勉強しやすい形に整理

ဒီ folder က PDF scan ဖိုင်တွေ + Supabase ထဲက already-structured (JP/My) Q&A/Vocab data ကို **ရှာလို့လွယ်၊ quiz လုပ်လို့လွယ်** အောင် ပြန်စီထားတာပါ။

## Folder structure

```
鉄骨製作管理技術者 Exam/
├── original/
│   ├── textbook/            # Chapter PDFs (renamed)
│   └── past-exams/          # 2021–2024 past exams (renamed)
├── data/                    # Exported JSON from Supabase (generated)
├── notes/
│   ├── INDEX.md             # Study index
│   ├── questions/           # Generated Markdown (from JSON)
│   ├── vocab/               # Generated Markdown (from JSON)
│   └── ocr_raw/             # Raw OCR text outputs (optional)
├── scripts/                 # Export / build / OCR scripts
└── study-app/               # Local web app (search/quiz/vocab)
```

---

## 1) Supabase export (အဓိက)

### Prerequisites

- Python 3.10+ (recommended)

Install dependencies:

```powershell
pip install -r scripts/requirements.txt
```

### Set env vars

Supabase dashboard → Project settings မှာ:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (export အတွက် အကြံပြု)

PowerShell:

```powershell
$env:SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
python scripts/export_supabase.py
```

Outputs:

- `data/questions.json`
- `data/flashcards.json`

---

## 2) Generate Markdown notes (JSON → notes/)

```powershell
python scripts/build_notes.py
```

Outputs:

- `notes/questions/*.md`
- `notes/vocab/*.md`

---

## 3) Run the study web app

Browser က `file://` နဲ့ ဖွင့်ရင် fetch/CORS ကြောင့် data load မလုပ်နိုင်တာများလို့ **local server** နဲ့ ဖွင့်ပါ။

```powershell
python -m http.server 8000
```

Then open:

- `http://localhost:8000/study-app/`

---

## 3b) Deploy to Vercel (GitHub)

This repo is ready for Vercel static hosting:

- `data/questions.json` + `data/flashcards.json` are included
- `vercel.json` rewrites `/` → `/study-app/`
- Large PDFs in `original/` are **gitignored** (not uploaded)

### Push to GitHub

```powershell
cd "D:\1111One Piece\鉄骨製作管理技術者 Exam"
git init
git add .
git commit -m "Add study app with exported Supabase data"
```

Create a new GitHub repo, then:

```powershell
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git branch -M main
git push -u origin main
```

### Deploy on Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repo
3. Framework preset: **Other** (static)
4. Deploy

Your app will be available at:

- `https://YOUR_PROJECT.vercel.app/` (root)
- `https://YOUR_PROJECT.vercel.app/study-app/`

Features:

- Search (JP/My)
- Quiz (shuffle/next/prev + show answer)
- Vocab list
- Progress (localStorage)

---

## 4) OCR (optional backup)

PDF က image-only scan ဖြစ်လို့ OCR လုပ်ချင်ရင်:

1. Windows မှာ Tesseract + Japanese language pack (`jpn`) install
2. Run:

```powershell
python scripts/ocr_extract.py
```

Outputs: `notes/ocr_raw/`

