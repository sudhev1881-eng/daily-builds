/** Web Audio alarm beeps — no external files, synced to visual pulses. */

export class AlarmAudio {
  private ctx: AudioContext | null = null;
  private timer: number | null = null;
  private volume = 0.55;
  private onBeat: ((t: number) => void) | null = null;
  private lastBeat = 0;

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
  }

  setOnBeat(cb: ((t: number) => void) | null) {
    this.onBeat = cb;
  }

  async resume() {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  start() {
    void this.resume();
    if (this.timer !== null) return;
    this.beep();
    this.timer = window.setInterval(() => this.beep(), 900);
  }

  stop() {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  tap() {
    void this.resume();
    this.tone(880, 0.05, "triangle", 0.12);
  }

  success() {
    void this.resume();
    this.tone(523, 0.08, "sine", 0.18);
    window.setTimeout(() => this.tone(784, 0.12, "sine", 0.18), 90);
  }

  fail() {
    void this.resume();
    this.tone(180, 0.18, "sawtooth", 0.16);
  }

  private beep() {
    this.lastBeat = performance.now();
    this.onBeat?.(this.lastBeat);
    this.tone(880, 0.11, "square", 0.22);
    window.setTimeout(() => this.tone(660, 0.09, "square", 0.16), 140);
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
  ) {
    if (!this.ctx || this.volume <= 0.01) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = this.volume * gain;
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start();
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
    osc.stop(this.ctx.currentTime + dur + 0.02);
  }
}

export const alarmAudio = new AlarmAudio();
