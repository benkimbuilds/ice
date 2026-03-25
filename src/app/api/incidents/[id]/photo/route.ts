import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseAltSources } from "@/lib/sources";

const EDIT_PASSWORD = "acab";

/**
 * Extract the best person photo from linked articles.
 * Tries og:image from each source URL, picks the most likely person photo.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (req.headers.get("x-edit-password") !== EDIT_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const incident = await prisma.incident.findUnique({
    where: { id },
    select: { url: true, altSources: true, imageUrl: true },
  });

  if (!incident) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // If incident already has an imageUrl, return it
  if (incident.imageUrl) {
    return NextResponse.json({
      imageUrl: incident.imageUrl,
      source: getDomain(incident.url),
      cached: true,
    });
  }

  // Collect all URLs to try
  const altUrls = parseAltSources(incident.altSources);
  const allUrls = [incident.url, ...altUrls].filter(
    (u) => !u.includes("instagram.com") && !u.includes("tiktok.com")
  );

  const results: Array<{ url: string; imageUrl: string; source: string }> = [];

  for (const url of allUrls.slice(0, 5)) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        },
        signal: AbortSignal.timeout(8000),
        redirect: "follow",
      });

      if (!res.ok) continue;

      const html = await res.text();

      // Extract og:image
      const ogMatch = html.match(
        /<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i
      ) ?? html.match(
        /content=["']([^"']+)["']\s+(?:property|name)=["']og:image["']/i
      );

      if (ogMatch?.[1]) {
        let imgUrl = ogMatch[1];
        // Make relative URLs absolute
        if (imgUrl.startsWith("/")) {
          try {
            const u = new URL(url);
            imgUrl = `${u.protocol}//${u.host}${imgUrl}`;
          } catch { /* skip */ }
        }

        // Skip generic/logo images
        const lower = imgUrl.toLowerCase();
        if (
          lower.includes("logo") ||
          lower.includes("favicon") ||
          lower.includes("icon") ||
          lower.includes("placeholder") ||
          lower.includes("default") ||
          lower.includes("banner") ||
          lower.includes("site-image") ||
          lower.includes("share-image")
        ) {
          continue;
        }

        results.push({
          url,
          imageUrl: imgUrl,
          source: getDomain(url),
        });
      }
    } catch {
      // Skip failed URLs
    }
  }

  if (results.length === 0) {
    return NextResponse.json({ error: "No photos found" }, { status: 404 });
  }

  // Return the first good result
  const best = results[0];
  return NextResponse.json({
    imageUrl: best.imageUrl,
    source: best.source,
    allPhotos: results.map((r) => ({ imageUrl: r.imageUrl, source: r.source })),
  });
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
