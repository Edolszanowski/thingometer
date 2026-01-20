/**
 * Client-safe score utility functions
 * These can be used in both server and client components
 */

/**
 * Calculate total score from score items
 */
export function calculateTotalFromItems(scoreItems: Array<{ value: number | null }>): number {
  return scoreItems.reduce((sum, item) => {
    return sum + (item.value ?? 0)
  }, 0)
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use calculateTotalFromItems instead
 */
export function calculateTotal(score: {
  lighting?: number | null
  theme?: number | null
  traditions?: number | null
  spirit?: number | null
  music?: number | null
}, hasMusic: boolean = true): number {
  const lighting = score.lighting ?? 0
  const theme = score.theme ?? 0
  const traditions = score.traditions ?? 0
  const spirit = score.spirit ?? 0
  const music = hasMusic ? (score.music ?? 0) : 0
  return lighting + theme + traditions + spirit + music
}

