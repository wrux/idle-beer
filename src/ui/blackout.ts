/**
 * Last Orders, as it feels from the bar stool: the room starts to swim, your eyelids get heavy,
 * you blink it back once or twice, and then the lights go out. You come round after hours.
 */

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Run an animation to the end, but never wait on it for ever (a hidden tab pauses them). */
async function play(el: Element, frames: Keyframe[], options: KeyframeAnimationOptions): Promise<void> {
  const anim = el.animate(frames, { fill: 'forwards', ...options });
  await Promise.race([anim.finished.catch(() => undefined), wait(Number(options.duration ?? 0) + Number(options.delay ?? 0) + 250)]);
}

let running = false;

/**
 * Black out. `atDark` runs once nothing can be seen, which is the moment to reset the game.
 * Resolves when the screen is fully dark and `atDark` has run; whatever `atDark` puts on screen
 * (the after-hours screen) fades up by itself.
 */
export async function blackOut(atDark: () => void): Promise<void> {
  if (running) return;
  running = true;
  const app = document.getElementById('app')!;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const overlay = document.createElement('div');
  overlay.className = 'blackout';
  overlay.innerHTML = '<div class="blackout-haze"></div><div class="blackout-lid top"></div><div class="blackout-lid bottom"></div>';
  document.body.appendChild(overlay);
  // The swaying, growing page would otherwise spill past the window and bring up scroll bars.
  document.documentElement.classList.add('blacking-out');
  const haze = overlay.querySelector('.blackout-haze')!;
  const lids = [...overlay.querySelectorAll('.blackout-lid')];

  try {
    if (still) {
      await play(overlay, [{ opacity: 0 }, { opacity: 1 }], { duration: 400 });
      overlay.classList.add('out');
      atDark();
      await wait(200);
      return;
    }
    const total = 3400;
    // The room swims: a slow sway that gets wider, and focus that comes and goes and then just goes.
    void play(app, [
      { transform: 'rotate(0deg) translate(0, 0) scale(1)', filter: 'blur(0px) saturate(1) brightness(1)' },
      { transform: 'rotate(-1.2deg) translate(-1.2%, 0.4%) scale(1.03)', filter: 'blur(1.5px) saturate(1.15) brightness(1.03)', offset: 0.16 },
      { transform: 'rotate(1.6deg) translate(1.6%, -0.3%) scale(1.04)', filter: 'blur(0.5px) saturate(1.1) brightness(1)', offset: 0.34 },
      { transform: 'rotate(-2.4deg) translate(-2.2%, 0.8%) scale(1.06)', filter: 'blur(4px) saturate(1.3) brightness(0.95)', offset: 0.54 },
      { transform: 'rotate(2.8deg) translate(2.4%, 0.2%) scale(1.07)', filter: 'blur(2.5px) saturate(1.2) brightness(0.9)', offset: 0.72 },
      { transform: 'rotate(-4deg) translate(-1.5%, 3%) scale(1.1)', filter: 'blur(9px) saturate(1.4) brightness(0.7)', offset: 0.9 },
      { transform: 'rotate(-7deg) translate(0, 9%) scale(1.14)', filter: 'blur(16px) saturate(1.4) brightness(0.4)' },
    ], { duration: total, easing: 'ease-in-out' });
    // Tunnel vision closing in from the edges.
    void play(haze, [{ opacity: 0 }, { opacity: 0.5, offset: 0.5 }, { opacity: 1 }], { duration: total, easing: 'ease-in' });
    // Heavy eyelids: two long blinks, fought off, and then they stay shut.
    const lidFrames = [
      { height: '0%' },
      { height: '0%', offset: 0.18 },
      { height: '38%', offset: 0.3 },
      { height: '6%', offset: 0.4 },
      { height: '10%', offset: 0.52 },
      { height: '46%', offset: 0.66 },
      { height: '18%', offset: 0.76 },
      { height: '24%', offset: 0.84 },
      { height: '52%' },
    ];
    await Promise.all(lids.map((lid) => play(lid, lidFrames, { duration: total, easing: 'ease-in-out' })));
    overlay.classList.add('out');
    await wait(450);
    atDark();
    await wait(250);
  } finally {
    app.getAnimations().forEach((a) => a.cancel());
    document.documentElement.classList.remove('blacking-out');
    // Whatever comes next fades up over the dark, so the dark itself can simply go.
    void play(overlay, [{ opacity: 1 }, { opacity: 0 }], { duration: 700, easing: 'ease-in' }).then(() => overlay.remove());
    running = false;
  }
}
