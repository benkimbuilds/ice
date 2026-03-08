/**
 * Parse the altSources DB field into an array of URLs.
 * Handles: JSON array string, legacy single URL string.
 */
export function parseAltSources(altSources: string | null): string[] {
  if (!altSources) return [];
  const trimmed = altSources.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [trimmed];
    } catch {
      return [trimmed].filter(Boolean);
    }
  }
  return [trimmed].filter(Boolean);
}

/**
 * Serialize an array of URLs into the altSources DB field format.
 */
export function serializeAltSources(urls: string[]): string | null {
  const filtered = urls.map((u) => u.trim()).filter(Boolean);
  return filtered.length > 0 ? JSON.stringify(filtered) : null;
}
