/**
 * You: the regular at the bar, in profile, drawn in world coordinates around the shared pose
 * constants (HEAD, NECK, SHOULDER). He breathes, blinks, shuts his eyes to drink, swallows,
 * and lets out a satisfied "ahh" with a foam moustache when a pint goes down.
 */
import { HEAD, NECK, SHOULDER, type Pose } from '../scene';
import {
  alpha, approach, blob, circle, clamp, curve, ellipse, hgrad, lerp, limb, line, mix, poly, shade, tint, type Ctx,
} from './draw';

const C = {
  skin: '#f1c6a0', nose: '#eba98a', hair: '#e4dfd6', cap: '#5f6d58', jacket: '#94704a', shirt: '#f1ead9',
  tie: '#8f2c26', ink: '#2a1a1c', blush: '#e8705f', foam: '#fffaf0',
};

export class Hero {
  /** Maps a colour through the room's light. */
  tone: (c: string) => string = (c) => c;
  /** 0..1, how flushed he is (rises with a chug streak). */
  merry = 0;

  private blink = 0;
  private blinkIn = 2;
  private ahh = 0;
  private foamTache = 0;
  private wasSipping = false;
  private gulp = 0;
  private eyesShut = 0;
  private tap = 0;
  private tapIn = 4;
  private merryV = 0;

  /** A pint just went down. */
  finished() {
    this.ahh = 1;
    this.foamTache = 1;
  }

  update(dt: number, pose: Pose) {
    this.blinkIn -= dt;
    if (this.blinkIn <= 0) {
      this.blink = 1;
      this.blinkIn = 2 + Math.random() * 4;
    }
    this.blink = Math.max(0, this.blink - dt / 0.15);
    this.ahh = Math.max(0, this.ahh - dt / 1.1);
    this.foamTache = Math.max(0, this.foamTache - dt / 5);
    if (this.wasSipping && !pose.sipping) this.foamTache = Math.max(this.foamTache, 0.8);
    this.wasSipping = pose.sipping;
    this.gulp = pose.sipping ? this.gulp + dt * 5.5 : 0;
    this.eyesShut = approach(this.eyesShut, pose.sipping || this.ahh > 0.35 ? 1 : 0, 18, dt);
    this.merryV = approach(this.merryV, this.merry, 2, dt);
    // Drumming his fingers while he waits.
    this.tapIn -= dt;
    if (this.tapIn <= 0) {
      this.tap = 1;
      this.tapIn = 5 + Math.random() * 7;
    }
    this.tap = Math.max(0, this.tap - dt / 1.2);
  }

