export type ValueMetrics = {
  multiple: number | null;
  netReturnPercent: number | null;
};

/**
 * Calculates the two portfolio value metrics without treating missing values
 * or zero cost as a successful return.
 */
export function calculateValueMetrics(estimatedValueUsd: number | null, aiCostUsd: number | null): ValueMetrics {
  if (estimatedValueUsd === null || aiCostUsd === null || estimatedValueUsd < 0 || aiCostUsd <= 0) {
    return { multiple: null, netReturnPercent: null };
  }

  return {
    multiple: estimatedValueUsd / aiCostUsd,
    netReturnPercent: ((estimatedValueUsd - aiCostUsd) / aiCostUsd) * 100,
  };
}
