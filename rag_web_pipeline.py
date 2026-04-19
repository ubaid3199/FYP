"""
RAG pipeline refactor: recursive web scraping (same-domain) instead of PDFs.

Implements:
1) Recursive crawl from a base URL with max depth and same-domain guard.
2) RecursiveCharacterTextSplitter chunking (800 / 150).
3) Strict prompt template that separates context and question.
4) Modern embeddings: OpenAI text-embedding-3-small (fallback HuggingFace BGE-m3).
5) debug_retriever(query): prints top 4 retrieved chunks without calling the LLM.

Install (example):
  pip install langchain langchain-openai langchain-community langchain-text-splitters \
              langchain-chroma beautifulsoup4 trafilatura requests

Optional fallback embedding model support:
  pip install sentence-transformers

Environment variables:
  OPENAI_API_KEY=...              # required for OpenAI embeddings/LLM path
  RAG_BASE_URL=...                # defaults to requested SharePoint URL
  RAG_MAX_DEPTH=5
  RAG_PERSIST_DIR=.rag_chroma
"""

from __future__ import annotations

import os
import re
from collections import deque
from dataclasses import dataclass
from typing import Iterable
from urllib.parse import urljoin, urlparse, urlunparse

import requests
import trafilatura
from bs4 import BeautifulSoup
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_core.prompts import PromptTemplate
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter


DEFAULT_BASE_URL = "https://roehamptonprod.sharepoint.com/sites/portal/nest/Pages/default.aspx"
DEFAULT_MAX_DEPTH = 5
DEFAULT_PERSIST_DIR = ".rag_chroma"

# Requirement #3: exact prompt structure.
SYSTEM_PROMPT_TEMPLATE = (
    "You are a helpful assistant. Use the following pieces of retrieved context to answer the user's question. "
    "If the answer is not contained within the context, say 'I don't know.' Do not use outside information.\n"
    "Context: {context}\n"
    "User Question: {question}\n"
    "Answer:"
)


@dataclass
class CrawlConfig:
    base_url: str = DEFAULT_BASE_URL
    max_depth: int = DEFAULT_MAX_DEPTH
    timeout_seconds: int = 20
    max_pages: int = 1000


def _canonicalize_url(url: str) -> str:
    parsed = urlparse(url)
    cleaned = parsed._replace(fragment="")
    if cleaned.scheme in {"http", "https"}:
        path = re.sub(r"//+", "/", cleaned.path) or "/"
        cleaned = cleaned._replace(path=path)
    # Drop query to reduce duplicate crawl states.
    cleaned = cleaned._replace(query="")
    result = urlunparse(cleaned)
    return result[:-1] if result.endswith("/") else result


def _same_domain(url: str, allowed_domain: str) -> bool:
    parsed = urlparse(url)
    return parsed.netloc.lower() == allowed_domain.lower()


def _extract_clean_markdown(html: str, url: str) -> str:
    # Trafilatura is robust at stripping boilerplate and returning main content.
    extracted = trafilatura.extract(
        html,
        url=url,
        output_format="markdown",
        include_links=False,
        include_tables=True,
        favor_recall=True,
    )
    if extracted:
        return extracted.strip()

    # Fallback to basic HTML cleanup if extraction fails.
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "noscript"]):
        tag.decompose()
    text = soup.get_text(separator=" ", strip=True)
    return re.sub(r"\s+", " ", text).strip()


def crawl_site_recursive(config: CrawlConfig) -> list[Document]:
    """
    Crawl pages recursively from base URL, up to max_depth, same-domain only.
    Returns LangChain Documents with cleaned page text.
    """
    base = _canonicalize_url(config.base_url)
    allowed_domain = urlparse(base).netloc

    queue: deque[tuple[str, int]] = deque([(base, 0)])
    visited: set[str] = set()
    docs: list[Document] = []

    session = requests.Session()
    session.headers.update({"User-Agent": "rag-web-crawler/1.0"})

    while queue and len(visited) < config.max_pages:
        current_url, depth = queue.popleft()
        current_url = _canonicalize_url(current_url)

        if current_url in visited:
            continue
        if depth > config.max_depth:
            continue
        if not _same_domain(current_url, allowed_domain):
            continue

        visited.add(current_url)

        try:
            response = session.get(current_url, timeout=config.timeout_seconds)
        except requests.RequestException:
            continue

        if not response.ok:
            continue

        content_type = (response.headers.get("content-type") or "").lower()
        if "text/html" not in content_type:
            continue

        html = response.text
        clean_text = _extract_clean_markdown(html, current_url)
        if clean_text:
            docs.append(
                Document(
                    page_content=clean_text,
                    metadata={"source": current_url, "depth": depth},
                )
            )

        if depth == config.max_depth:
            continue

        soup = BeautifulSoup(html, "html.parser")
        for anchor in soup.find_all("a", href=True):
            candidate = _canonicalize_url(urljoin(current_url, anchor["href"]))
            parsed = urlparse(candidate)

            if parsed.scheme not in {"http", "https"}:
                continue
            if not _same_domain(candidate, allowed_domain):
                continue
            if candidate in visited:
                continue

            queue.append((candidate, depth + 1))

    return docs