  /** Body and head: everything behind the bar. */
  drawBody(ctx: Ctx, pose: Pose, t: number) {
    const k = this.tone;
    const breath = Math.sin(t * 1.6);
    const jacket = k(C.jacket), jacketSh = k(shade(C.jacket, 0.3)), jacketHi = k(tint(C.jacket, 0.14));
    const skin = k(C.skin), skinSh = k(shade(C.skin, 0.2));

    // ----- torso -----
    ctx.save();
    ctx.translate(150, 230);
    ctx.scale(1 + breath * 0.006, 1 + breath * 0.008);
    ctx.translate(-150, -230);
    const torso = [104, 236, 105, 184, 110, 156, 124, 140, 145, 134, 165, 137, 184, 152, 194, 178, 196, 236];
    blob(ctx, torso, jacket, 0.42);
    ctx.save();
    blob(ctx, torso, undefined, 0.42);
    ctx.clip();
    // Shirt and tie in the V of the jacket.
    poly(ctx, [148, 132, 172, 138, 177, 160, 166, 178, 154, 150], k(C.shirt));
    poly(ctx, [164, 142, 169.5, 143, 173, 160, 167.5, 170, 162.5, 159], k(C.tie));
    poly(ctx, [163, 139, 170.5, 140.5, 169.5, 145.5, 163.5, 144.5], k(shade(C.tie, 0.2)));
    // Near lapel, with a crisp edge; the far one is just a sliver.
    const lapel = [141, 131, 152, 133, 163, 153, 167, 181, 159, 187, 150, 166, 141, 146];
    blob(ctx, lapel, jacketHi, 0.3);
    curve(ctx, [152, 133, 163, 153, 167, 181, 159, 187], jacketSh, 1.1);
    blob(ctx, [172, 138, 179, 148, 178, 163, 168, 180, 174, 160], jacketSh, 0.3);
    // His back falls into shadow; a seam of warm light runs down his front.
    ctx.fillStyle = hgrad(ctx, 100, 132, [alpha('#160a22', 0.3), alpha('#160a22', 0)]);
    ctx.fillRect(96, 120, 40, 130);
    blob(ctx, [186, 156, 192, 176, 194, 236, 190, 236, 188, 178], alpha(tint(C.jacket, 0.4), 0.35), 0.3);
    // Breast pocket and a button.
    curve(ctx, [128, 178, 136, 179.5, 144, 179], jacketSh, 1.1);
    circle(ctx, 172, 192, 1.8, jacketSh);
    ctx.restore();
    ctx.restore();

    // ----- neck -----
    const bob = breath * 0.5;
    poly(ctx, [139, 122 + bob, 161, 124 + bob, 165, 143, 137, 142], skinSh);
    poly(ctx, [146, 131, 164, 133, 168, 143, 150, 141], k(C.shirt)); // collar
    if (pose.sipping) {
      // Swallowing.
      const g = (this.gulp % 1);
      ellipse(ctx, 160.5, 127 + g * 9, 2.6, 3.4, alpha(skin, Math.sin(g * Math.PI)));
    }

    // ----- head -----
    ctx.save();
    ctx.translate(0, bob);
    ctx.translate(NECK.x, NECK.y);
    ctx.rotate(-pose.headTilt);
    ctx.translate(HEAD.x - NECK.x, HEAD.y - NECK.y);
    this.head(ctx, pose, t);
    ctx.restore();
  }

