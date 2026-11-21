/**
 * Game loop: requestAnimationFrame while visible, with a setInterval backup so the
 * game keeps ticking when the tab is hidden and rAF is paused.
 *
 * `update` gets the real seconds since the last tick, which can be large when the
 * browser throttles a hidden tab. The caller decides how to spend it (idle income
 * takes it all at once; the drinking animation steps through it in small slices).
 */
export function startLoop(update: (elapsed: number, now: number) => void): () => void {
  let last = performance.now();
  let raf = 0;

  const tick = (now: number) => {
    const elapsed = Math.max(0, (now - last) / 1000);
    last = now;
    update(elapsed, now);
  };

  const frame = (now: number) => {
    tick(now);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  const backup = setInterval(() => {
    const now = performance.now();
    if (now - last > 250) tick(now);
  }, 250);

  return () => {
    cancelAnimationFrame(raf);
    clearInterval(backup);
  };
}
