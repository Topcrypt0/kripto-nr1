// Single source of truth for where each multiplier sends the rocket.
export type DestMeta = { name: string; emoji: string; durMs: number };

export const DEST_META: Record<number, DestMeta> = {
  0: { name: "Asteroid belt", emoji: "☄️", durMs: 1700 },
  2: { name: "Mars", emoji: "🔴", durMs: 2000 },
  3: { name: "Jupiter", emoji: "🟠", durMs: 2500 },
  5: { name: "Saturn", emoji: "🪐", durMs: 3000 },
  10: { name: "Neptune", emoji: "🌌", durMs: 3600 },
};

export function destMeta(multiplier: number): DestMeta {
  return DEST_META[multiplier] ?? DEST_META[0];
}