  private head(ctx: Ctx, pose: Pose, t: number) {
    const k = this.tone;
    const skin = k(C.skin), skinSh = k(shade(C.skin, 0.2)), skinHi = k(tint(C.skin, 0.2));
    const hair = k(C.hair), hairSh = k(shade(C.hair, 0.22));
    const cap = k(C.cap), capSh = k(shade(C.cap, 0.3)), capHi = k(tint(C.cap, 0.16));
    const ink = k(C.ink);
    // No sighing with a glass in his face: when pints go down fast, the next is already on its way up.
    const ahh = pose.tilt > 0.08 ? 0 : clamp(this.ahh * 1.6);
    const merry = this.merryV;

    // Hair at the back, under the cap.
    blob(ctx, [-26, -8, -12, -10, -9, 6, -13, 18, -22, 17, -27, 5], hairSh, 0.5);

    // Skull and face.
    const face = [-16, 23, -25, 7, -25, -10, -12, -25, 9, -26, 22, -15, 24.5, -3, 23, 7, 25.5, 14, 23.5, 20, 18, 27.5, 5, 28.5, -8, 25];
    blob(ctx, face, skin, 0.5);
    ctx.save();
    blob(ctx, face, undefined, 0.5);
    ctx.clip();
    // Shade the back of the head and under the jaw; light the brow and cheekbone.
    blob(ctx, [-30, -30, -12, -30, -15, 4, -6, 26, 8, 34, -30, 34], alpha(skinSh, 0.75), 0.5);
    ellipse(ctx, 15, 2, 7, 5, alpha(skinHi, 0.4));
    // Flush: a pint or ten in.
    circle(ctx, 9.5, 9.5, 7, alpha(k(C.blush), 0.22 + merry * 0.4 + ahh * 0.12));
    ctx.restore();

    // Ear.
    ellipse(ctx, -7, 3.5, 5, 7.4, skin);
    ellipse(ctx, -7, 3.5, 5, 7.4, alpha(skinSh, 0.45));
    curve(ctx, [-5, -1.5, -9, 1, -8, 7, -5.5, 6], skinSh, 1.2);
    // Sideburn.
    blob(ctx, [-4.5, -9, 0.5, -9, 1, 4, -1.5, 8.5, -4, 4], hair, 0.5);

    // Nose: big, round and a little red.
    blob(ctx, [21.5, -3, 29.5, 1.5, 35.5, 8, 33.5, 13, 27, 13.5, 22, 10], k(mix(C.nose, C.blush, 0.15 + merry * 0.35)), 0.55);
    ellipse(ctx, 31, 6.5, 2.3, 1.8, alpha(skinHi, 0.7));
    ellipse(ctx, 27.5, 12.2, 2.2, 1.1, alpha(k(shade(C.nose, 0.4)), 0.5));

    // Eye.
    const shut = Math.max(this.eyesShut, this.blink);
    const ex = 14.2, ey = -5.2;
    if (shut > 0.55) {
      // Shut tight while he drinks, and a contented crescent afterwards.
      const up = ahh > 0.2 && !pose.sipping;
      curve(ctx, up ? [ex - 4, ey + 0.6, ex, ey - 2.2, ex + 4, ey + 0.6] : [ex - 4, ey - 0.8, ex, ey + 1.6, ex + 4, ey - 0.8], ink, 1.9);
    } else {
      const gaze = pose.fill < 0.02 ? 1.4 : 0.6;
      ellipse(ctx, ex, ey, 3.7, 4.3 * (1 - shut), k('#fbf6ea'));
      ellipse(ctx, ex + gaze, ey + 0.5, 2.3, 3 * (1 - shut), ink);
      circle(ctx, ex + gaze + 0.9, ey - 0.9, 0.8, 'rgba(255,255,255,0.85)');
      curve(ctx, [ex - 4.6, ey - 2.4, ex, ey - 4.9, ex + 4.6, ey - 2.2], skinSh, 1.3);
    }
    curve(ctx, [ex - 3.5, ey + 6, ex + 0.5, ey + 7.2, ex + 4, ey + 5.6], alpha(skinSh, 0.8), 1);
    // Bushy brow: it lifts when the beer is good.
    const lift = ahh * 3 + (pose.sipping ? 1.6 : 0) + Math.sin(t * 0.9) * 0.3;
    curve(ctx, [7.5, -11.5 - lift * 0.6, 14, -14.6 - lift, 21.5, -12.2 - lift * 0.8], hair, 3.4);
    curve(ctx, [8.5, -10.6 - lift * 0.6, 14, -13.2 - lift, 20.5, -11.2 - lift * 0.8], hairSh, 1);

    // Mouth: hidden under the moustache until he says "ahh".
    if (ahh > 0.05) {
      ellipse(ctx, 21.5, 21, 4.6, 1 + ahh * 4, k('#4a161c'), -0.15);
      ellipse(ctx, 21, 22.6 + ahh * 1.6, 2.8, ahh * 1.8, k('#d9626a'), -0.15);
    } else {
      curve(ctx, [17.5, 20.4, 21, 21.3, 24, 20.2], k(shade(C.skin, 0.45)), 1.1);
    }

    // Walrus moustache, with the head of his last pint in it.
    const tache = [14.5, 11.5, 22, 9.4, 30.5, 11.6, 31.5, 16.5, 27, 20, 20, 19.2, 14.5, 17.2];
    blob(ctx, tache, hair, 0.55);
    blob(ctx, [15.5, 15.5, 22, 15.5, 30.5, 15.2, 27, 20, 20, 19.2, 15, 17.4], hairSh, 0.55);
    if (this.foamTache > 0.02) {
      ctx.globalAlpha = clamp(this.foamTache * 2);
      blob(ctx, [18, 10.4, 25, 9.2, 31.5, 11.5, 32, 15, 26, 14.2, 19, 14.4], k(C.foam), 0.6);
      circle(ctx, 22, 14.4, 1.7, k(C.foam));
      circle(ctx, 27.5, 14.6, 1.9, k(C.foam));
      ctx.globalAlpha = 1;
    }

    // Flat cap.
    const crown = [-28.5, -8, -28, -21, -15, -33, 5, -35.5, 21, -29.5, 29.5, -18, 30.5, -10.5, 0, -7.6];
    blob(ctx, crown, cap, 0.5);
    ctx.save();
    blob(ctx, crown, undefined, 0.5);
    ctx.clip();
    blob(ctx, [-14, -31, 6, -33.5, 20, -27, 6, -27, -8, -25], alpha(capHi, 0.9), 0.5);
    ctx.fillStyle = alpha('#160a22', 0.22);
    ctx.fillRect(-34, -38, 16, 34);
    // Herringbone.
    ctx.strokeStyle = alpha(k(shade(C.cap, 0.5)), 0.18);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (let x = -40; x < 40; x += 4.5) {
      ctx.moveTo(x, -6);
      ctx.lineTo(x + 9, -22);
      ctx.lineTo(x, -38);
    }
    ctx.stroke();
    ctx.restore();
    curve(ctx, [-28.5, -8.6, 0, -7.4, 30.4, -11], capSh, 2.6);
    blob(ctx, [26, -14.6, 37, -13, 46.5, -8, 41, -4.4, 28, -6.6], capSh, 0.5);
    blob(ctx, [28, -13.4, 37, -12, 44, -8.6, 36, -9.4], alpha(capHi, 0.55), 0.5);
    circle(ctx, 2, -35.2, 1.9, capSh);
  }