def chunk_documents(docs: Iterable[Document]) -> list[Document]:
    """
    Requirement #2 chunking parameters.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=150,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    return splitter.split_documents(list(docs))


def build_embeddings():
    """
    Requirement #4: modern embedding model.
    Primary: OpenAI text-embedding-3-small.
    Fallback: HuggingFace BGE-m3 for local/offline usage.
    """
    if os.getenv("OPENAI_API_KEY"):
        return OpenAIEmbeddings(model="text-embedding-3-small")

    return HuggingFaceEmbeddings(model_name="BAAI/bge-m3")


def build_or_update_vectorstore(chunks: list[Document], persist_dir: str = DEFAULT_PERSIST_DIR) -> Chroma:
    embeddings = build_embeddings()
    vectorstore = Chroma(
        collection_name="web_rag",
        embedding_function=embeddings,
        persist_directory=persist_dir,
    )
    if chunks:
        vectorstore.add_documents(chunks)
    return vectorstore


def build_prompt() -> PromptTemplate:
    return PromptTemplate.from_template(SYSTEM_PROMPT_TEMPLATE)


def answer_question(vectorstore: Chroma, question: str, top_k: int = 4) -> str:
    """
    Runs retrieval + generation with strict context-only prompt.
    """
    retrieved_docs = vectorstore.similarity_search(question, k=top_k)
    context = "\n\n".join(doc.page_content for doc in retrieved_docs)

    prompt = build_prompt().format(context=context, question=question)

    if not os.getenv("OPENAI_API_KEY"):
        return (
            "OPENAI_API_KEY not set. Retrieval worked, but LLM generation is skipped.\n"
            "Use debug_retriever(query) to inspect retrieved chunks."
        )

    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    response = llm.invoke(prompt)
    return response.content if hasattr(response, "content") else str(response)


def debug_retriever(query: str, persist_dir: str = DEFAULT_PERSIST_DIR) -> None:
    """
    Requirement #5.
    Prints top 4 retrieved chunks only; does not call any LLM.
    """
    vectorstore = Chroma(
        collection_name="web_rag",
        embedding_function=build_embeddings(),
        persist_directory=persist_dir,
    )
    results = vectorstore.similarity_search(query, k=4)

    print("\n=== debug_retriever: top 4 chunks ===")
    if not results:
        print("No chunks found. Build the index first.")
        return

    for i, doc in enumerate(results, start=1):
        source = doc.metadata.get("source", "unknown")
        snippet = doc.page_content[:600].replace("\n", " ")
        print(f"\n[{i}] source: {source}")
        print(snippet)


def run_pipeline(
    base_url: str = DEFAULT_BASE_URL,
    max_depth: int = DEFAULT_MAX_DEPTH,
    persist_dir: str = DEFAULT_PERSIST_DIR,
) -> Chroma:
    crawl_config = CrawlConfig(base_url=base_url, max_depth=max_depth)

    docs = crawl_site_recursive(crawl_config)
    if not docs:
        raise RuntimeError("Crawler found no documents. Check authentication/site access.")

    chunks = chunk_documents(docs)
    vectorstore = build_or_update_vectorstore(chunks, persist_dir=persist_dir)

    print(f"Crawled docs: {len(docs)}")
    print(f"Chunked docs: {len(chunks)}")
    print(f"Vector DB dir: {persist_dir}")
    return vectorstore


if __name__ == "__main__":
    base_url = os.getenv("RAG_BASE_URL", DEFAULT_BASE_URL)
    max_depth = int(os.getenv("RAG_MAX_DEPTH", str(DEFAULT_MAX_DEPTH)))
    persist_dir = os.getenv("RAG_PERSIST_DIR", DEFAULT_PERSIST_DIR)

    vs = run_pipeline(base_url=base_url, max_depth=max_depth, persist_dir=persist_dir)

    # Example debugging call to validate retrieval quality before LLM usage.
    debug_retriever("How do I access university support services?", persist_dir=persist_dir)

    # Example QA call.
    answer = answer_question(vs, "How can students get help from support services?")
    print("\n=== LLM Answer ===")
    print(answer)
