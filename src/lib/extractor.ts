import Anthropic from "@anthropic-ai/sdk";

const EXTRACTION_PROMPT = `You are a data extraction assistant. Given the text content of a news article or social media post about a U.S. immigration enforcement incident, extract the following fields. Return ONLY valid JSON with no markdown formatting.

{
  "headline": "A short headline summarizing the incident (max 15 words)",
  "date": "The date of the incident in M/D/YYYY format if available, otherwise null",
  "location": "City, State abbreviation (e.g. 'Chicago, IL') if available, otherwise null",
  "summary": "A 2-4 sentence factual summary of what happened",
  "incidentType": "Comma-separated tags from ONLY these options: Detained, Deported, Death, Detention Conditions, Officer Use Of Force, Officer Misconduct, Minor/Family, U.S. Citizen, Protest / Intervention, Raid, Refugee/Asylum, DACA, Visa / Legal Status, LPR, TPS, Court Process Issue, 3rd Country Deportation, Native American, Vigilante",
  "country": "Country of origin of the affected person if mentioned, otherwise null"
}

Rules:
- Only use tags from the provided list. Use multiple comma-separated tags when applicable.
- If you cannot determine a field, set it to null.
- The summary should be factual and neutral in tone.
- For the date, extract the date the incident occurred (not the article publication date) if possible.
- Return ONLY the JSON object, no other text.`;

export type ExtractedData = {
  headline: string | null;
  date: string | null;
  location: string | null;
  summary: string | null;
  incidentType: string | null;
  country: string | null;
};

export async function extractFromText(
  text: string,
  url: string
): Promise<ExtractedData> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const anthropic = new Anthropic({ apiKey });

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `URL: ${url}\n\nArticle text:\n${text}`,
      },
    ],
    system: EXTRACTION_PROMPT,
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  let jsonStr = content.text.trim();
  if (jsonStr.startsWith("\`\`\`")) {
    jsonStr = jsonStr.replace(/^\`\`\`(?:json)?\n?/, "").replace(/\n?\`\`\`$/, "");
  }

  const parsed = JSON.parse(jsonStr);

  return {
    headline: parsed.headline || null,
    date: parsed.date || null,
    location: parsed.location || null,
    summary: parsed.summary || null,
    incidentType: parsed.incidentType || null,
    country: parsed.country || null,
  };
}
