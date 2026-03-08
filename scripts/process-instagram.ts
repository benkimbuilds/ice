/**
 * Batch-process all Instagram / social media incidents in the database.
 *
 * Usage:
 *   npx tsx scripts/process-instagram.ts
 *
 * Requires EXA_API_KEY and ANTHROPIC_API_KEY in .env.local.
 *
 * Each incident goes through:
 *   1. Instagram embed scraping  → caption text + thumbnail image
 *   2. Claude Vision             → describe the thumbnail
 *   3. Exa findSimilar + search  → find related news articles
 *   4. Claude extraction         → structured incident data
 */

import { config } from "dotenv";
import { resolve } from "path";
// Load env BEFORE importing anything that reads process.env
config({ path: resolve(__dirname, "../.env.local") });
config({ path: resolve(__dirname, "../.env") });

import { prisma } from "../src/lib/db";
import { processInstagramPipeline } from "../src/lib/instagram-pipeline";

const SOCIAL_HOSTS = ["instagram.com", "tiktok.com", "facebook.com/reel"];
const CONCURRENCY = 2; // keep low — Exa and Claude have rate limits

async function pLimit(tasks: (() => Promise<void>)[], concurrency: number) {
  let i = 0;
  async function worker() {
    while (i < tasks.length) await tasks[i++]();
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
}

async function main() {
  // Find all social media incidents that need processing
  const all = await prisma.incident.findMany({
    where: {
      OR: [
        { status: "RAW" },
        { status: "FAILED" },
      ],
    },
    select: { id: true, url: true, status: true, errorMessage: true },
    orderBy: { id: "asc" },
  });

  const targets = all.filter((inc) =>
    SOCIAL_HOSTS.some((h) => inc.url.includes(h))
  );

  if (targets.length === 0) {
    console.log("No social media incidents to process.");
    await prisma.$disconnect();
    return;
  }

  console.log(`\n📱 Processing ${targets.length} social media incidents (${CONCURRENCY} concurrent)…\n`);

  let done = 0;
  let succeeded = 0;
  let failed = 0;

  const tasks = targets.map(({ id, url }) => async () => {
    const n = ++done;
    try {
      await processInstagramPipeline(id);
      succeeded++;
      console.log(`  ✅ [${n}/${targets.length}] #${id} — ${url.slice(0, 70)}`);
    } catch (err: any) {
      failed++;
      console.error(`  ❌ [${n}/${targets.length}] #${id} FAILED: ${err.message?.slice(0, 100)}`);
    }
  });

  await pLimit(tasks, CONCURRENCY);

  console.log(`\n🏁 Done: ${succeeded} succeeded, ${failed} failed out of ${targets.length}.\n`);

  // Print any still-failing ones for manual review
  if (failed > 0) {
    const stillFailed = await prisma.incident.findMany({
      where: { id: { in: targets.map((t) => t.id) }, status: "FAILED" },
      select: { id: true, url: true, errorMessage: true },
    });
    console.log("Still failing (may need manual entry):");
    stillFailed.forEach((inc) => {
      console.log(`  #${inc.id}  ${inc.url}`);
      console.log(`         → ${inc.errorMessage}`);
    });
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
