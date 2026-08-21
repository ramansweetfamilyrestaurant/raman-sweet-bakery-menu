// Self-contained sound alert engine for TouchQR Admin Dashboard
// Generates PCM WAV Data URIs and controls Web Audio synthesizer

/**
 * Creates a clean PCM 16-bit Mono WAV Data URI from an array of Float32 audio samples
 */
function createWavDataUri(samples, sampleRate = 22050) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
  view.setUint16(20, 1, true);  // AudioFormat (1 for PCM)
  view.setUint16(22, 1, true);  // NumChannels (1 = Mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true);  // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample (16-bit)

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  // Write PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  // Convert buffer to base64
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return 'data:audio/wav;base64,' + btoa(binary);
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Generate Presence Verification Chime (Ascending 4-Tone Shield: C5 -> E5 -> G5 -> C6 with harmonic shimmer)
 */
export function generatePresenceChimeWav() {
  const sampleRate = 22050;
  const duration = 2.4; // 2.4 seconds per loop
  const totalSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(totalSamples);

  const notes = [
    { freq: 523.25, start: 0.00, dur: 0.35, gain: 0.8 },  // C5
    { freq: 659.25, start: 0.22, dur: 0.35, gain: 0.85 }, // E5
    { freq: 783.99, start: 0.44, dur: 0.40, gain: 0.9 },  // G5
    { freq: 1046.50, start: 0.66, dur: 1.40, gain: 1.0 }, // C6
    { freq: 2093.00, start: 0.66, dur: 0.80, gain: 0.35 } // Sparkle
  ];

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    let sampleVal = 0;

    for (const note of notes) {
      if (t >= note.start && t < note.start + note.dur) {
        const noteT = t - note.start;
        const env = Math.exp(-noteT * 3.5); // Exponential decay
        const wave = Math.sin(2 * Math.PI * note.freq * noteT) + 
                     0.25 * Math.sin(2 * Math.PI * note.freq * 2 * noteT); // Harmonic
        sampleVal += wave * note.gain * env;
      }
    }
    samples[i] = sampleVal * 0.7;
  }

  return createWavDataUri(samples, sampleRate);
}

/**
 * Generate Waiter Bell Chime (3-Tone Reception Desk Bell: 880Hz -> 1320Hz -> 1760Hz)
 */
export function generateWaiterBellWav() {
  const sampleRate = 22050;
  const duration = 2.0;
  const totalSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(totalSamples);

  const tones = [
    { freq: 880, start: 0.00, dur: 0.45, gain: 0.9 },
    { freq: 1320, start: 0.25, dur: 0.50, gain: 0.95 },
    { freq: 1760, start: 0.50, dur: 1.20, gain: 1.0 }
  ];

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    let sampleVal = 0;

    for (const tone of tones) {
      if (t >= tone.start && t < tone.start + tone.dur) {
        const noteT = t - tone.start;
        const env = Math.exp(-noteT * 3.2);
        const wave = Math.sin(2 * Math.PI * tone.freq * noteT);
        sampleVal += wave * tone.gain * env;
      }
    }
    samples[i] = sampleVal * 0.75;
  }

  return createWavDataUri(samples, sampleRate);
}

/**
 * Singleton Audio Player with dual Web Audio API & HTML5 Audio fallback
 */
class SoundNotificationManager {
  constructor() {
    this.audioCtx = null;
    this.presenceAudio = null;
    this.waiterAudio = null;
    this.isUnlocked = false;
    this.presenceInterval = null;
    this.waiterInterval = null;
  }

  init() {
    if (typeof window === 'undefined') return;
    try {
      if (!this.presenceAudio) {
        const presenceUri = generatePresenceChimeWav();
        this.presenceAudio = new Audio(presenceUri);
        this.presenceAudio.preload = 'auto';
      }
      if (!this.waiterAudio) {
        const waiterUri = generateWaiterBellWav();
        this.waiterAudio = new Audio(waiterUri);
        this.waiterAudio.preload = 'auto';
      }
      console.log('[NOTIFICATION_SOUND] initialized');
    } catch (e) {
      console.warn('[NOTIFICATION_SOUND] init error:', e);
    }
  }

