import { renderHook, waitFor } from "@testing-library/react";
import { useAnimatedNumber } from "../useAnimatedNumber";

describe("useAnimatedNumber", () => {
  it("returns the initial target immediately, without animating on mount", () => {
    const { result } = renderHook(() => useAnimatedNumber(100, 20));
    expect(result.current).toBe(100);
  });

  it("eases toward a new target when it changes, and settles exactly on it", async () => {
    const { result, rerender } = renderHook(({ target }) => useAnimatedNumber(target, 20), {
      initialProps: { target: 100 },
    });
    expect(result.current).toBe(100);

    rerender({ target: 200 });

    await waitFor(() => expect(result.current).toBe(200), { timeout: 1000 });
  });

  it("does not restart the animation when the target stays the same", async () => {
    const { result, rerender } = renderHook(({ target }) => useAnimatedNumber(target, 20), {
      initialProps: { target: 100 },
    });

    rerender({ target: 100 });
    await new Promise(resolve => setTimeout(resolve, 30));

    expect(result.current).toBe(100);
  });
});
