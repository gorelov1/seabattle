/**
 * Icon library — IDs must match the server-side ICON_LIBRARY in accountManager.ts.
 * The emoji map is client-only for display purposes.
 */
export const ICON_LIBRARY: string[] = [
  'anchor', 'ship', 'compass', 'wave', 'lighthouse',
  'fish', 'crab', 'octopus', 'shark', 'whale',
  'torpedo', 'periscope',
];

/** Maps icon IDs to display emoji. */
export const ICON_EMOJI: Record<string, string> = {
  anchor:     '⚓',
  ship:       '🚢',
  compass:    '🧭',
  wave:       '🌊',
  lighthouse: '🗼',
  fish:       '🐟',
  crab:       '🦀',
  octopus:    '🐙',
  shark:      '🦈',
  whale:      '🐳',
  torpedo:    '💣',
  periscope:  '🔭',
};

/** Returns the emoji for an icon ID, falling back to the ID itself. */
export function iconEmoji(id: string): string {
  return ICON_EMOJI[id] ?? id;
}
