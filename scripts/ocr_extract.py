import os
from pathlib import Path

import fitz  # PyMuPDF
from PIL import Image
import pytesseract


def ocr_pdf_to_text(pdf_path: Path, out_dir: Path, lang: str = "jpn") -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(pdf_path)
    for i in range(doc.page_count):
        page = doc.load_page(i)
        pix = page.get_pixmap(dpi=300)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        text = pytesseract.image_to_string(img, lang=lang)
        out_path = out_dir / f"{pdf_path.stem}_p{i+1:03d}.txt"
        out_path.write_text(text, encoding="utf-8")
        print(f"OCR {pdf_path.name} p{i+1}/{doc.page_count} -> {out_path.name}")


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    original = root / "original"
    out_root = root / "notes" / "ocr_raw"
    out_root.mkdir(parents=True, exist_ok=True)

    pdfs = list(original.rglob("*.pdf"))
    if not pdfs:
        raise SystemExit("No PDFs found under original/")

    for pdf in pdfs:
        rel = pdf.relative_to(original)
        out_dir = out_root / rel.parent
        ocr_pdf_to_text(pdf, out_dir=out_dir)


if __name__ == "__main__":
    # Windows: ensure Tesseract + jpn traineddata installed and in PATH.
    os.environ.setdefault("TESSDATA_PREFIX", os.environ.get("TESSDATA_PREFIX", ""))
    main()

