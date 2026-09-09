import { describe, expect, it } from "vitest";
import { splitInboxText } from "./inboxParser";

describe("splitInboxText", () => {
  it("splits the brief's own worked example into the right four domain segments", () => {
    const segments = splitInboxText(
      "Had two coffees and a donut, played volleyball for 2.5 hours, my hip feels tight and my period started.",
    );

    const domains = segments.map((s) => s.domain);
    expect(domains).toEqual(["food", "workout", "symptom", "cycle"]);
    expect(segments[0]!.text).toContain("coffees");
    expect(segments[1]!.text).toContain("volleyball");
    expect(segments[2]!.text).toContain("hip");
    expect(segments[3]!.text.toLowerCase()).toContain("period");
  });

  it("marks a clause with no recognized keywords as unclassified rather than dropping it", () => {
    const segments = splitInboxText("something vague happened today");
    expect(segments).toHaveLength(1);
    expect(segments[0]!.domain).toBe("unclassified");
    expect(segments[0]!.text).toBe("something vague happened today");
  });
});