  /** His other arm, resting on the bar. Drawn after the bar. */
  drawRestingArm(ctx: Ctx, barY: number) {
    const k = this.tone;
    const sleeve = k(shade(C.jacket, 0.2)), skinSh = k(shade(C.skin, 0.14));
    const y = barY - 5.5;
    limb(ctx, 182, y - 9, 207, y - 1, 8.4, 6.6, sleeve);
    limb(ctx, 203, y - 2.2, 208, y - 0.6, 6.4, 6.2, k(C.shirt));
    ellipse(ctx, 213.5, y + 0.4, 7, 5.2, skinSh);
    // Fingers drum now and then.
    for (let i = 0; i < 4; i++) {
      const up = this.tap > 0 ? Math.max(0, Math.sin(this.tap * 18 - i * 1.1)) * 2.2 : 0;
      limb(ctx, 215 + i * 0.4, y - 3 + i * 1.9, 220.5 - i * 0.5, y - 2.4 + i * 1.9 - up, 1.9, 1.6, k(C.skin));
    }
  }

  /** The drinking arm up to the wrist; the glass goes on top, then the fingers. */
  drawArm(ctx: Ctx, pose: Pose) {
    const k = this.tone;
    const jacket = k(C.jacket), jacketHi = k(tint(C.jacket, 0.1)), jacketSh = k(shade(C.jacket, 0.3));
    const { hand, elbow } = pose;
    const s = SHOULDER;
    circle(ctx, s.x - 1, s.y + 1, 12.5, jacket);
    limb(ctx, s.x, s.y, elbow.x, elbow.y, 11, 9.2, jacket);
    // Elbow patch.
    ellipse(ctx, elbow.x, elbow.y, 6.5, 6.5, jacketSh);
    const wx = lerp(elbow.x, hand.x, 0.8), wy = lerp(elbow.y, hand.y, 0.8);
    limb(ctx, elbow.x, elbow.y, wx, wy, 9, 7.2, jacketHi);
    limb(ctx, elbow.x, elbow.y + 1.5, wx, wy + 1.5, 7, 5, alpha(jacketSh, 0.35));
    limb(ctx, wx, wy, lerp(elbow.x, hand.x, 0.92), lerp(elbow.y, hand.y, 0.92), 6.6, 6.2, k(C.shirt));
    // Palm and thumb sit behind the glass.
    circle(ctx, hand.x, hand.y, 7.4, k(shade(C.skin, 0.12)));
  }

  /** Fingers wrapped round the front of the glass. */
  drawFingers(ctx: Ctx, pose: Pose) {
    const k = this.tone;
    const a = -pose.tilt;
    const ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
    const s = pose.scale;
    for (let i = 0; i < 4; i++) {
      const off = (-6.3 + i * 4.2) * s;
      const len = (12.5 - Math.abs(i - 1.3) * 1.5) * s;
      const x0 = pose.hand.x + vx * off - ux * 1.5, y0 = pose.hand.y + vy * off - uy * 1.5;
      limb(ctx, x0, y0, x0 + ux * len, y0 + uy * len, 2.5 * s, 2.2 * s, k(i > 1 ? shade(C.skin, 0.08) : C.skin));
      line(ctx, x0 + ux * len * 0.5, y0 + uy * len * 0.5 + 1.4 * s, x0 + ux * len * 0.95, y0 + uy * len * 0.95 + 1.4 * s, alpha(k(shade(C.skin, 0.4)), 0.35), 0.7);
    }
  }
}
