/**
 * The fixed palette of label colors, mirroring the backend's `LABEL_COLORS`
 * (see api/app/models/label.py). The API rejects any color outside this set,
 * so the picker only ever offers these.
 */

export interface LabelColor {
  name: string;
  value: string;
}

export const LABEL_COLORS: LabelColor[] = [
  { name: "Rose", value: "#E11D48" },
  { name: "Pink", value: "#DB2777" },
  { name: "Fuchsia", value: "#C026D3" },
  { name: "Purple", value: "#9333EA" },
  { name: "Indigo", value: "#6366F1" },
  { name: "Blue", value: "#2563EB" },
  { name: "Cyan", value: "#0891B2" },
  { name: "Emerald", value: "#059669" },
  { name: "Lime", value: "#65A30D" },
  { name: "Yellow", value: "#CA8A04" },
  { name: "Orange", value: "#EA580C" },
  { name: "Stone", value: "#57534E" },
];

const PALETTE = new Set(LABEL_COLORS.map((color) => color.value));

/** Whether a hex string is one of the preset label colors (case-insensitive). */
export function isLabelColor(hex: string): boolean {
  return PALETTE.has(hex.toUpperCase());
}

/**
 * Returns a readable text color (near-black or white) for a label background,
 * chosen by the background's perceived luminance so pills stay legible.
 */
export function readableTextColor(hex: string): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  // YIQ perceived brightness; >= 128 reads better with dark text.
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? "#1C1917" : "#FFFFFF";
}
