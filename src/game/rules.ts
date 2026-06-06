export function getAccusationThreshold(playerCount: number, cycles: number) {
  const multiplier = cycles <= 2 ? 0.75 : cycles <= 4 ? 1 : 1.25
  return Math.round((20 * (playerCount - 1) * multiplier) / 10) * 10
}
