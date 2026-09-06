import os
from typing import Dict, Any, List

class LocalOCREngine:
    """
    Local document text extraction and OCR engine.
    Extracts text from PDF, scanned PDF, Markdown, and TXT files completely offline.
    Zero external cloud API dependencies.
    """

    @classmethod
    def extract_text_from_file(cls, file_path: str, file_type: str) -> Dict[str, Any]:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Document file not found at {file_path}")

        extracted_pages: List[Dict[str, Any]] = []

        if file_type.upper() in ["TXT", "MD", "LOG"]:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            extracted_pages.append({"page_number": 1, "text": content})

        elif file_type.upper() in ["PDF", "SCANNED_PDF"]:
            # Try pypdfium2 first for high quality, fallback to PyPDF2
            extracted = False
            try:
                import pypdfium2
                pdf = pypdfium2.PdfDocument(file_path)
                for i, page in enumerate(pdf):
                    textpage = page.get_textpage()
                    text = textpage.get_text_range()
                    extracted_pages.append({"page_number": i + 1, "text": text})
                extracted = True
            except Exception:
                pass

            if not extracted:
                try:
                    import pypdf
                    reader = pypdf.PdfReader(file_path)
                    for i, page in enumerate(reader.pages):
                        extracted_pages.append({"page_number": i + 1, "text": page.extract_text() or ""})
                    extracted = True
                except Exception:
                    pass

            # If plain text extraction yielded empty pages (e.g. pure scanned image PDF)
            total_chars = sum(len(p["text"].strip()) for p in extracted_pages)
            if total_chars < 50:
                # Attempt local page image rendering and OCR
                ocr_rendered_pages = []
                try:
                    import pypdfium2
                    import pytesseract
                    pdf = pypdfium2.PdfDocument(file_path)
                    for i, page in enumerate(pdf):
                        pil_img = page.render(scale=2.0).to_pil()
                        ocr_txt = pytesseract.image_to_string(pil_img).strip()
                        if ocr_txt:
                            ocr_rendered_pages.append({"page_number": i + 1, "text": ocr_txt})
                except Exception as e:
                    print(f"[LocalOCREngine] PDF OCR rendering note: {e}")

                if ocr_rendered_pages:
                    extracted_pages = ocr_rendered_pages
                else:
                    extracted_pages = [
                        {
                            "page_number": 1,
                            "text": f"[DOCUMENT NOTE - {os.path.basename(file_path)}]: Scanned PDF contains no digital text layer. System Tesseract OCR engine was unable to extract optical text."
                        }
                    ]

        elif file_type.upper() in ["IMAGE", "PNG", "JPG", "JPEG"]:
            extracted_text = ""
            base_name = os.path.basename(file_path)
            try:
                import pytesseract
                from PIL import Image
                img = Image.open(file_path)
                extracted_text = pytesseract.image_to_string(img).strip()
            except Exception as e:
                print(f"[LocalOCREngine] Image OCR note: {e}")
                extracted_text = ""

            if not extracted_text:
                extracted_text = f"[IMAGE NOTE - {base_name}]: Visual inspection artifact uploaded. No legible optical text recognized by local OCR."

            extracted_pages.append({"page_number": 1, "text": extracted_text})

        else:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                extracted_pages.append({"page_number": 1, "text": f.read()})

        full_text = "\n\n".join(p["text"] for p in extracted_pages)
        return {
            "page_count": len(extracted_pages),
            "pages": extracted_pages,
            "full_text": full_text
        }
