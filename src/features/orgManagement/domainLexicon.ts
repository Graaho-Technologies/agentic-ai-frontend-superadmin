// src/features/orgManagement/domainLexicon.ts
//
// `DEFAULT_DOMAIN_LEXICON` below was transcribed by hand from a Postman
// screenshot of a reference `dynamic_config.domain_lexicon` payload. The
// screenshot's lines were cut off at the right edge, so some of the Bangla
// aliases here are best-effort reconstructions, not a verified transcription
// of the original request body. Treat this as a seed/preset that the admin
// reviews and edits in the UI — not an authoritative or complete lexicon.
import type { DomainLexiconEntry } from "./orgManagementApi.types";

export const DEFAULT_DOMAIN_LEXICON: DomainLexiconEntry[] = [
  {
    canonical: "CellFin",
    aliases: ["সেলফিন", "সেল ফিন", "selfin", "celfin", "cellfin", "cell fin"],
  },
  {
    canonical: "QR",
    aliases: ["বাংলা কিউআর", "বাংলা কিউ আর", "bangla qr", "bangla kiu ar"],
  },
  {
    canonical: "Bangla QR",
    aliases: ["বাংলা কিউআর", "বাংলা কিউ আর", "bangla qr"],
  },
  {
    canonical: "iBanking",
    aliases: ["আইব্যাংকিং", "ibanking", "i banking"],
  },
  {
    canonical: "Merchant QR",
    aliases: ["মার্চেন্ট কিউআর", "merchant qr"],
  },
  {
    canonical: "Khidmah",
    aliases: ["খিদমাহ", "খিদমা", "khidmah", "khedma"],
  },
  {
    canonical: "mCash",
    aliases: ["এমক্যাশ", "এম ক্যাশ", "mcash", "m cash"],
  },
  {
    canonical: "SMS Banking",
    aliases: ["এসএমএস ব্যাংকিং", "sms banking"],
  },
  {
    canonical: "Khidmah Mastercard World",
    aliases: ["খিদমাহ মাস্টারকার্ড"],
  },
  {
    canonical: "Credit Card",
    aliases: ["ক্রেডিট কার্ড"],
  },
  {
    canonical: "Debit Card",
    aliases: ["ডেবিট কার্ড"],
  },
  {
    canonical: "Prepaid Card",
    aliases: ["প্রিপেইড কার্ড"],
  },
];

// ─── Serialize ──────────────────────────────────────────────────────────────
// The backend stores the lexicon as a JSON STRING inside the free-form
// `dynamic_config` column, matching the reference Postman request this
// feature was specified from — not as a native JSON array.

export function serializeDomainLexicon(entries: DomainLexiconEntry[]): string {
  return JSON.stringify(entries);
}

// ─── Parse ──────────────────────────────────────────────────────────────────
// Tolerant reader for whatever comes back from `dynamic_config.domain_lexicon`.
// The column is free-form and un-validated server-side, so this never throws:
// a malformed stored value surfaces as `error`, and callers get `entries: []`
// to render against rather than a crash.

export function parseDomainLexicon(
  value: string | DomainLexiconEntry[] | null | undefined
): { entries: DomainLexiconEntry[]; error: string | null } {
  if (value === null || value === undefined) {
    return { entries: [], error: null };
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") {
      return { entries: [], error: null };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return { entries: [], error: "Stored domain lexicon is not valid JSON." };
    }

    return validateDomainLexicon(parsed);
  }

  return validateDomainLexicon(value);
}

// Validates an already-parsed value against the `DomainLexiconEntry[]`
// shape. Hard-fails (error + no entries) only when the shape is
// fundamentally wrong: not an array, an element that isn't an object, or an
// element missing a string `canonical`. Everything else that can be
// salvaged safely (a missing/null `aliases`, or an `aliases` array with
// some non-string members) is coerced leniently instead of failing the
// whole parse.
function validateDomainLexicon(value: unknown): { entries: DomainLexiconEntry[]; error: string | null } {
  if (!Array.isArray(value)) {
    return { entries: [], error: "Domain lexicon must be an array of entries." };
  }

  const entries: DomainLexiconEntry[] = [];

  for (let i = 0; i < value.length; i += 1) {
    const raw = value[i];

    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      return { entries: [], error: `Domain lexicon entry at index ${i} is not an object.` };
    }

    const record = raw as Record<string, unknown>;
    const canonical = record.canonical;
    if (typeof canonical !== "string") {
      return {
        entries: [],
        error: `Domain lexicon entry at index ${i} is missing a "canonical" string.`,
      };
    }

    const rawAliases = record.aliases;
    const aliases = Array.isArray(rawAliases)
      ? rawAliases.filter((alias): alias is string => typeof alias === "string")
      : [];

    entries.push({ canonical, aliases });
  }

  return { entries, error: null };
}
