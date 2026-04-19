# University AI Portal

A modern, glassmorphic AI-powered university portal built with Next.js and Ollama.

## Retrieval Providers

The assistant supports two retriever backends:

- `hybrid`: existing local Parent-Child Hybrid RAG (default fallback).
- `haystack`: external HTTP retriever endpoint powered by Haystack.

Provider selection is controlled with environment variables:

```bash
# auto: try Haystack first, then fallback to local HybridRAG
# haystack: force Haystack first, still falls back to HybridRAG on failure
# hybrid: use local HybridRAG only
RAG_RETRIEVER_PROVIDER="auto"

# Haystack endpoint that returns retrieved docs
# Expected JSON can be an array or object containing one of:
# documents | results | answers | hits
HAYSTACK_RETRIEVE_URL="http://localhost:1416/retrieve"

# Optional auth and payload field overrides
HAYSTACK_API_KEY=""
HAYSTACK_QUERY_FIELD="query"
HAYSTACK_TOPK_FIELD="top_k"

# Optional health probing (recommended)
HAYSTACK_HEALTH_URL="http://localhost:1416/health"
RAG_RETRIEVER_HEALTH_TTL_MS="60000"
```

Admin retriever health endpoint:

```bash
GET /api/admin/rag/retriever/health
```

Quick local validation (no external Haystack required):

```bash
# terminal 1
npm run mock:haystack

# terminal 2
npm run dev

# then open
http://localhost:3000/api/admin/rag/retriever/health
```

If the endpoint reports `haystackHealthy: true`, chat retrieval will prefer Haystack and still fallback to local HybridRAG if Haystack is unavailable.

Use a real Haystack service instead of mock:

1. Start the service from [haystack-service/README.md](../haystack-service/README.md)
2. Keep these values in `web-app/.env`:

```bash
RAG_RETRIEVER_PROVIDER="auto"
HAYSTACK_RETRIEVE_URL="http://127.0.0.1:1416/retrieve"
HAYSTACK_HEALTH_URL="http://127.0.0.1:1416/health"
```

3. Validate retriever status at:

```bash
http://localhost:3000/api/admin/rag/retriever/health
```

PowerShell smoke test (from `web-app`):

```powershell
$job = Start-Job -ScriptBlock { node scripts/mock-haystack-server.mjs }
try {
	$health = Invoke-WebRequest -Uri "http://127.0.0.1:1416/health" -UseBasicParsing
	Write-Host "Health status: $($health.StatusCode)"

	$retrieve = Invoke-RestMethod -Uri "http://127.0.0.1:1416/retrieve" -Method Post -Body '{"query":"library hours","top_k":2}' -ContentType "application/json"
	Write-Host ("Retrieve response: " + ($retrieve | ConvertTo-Json -Compress))
}
finally {
	Stop-Job $job -ErrorAction SilentlyContinue
	Get-NetTCPConnection -LocalPort 1416 -ErrorAction SilentlyContinue |
		Where-Object { $_.OwningProcess -ne 0 } |
		ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
}
```

## Features

- **AI Chatbot**: Intelligent assistant powered by a local LLM (Ollama) with Hybrid RAG (Vector + Keyword search) for accurate answers from university documents.
- **University Tools**: Integrated access to Moodle, Seats, Nest, and other campus services via seamless iFrames.
- **Glassmorphic UI**: Premium, dark-mode focused design with smooth animations.
- **Session Persistence**: Saves your session state locally.

## Getting Started

### 1. Prerequisites

- [Ollama](https://ollama.com/) installed and running.
- Model `gpt-oss:20b` (or your preferred model) pulled: `ollama pull gpt-oss:20b`.
- Embedding model `nomic-embed-text` pulled: `ollama pull nomic-embed-text`.

### 2. Setup

```bash
# Install dependencies
npm install

# Configure environment
# Create a .env file with:
# OLLAMA_MODEL="gpt-oss:20b"
# OLLAMA_EMBEDDING_MODEL="nomic-embed-text"
# RAG_RETRIEVER_PROVIDER="auto"
# HAYSTACK_RETRIEVE_URL="http://localhost:1416/retrieve"
```

### 3. Ingest Documentation

Place your PDFs, DOCX, or TXT files in the `documents` folder (create it if it doesn't exist) and run:

```bash
npm run ingest
```

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the result.


### 5. Parallel Processing (Multi-User Support)

To handle multiple students simultaneously, configure Ollama for parallel generation:
- **Windows**: Set environment variable OLLAMA_NUM_PARALLEL=4 (or more depending on VRAM).
- **Linux/macOS**: export OLLAMA_NUM_PARALLEL=4 before running Ollama.

This allows the backend to generate multiple responses at once without blocking.
