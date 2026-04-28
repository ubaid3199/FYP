import { HybridRAG } from './lib/domains/rag/hybridStore';
import { OllamaEmbeddings } from '@langchain/ollama';

async function smokeTest() {
  console.log('=== RAG Smoke Test ===\n');
  process.env.RAG_DEBUG_METRICS = '1';
  
  const embeddings = new OllamaEmbeddings({ 
    model: process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text:latest',
    baseUrl: 'http://127.0.0.1:11434',
  });
  
  const rag = new HybridRAG(embeddings);
  await rag.loadFromDisk();
  
  const testQueries = [
    'What is the deadline for mitigating circumstances?',
    'What courses are available for undergraduate students?',
    'What facilities are available at the Roehampton campus?',
    'How do I apply for postgraduate study?',
    'What is the library like at Roehampton?'
  ];
  
  for (const query of testQueries) {
    console.log(`Query: "${query}"`);
    try {
      const results = await rag.retrieve(query, 5);
      console.log(`  Found ${results.length} results`);
      results.slice(0, 2).forEach((r, i) => {
        const doc = r as any;
        console.log(`    ${i+1}. ${doc.metadata?.source || 'unknown'}`);
        console.log(`       ${doc.pageContent.substring(0, 80)}...`);
      });
      console.log();
    } catch (e: any) {
      console.log(`  ERROR: ${e.message}`);
      console.log();
    }
  }
  
  console.log('=== Smoke Test Complete ===');
}

smokeTest().catch(console.error);
