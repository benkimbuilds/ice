import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { Client } from "pg";

async function addAltSource(client: Client, id: number, newUrls: string[]) {
  const res = await client.query(
    `SELECT "altSources" FROM "Incident" WHERE id = $1`,
    [id]
  );
  if (!res.rows[0]) {
    console.log(`  ⚠ ID ${id} not found, skipping`);
    return;
  }
  const existing: string[] = res.rows[0].altSources
    ? JSON.parse(res.rows[0].altSources)
    : [];
  const combined = [...new Set([...existing, ...newUrls])];
  if (combined.length === existing.length) {
    console.log(`  ⏭ ID ${id}: all sources already present`);
    return;
  }
  await client.query(
    `UPDATE "Incident" SET "altSources" = $1 WHERE id = $2`,
    [JSON.stringify(combined), id]
  );
  console.log(
    `  ✓ ID ${id}: added ${combined.length - existing.length} new source(s) (${combined.length} total)`
  );
}

async function addNewIncident(
  client: Client,
  url: string,
  label: string
): Promise<boolean> {
  // Check if URL already exists
  const existing = await client.query(
    `SELECT id FROM "Incident" WHERE url = $1`,
    [url]
  );
  if (existing.rows.length > 0) {
    console.log(`  ⏭ "${label}" already exists as ID ${existing.rows[0].id}`);
    return false;
  }
  // Also check altSources
  const altCheck = await client.query(
    `SELECT id FROM "Incident" WHERE "altSources" ILIKE '%' || $1 || '%'`,
    [url]
  );
  if (altCheck.rows.length > 0) {
    console.log(
      `  ⏭ "${label}" already exists as alt source on ID ${altCheck.rows[0].id}`
    );
    return false;
  }
  await client.query(
    `INSERT INTO "Incident" (url, status, "createdAt", "updatedAt") VALUES ($1, 'RAW', NOW(), NOW())`,
    [url]
  );
  console.log(`  ✓ Added: "${label}"`);
  return true;
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // ========================================
  // ADD NEW SOURCES TO EXISTING STORIES
  // ========================================
  console.log("=== ADDING SOURCES TO EXISTING STORIES ===\n");

  // Leqaa Kordia (ID 2206) — Zeteo first-person account
  console.log("Kordia first-person account (Zeteo):");
  await addAltSource(client, 2206, [
    "https://zeteo.com/p/leqaa-kordia-ice-detention-women-trump-administration",
  ]);

  // Estefany Rodriguez (ID 785) — Nashville Banner bond story
  console.log("Estefany Rodriguez bond story (Nashville Banner):");
  await addAltSource(client, 785, [
    "https://nashvillebanner.com/2026/03/16/ice-detention-nashville-journalist-estefany-rodriguez-bond/",
  ]);

  // Afghan man died in custody (ID 2194) — Fort Worth Star-Telegram
  console.log("Afghan man ICE death (additional sources):");
  await addAltSource(client, 2194, [
    "https://www.texastribune.org/2026/03/15/afghan-man-dies-ice-custody-dallas/",
    "https://www.spokesman.com/stories/2026/mar/18/he-was-not-illegal-afghan-asylum-seekers-death-in-/",
  ]);

  // Haitian woman bus stop Pittsburgh (ID 2308) — WTAE
  console.log("Haitian woman bus stop death (additional sources):");
  await addAltSource(client, 2308, [
    "https://haitiantimes.com/2026/03/14/haitian-asylum-seeker-death-ice-pittsburgh/",
    "https://migrantinsider.com/p/the-lonesome-death-of-daphy-michel",
  ]);

  // Maryland man lured to police station (ID 1710) — Washington Post
  console.log("Maryland man lured to police station (Washington Post):");
  await addAltSource(client, 1710, [
    "https://www.washingtonpost.com/dc-md-va/2026/02/25/dc-police-ice-coordination-arrests/",
  ]);

  // Community patroller arrested (ID 2290) — L.A. Taco
  console.log("Community patroller car rammed (L.A. Taco):");
  await addAltSource(client, 2290, [
    "https://lataco.com/ice-rams-vehicle-again",
  ]);

  // Anti-ICE terrorism charges Texas (ID 2296) — The Intercept
  console.log("Anti-ICE terrorism charges Texas (The Intercept):");
  await addAltSource(client, 2296, [
    "https://theintercept.com/2026/03/13/ice-protesters-terrorism-prairieland-antifa/",
  ]);
  // Also add to ID 2303
  await addAltSource(client, 2303, [
    "https://theintercept.com/2026/03/13/ice-protesters-terrorism-prairieland-antifa/",
  ]);

  // Marimar Martinez (ID 1955) — New Yorker profile
  console.log("Marimar Martinez (WBEZ/New Yorker profile):");
  await addAltSource(client, 1955, [
    "https://www.wbez.org/immigration/2026/02/03/marimar-martinez-shot-border-patrol-chicago-speaks-out-after-good-pretti-deaths-i-am-their-voice",
  ]);

  // Bovino retiring (ID 2688) — NBC News
  console.log("Bovino retiring (NBC News):");
  await addAltSource(client, 2688, [
    "https://www.nbcnews.com/news/us-news/border-patrol-gregory-bovino-retire-immigration-enforcement-rcna263751",
  ]);

  // Liam Ramos (ID 2394) — Delta flights / Gillian Brockell
  console.log("Liam Ramos Delta flights (Gillian Brockell):");
  await addAltSource(client, 2394, [
    "https://gillianbrockell.com/video-proves-delta-flew-liam-ramos-and-his-dad-to-ice-detention-center/",
  ]);

  // 900+ children past 20-day limit (ID 1737) — NBC News
  console.log("900+ children past 20-day limit (NBC News):");
  await addAltSource(client, 1737, [
    "https://www.nbcnews.com/news/us-news/children-languish-ice-detention-long-20-day-court-limit-rcna262525",
  ]);

  // ========================================
  // ADD NEW INCIDENTS
  // ========================================
  console.log("\n=== ADDING NEW INCIDENTS ===\n");

  let added = 0;
  const newStories: Array<[string, string]> = [
    // DHS accountability reports
    [
      "https://www.wola.org/analysis/denouncing-into-the-void-the-dismantling-of-internal-oversight-and-accountability-at-dhs/",
      "WOLA/Kino report: DHS accountability structure dismantled — CRCL shrunk 80%, Detention Ombudsman 96%",
    ],
    [
      "https://www.womensrefugeecommission.org/research-resources/what-about-my-children-family-separation-among-parents-deported-to-honduras/",
      "WRC/PHR report: Parents deported without children even when requesting them (Honduras)",
    ],

    // Detention conditions & systemic
    [
      "https://www.instagram.com/p/DOMBhSgkVL_/",
      "Austin Kocher: ICE modeling detention centers on Amazon supply chain",
    ],
    [
      "https://migrantinsider.com/p/meet-the-lobbyists-behind-migrant",
      "Migrant Insider: Lobbyists working for private prison companies with ICE contracts",
    ],
    [
      "https://prismreports.org/2026/03/12/detention-centers-map-freedom-for-immigrants/",
      "Freedom For Immigrants interactive map of detention centers (Prism)",
    ],

    // ICE death — 19-year-old Tzotzil Maya
    [
      "https://lataco.com/youngest-ice-death",
      "19-year-old Tzotzil Maya from Chiapas dies in ICE custody in Florida (L.A. Taco)",
    ],

    // Resistance & community
    [
      "https://sahanjournal.com/public-safety/advocates-human-rights-sues-doj-immigration-court-access/",
      "Minneapolis human rights group sues over immigration courts closing hearings to public",
    ],
    [
      "https://www.planetizen.com/news/2026/03/137159-architecture-firm-stop-designing-ice-prisons-after-staff-outrage",
      "Architecture firm employees revolt and quit over ICE contract (Mother Jones)",
    ],
    [
      "https://capitalandmain.com/from-socal-to-minneapolis-fatal-encounters-show-impunity-of-immigration-officials-activists-say",
      "Capital & Main: Woman who documented ICE killing in San Diego speaks about witnessing state violence",
    ],

    // Family stories
    [
      "https://apps.bostonglobe.com/2026/02/metro/us-citizen-family-guatemala/",
      "Boston Globe: Mother and children travel to Guatemala to reunite with deported father",
    ],

    // Policy & surveillance
    [
      "https://www.mainepublic.org/politics/2026-03-12/maine-nurses-call-on-collins-to-stop-taking-donations-from-ice-surveillance-company",
      "Maine nurses call out Sen. Collins for taking money from Palantir (ICE surveillance)",
    ],
    [
      "https://www.chicagotribune.com/2026/03/15/daca-delays-trump-immigration/",
      "Chicago Tribune: DACA work permit delays causing immigrants to lose jobs",
    ],
    [
      "https://dnyuz.com/2026/03/15/to-address-farm-labor-shortage-trump-administration-turns-to-migrant-workers/",
      "NYT: Trump administration lowered required wages for temporary foreign farmworkers",
    ],
  ];

  for (const [url, label] of newStories) {
    const result = await addNewIncident(client, url, label);
    if (result) added++;
  }

  // Springfield Ohio safe houses - try NYT original URL pattern
  const springfieldAdded = await addNewIncident(
    client,
    "https://dnyuz.com/2026/03/03/inside-the-underground-safe-houses-sheltering-immigrants-from-ice/",
    "NYT: Springfield Ohio neighbors create safe houses for Haitian families"
  );
  if (springfieldAdded) added++;

  console.log(`\n=== DONE ===`);
  console.log(`Added ${added} new incidents (will need scraping)`);
  console.log(
    `Updated alt sources on existing incidents above`
  );

  await client.end();
}

main().catch(console.error);
