import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../.env.local") });

import { prisma } from "../src/lib/db";

async function main() {
  const withParsedDate = await prisma.incident.count({ where: { parsedDate: { not: null }, headline: { not: null } } });
  const withoutParsedDate = await prisma.incident.count({ where: { parsedDate: null, headline: { not: null } } });
  console.log("With parsedDate:", withParsedDate);
  console.log("Without parsedDate:", withoutParsedDate);

  const sample = await prisma.incident.findMany({
    where: { parsedDate: null, headline: { not: null } },
    take: 5,
    select: { id: true, date: true, headline: true },
  });
  console.log("\nSample without parsedDate:");
  sample.forEach(r => console.log(`  #${r.id} date="${r.date}" — ${r.headline}`));

  await prisma.$disconnect();
}
main();
