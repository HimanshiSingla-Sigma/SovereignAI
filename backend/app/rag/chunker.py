from typing import List, Dict, Any

class DocumentChunker:
    """Chunks document pages into overlapping semantic segments with source metadata."""

    @classmethod
    def chunk_document(
        cls,
        doc_id: str,
        title: str,
        classification: str,
        pages: List[Dict[str, Any]],
        chunk_size_words: int = 120,
        overlap_words: int = 25
    ) -> List[Dict[str, Any]]:
        chunks: List[Dict[str, Any]] = []
        chunk_counter = 0

        for page in pages:
            p_num = page.get("page_number", 1)
            text = page.get("text", "").strip()
            if not text:
                continue

            words = text.split()
            if len(words) <= chunk_size_words:
                chunks.append({
                    "chunk_id": f"{doc_id}-chunk-{chunk_counter}",
                    "doc_id": doc_id,
                    "title": title,
                    "page_number": p_num,
                    "classification": classification,
                    "content": text,
                    "word_count": len(words)
                })
                chunk_counter += 1
            else:
                step = chunk_size_words - overlap_words
                for i in range(0, len(words), step):
                    segment_words = words[i:i + chunk_size_words]
                    segment_text = " ".join(segment_words)
                    chunks.append({
                        "chunk_id": f"{doc_id}-chunk-{chunk_counter}",
                        "doc_id": doc_id,
                        "title": title,
                        "page_number": p_num,
                        "classification": classification,
                        "content": segment_text,
                        "word_count": len(segment_words)
                    })
                    chunk_counter += 1
                    if i + chunk_size_words >= len(words):
                        break

        return chunks