  getAudioContext() {
    if (typeof window === 'undefined') return null;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioCtx();
      }
      return this.audioCtx;
    } catch (e) {
      console.warn('[NOTIFICATION_SOUND] getAudioContext error:', e);
      return null;
    }
  }

  unlock() {
    if (typeof window === 'undefined') return;
    try {
      const ctx = this.getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().then(() => {
          this.isUnlocked = true;
          console.log('[NOTIFICATION_SOUND] user_interaction_unlocked (Web Audio)');
        }).catch(err => {
          console.warn('[NOTIFICATION_SOUND] autoplay_blocked (Web Audio):', err);
        });
      } else if (ctx && ctx.state === 'running') {
        this.isUnlocked = true;
      }

      // Warm up HTML5 Audio
      this.init();
      if (this.presenceAudio) {
        this.presenceAudio.play().then(() => {
          this.presenceAudio.pause();
          this.presenceAudio.currentTime = 0;
          this.isUnlocked = true;
          console.log('[NOTIFICATION_SOUND] user_interaction_unlocked (HTML5 Audio)');
        }).catch(e => {});
      }
    } catch (e) {
      console.warn('[NOTIFICATION_SOUND] unlock error:', e);
    }
  }

  playPresenceAlert() {
    console.log('[NOTIFICATION_SOUND] play_started', { type: 'presence_verification' });
    this.stopPresenceAlert();

    const playOnce = () => {
      // 1. Try HTML5 Audio
      try {
        if (!this.presenceAudio) this.init();
        if (this.presenceAudio) {
          this.presenceAudio.currentTime = 0;
          const p = this.presenceAudio.play();
          if (p && typeof p.then === 'function') {
            p.catch(err => {
              console.warn('[NOTIFICATION_SOUND] HTML5 Audio play blocked:', err);
              this.playWebAudioPresence();
            });
          }
        } else {
          this.playWebAudioPresence();
        }
      } catch (err) {
        console.warn('[NOTIFICATION_SOUND] HTML5 Audio play error:', err);
        this.playWebAudioPresence();
      }
    };

    playOnce();
    const startTime = Date.now();
    this.presenceInterval = setInterval(() => {
      if (Date.now() - startTime >= 4800) {
        this.stopPresenceAlert();
        console.log('[NOTIFICATION_SOUND] play_completed', { type: 'presence_verification' });
      } else {
        playOnce();
      }
    }, 1500);

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([400, 150, 400, 150, 400]);
    }
  }

  stopPresenceAlert() {
    if (this.presenceInterval) {
      clearInterval(this.presenceInterval);
      this.presenceInterval = null;
    }
  }

  playWebAudioPresence() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const tones = [
        { freq: 523.25, start: 0.00, dur: 0.25, gain: 0.8 },
        { freq: 659.25, start: 0.16, dur: 0.25, gain: 0.85 },
        { freq: 783.99, start: 0.32, dur: 0.30, gain: 0.9 },
        { freq: 1046.50, start: 0.48, dur: 0.60, gain: 1.0 }
      ];
      tones.forEach(t => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(t.freq, ctx.currentTime + t.start);
        gain.gain.setValueAtTime(t.gain, ctx.currentTime + t.start);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t.start + t.dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + t.start);
        osc.stop(ctx.currentTime + t.start + t.dur);
      });
    } catch (e) {
      console.warn('[NOTIFICATION_SOUND] Web Audio fallback error:', e);
    }
  }

  playWaiterBell() {
    console.log('[NOTIFICATION_SOUND] play_started', { type: 'waiter_bell' });
    this.stopWaiterBell();

    const playOnce = () => {
      try {
        if (!this.waiterAudio) this.init();
        if (this.waiterAudio) {
          this.waiterAudio.currentTime = 0;
          const p = this.waiterAudio.play();
          if (p && typeof p.then === 'function') {
            p.catch(err => {
              console.warn('[NOTIFICATION_SOUND] Waiter HTML5 audio blocked:', err);
              this.playWebAudioWaiter();
            });
          }
        } else {
          this.playWebAudioWaiter();
        }
      } catch (err) {
        this.playWebAudioWaiter();
      }
    };

    playOnce();
    const startTime = Date.now();
    this.waiterInterval = setInterval(() => {
      if (Date.now() - startTime >= 6000) {
        this.stopWaiterBell();
        console.log('[NOTIFICATION_SOUND] play_completed', { type: 'waiter_bell' });
      } else {
        playOnce();
      }
    }, 1400);
  }

  stopWaiterBell() {
    if (this.waiterInterval) {
      clearInterval(this.waiterInterval);
      this.waiterInterval = null;
    }
  }

  playWebAudioWaiter() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const tones = [
        { freq: 880, start: 0.00, dur: 0.35, gain: 0.9 },
        { freq: 1320, start: 0.20, dur: 0.40, gain: 0.95 },
        { freq: 1760, start: 0.40, dur: 0.65, gain: 1.0 }
      ];
      tones.forEach(t => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(t.freq, ctx.currentTime + t.start);
        gain.gain.setValueAtTime(t.gain, ctx.currentTime + t.start);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t.start + t.dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + t.start);
        osc.stop(ctx.currentTime + t.start + t.dur);
      });
    } catch (e) {
      console.warn('[NOTIFICATION_SOUND] Web Audio waiter error:', e);
    }
  }
}

export const soundManager = new SoundNotificationManager();
