import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../.env.local") });

import { prisma } from "../src/lib/db";
import { parseIncidentDate } from "../src/lib/geocode";

async function main() {
  const incidents = await prisma.incident.findMany({
    where: { parsedDate: null, date: { not: null } },
    select: { id: true, date: true },
  });

  console.log(`\nBackfilling parsedDate for ${incidents.length} incidents...\n`);

  let updated = 0;
  let skipped = 0;

  for (const inc of incidents) {
    const parsed = parseIncidentDate(inc.date);
    if (parsed) {
      await prisma.incident.update({ where: { id: inc.id }, data: { parsedDate: parsed } });
      updated++;
    } else {
      skipped++;
    }
  }

  console.log(`Done: ${updated} updated, ${skipped} skipped (unparseable dates)\n`);
  await prisma.$disconnect();
}
main();
