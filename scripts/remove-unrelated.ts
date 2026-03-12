/**
 * Scan all incidents and remove any not related to immigration enforcement.
 *
 * Run: npx tsx scripts/remove-unrelated.ts          (dry run — lists unrelated)
 *      npx tsx scripts/remove-unrelated.ts --delete  (actually deletes them)
 */
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../.env.local"), override: true });

import Anthropic from "@anthropic-ai/sdk";
import { Client } from "pg";

const DELETE = process.argv.includes("--delete");
const BATCH_SIZE = 30;

type Incident = {
  id: number;
  headline: string | null;
  summary: string | null;
};

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function findUnrelated(incidents: Incident[]): Promise<number[]> {
  const incidentText = incidents
    .map(
      (inc) =>
        `ID ${inc.id}:\n  Headline: ${inc.headline ?? "(none)"}\n  Summary: ${(inc.summary ?? "").slice(0, 200)}`
    )
    .join("\n\n");

  const prompt = `You are reviewing a database of incidents related to U.S. immigration enforcement. Your job is to identify incidents that do NOT belong — i.e., incidents that are clearly unrelated to immigration enforcement, ICE operations, deportation, detention, customs enforcement, immigration courts, or immigration policy.

An incident BELONGS if it involves any of:
- ICE arrests, raids, or operations
- Deportation or removal proceedings
- Immigration detention facilities or conditions
- CBP / Border Patrol enforcement
- Immigration courts or legal proceedings
- People affected by immigration enforcement (detained, deported, etc.)
- Protests or interventions related to immigration enforcement
- Government immigration policy and its human impact
- Stories about people living under threat of immigration enforcement

An incident does NOT belong if it is clearly about something unrelated, such as:
- Purely domestic crimes with no immigration connection
- General court cases unrelated to immigration
- Unrelated news stories that happen to mention a name or place
- Content that has no clear connection to immigration enforcement

Be CONSERVATIVE — only flag incidents you are HIGHLY CONFIDENT are not about immigration enforcement. If in doubt, keep it.

Return ONLY a JSON array of IDs that should be removed. If all belong, return [].
Example: [123, 456]

INCIDENTS:
${incidentText}`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text.trim() : "";

  // Extract JSON array
  let depth = 0, start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "[") {
      if (start === -1) start = i;
      depth++;
    } else if (text[i] === "]") {
      if (--depth === 0 && start !== -1) {
        try {
          const arr = JSON.parse(text.slice(start, i + 1));
          return Array.isArray(arr) ? arr.filter((x) => typeof x === "number") : [];
        } catch {
          return [];
        }
      }
    }
  }
  return [];
}

async function main() {
  console.log(DELETE ? "DELETE MODE — will remove unrelated incidents\n" : "DRY RUN — listing unrelated incidents (run with --delete to remove)\n");

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const { rows: incidents } = await client.query<Incident>(
    `SELECT id, headline, summary
     FROM "Incident"
     WHERE status = 'COMPLETE' AND headline IS NOT NULL
     ORDER BY id`
  );
  console.log(`Loaded ${incidents.length} incidents\n`);

  const toRemove: { id: number; headline: string }[] = [];

  for (let i = 0; i < incidents.length; i += BATCH_SIZE) {
    const batch = incidents.slice(i, i + BATCH_SIZE);
    const end = Math.min(i + BATCH_SIZE, incidents.length);
    process.stdout.write(`Batch ${i + 1}–${end} / ${incidents.length}... `);

    const unrelatedIds = await findUnrelated(batch);
    console.log(`${unrelatedIds.length} unrelated`);

    for (const id of unrelatedIds) {
      const inc = batch.find((b) => b.id === id);
      if (!inc) continue;
      toRemove.push({ id, headline: inc.headline ?? "(no headline)" });
      console.log(`  ✗ #${id}: ${inc.headline?.slice(0, 80)}`);
    }
  }

  console.log(`\n━━━ Summary ━━━`);
  console.log(`${toRemove.length} incidents flagged as unrelated to immigration enforcement`);

  if (toRemove.length > 0 && DELETE) {
    const ids = toRemove.map((r) => r.id);
    await client.query(`DELETE FROM "Incident" WHERE id = ANY($1)`, [ids]);
    console.log(`✓ Deleted ${ids.length} incidents`);
  } else if (toRemove.length > 0) {
    console.log(`\nRun with --delete to remove these ${toRemove.length} incidents.`);
  }

  await client.end();
}

main().catch(console.error);
