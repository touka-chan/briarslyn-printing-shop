#!/usr/bin/env python3
"""Extract all text from a PDF and save it to a text file."""

import os
import sys
from pathlib import Path

# Path to the PDF file
PDF_PATH = r"C:/Users/monah/OneDrive/Desktop/Finals/tile_sia2_final.pdf"
OUTPUT_PATH = r"C:/Users/monah/OneDrive/Desktop/Finals/tile_sia2_final_text.txt"


def check_file_exists(path: str) -> bool:
    """Check if the PDF file exists and is not empty."""
    file_path = Path(path)
    if not file_path.exists():
        print(f"Error: File does not exist at {path}")
        return False
    if not file_path.is_file():
        print(f"Error: Path is not a file: {path}")
        return False
    if file_path.stat().st_size == 0:
        print(f"Error: File is empty: {path}")
        return False
    print(f"File found: {path}")
    print(f"File size: {file_path.stat().st_size} bytes")
    return True


def extract_text(pdf_path: str) -> str:
    """Extract all text from a PDF using pypdf."""
    try:
        from pypdf import PdfReader
    except ImportError:
        print("pypdf not found. Trying to install...")
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pypdf"])
        from pypdf import PdfReader

    reader = PdfReader(pdf_path)
    num_pages = len(reader.pages)
    print(f"Total pages: {num_pages}")

    extracted = []
    for i, page in enumerate(reader.pages, start=1):
        try:
            text = page.extract_text() or ""
        except Exception as e:
            text = f"[Error extracting page {i}: {e}]"
        extracted.append(f"===== Page {i} =====\n{text}\n")

    return "\n".join(extracted)


def main() -> int:
    if not check_file_exists(PDF_PATH):
        return 1

    full_text = extract_text(PDF_PATH)

    if not full_text.strip():
        print("Warning: No text content was extracted from the PDF.")
    else:
        print(f"Successfully extracted {len(full_text)} characters of text.")

    # Write all text to the output file
    try:
        with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
            f.write(full_text)
        print(f"Full text written to: {OUTPUT_PATH}")
    except OSError as e:
        print(f"Error writing output file: {e}")
        return 1

    # Print the first 10 pages to the console
    print("\n" + "=" * 60)
    print("FIRST 10 PAGES")
    print("=" * 60)
    sections = full_text.split("===== Page ")
    count = 0
    for section in sections[1:]:
        if count >= 10:
            break
        count += 1
        print(f"===== Page {section.split(' =====')[0]} =====")
        body = section.split("===== ", 1)[1] if "===== " in section else section
        # split off the next page header if present
        if "\n=====" in body:
            body = body.split("\n=====")[0]
        print(body)

    return 0


if __name__ == "__main__":
    sys.exit(main())
