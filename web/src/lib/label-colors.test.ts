import { describe, expect, it } from "vitest";

import { LABEL_COLORS, isLabelColor, readableTextColor } from "./label-colors";

describe("label-colors", () => {
  it("exposes a fixed palette of twelve preset colors", () => {
    expect(LABEL_COLORS).toHaveLength(12);
    for (const color of LABEL_COLORS) {
      expect(color.value).toMatch(/^#[0-9A-F]{6}$/);
      expect(color.name.length).toBeGreaterThan(0);
    }
  });

  it("recognizes a preset color regardless of case", () => {
    expect(isLabelColor("#e11d48")).toBe(true);
    expect(isLabelColor("#E11D48")).toBe(true);
  });

  it("rejects a color outside the palette", () => {
    expect(isLabelColor("#123456")).toBe(false);
  });

  it("picks white text on a dark background", () => {
    expect(readableTextColor("#2563EB")).toBe("#FFFFFF");
  });

  it("picks dark text on a light background", () => {
    expect(readableTextColor("#CA8A04")).toBe("#1C1917");
  });
});
