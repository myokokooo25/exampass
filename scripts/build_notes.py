import json
import os
import re
from collections import defaultdict
from typing import Any


def _load_json(path: str) -> list[dict[str, Any]]:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise RuntimeError(f"Expected list in {path}")
    return data


def _safe_filename(s: str) -> str:
    s = s.strip()
    s = re.sub(r"[^\w\-\.]+", "_", s, flags=re.UNICODE)
    s = re.sub(r"_+", "_", s)
    return s.strip("_")


SUBJECT_BY_CATEGORY = {
    "1": "鉄骨構造",
    "2": "鉄骨加工",
    "3": "品質管理",
    "4": "安全衛生",
    "5": "建築法規",
}


def _write(path: str, content: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


def build_questions_markdown(questions: list[dict[str, Any]], out_dir: str) -> None:
    by_cat: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for q in questions:
        cat = str(q.get("category") or "").strip() or "unknown"
        by_cat[cat].append(q)

    for cat, qs in sorted(by_cat.items(), key=lambda kv: kv[0]):
        subject = SUBJECT_BY_CATEGORY.get(cat, f"カテゴリ{cat}")
        lines: list[str] = []
        lines.append(f"# 問題集（{subject}）")
        lines.append("")
        for q in qs:
            qid = q.get("id", "")
            qjp = (q.get("question_jp") or "").strip()
            qmy = (q.get("question_my") or "").strip()
            options = q.get("options") or []
            correct = q.get("correct_option_id")
            explanation = q.get("explanation")

            lines.append(f"## {qid}")
            lines.append("")
            if qjp:
                lines.append("### 日本語")
                lines.append(qjp)
                lines.append("")
            if qmy:
                lines.append("### မြန်မာ")
                lines.append(qmy)
                lines.append("")

            if isinstance(options, list) and options:
                lines.append("### 選択肢 / Options")
                for opt in options:
                    oid = opt.get("id")
                    tjp = (opt.get("textJP") or "").strip()
                    tmy = (opt.get("textMY") or "").strip()
                    mark = "✅" if correct is not None and oid == correct else "  "
                    lines.append(f"- {mark} ({oid}) {tjp}")
                    if tmy:
                        lines.append(f"  - {tmy}")
                lines.append("")

            if explanation:
                lines.append("### 解説 / Explanation")
                if isinstance(explanation, dict):
                    title = (explanation.get("titleMY") or "").strip()
                    reason = (explanation.get("reasonMY") or "").strip()
                    tip = (explanation.get("memoryTipMY") or "").strip()
                    if title:
                        lines.append(f"- **Title**: {title}")
                    if reason:
                        lines.append(f"- **Reason**: {reason}")
                    if tip:
                        lines.append(f"- **Tip**: {tip}")
                else:
                    lines.append(str(explanation))
                lines.append("")

            lines.append("---")
            lines.append("")

        filename = f"questions_{cat}_{_safe_filename(subject)}.md"
        _write(os.path.join(out_dir, filename), "\n".join(lines))


def build_vocab_markdown(flashcards: list[dict[str, Any]], out_dir: str) -> None:
    by_cat: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for r in flashcards:
        cat = str(r.get("category") or "").strip() or "unknown"
        by_cat[cat].append(r)

    for cat, rows in sorted(by_cat.items(), key=lambda kv: kv[0]):
        subject = SUBJECT_BY_CATEGORY.get(cat, f"カテゴリ{cat}")
        lines: list[str] = []
        lines.append(f"# 用語（{subject}）")
        lines.append("")
        for r in rows:
            kanji = (r.get("kanji") or "").strip()
            reading = (r.get("reading") or "").strip()
            en = (r.get("english") or "").strip()
            my = (r.get("burmese") or "").strip()
            lines.append(f"## {kanji}")
            if reading:
                lines.append(f"- **Reading**: {reading}")
            if en:
                lines.append(f"- **EN**: {en}")
            if my:
                lines.append(f"- **MY**: {my}")
            lines.append("")

        filename = f"vocab_{cat}_{_safe_filename(subject)}.md"
        _write(os.path.join(out_dir, filename), "\n".join(lines))


def main() -> None:
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    data_dir = os.path.join(root, "data")
    notes_dir = os.path.join(root, "notes")

    questions_path = os.path.join(data_dir, "questions.json")
    flashcards_path = os.path.join(data_dir, "flashcards.json")

    if not os.path.exists(questions_path) or not os.path.exists(flashcards_path):
        raise SystemExit(
            "Missing data/*.json. Run scripts/export_supabase.py first "
            "(or place questions.json + flashcards.json into data/)."
        )

    questions = _load_json(questions_path)
    flashcards = _load_json(flashcards_path)

    build_questions_markdown(questions, os.path.join(notes_dir, "questions"))
    build_vocab_markdown(flashcards, os.path.join(notes_dir, "vocab"))

    print("Generated notes in notes/questions and notes/vocab")


if __name__ == "__main__":
    main()

