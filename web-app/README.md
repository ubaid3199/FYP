# University AI Portal

A modern, glassmorphic AI-powered university portal built with Next.js and Ollama.

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
