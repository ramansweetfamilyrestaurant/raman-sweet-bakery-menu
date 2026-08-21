// Central authoritative notification sound service for TouchQR Admin Dashboard
// Uses a single persistent Web Audio API AudioContext for reliable low-latency chimes.

class NotificationSoundService {
  constructor() {
    this.audioCtx = null;
    this.isReady = false;
    this.presenceInterval = null;
    this.waiterInterval = null;
    this.listeners = new Set();

    if (typeof window !== 'undefined') {
      window.testNotificationSound = (type = 'presence') => this.testNotificationSound(type);
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
   * Unlock Web Audio Context on user gesture
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

      if (ctx.state === 'suspended') {
        return ctx.resume().then(() => {
          console.log('[SOUND_DEBUG] unlock_success', ctx.state);
          this._notifyListeners();
          return true;
        }).catch(err => {
          console.warn('[SOUND_DEBUG] unlock_failed', err?.message || err);
          return false;
        });
      } else if (ctx.state === 'running') {
        console.log('[SOUND_DEBUG] unlock_success (already running)');
        this._notifyListeners();
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
   * Development & verification manual test helper
   */
  testNotificationSound(type = 'presence') {
    console.log('[SOUND_DEBUG] test_sound_started', { type });
    if (type === 'waiter') {
      return this.playWaiterAlert();
    }
    return this.playPresenceAlert();
  }
}

export const soundManager = new NotificationSoundService();
export const unlockNotificationSound = () => soundManager.unlockNotificationSound();
export const playPresenceAlert = () => soundManager.playPresenceAlert();
export const playWaiterAlert = () => soundManager.playWaiterAlert();
export const isNotificationSoundReady = () => soundManager.isNotificationSoundReady();
export const subscribeAudioState = (cb) => soundManager.subscribeAudioState(cb);
export const testNotificationSound = (type) => soundManager.testNotificationSound(type);
