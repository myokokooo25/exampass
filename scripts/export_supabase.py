import json
import os
import sys
from typing import Any

import requests


def _must_getenv(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise SystemExit(f"Missing env var: {name}")
    return value


def _get_all_rows(url: str, headers: dict[str, str], select: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    offset = 0
    limit = 1000
    while True:
        params = {
            "select": select,
            "order": "id.asc",
            "limit": str(limit),
            "offset": str(offset),
        }
        r = requests.get(url, headers=headers, params=params, timeout=60)
        r.raise_for_status()
        batch = r.json()
        if not isinstance(batch, list):
            raise RuntimeError("Unexpected response (expected list)")
        rows.extend(batch)
        if len(batch) < limit:
            break
        offset += limit
    return rows


def main() -> None:
    """
    Export Supabase tables to local JSON.

    Requires:
      - SUPABASE_URL (e.g. https://xxxx.supabase.co)
      - SUPABASE_SERVICE_ROLE_KEY (recommended for exporting private tables)

    Output:
      - ../data/questions.json
      - ../data/flashcards.json
    """
    supabase_url = _must_getenv("SUPABASE_URL").rstrip("/")
    service_key = _must_getenv("SUPABASE_SERVICE_ROLE_KEY")

    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Accept": "application/json",
    }

    questions_url = f"{supabase_url}/rest/v1/questions"
    vocab_url = f"{supabase_url}/rest/v1/vocabulary_flashcards"

    questions = _get_all_rows(
        questions_url,
        headers,
        "id,category,question_jp,question_my,options,correct_option_id,explanation,ai_explanation",
    )
    flashcards = _get_all_rows(
        vocab_url,
        headers,
        "id,category,kanji,reading,english,burmese,ai_explanation,created_at",
    )

    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
    os.makedirs(out_dir, exist_ok=True)

    with open(os.path.join(out_dir, "questions.json"), "w", encoding="utf-8") as f:
        json.dump(questions, f, ensure_ascii=False, indent=2)

    with open(os.path.join(out_dir, "flashcards.json"), "w", encoding="utf-8") as f:
        json.dump(flashcards, f, ensure_ascii=False, indent=2)

    print(f"Exported questions: {len(questions)}")
    print(f"Exported flashcards: {len(flashcards)}")


if __name__ == "__main__":
    try:
        main()
    except requests.HTTPError as e:
        print("HTTP error:", e, file=sys.stderr)
        if e.response is not None:
            print(e.response.text, file=sys.stderr)
        raise

