// @ts-nocheck
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../.env.local"), override: true });

import { Client } from "pg";

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // Check heat incidents tags and summary
  const { rows: heat } = await client.query(
    `SELECT id, status, headline, "incidentType", summary FROM "Incident" WHERE id >= 1693 ORDER BY id`
  );
  console.log("=== Heat incidents (#1693+) ===");
  for (const r of heat) {
    const hasClimate = (r.incidentType || "").includes("Climate");
    console.log(`  #${r.id} [${r.status}] climate=${hasClimate}`);
    console.log(`    headline: ${r.headline?.slice(0, 70)}`);
    console.log(`    tags: ${r.incidentType || "(none)"}`);
    console.log(`    summary: ${r.summary?.slice(0, 120)}`);
    console.log();
  }

  await client.end();
}

main();
export {};
