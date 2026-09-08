/**
 * Player display name handling: stall-safe (no accounts), spam-resistant.
 */
const MAX_NAME_LENGTH = 16;
const BLOCKED = new Set(["admin", "organizer", "root", "system", "engineered"]);

export function sanitizeName(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const cleaned = raw
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N} _\-.]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME_LENGTH);
  if (cleaned.length < 2) return null;
  if (BLOCKED.has(cleaned.toLowerCase())) return null;
  return cleaned;
}

/** Short share id for result cards: e.g. "7K2F-Q91X". */
export function generateShareId(): string {
  const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  let id = "";
  for (let i = 0; i < 8; i++) {
    id += alphabet[Math.floor(Math.random() * alphabet.length)];
    if (i === 3) id += "-";
  }
  return id;
}
