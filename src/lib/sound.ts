// Web Audio chime synthesis. Zero deps, zero latency, no API key.
const STORAGE_KEY = "rebuilt.sound";

export function isMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) === "off";
}
export function setMuted(muted: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, muted ? "off" : "on");
}

let ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
  if (!AC) return null;
  ctx = new AC();
  return ctx;
}

/** Play a pleasant tone: short attack, gentle decay. */
function tone(freq: number, startAt: number, duration = 0.6, type: OscillatorType = "sine", gain = 0.18) {
  const ac = getCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  // ADSR-ish envelope
  g.gain.setValueAtTime(0.0001, startAt);
  g.gain.exponentialRampToValueAtTime(gain, startAt + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(g).connect(ac.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.05);
}

export type ChimePreset = "ding" | "chime" | "fanfare" | "victory" | "pr" | "singing_bowl";

export function playChime(preset: ChimePreset) {
  if (isMuted()) return;
  const ac = getCtx();
  if (!ac) return;
  if (ac.state === "suspended") ac.resume().catch(() => {});
  const now = ac.currentTime + 0.01;

  // Frequencies: C5=523.25, E5=659.25, G5=783.99, C6=1046.5, E6=1318.5
  switch (preset) {
    case "ding":
      // Tight two-note rising fifth — clean reward ping for check-ins.
      tone(783.99, now, 0.32, "sine", 0.2);
      tone(1174.66, now + 0.09, 0.42, "triangle", 0.14);
      break;
    case "chime":
      tone(523.25, now, 0.5, "sine", 0.18);
      tone(659.25, now + 0.09, 0.5, "sine", 0.16);
      tone(783.99, now + 0.18, 0.7, "triangle", 0.14);
      break;
    case "fanfare": {
      const seq: Array<[number, number, number]> = [
        [523.25, 0.0, 0.35],
        [659.25, 0.13, 0.35],
        [783.99, 0.26, 0.4],
        [1046.5, 0.42, 0.9],
      ];
      seq.forEach(([f, t, d]) => tone(f, now + t, d, "sine", 0.18));
      tone(1318.5, now + 0.42, 0.9, "triangle", 0.08);
      break;
    }
    case "victory": {
      // Four-note ascending major arpeggio with sustained crown — workout complete.
      const seq: Array<[number, number, number]> = [
        [523.25, 0.0, 0.3],
        [659.25, 0.1, 0.3],
        [783.99, 0.2, 0.3],
        [1046.5, 0.32, 1.1],
      ];
      seq.forEach(([f, t, d]) => tone(f, now + t, d, "sine", 0.2));
      // Warm fifth + octave shimmer on the crown
      tone(1567.98, now + 0.32, 1.1, "triangle", 0.09);
      tone(2093.0, now + 0.38, 0.9, "sine", 0.05);
      break;
    }
    case "pr": {
      // Bright bell — new personal record. Two struck bells with overtone shimmer.
      tone(1046.5, now, 0.9, "sine", 0.22);
      tone(1318.5, now + 0.04, 0.9, "triangle", 0.12);
      tone(2093.0, now + 0.08, 0.7, "sine", 0.06);
      tone(1567.98, now + 0.35, 0.7, "triangle", 0.1);
      break;
    }
    case "singing_bowl": {
      // Tibetan singing bowl — soft strike, sustained body, slow beating shimmer.
      // Strike: short triangle pluck on fundamental.
      tone(220, now, 0.18, "triangle", 0.12);
      // Body: sine fundamental with long decay.
      tone(220, now, 4.5, "sine", 0.22);
      // Detuned twin for slow beating wobble.
      tone(221.5, now, 4.5, "sine", 0.18);
      // Overtones bloom in.
      tone(330, now + 0.06, 4.0, "sine", 0.1);
      tone(440, now + 0.14, 3.6, "sine", 0.07);
      tone(660, now + 0.22, 2.8, "sine", 0.035);
      break;
    }
  }
}
