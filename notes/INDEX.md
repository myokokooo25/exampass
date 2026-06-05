# 鉄骨製作管理技術者 1級 — Study Index

## 1) まず何をする？

このフォルダは、PDF（スキャン）と Supabase 上の整理済みデータ（問題・単語）から、勉強しやすい形に再構成しています。

- **最短ルート**: Supabase → `data/*.json` に export → `study-app/` で検索/クイズ
- **バックアップ**: `original/` 配下の PDF を OCR → `notes/ocr_raw/`

---

## 2) 出題分野（全 50 問）

1. **鉄骨構造**（9問）
2. **鉄骨加工**（20問）
3. **品質管理**（15問）
4. **安全衛生**（3問）
5. **建築法規**（3問）

おすすめ学習順（頻出重視）:
**2 → 3 → 1 → 4 → 5**

---

## 3) ここに生成されるノート

Supabase export 後に `scripts/build_notes.py` を実行すると、以下が生成されます。

- `notes/questions/`:
  - `questions_1_鉄骨構造.md`
  - `questions_2_鉄骨加工.md`
  - `questions_3_品質管理.md`
  - `questions_4_安全衛生.md`
  - `questions_5_建築法規.md`
- `notes/vocab/`:
  - `vocab_1_鉄骨構造.md` … etc

---

## 4) 原本 PDF

- 教材: `original/textbook/`
- 過去問: `original/past-exams/`

