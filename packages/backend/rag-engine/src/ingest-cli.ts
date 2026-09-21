/**
 * Standalone ingestion CLI.
 *
 * Usage:
 *   RAG_DATA_DIR=./dev-data/rag node dist/ingest-cli.js ../../../dev-data/assets/readables
 *
 * This is intentionally separate from the app's IPC surface: ingestion is a
 * background/offline operation (per section on "Model loading" performance
 * rules — expensive work happens outside the real-time voice loop), so it's
 * fine to run it as a build/setup step or from a background queue in
 * content-sync.ts, not from a renderer-triggered IPC call during a recording.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { RagEngine } from './index.js';

async function extractText(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') {
    const pdfModule = await import('pdf-parse');
    const pdfParse = typeof pdfModule === 'function' ? pdfModule : pdfModule.default;
    const buffer = readFileSync(filePath);
    const result = await pdfParse(buffer);
    return result.text;
  }
  if (ext === '.md' || ext === '.txt') {
    return readFileSync(filePath, 'utf-8');
  }
  throw new Error(`Unsupported file type for ingestion: ${filePath}`);
}

function collectFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...collectFiles(full));
    } else if (/\.(pdf|md|txt)$/i.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

async function main() {
  const targetDir = process.argv[2];
  if (!targetDir) {
    console.error('Usage: ingest-cli <directory>');
    process.exit(1);
  }

  const dataDir = process.env.RAG_DATA_DIR ?? path.resolve(process.cwd(), 'dev-data/rag');
  const engine = new RagEngine({ dataDir });
  await engine.warmup();

  const files = collectFiles(path.resolve(targetDir));
  console.log(`[ingest-cli] found ${files.length} file(s) to ingest`);

  for (const file of files) {
    try {
      const text = await extractText(file);
      const id = path.relative(process.cwd(), file);
      const { chunkCount, ms } = await engine.ingest({
        id,
        text,
        metadata: { title: path.basename(file), source: id },
      });
      console.log(`  ✓ ${id}: ${chunkCount} chunks (${ms}ms)`);
    } catch (err) {
      console.error(`  ✗ ${file}:`, (err as Error).message);
    }
  }

  console.log(`[ingest-cli] done. documents in index: ${engine.documentCount()}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
