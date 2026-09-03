/** Barking-dog ringtone + spoken Malayalam trolls. No external files. */

function stripEmoji(text: string) {
  return text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export class AlarmAudio {
  private ctx: AudioContext | null = null;
  private timer: number | null = null;
  private volume = 0.55;
  private onBeat: ((t: number) => void) | null = null;
  private noise: AudioBuffer | null = null;
  private speaking = false;

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
  }

  setOnBeat(cb: ((t: number) => void) | null) {
    this.onBeat = cb;
  }

  async resume() {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === "suspended") await this.ctx.resume();
    if (typeof speechSynthesis !== "undefined") {
      speechSynthesis.getVoices();
    }
  }

  start() {
    void this.resume();
    if (this.timer !== null) return;
    this.bark();
    this.timer = window.setInterval(() => this.bark(), 1080);
  }

  stop() {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    this.silence();
  }

  tap() {
    void this.resume();
    this.tone(880, 0.05, "triangle", 0.12);
  }

  arm() {
    void this.resume();
    this.tone(392, 0.08, "sine", 0.14);
    window.setTimeout(() => this.tone(523, 0.1, "sine", 0.16), 120);
    window.setTimeout(() => this.tone(784, 0.16, "triangle", 0.18), 260);
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

  win() {
    void this.resume();
    this.tone(523, 0.1, "sine", 0.16);
    window.setTimeout(() => this.tone(659, 0.1, "sine", 0.16), 110);
    window.setTimeout(() => this.tone(784, 0.18, "sine", 0.2), 220);
  }

  speak(text: string) {
    if (this.volume <= 0.01) return;
    const clean = stripEmoji(text);
    if (!clean) return;
    void this.resume();
    this.silence();
    const url = `/api/tts?q=${encodeURIComponent(clean)}`;
    const audio = new Audio();
    audio.volume = Math.max(0.3, this.volume);
    audio.src = url;
    audio.setAttribute("data-troll-tts", "1");
    audio.style.display = "none";
    document.body.appendChild(audio);
    this.ttsAudio = audio;
    this.speaking = true;
    audio.onended = () => {
      this.speaking = false;
      audio.remove();
    };
    audio.onerror = () => {
      this.speaking = false;
      audio.remove();
      this.speakLocal(clean);
    };
    void audio.play().catch(() => {
      this.speaking = false;
      audio.remove();
      this.speakLocal(clean);
    });
  }

  silence() {
    if (this.ttsAudio) {
      this.ttsAudio.pause();
      this.ttsAudio.remove();
      this.ttsAudio.src = "";
      this.ttsAudio = null;
    }
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    this.speaking = false;
  }

  private ttsAudio: HTMLAudioElement | null = null;

  private speakLocal(clean: string) {
    if (typeof speechSynthesis === "undefined") return;
    speechSynthesis.cancel();
    speechSynthesis.resume();
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = "ml-IN";
    u.rate = 1.02;
    u.pitch = 1.12;
    u.volume = Math.max(0.25, this.volume);
    const voices = speechSynthesis.getVoices();
    const ml = voices.find((v) => v.lang.toLowerCase().startsWith("ml"));
    const hi = voices.find((v) => v.lang.toLowerCase().startsWith("hi"));
    if (ml) u.voice = ml;
    else if (hi) {
      u.voice = hi;
      u.lang = "hi-IN";
    }
    this.speaking = true;
    u.onend = () => {
      this.speaking = false;
    };
    u.onerror = () => {
      this.speaking = false;
    };
    speechSynthesis.speak(u);
  }

  private bark() {
    this.onBeat?.(performance.now());
    const duck = this.speaking ? 0.38 : 1;
    this.woof(0, 1 * duck);
    this.woof(0.17, 0.78 * duck);
  }

  previewBark() {
    void this.resume();
    this.bark();
  }

  private woof(offset: number, amp: number) {
    if (!this.ctx || this.volume <= 0.01) return;
    const t = this.ctx.currentTime + offset;
    const vol = this.volume * amp;

    const osc = this.ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(460, t);
    osc.frequency.exponentialRampToValueAtTime(118, t + 0.15);

    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 5;
    lp.frequency.setValueAtTime(1600, t);
    lp.frequency.exponentialRampToValueAtTime(380, t + 0.16);

    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(vol * 0.62, t + 0.012);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);

    osc.connect(lp);
    lp.connect(og);
    og.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.24);

    const buf = this.noiseBuffer();
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(780, t);
    bp.frequency.exponentialRampToValueAtTime(280, t + 0.14);
    bp.Q.value = 1.4;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(vol * 0.42, t + 0.01);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    src.connect(bp);
    bp.connect(ng);
    ng.connect(this.ctx.destination);
    src.start(t);
    src.stop(t + 0.2);
  }

  private noiseBuffer() {
    if (!this.ctx) return null;
    if (!this.noise) {
      const len = Math.floor(this.ctx.sampleRate * 0.3);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noise = buf;
    }
    return this.noise;
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number) {
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
