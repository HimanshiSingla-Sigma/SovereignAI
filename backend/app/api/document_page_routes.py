"""
Document page rendering for the OCR/RAG scanner (ADDITIVE — no existing route
is modified).

Returns the locally OCR-extracted text of a stored document, page by page, so
the UI can render the page next to a RAG answer and highlight the exact cited
span. Reads only rows the existing upload pipeline already wrote.
"""
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rbac import require_permission
from app.models.all_models import Document, DocumentChunk

router = APIRouter(prefix="/documents", tags=["Document Page Rendering"])


@router.get("/{doc_id}/pages")
def get_document_pages(
    doc_id: str,
    payload: dict = Depends(require_permission("documents:read")),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    doc = db.query(Document).filter_by(doc_id=doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail=f"Document '{doc_id}' not found.")

    chunks = (
        db.query(DocumentChunk)
        .filter_by(document_id=doc.id)
        .order_by(DocumentChunk.page_number, DocumentChunk.chunk_index)
        .all()
    )

    pages: Dict[int, List[str]] = {}
    for chunk in chunks:
        pages.setdefault(chunk.page_number or 1, []).append(chunk.content)

    return {
        "doc_id": doc.doc_id,
        "title": doc.title,
        "filename": doc.filename,
        "file_type": doc.file_type,
        "classification": doc.classification,
        "page_count": doc.page_count or len(pages) or 1,
        "pages": [
            {"page_number": page_number, "content": "\n\n".join(parts)}
            for page_number, parts in sorted(pages.items())
        ],
    }
