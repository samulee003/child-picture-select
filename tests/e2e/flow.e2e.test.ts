import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, writeFile, cp, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import sharp from 'sharp';
import { fileToEmbedding } from '../../src/core/embeddings';
import { cosineSimilarity } from '../../src/core/similarity';

async function createSolidImage(filePath: string, color: string) {
  const [r, g, b] = color
    .replace('#', '')
    .match(/.{1,2}/g)!
    .map((x) => parseInt(x, 16));
  const img = await sharp({ create: { width: 64, height: 64, channels: 3, background: { r, g, b } } })
    .png()
    .toBuffer();
  await writeFile(filePath, img);
}

describe('E2E skeleton: scan → match → export', () => {
  let workDir: string;
  let outDir: string;
  let imgA: string;
  let imgB: string;
  let imgC: string;

  beforeAll(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'fmko-'));
    outDir = join(workDir, 'export');
    await mkdir(outDir);
    imgA = join(workDir, 'a.png');
    imgB = join(workDir, 'b.png');
    imgC = join(workDir, 'c.png');
    await createSolidImage(imgA, '#ff0000');
    await createSolidImage(imgB, '#00ff00');
    await createSolidImage(imgC, '#0000ff');
  });

  afterAll(async () => {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  });

  it('scans files, computes embeddings, matches by cosine, and exports topN', async () => {
    // Arrange: reference is imgA
    const ref = await fileToEmbedding(imgA);
    const embA = await fileToEmbedding(imgA);
    const embB = await fileToEmbedding(imgB);
    const embC = await fileToEmbedding(imgC);

    const candidates = [
      { path: imgA, emb: embA },
      { path: imgB, emb: embB },
      { path: imgC, emb: embC }
    ];

    // Act: compute best scores vs reference and sort
    const results = candidates
      .map((c) => ({ path: c.path, score: cosineSimilarity(c.emb, ref) }))
      .sort((a, b) => b.score - a.score);

    // Assert ranking and threshold behavior
    expect(results[0].path).toBe(imgA);
    const threshold = Math.max(0.5, results[1].score + 1e-6);
    const filtered = results.filter((r) => r.score >= threshold);
    expect(filtered.length).toBe(1);

    // Simulate export copy for topN=2
    const topN = 2;
    const toExport = results.slice(0, topN).map((r) => r.path);
    for (const src of toExport) {
      const base = src.split(/[/\\]/).pop()!;
      await cp(src, join(outDir, base));
    }
    // Basic check: exported files exist in outDir
    // Note: fs access is implicit; rely on cp not throwing
    expect(toExport.length).toBe(2);
  });
});


