// Central authoritative notification sound service for TouchQR Admin Dashboard
// Uses a single persistent Web Audio API AudioContext for reliable low-latency chimes.

class NotificationSoundService {
  constructor() {
    this.audioCtx = null;
    this.isReady = false;
    this.presenceInterval = null;
    this.waiterInterval = null;
    this.activeSirenGain = null;
    this.activeSirenOscillators = [];
    this.listeners = new Set();

    if (typeof window !== 'undefined') {
      window.testNotificationSound = (type = 'siren') => this.testNotificationSound(type);
    }
  }

  /**
   * Get or initialize the persistent singleton AudioContext
   */
  getAudioContext() {
    if (typeof window === 'undefined') return null;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioCtx();
        console.log('[SOUND_DEBUG] audio_context_state', this.audioCtx.state);
      }
      return this.audioCtx;
    } catch (e) {
      console.warn('[SOUND_DEBUG] playback_error', e?.message || e);
      return null;
    }
  }

  /**
   * Check if the notification audio engine is unlocked and ready for playback
   */
  isNotificationSoundReady() {
    if (!this.audioCtx) return false;
    return this.audioCtx.state === 'running';
  }

  /**
   * Subscribe to audio readiness state changes
   */
  subscribeAudioState(callback) {
    if (typeof callback !== 'function') return () => {};
    this.listeners.add(callback);
    callback(this.isNotificationSoundReady());
    return () => this.listeners.delete(callback);
  }

  _notifyListeners() {
    const ready = this.isNotificationSoundReady();
    this.isReady = ready;
    this.listeners.forEach(cb => {
      try { cb(ready); } catch (e) {}
    });
  }

  /**
   * Unlock Web Audio Context on user gesture (with iOS Safari dummy buffer playback)
   */
  unlockNotificationSound() {
    if (typeof window === 'undefined') return Promise.resolve(false);
    console.log('[SOUND_DEBUG] unlock_attempt');
    try {
      const ctx = this.getAudioContext();
      if (!ctx) {
        console.warn('[SOUND_DEBUG] unlock_failed: AudioContext not supported');
        return Promise.resolve(false);
      }

      const primeAudio = () => {
        try {
          // Play 1 sample of silent buffer to guarantee iOS Safari doesn't immediately re-suspend
          const buffer = ctx.createBuffer(1, 1, 22050);
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          source.start(0);
        } catch (e) {}
        this._notifyListeners();
        return true;
      };

      if (ctx.state === 'suspended') {
        return ctx.resume().then(() => {
          console.log('[SOUND_DEBUG] unlock_success', ctx.state);
          return primeAudio();
        }).catch(err => {
          console.warn('[SOUND_DEBUG] unlock_failed', err?.message || err);
          return false;
        });
      } else if (ctx.state === 'running') {
        console.log('[SOUND_DEBUG] unlock_success (already running)');
        primeAudio();
        return Promise.resolve(true);
      }
      return Promise.resolve(false);
    } catch (e) {
      console.warn('[SOUND_DEBUG] unlock_failed', e?.message || e);
      return Promise.resolve(false);
    }
  }

  async _ensureContextRunning() {
    const ctx = this.getAudioContext();
    if (!ctx) return null;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
        this._notifyListeners();
      } catch (err) {
        console.warn('[SOUND_DEBUG] playback_error', err?.message || err);
      }
    }
    return ctx;
  }

  /**
   * 🚨 Play Super Loud Zomato/Swiggy Style 8-Cycle Emergency Order Siren Ringtone
   * Instant cancellable via stopKitchenSiren()
   */
  async playKitchenSiren() {
    const ctx = await this._ensureContextRunning();
    if (!ctx) return;

    this.stopKitchenSiren();

    try {
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(1.0, ctx.currentTime);
      masterGain.connect(ctx.destination);
      this.activeSirenGain = masterGain;

      const pulses = [
        { freq1: 1050, freq2: 1650, start: 0.0 },
        { freq1: 1350, freq2: 1850, start: 0.30 },
        { freq1: 1050, freq2: 1650, start: 0.60 },
        { freq1: 1450, freq2: 2050, start: 0.90 },
        { freq1: 1250, freq2: 1750, start: 1.20 },
        { freq1: 1550, freq2: 2150, start: 1.50 },
        { freq1: 1350, freq2: 1850, start: 1.80 },
        { freq1: 1650, freq2: 2250, start: 2.10 }
      ];

      pulses.forEach(p => {
        const t = ctx.currentTime + p.start;

        // Piercing Siren Tone 1 (Sawtooth)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(p.freq1, t);
        osc1.frequency.linearRampToValueAtTime(p.freq2, t + 0.14);
        gain1.gain.setValueAtTime(1.0, t);
        gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        osc1.connect(gain1);
        gain1.connect(masterGain);
        osc1.start(t);
        osc1.stop(t + 0.28);
        this.activeSirenOscillators.push(osc1);

        // High Alarm Resonance Tone 2 (Square)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(p.freq2, t + 0.10);
        osc2.frequency.linearRampToValueAtTime(p.freq1, t + 0.24);
        gain2.gain.setValueAtTime(0.9, t + 0.10);
        gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        osc2.connect(gain2);
        gain2.connect(masterGain);
        osc2.start(t + 0.10);
        osc2.stop(t + 0.28);
        this.activeSirenOscillators.push(osc2);
      });

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([400, 200, 400, 200, 600]);
        } catch (e) {}
      }

      // Cleanup finished oscillator references after pulse duration (~2.45s)
      setTimeout(() => {
        if (this.activeSirenGain === masterGain) {
          this.activeSirenGain = null;
          this.activeSirenOscillators = [];
        }
      }, 2500);
    } catch (e) {
      console.warn('[SOUND_DEBUG] kitchen_siren_error', e?.message || e);
    }
  }

  /**
   * Instantly stops any active kitchen siren sound and cuts off oscillator output
   */
  stopKitchenSiren() {
    const ctx = this.audioCtx;
    if (this.activeSirenGain && ctx) {
      try {
        this.activeSirenGain.gain.cancelScheduledValues(ctx.currentTime);
        this.activeSirenGain.gain.setValueAtTime(0.0001, ctx.currentTime);
        this.activeSirenGain.disconnect();
      } catch (e) {}
      this.activeSirenGain = null;
    }

    if (this.activeSirenOscillators.length > 0) {
      this.activeSirenOscillators.forEach(osc => {
        try { osc.stop(); } catch (e) {}
      });
      this.activeSirenOscillators = [];
    }
  }

  /**
   * Play single synthesized 4-Tone Shield sequence for Table Presence Verification
   * C5 (523.25Hz) -> E5 (659.25Hz) -> G5 (783.99Hz) -> C6 (1046.50Hz) + sparkle harmonic
   */
  _synthesizePresenceChime(ctx) {
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const tones = [
        { freq: 523.25, start: 0.00, dur: 0.22, wave: 'sine', gain: 0.8 },
        { freq: 659.25, start: 0.14, dur: 0.22, wave: 'sine', gain: 0.85 },
        { freq: 783.99, start: 0.28, dur: 0.25, wave: 'triangle', gain: 0.9 },
        { freq: 1046.50, start: 0.42, dur: 0.45, wave: 'sine', gain: 1.0 },
        { freq: 2093.00, start: 0.42, dur: 0.35, wave: 'sine', gain: 0.35 }
      ];

      tones.forEach(t => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = t.wave;
        osc.frequency.setValueAtTime(t.freq, now + t.start);
        gain.gain.setValueAtTime(0.0001, now + t.start);
        gain.gain.linearRampToValueAtTime(t.gain, now + t.start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + t.start + t.dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + t.start);
        osc.stop(now + t.start + t.dur + 0.05);
      });
    } catch (e) {
      console.warn('[SOUND_DEBUG] playback_error', e?.message || e);
    }
  }

  /**
   * Play presence verification attention sound alert (3 cycles over ~4.5s)
   */
  async playPresenceAlert() {
    console.log('[SOUND_DEBUG] presence_sound_function_called');
    this.stopPresenceAlert();

    const ctx = await this._ensureContextRunning();
    if (!ctx) {
      console.warn('[SOUND_DEBUG] playback_failed: No AudioContext');
      return;
    }

    console.log('[SOUND_DEBUG] audio_ready', this.isNotificationSoundReady());
    console.log('[SOUND_DEBUG] audio_context_state', ctx.state);
    console.log('[SOUND_DEBUG] playback_started', { type: 'presence_verification' });

    const startTime = Date.now();
    this._synthesizePresenceChime(ctx);

    this.presenceInterval = setInterval(() => {
      if (Date.now() - startTime >= 4500) {
        this.stopPresenceAlert();
        console.log('[SOUND_DEBUG] playback_completed', { type: 'presence_verification' });
      } else {
        this._synthesizePresenceChime(ctx);
      }
    }, 1200);

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([400, 150, 400, 150, 400]);
      } catch (e) {}
    }
  }

  stopPresenceAlert() {
    if (this.presenceInterval) {
      clearInterval(this.presenceInterval);
      this.presenceInterval = null;
    }
  }

  /**
   * Play single synthesized 3-Tone Reception Bell sequence for Waiter Calls
   * A5 (880Hz) -> E6 (1320Hz) -> A6 (1760Hz)
   */
  _synthesizeWaiterBell(ctx) {
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const tones = [
        { freq: 880, start: 0.00, dur: 0.30 },
        { freq: 1320, start: 0.18, dur: 0.35 },
        { freq: 1760, start: 0.36, dur: 0.50 }
      ];

      tones.forEach(t => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(t.freq, now + t.start);
        gain.gain.setValueAtTime(0.0001, now + t.start);
        gain.gain.linearRampToValueAtTime(1.0, now + t.start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + t.start + t.dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + t.start);
        osc.stop(now + t.start + t.dur + 0.05);
      });
    } catch (e) {
      console.warn('[SOUND_DEBUG] playback_error', e?.message || e);
    }
  }

  /**
   * Play waiter call sound alert (over 6.0 seconds)
   */
  async playWaiterAlert() {
    console.log('[SOUND_DEBUG] waiter_sound_function_called');
    this.stopWaiterAlert();

    const ctx = await this._ensureContextRunning();
    if (!ctx) {
      console.warn('[SOUND_DEBUG] playback_failed: No AudioContext');
      return;
    }

    console.log('[SOUND_DEBUG] audio_ready', this.isNotificationSoundReady());
    console.log('[SOUND_DEBUG] audio_context_state', ctx.state);
    console.log('[SOUND_DEBUG] playback_started', { type: 'waiter_bell' });

    const startTime = Date.now();
    this._synthesizeWaiterBell(ctx);

    this.waiterInterval = setInterval(() => {
      if (Date.now() - startTime >= 6000) {
        this.stopWaiterAlert();
        console.log('[SOUND_DEBUG] playback_completed', { type: 'waiter_bell' });
      } else {
        this._synthesizeWaiterBell(ctx);
      }
    }, 1200);
  }

  stopWaiterAlert() {
    if (this.waiterInterval) {
      clearInterval(this.waiterInterval);
      this.waiterInterval = null;
    }
  }

  /**
   * 👨‍🍳 Play short, pleasant 2-Tone KDS Kitchen Ticket Arrival Chime
   * (A5 880Hz -> E6 1320Hz, 0.35s)
   */
  async playKdsChime() {
    const ctx = await this._ensureContextRunning();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.20);
      gain.gain.setValueAtTime(0.6, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {
      console.warn('[SOUND_DEBUG] kds_chime_error', e?.message || e);
    }
  }

  /**
   * Development & verification manual test helper
   */
  testNotificationSound(type = 'siren') {
    console.log('[SOUND_DEBUG] test_sound_started', { type });
    if (type === 'waiter') {
      return this.playWaiterAlert();
    }
    if (type === 'presence') {
      return this.playPresenceAlert();
    }
    if (type === 'kds') {
      return this.playKdsChime();
    }
    return this.playKitchenSiren();
  }
}

export const soundManager = new NotificationSoundService();
export const unlockNotificationSound = () => soundManager.unlockNotificationSound();
export const playKitchenSiren = () => soundManager.playKitchenSiren();
export const stopKitchenSiren = () => soundManager.stopKitchenSiren();
export const playPresenceAlert = () => soundManager.playPresenceAlert();
export const stopPresenceAlert = () => soundManager.stopPresenceAlert();
export const playWaiterAlert = () => soundManager.playWaiterAlert();
export const stopWaiterAlert = () => soundManager.stopWaiterAlert();
export const playKdsChime = () => soundManager.playKdsChime();
export const isNotificationSoundReady = () => soundManager.isNotificationSoundReady();
export const subscribeAudioState = (cb) => soundManager.subscribeAudioState(cb);
export const testNotificationSound = (type) => soundManager.testNotificationSound(type);
