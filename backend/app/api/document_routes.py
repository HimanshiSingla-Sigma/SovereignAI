import os
import hashlib
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.rbac import require_permission
from app.core.config import settings
from app.core.audit import AuditLogger
from app.models.all_models import Document, DocumentChunk
from app.rag.ocr_engine import LocalOCREngine
from app.rag.chunker import DocumentChunker
from app.rag.vector_store import LocalVectorStore
from app.schemas.schemas import DocumentResponse

router = APIRouter(prefix="/documents", tags=["Document Intelligence & OCR"])

ALLOWED_EXTENSIONS = {".pdf", ".txt", ".md", ".png", ".jpg", ".jpeg"}
MAX_FILE_SIZE = 15 * 1024 * 1024  # 15 MB

@router.get("", response_model=List[DocumentResponse])
def list_documents(
    payload: dict = Depends(require_permission("documents:read")),
    db: Session = Depends(get_db)
):
    docs = db.query(Document).order_by(Document.created_at.desc()).all()
    return docs

@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    title: str = Form(None),
    classification: str = Form("INTERNAL"),
    payload: dict = Depends(require_permission("documents:upload")),
    db: Session = Depends(get_db)
):
    user = payload["sub"]
    filename = file.filename or "uploaded_document"
    ext = os.path.splitext(filename)[1].lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File extension '{ext}' not allowed. Allowed: {ALLOWED_EXTENSIONS}")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"File exceeds maximum allowed size ({MAX_FILE_SIZE // (1024*1024)} MB).")

    file_hash = hashlib.sha256(content).hexdigest()
    doc_id = f"DOC-{uuid.uuid4().hex[:8].upper()}"
    save_path = os.path.join(settings.DOCUMENTS_DIR, f"{doc_id}_{filename}")

    with open(save_path, "wb") as f:
        f.write(content)

    # Local OCR & Text Extraction
    f_type = "PDF" if ext == ".pdf" else "IMAGE" if ext in [".png", ".jpg", ".jpeg"] else "TXT"
    extraction = LocalOCREngine.extract_text_from_file(save_path, f_type)

    doc_record = Document(
        doc_id=doc_id,
        title=title or filename,
        filename=filename,
        file_type=f_type,
        file_size_bytes=len(content),
        classification=classification,
        file_hash=file_hash,
        storage_path=save_path,
        page_count=extraction["page_count"],
        uploaded_by=user,
        is_indexed=True
    )
    db.add(doc_record)
    db.flush()

    # Chunking & Embedding
    chunks = DocumentChunker.chunk_document(
        doc_id=doc_id,
        title=doc_record.title,
        classification=classification,
        pages=extraction["pages"]
    )

    for ch in chunks:
        chunk_row = DocumentChunk(
            document_id=doc_record.id,
            chunk_index=int(ch["chunk_id"].split("-")[-1]),
            page_number=ch["page_number"],
            content=ch["content"],
            classification=ch["classification"],
            token_count=ch["word_count"]
        )
        db.add(chunk_row)

    db.commit()
    db.refresh(doc_record)

    # Ingest into vector store
    if chunks:
        LocalVectorStore.add_chunks(chunks)

    AuditLogger.log(
        who=user,
        what="DOCUMENT_UPLOADED",
        resource=f"{doc_id}:{filename}",
        result="SUCCESS",
        reason=f"Indexed {len(chunks)} chunks, OCR pages: {extraction['page_count']}",
        details={"file_size": len(content), "classification": classification}
    )

    return doc_record
