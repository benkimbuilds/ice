// @ts-nocheck
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../.env.local"), override: true });

import { Client } from "pg";

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // Check new alligator/cecot incidents
  const { rows: newOnes } = await client.query(
    `SELECT id, status, headline, "parsedDate" FROM "Incident" WHERE id >= 1665 ORDER BY id`
  );
  console.log("=== New incidents (#1665+) ===");
  for (const r of newOnes) {
    const h = r.headline ? r.headline.slice(0, 65) : "(no headline)";
    console.log(`  #${r.id} [${r.status.padEnd(10)}] parsedDate=${r.parsedDate ? r.parsedDate.toISOString().slice(0, 10) : "NULL"} — ${h}`);
  }

  // Check phone/communication incidents
  const { rows: phone } = await client.query(
    `SELECT id, status, headline, "parsedDate", "incidentType" FROM "Incident"
     WHERE "incidentType" ILIKE '%phone%' OR "incidentType" ILIKE '%communicat%'
     ORDER BY id DESC`
  );
  console.log("\n=== Phone/Communication incidents ===");
  console.log("Count:", phone.length);
  for (const r of phone) {
    const h = r.headline ? r.headline.slice(0, 60) : "(no headline)";
    console.log(`  #${r.id} [${r.status.padEnd(10)}] parsedDate=${r.parsedDate ? r.parsedDate.toISOString().slice(0, 10) : "NULL"} [${r.incidentType}]`);
    console.log(`    ${h}`);
  }

  // Check incidents with null parsedDate
  const { rows: noParsed } = await client.query(
    `SELECT COUNT(*) as cnt FROM "Incident" WHERE status='COMPLETE' AND headline IS NOT NULL AND "parsedDate" IS NULL`
  );
  console.log(`\n=== COMPLETE+headline but NULL parsedDate: ${noParsed[0].cnt}`);

  await client.end();
}

main();

export {};
