/**
 * You: the regular at the bar. He is the same rig as the crowd (figures.ts), drawn larger and
 * posed from outside: his drinking arm runs from his shoulder to wherever the pint is, his head
 * tips back and his eyes close as he drinks, and he lets out an "ahh" with foam on his moustache
 * when a pint goes down.
 */
import type { Pose } from '../scene';
import { approach, clamp, type Ctx } from './draw';
import { Figure, type Puppet, type Tone } from './figures';

/** Where he sits, and how much bigger he is than the people behind him. */
const PLACE = { x: 150, headY: 100, scale: 1.75 };

export class Hero {
  /** 0..1, how flushed he is (rises with a chug streak). */
  merry = 0;

  private figure = new Figure('hero', 1);
  private ahh = 0;
  private wasSipping = false;
  private sip = 0;
  private merryV = 0;

  constructor() {
    this.figure.x = PLACE.x;
    this.figure.headY = PLACE.headY;
    this.figure.scale = PLACE.scale;
  }

  set tone(tone: Tone) {
    this.figure.tone = tone;
  }

  /** A pint just went down. */
  finished() {
    this.ahh = 1;
    this.figure.foam = 1;
  }

  update(dt: number, pose: Pose) {
    this.figure.tick(dt);
    this.ahh = Math.max(0, this.ahh - dt / 1.1);
    this.figure.foam = Math.max(0, this.figure.foam - dt / 5);
    if (this.wasSipping && !pose.sipping) this.figure.foam = Math.max(this.figure.foam, 0.8);
    this.wasSipping = pose.sipping;
    // His head follows the glass up, a touch behind it.
    this.sip = approach(this.sip, clamp(pose.headTilt / 0.22), 22, dt);
    this.merryV = approach(this.merryV, this.merry, 2, dt);
  }

  private puppet(part: Puppet['part'], pose: Pose): Puppet {
    const [hx, hy] = this.figure.toLocal(pose.hand.x, pose.hand.y);
    return { part, hx, hy, tilt: -pose.tilt };
  }

  private face(pose: Pose) {
    // No sighing with a glass in his face: when pints go down fast, the next is already on its way up.
    return { sip: this.sip, ahh: pose.tilt > 0.08 ? 0 : clamp(this.ahh * 1.6), flush: this.merryV * 0.2 };
  }

  /** Body and head: everything behind the bar. */
  drawBody(ctx: Ctx, pose: Pose, t: number) {
    this.figure.drawPuppet(ctx, t, this.puppet('body', pose), this.face(pose));
  }

  /** The drinking arm, from shoulder to palm; the glass goes on top, then the fingers. */
  drawArm(ctx: Ctx, pose: Pose, t: number) {
    this.figure.drawPuppet(ctx, t, this.puppet('arm', pose), this.face(pose));
  }

  /** Fingers wrapped round the front of the glass. */
  drawFingers(ctx: Ctx, pose: Pose, t: number) {
    this.figure.drawPuppet(ctx, t, this.puppet('fingers', pose), this.face(pose));
  }
}
