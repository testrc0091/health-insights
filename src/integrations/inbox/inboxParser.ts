export type InboxDomain = "food" | "workout" | "symptom" | "cycle" | "unclassified";

export interface InboxSegment {
  domain: InboxDomain;
  text: string;
}

const FOOD_KEYWORDS = [
  "ate", "had", "eating", "drank", "drinking", "coffee", "coffees", "donut", "doughnut",
  "meal", "breakfast", "lunch", "dinner", "snack", "protein shake", "yogurt", "banana",
  "egg", "eggs", "chicken", "rice", "oatmeal", "pasta", "salad", "smoothie", "toast",
];
const WORKOUT_KEYWORDS = [
  "played", "workout", "lifted", "lifting", "gym", "ran", "running", "volleyball",
  "practice", "training", "sets", "reps", "bench", "squat", "deadlift", "jog",
];
const SYMPTOM_KEYWORDS = [
  "hurts", "hurt", "pain", "sore", "soreness", "tight", "tightness", "ache", "aches",
  "numb", "numbness", "swelling", "stiff", "stiffness", "snapping",
];
const CYCLE_KEYWORDS = ["period", "cramps", "cramping", "spotting", "flow", "pms", "ovulat"];

function matchedDomains(text: string): InboxDomain[] {
  const lower = text.toLowerCase();
  const domains: InboxDomain[] = [];
  if (FOOD_KEYWORDS.some((k) => lower.includes(k))) domains.push("food");
  if (WORKOUT_KEYWORDS.some((k) => lower.includes(k))) domains.push("workout");
  if (SYMPTOM_KEYWORDS.some((k) => lower.includes(k))) domains.push("symptom");
  if (CYCLE_KEYWORDS.some((k) => lower.includes(k))) domains.push("cycle");
  return domains;
}

/**
 * Splits one universal free-text "Inbox" entry into per-domain draft segments — the
 * brief's "AI Health Inbox," implemented rule-based (no network/LLM) per the user's
 * choice. This function only classifies text; it never touches storage — the app
 * layer always routes each segment through a per-domain draft builder and shows a
 * confirmation screen before anything becomes a real row (brief's explicit "never
 * auto-commit a multi-domain parse" requirement).
 *
 * Splits on commas/periods first (top-level clauses), then — only for a clause that
 * matches keywords from more than one domain, e.g. "my hip feels tight and my period
 * started" — tries splitting that one clause on " and " and reclassifying each half,
 * since a single comma-clause can still bundle two distinct domain statements.
 */
export function splitInboxText(rawText: string): InboxSegment[] {
  const clauses = rawText
    .split(/,|\.(?!\d)/)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
  const segments: InboxSegment[] = [];

  for (const clause of clauses) {
    const domains = matchedDomains(clause);
    if (domains.length <= 1) {
      segments.push({ domain: domains[0] ?? "unclassified", text: clause });
      continue;
    }

    const halves = clause
      .split(/ and /i)
      .map((h) => h.trim())
      .filter((h) => h.length > 0);

    if (halves.length > 1) {
      for (const half of halves) {
        segments.push({ domain: matchedDomains(half)[0] ?? "unclassified", text: half });
      }
    } else {
      // Couldn't cleanly split on "and" — best-effort: assign to the first matched
      // domain rather than silently dropping the text.
      segments.push({ domain: domains[0]!, text: clause });
    }
  }

  return segments;
}
