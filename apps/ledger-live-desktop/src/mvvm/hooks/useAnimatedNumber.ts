/* oxlint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";

const DEFAULT_DURATION_MS = 900;

/**
 * Eases numerically toward `targetValue` whenever it changes, instead of jumping instantly.
 * Same requestAnimationFrame + cubic ease-out approach as ArcGaugeIndicator.
 * Seeded with `targetValue` on first render, so nothing animates on initial mount —
 * only subsequent changes to `targetValue` while the component stays mounted ease in.
 */
export function useAnimatedNumber(targetValue: number, durationMs = DEFAULT_DURATION_MS): number {
  const [animatedValue, setAnimatedValue] = useState(targetValue);

  useEffect(() => {
    const startValue = animatedValue;
    const endValue = targetValue;
    if (startValue === endValue) return;

    const startTime = Date.now();
    let frameId: number;

    const step = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      setAnimatedValue(startValue + (endValue - startValue) * eased);

      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      }
    };

    frameId = requestAnimationFrame(step);

    return () => cancelAnimationFrame(frameId);
  }, [targetValue, durationMs]);

  return animatedValue;
}
