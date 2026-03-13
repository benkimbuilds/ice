// @ts-nocheck
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../.env.local"), override: true });

import { Client } from "pg";

// IDs of the extreme heat articles we just added
const HEAT_IDS = [1693, 1694, 1695, 1696, 1698, 1699, 1700, 1701, 1702, 1703];

const TAG = "Climate/Environmental";

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  for (const id of HEAT_IDS) {
    const { rows } = await client.query(
      `SELECT id, "incidentType" FROM "Incident" WHERE id = $1`,
      [id]
    );
    if (!rows.length) {
      console.log(`  #${id}: not found`);
      continue;
    }
    const current = rows[0].incidentType || "";
    if (current.includes(TAG)) {
      console.log(`  #${id}: already has Climate/Environmental — skipping`);
      continue;
    }
    const updated = current ? `${current}, ${TAG}` : TAG;
    await client.query(`UPDATE "Incident" SET "incidentType" = $1 WHERE id = $2`, [updated, id]);
    console.log(`  #${id}: updated → ${updated}`);
  }

  console.log("\nDone.");
  await client.end();
}

main();
export {};
