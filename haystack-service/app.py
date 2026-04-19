from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from pypdf import PdfReader

from haystack import Document, Pipeline
from haystack.components.retrievers.in_memory import InMemoryBM25Retriever
from haystack.document_stores.in_memory import InMemoryDocumentStore


BASE_DIR = Path(__file__).resolve().parent
DOCS_DIR = Path(os.getenv("HAYSTACK_DOCS_DIR", "../pdf files/scraped")).resolve()
API_KEY = os.getenv("HAYSTACK_API_KEY", "").strip()
TOP_K_DEFAULT = max(1, int(os.getenv("HAYSTACK_TOP_K_DEFAULT", "4")))
TOP_K_MAX = max(TOP_K_DEFAULT, int(os.getenv("HAYSTACK_TOP_K_MAX", "12")))


def _read_text_file(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="ignore").strip()
    except OSError:
        return ""


def _read_pdf_file(path: Path) -> str:
    try:
        reader = PdfReader(str(path))
    except Exception:
        return ""

    parts: list[str] = []
    for page in reader.pages:
        try:
            text = page.extract_text() or ""
        except Exception:
            text = ""
        if text.strip():
            parts.append(text.strip())

    return "\n\n".join(parts).strip()


def _load_documents(root_dir: Path) -> list[Document]:
    docs: list[Document] = []
    if not root_dir.exists():
        return docs

    allowed = {".txt", ".md", ".pdf"}
    for path in root_dir.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in allowed:
            continue

        if path.suffix.lower() == ".pdf":
            content = _read_pdf_file(path)
        else:
            content = _read_text_file(path)

        if not content:
            continue
        docs.append(
            Document(
                content=content,
                meta={"source": str(path.relative_to(root_dir)).replace("\\", "/")},
            )
        )
    return docs


def _build_pipeline(documents: list[Document]) -> tuple[InMemoryDocumentStore, Pipeline]:
    store = InMemoryDocumentStore()
    if documents:
        store.write_documents(documents)

    pipeline = Pipeline()
    pipeline.add_component("retriever", InMemoryBM25Retriever(document_store=store))
    return store, pipeline


def _require_auth(authorization: str | None) -> None:
    if not API_KEY:
        return
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    expected = f"Bearer {API_KEY}"
    if authorization.strip() != expected:
        raise HTTPException(status_code=401, detail="Invalid API key")


class RetrieveRequest(BaseModel):
    query: str = Field(min_length=1, description="Search query")
    top_k: int = Field(default=TOP_K_DEFAULT, ge=1, le=TOP_K_MAX)


class RetrieveDocument(BaseModel):
    content: str
    source: str
    score: float | None = None
    meta: dict[str, Any] = Field(default_factory=dict)


class RetrieveResponse(BaseModel):
    documents: list[RetrieveDocument]


app = FastAPI(title="Haystack Retriever API", version="1.0.0")

DOCUMENTS = _load_documents(DOCS_DIR)
DOC_STORE, RETRIEVE_PIPELINE = _build_pipeline(DOCUMENTS)


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "haystack-retriever",
        "documentsIndexed": DOC_STORE.count_documents(),
        "docsDir": str(DOCS_DIR),
    }


@app.post("/retrieve", response_model=RetrieveResponse)
def retrieve(payload: RetrieveRequest, authorization: str | None = Header(default=None)) -> RetrieveResponse:
    _require_auth(authorization)

    result = RETRIEVE_PIPELINE.run({"retriever": {"query": payload.query, "top_k": payload.top_k}})
    items = result.get("retriever", {}).get("documents", [])

    docs: list[RetrieveDocument] = []
    for item in items:
        source = str((item.meta or {}).get("source", "haystack"))
        docs.append(
            RetrieveDocument(
                content=item.content,
                source=source,
                score=item.score,
                meta=item.meta or {},
            )
        )

    return RetrieveResponse(documents=docs)


@app.post("/reload")
def reload_index(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    _require_auth(authorization)

    global DOCUMENTS, DOC_STORE, RETRIEVE_PIPELINE
    DOCUMENTS = _load_documents(DOCS_DIR)
    DOC_STORE, RETRIEVE_PIPELINE = _build_pipeline(DOCUMENTS)

    return {"reloaded": True, "documentsIndexed": DOC_STORE.count_documents(), "docsDir": str(DOCS_DIR)}
