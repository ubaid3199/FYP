import http from "node:http";

const port = Number(process.env.HAYSTACK_MOCK_PORT || 1416);

const knowledgeBase = [
  {
    content:
      "Library opening hours are usually updated on the official portal timetable page and campus app notices.",
    source: "mock://library-hours",
  },
  {
    content:
      "For accommodation support, students should contact Student Services first, then Accommodation Office for escalation.",
    source: "mock://accommodation-support",
  },
  {
    content:
      "Exam timetable updates are published via the Nest portal and examination guidance pages.",
    source: "mock://exam-timetable",
  },
];

function json(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function pickDocs(query, topK) {
  const q = String(query || "").toLowerCase();
  const scored = knowledgeBase.map((doc) => {
    const tokens = q.split(/[^a-z0-9]+/).filter(Boolean);
    let score = 0;
    for (const token of tokens) {
      if (doc.content.toLowerCase().includes(token)) score += 1;
    }
    return { ...doc, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, Number(topK || 4)))
    .map((item) => ({
      content: item.content,
      source: item.source,
      meta: {
        source: item.source,
        score: item.score,
      },
    }));
}

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    return json(res, 200, { status: "ok", service: "mock-haystack" });
  }

  if (req.method === "POST" && req.url === "/retrieve") {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      try {
        const body = raw ? JSON.parse(raw) : {};
        const query = body.query ?? "";
        const topK = body.top_k ?? 4;
        const documents = pickDocs(query, topK);
        return json(res, 200, { documents });
      } catch {
        return json(res, 400, { error: "Invalid JSON body" });
      }
    });
    return;
  }

  json(res, 404, { error: "Not found" });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`[mock-haystack] running on http://127.0.0.1:${port}`);
  console.log(`[mock-haystack] endpoints: GET /health, POST /retrieve`);
});
