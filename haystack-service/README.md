# Haystack Retriever Service

Minimal Haystack-backed HTTP service for your Next.js retriever integration.

## Endpoints

- `GET /health`: service status and indexed document count
- `POST /retrieve`: retrieve top-k documents
- `POST /reload`: rebuild in-memory index from files on disk

## Request/Response Contract

### POST /retrieve

Request JSON:

```json
{
  "query": "library hours",
  "top_k": 4
}
```

Response JSON:

```json
{
  "documents": [
    {
      "content": "...",
      "source": "relative/path/to/file.md",
      "score": 8.1,
      "meta": {
        "source": "relative/path/to/file.md"
      }
    }
  ]
}
```

This matches your web app retriever normalizer in `web-app/lib/domains/rag/retriever.ts`.

## Setup

```bash
cd haystack-service
python -m pip install -r requirements.txt
```

Optional environment variables:

- `HAYSTACK_HOST` default `127.0.0.1`
- `HAYSTACK_PORT` default `1416`
- `HAYSTACK_API_KEY` default empty
- `HAYSTACK_DOCS_DIR` default `../pdf files/scraped`
- `HAYSTACK_TOP_K_DEFAULT` default `4`
- `HAYSTACK_TOP_K_MAX` default `12`

Supported source file types in `HAYSTACK_DOCS_DIR`:

- `.md`
- `.txt`
- `.pdf` (via `pypdf` extraction)

## Run

PowerShell:

```powershell
$env:HAYSTACK_HOST = "127.0.0.1"
$env:HAYSTACK_PORT = "1416"
uvicorn app:app --host $env:HAYSTACK_HOST --port $env:HAYSTACK_PORT
```

## Integration With web-app

Ensure your `web-app/.env` includes:

```bash
RAG_RETRIEVER_PROVIDER="auto"
HAYSTACK_RETRIEVE_URL="http://127.0.0.1:1416/retrieve"
HAYSTACK_HEALTH_URL="http://127.0.0.1:1416/health"
# Optional if you set HAYSTACK_API_KEY in this service:
# HAYSTACK_API_KEY="same-token"
```

Then check status:

```bash
GET /api/admin/rag/retriever/health
```
