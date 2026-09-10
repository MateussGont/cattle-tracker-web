const LIPO_EMPTY_MV = 3000;
const LIPO_FULL_MV = 4200;

/**
 * Rough single-cell LiPo state-of-charge estimate from a raw voltage
 * reading. This is a linear approximation, not a fuel-gauge measurement —
 * good enough for ONLINE/ATENÇÃO/OFFLINE-style battery alerts, not for
 * precise runtime estimates. Replace with a coulomb-counting fuel gauge
 * reading if the hardware gains one.
 */
export function batteryPercentFromMv(milliVolts: number): number {
  const clamped = Math.min(Math.max(milliVolts, LIPO_EMPTY_MV), LIPO_FULL_MV);
  const ratio = (clamped - LIPO_EMPTY_MV) / (LIPO_FULL_MV - LIPO_EMPTY_MV);
  return Math.round(ratio * 100);
}
