export type ScrapeResult = {
  metadata: PageMetadata;
  bodyText: string;
};

export type PageMetadata = {
  title: string | null;
  description: string | null;
  date: string | null;
  image: string | null;
  siteName: string | null;
  author: string | null;
  jsonLd: Record<string, unknown> | null;
};

function extractMeta(html: string, property: string): string | null {
  // Match both property="..." and name="..." attributes
  const patterns = [
    new RegExp(`<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["']`, "i"),
  ];
  for (const re of patterns) {
    const match = html.match(re);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function extractJsonLd(html: string): Record<string, unknown> | null {
  const match = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match?.[1]) return null;
  try {
    const parsed = JSON.parse(match[1]);
    // If it's an array, take the first NewsArticle or just the first item
    if (Array.isArray(parsed)) {
      return parsed.find((p: any) => p["@type"] === "NewsArticle" || p["@type"] === "Article") || parsed[0] || null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match?.[1]?.trim() || null;
}

function extractMetadata(html: string): PageMetadata {
  const jsonLd = extractJsonLd(html);

  return {
    title:
      extractMeta(html, "og:title") ||
      extractMeta(html, "twitter:title") ||
      (jsonLd?.headline as string) ||
      extractTitle(html),
    description:
      extractMeta(html, "og:description") ||
      extractMeta(html, "twitter:description") ||
      extractMeta(html, "description") ||
      (jsonLd?.description as string) ||
      null,
    date:
      extractMeta(html, "article:published_time") ||
      (jsonLd?.datePublished as string) ||
      (jsonLd?.dateCreated as string) ||
      null,
    image:
      extractMeta(html, "og:image") ||
      null,
    siteName:
      extractMeta(html, "og:site_name") ||
      (jsonLd?.publisher as any)?.name ||
      null,
    author:
      extractMeta(html, "author") ||
      extractMeta(html, "article:author") ||
      (typeof jsonLd?.author === "string" ? jsonLd.author : (jsonLd?.author as any)?.name) ||
      null,
    jsonLd,
  };
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ICEIncidentTracker/1.0; +research)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const metadata = extractMetadata(html);
    const bodyText = htmlToText(html).slice(0, 15000);

    return { metadata, bodyText };
  } finally {
    clearTimeout(timeout);
  }
}
