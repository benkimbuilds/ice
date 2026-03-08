import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../.env.local") });

import { prisma } from "../src/lib/db";

async function main() {
  const rows = await prisma.incident.findMany({
    where: { url: { contains: "instagram.com" } },
    select: { id: true, url: true, status: true, headline: true, errorMessage: true },
    orderBy: { id: "asc" },
  });
  console.log(`\nInstagram incidents (${rows.length} total):\n`);
  rows.forEach((r) => {
    console.log(`  #${r.id} [${r.status}] ${r.url.slice(0, 60)}`);
    if (r.headline) console.log(`        headline: ${r.headline}`);
    if (r.errorMessage) console.log(`        error: ${r.errorMessage}`);
  });
  await prisma.$disconnect();
}
main();
