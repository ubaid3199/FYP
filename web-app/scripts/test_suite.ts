/**
 * Comprehensive test suite for MyUni AI portal
 * Tests model routing, RAG retrieval, streaming, and response quality
 */

const BASE_URL = "http://localhost:3000";

async function testChat(label: string, messages: any[], model = "automatic"): Promise<void> {
  const start = Date.now();
  process.stdout.write(`\n[TEST] ${label} (model=${model}) ... `);
  
  try {
    const res = await fetch(`${BASE_URL}/api/assistant/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, model, isRestricted: false }),
      signal: AbortSignal.timeout(90_000),
    });

    if (!res.ok) {
      console.log(`❌ HTTP ${res.status}`);
      return;
    }

    const text = await res.text();
    const lines = text.trim().split("\n").filter(Boolean);
    let fullContent = "";
    let routedModel = model;

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed?.message?.content) {
          fullContent += parsed.message.content;
        }
        if (parsed?.model) routedModel = parsed.model;
      } catch { /* partial line */ }
    }

    const elapsed = Date.now() - start;
    const preview = fullContent.replace(/\n+/g, " ").trim().substring(0, 120);
    const hasContent = fullContent.trim().length > 0;
    const isRefusal = /cannot verify|not confirmed|i don't have|no specific/i.test(fullContent);
    const hasHallucination = /http[s]?:\/\/[^\s]+/g.test(fullContent);

    console.log(hasContent ? "✅" : "❌ EMPTY");
    console.log(`   Time: ${elapsed}ms | Routed: ${routedModel}`);
    console.log(`   Response: "${preview}${fullContent.length > 120 ? '...' : ''}"`);
    if (isRefusal) console.log(`   ⚠️  Possible refusal/no-answer`);
    if (hasHallucination) {
      const urls = fullContent.match(/http[s]?:\/\/[^\s"]+/g) || [];
      console.log(`   🔗 URLs in response: ${urls.join(", ").substring(0, 200)}`);
    }
  } catch (err: any) {
    console.log(`❌ ERROR: ${err.message}`);
  }
}

async function testOllamaModel(modelName: string): Promise<boolean> {
  try {
    const res = await fetch("http://127.0.0.1:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: modelName, prompt: "Reply with: OK", stream: false, options: { num_predict: 5 } }),
      signal: AbortSignal.timeout(30_000),
    });
    const data = await res.json() as any;
    return res.ok && typeof data.response === "string";
  } catch {
    return false;
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("MyUni AI - Comprehensive Model & API Test Suite");
  console.log("=".repeat(60));

  // ── 1. Ollama Model Availability ──────────────────────────────
  console.log("\n📦 STEP 1: Ollama Model Availability");
  const models = ["gemma3:1b", "gemma3:latest", "gemma4:e2b", "gemma4:e4b", "gpt-oss:20b", "llava:latest", "nomic-embed-text:latest"];
  for (const m of models) {
    const ok = await testOllamaModel(m);
    console.log(`  ${ok ? "✅" : "❌"} ${m}`);
  }

  // ── 2. API Health ─────────────────────────────────────────────
  console.log("\n🌐 STEP 2: API Health Check");
  try {
    const r = await fetch(`${BASE_URL}/api/assistant/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "ping" }], model: "gemma3:1b" }),
      signal: AbortSignal.timeout(90_000),
    });
    console.log(`  API reachable: ${r.status === 200 ? "✅ 200 OK" : `❌ ${r.status}`}`);
  } catch (e: any) {
    console.log(`  ⚠️  API slow or unreachable: ${e.message} (continuing...)`);
  }

  // ── 3. Model Routing Tests ────────────────────────────────────
  console.log("\n🔀 STEP 3: Automatic Model Routing");

  await testChat("Small talk (→ gemma3:latest)", [{ role: "user", content: "hello" }], "automatic");
  await testChat("Short factual (→ gemma3:latest)", [{ role: "user", content: "what is roehampton" }], "automatic");
  await testChat("Complex query (→ gemma4:e4b)", [{ role: "user", content: "i am struggling with mental health and anxiety, what support options do i have" }], "automatic");
  await testChat("Finance query (→ gemma4:e4b)", [{ role: "user", content: "how do i apply for a bursary or financial hardship fund" }], "automatic");
  await testChat("Long analytical (→ gpt-oss:20b)", [{ role: "user", content: "can you explain in detail how the mitigating circumstances process works and compare it to the academic appeals process" }], "automatic");

  // ── 4. Direct Model Tests ─────────────────────────────────────
  console.log("\n🤖 STEP 4: Direct Model Tests");

  await testChat("gemma3:1b direct", [{ role: "user", content: "what is the library opening time" }], "gemma3:1b");
  await testChat("gemma3:latest direct", [{ role: "user", content: "library closing time" }], "gemma3:latest");
  await testChat("gemma4:e2b direct", [{ role: "user", content: "what mental health support is available" }], "gemma4:e2b");
  await testChat("gemma4:e4b direct", [{ role: "user", content: "tell me about mitigating circumstances" }], "gemma4:e4b");
  await testChat("gpt-oss:20b direct", [{ role: "user", content: "what are the academic regulations" }], "gpt-oss:20b");

  // ── 5. RAG Quality Tests ──────────────────────────────────────
  console.log("\n📚 STEP 5: RAG Retrieval Quality");

  await testChat("Library hours", [{ role: "user", content: "what time does the library close" }], "automatic");
  await testChat("Mitigating circumstances", [{ role: "user", content: "how do i submit mitigating circumstances" }], "automatic");
  await testChat("Exam timetable", [{ role: "user", content: "where can i find the exam timetable" }], "automatic");
  await testChat("Campus map", [{ role: "user", content: "where can i find a campus map" }], "automatic");
  await testChat("Student wellbeing", [{ role: "user", content: "i am feeling stressed and overwhelmed, what support is available" }], "automatic");
  await testChat("Enrolment", [{ role: "user", content: "how do i enrol as a postgraduate student" }], "automatic");

  // ── 6. Edge Cases ─────────────────────────────────────────────
  console.log("\n⚠️  STEP 6: Edge Cases & Safety");
  await testChat("Out-of-scope question", [{ role: "user", content: "what is the capital of france" }], "automatic");
  await testChat("Source follow-up", [
    { role: "user", content: "what time does the library close" },
    { role: "assistant", content: "The library closes at 10pm on weekdays." },
    { role: "user", content: "what is the source for that" }
  ], "automatic");
  await testChat("Link request", [{ role: "user", content: "can you give me a link to the student portal" }], "automatic");

  console.log("\n" + "=".repeat(60));
  console.log("✅ Test suite complete");
  console.log("=".repeat(60));
}

main().catch(console.error);
