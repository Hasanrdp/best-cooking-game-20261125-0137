// Synthesised sound: every noise the kitchen makes comes from the Web Audio
// API, so the game ships no audio files and makes no network request. The
// context is created on the first user gesture; until then every call is a
// no-op, and in a headless run (screenshots) it stays silent.

export function createAudio() {
  let context = null;
  let master = null;
  let sizzleNodes = null;
  let muted = false;

  function ensure() {
    if (context !== null) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext === undefined) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
    } catch {
      return false;
    }
    return true;
  }

  /** Call from any user gesture so the browser lets sound play. */
  function unlock() {
    if (!ensure()) return;
    if (context.state === 'suspended') context.resume().catch(() => {});
  }

  function tone(freq, dur, type, volume, slideTo) {
    if (!ensure() || muted) return;
    try {
      const now = context.currentTime;
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(slideTo, now + dur);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  function noiseBurst(dur, volume, filterFreq) {
    if (!ensure() || muted) return;
    try {
      const now = context.currentTime;
      const length = Math.max(1, Math.floor(context.sampleRate * dur));
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = context.createBufferSource();
      source.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = filterFreq;
      const gain = context.createGain();
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start(now);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  /** A looping filtered-noise hiss while any patty cooks; call every frame. */
  function setSizzle(on) {
    if (!ensure()) return;
    try {
      if (on && sizzleNodes === null) {
        const length = context.sampleRate;
        const buffer = context.createBuffer(1, length, context.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        const filter = context.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 5200;
        filter.Q.value = 0.6;
        const gain = context.createGain();
        gain.gain.value = 0;
        gain.gain.linearRampToValueAtTime(muted ? 0 : 0.05, context.currentTime + 0.2);
        source.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        source.start();
        sizzleNodes = { source, gain };
      } else if (!on && sizzleNodes !== null) {
        const nodes = sizzleNodes;
        sizzleNodes = null;
        nodes.gain.gain.linearRampToValueAtTime(0, context.currentTime + 0.15);
        setTimeout(() => {
          try { nodes.source.stop(); } catch { /* already stopped */ }
        }, 250);
      }
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  return {
    unlock,
    setMuted(value) {
      muted = value;
      if (master !== null) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    pickup() { tone(520, 0.07, 'sine', 0.25, 760); },
    place() { tone(340, 0.08, 'triangle', 0.25, 260); },
    chop() { noiseBurst(0.06, 0.3, 1800); },
    chopDone() { tone(660, 0.09, 'square', 0.12, 880); noiseBurst(0.08, 0.2, 2400); },
    grillDone() { tone(880, 0.12, 'sine', 0.2, 1174); },
    serve() {
      tone(523, 0.1, 'sine', 0.25);
      setTimeout(() => tone(659, 0.1, 'sine', 0.25), 90);
      setTimeout(() => tone(784, 0.16, 'sine', 0.28), 180);
    },
    bad() { tone(180, 0.18, 'sawtooth', 0.16, 120); },
    expire() { tone(392, 0.15, 'triangle', 0.2, 262); tone(311, 0.2, 'triangle', 0.18, 233); },
    burn() { tone(140, 0.3, 'sawtooth', 0.14, 90); },
    click() { tone(700, 0.05, 'sine', 0.15); },
    over() {
      tone(392, 0.2, 'sine', 0.22);
      setTimeout(() => tone(523, 0.2, 'sine', 0.22), 180);
      setTimeout(() => tone(659, 0.35, 'sine', 0.24), 360);
    },
    setSizzle,
  };
}
