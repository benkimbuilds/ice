import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { Client } from "pg";

const HEADLINE = "Colombian Nashville Journalist Estefany Rodríguez Detained by ICE During Traffic Stop";

const SUMMARY = `Estefany María Rodríguez Flores, a Colombian reporter for Nashville Noticias — a Spanish-language TV news outlet — was detained by ICE on March 5, 2026 during a traffic stop outside a Nashville gym, surrounded by multiple federal vehicles. Rodríguez had entered the U.S. legally on a tourist visa in 2021, subsequently applied for political asylum, married a U.S. citizen, obtained a work permit, and was awaiting a green card. ICE claimed she had overstayed her tourist visa, while her attorneys disputed the agency's authorization and argued the detention violated her First and Fifth Amendment rights, suspecting it was retaliation for her coverage of ICE enforcement. A federal judge ordered ICE to explain her continued detention by March 12; she was held at Etowah County Jail in Alabama. Press freedom organizations called the arrest an attack on the free press. A GoFundMe for her legal defense raised nearly $8,000 within days.`;

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const result = await client.query(
    `UPDATE "Incident"
     SET headline = $1, summary = $2
     WHERE id = 785
     RETURNING id, headline`,
    [HEADLINE, SUMMARY]
  );

  console.log("Updated:", result.rows[0]);
  await client.end();
}

main();
