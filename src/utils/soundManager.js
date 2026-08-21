// Central authoritative notification sound service for TouchQR Admin Dashboard
// Uses a single persistent Web Audio API AudioContext for reliable low-latency chimes.

class NotificationSoundService {
  constructor() {
    this.audioCtx = null;
    this.isReady = false;
    this.presenceInterval = null;
    this.waiterInterval = null;
    this.listeners = new Set();
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
        console.log('[SOUND] state:', this.audioCtx.state);
      }
      return this.audioCtx;
    } catch (e) {
      console.warn('[SOUND] getAudioContext failed:', e);
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
    console.log('[SOUND] unlock_attempt');
    try {
      const ctx = this.getAudioContext();
      if (!ctx) {
        console.warn('[SOUND] unlock_failed: AudioContext not supported');
        return Promise.resolve(false);
      }

      if (ctx.state === 'suspended') {
        return ctx.resume().then(() => {
          console.log('[SOUND] unlock_success');
          this._notifyListeners();
          return true;
        }).catch(err => {
          console.warn('[SOUND] unlock_failed:', err);
          return false;
        });
      } else if (ctx.state === 'running') {
        console.log('[SOUND] unlock_success (already running)');
        this._notifyListeners();
        return Promise.resolve(true);
      }
      return Promise.resolve(false);
    } catch (e) {
      console.warn('[SOUND] unlock_failed:', e);
      return Promise.resolve(false);
    }
  }

  /**
   * Play single synthesized 4-Tone Shield sequence for Table Presence Verification
   * C5 (523.25Hz) -> E5 (659.25Hz) -> G5 (783.99Hz) -> C6 (1046.50Hz) + sparkle harmonic
   */
  _synthesizePresenceChime(ctx) {
    if (!ctx) return;
    try {
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
        osc.frequency.setValueAtTime(t.freq, ctx.currentTime + t.start);
        gain.gain.setValueAtTime(t.gain, ctx.currentTime + t.start);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t.start + t.dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + t.start);
        osc.stop(ctx.currentTime + t.start + t.dur);
      });
    } catch (e) {
      console.warn('[SOUND] play_failed:', e);
    }
  }

  /**
   * Play presence verification attention sound alert (3 cycles over ~4.5s)
   */
  playPresenceAlert() {
    console.log('[SOUND] play_started', { type: 'presence_verification' });
    this.stopPresenceAlert();

    const ctx = this.getAudioContext();
    if (!ctx) {
      console.warn('[SOUND] play_failed: No AudioContext');
      return;
    }

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const startTime = Date.now();
    this._synthesizePresenceChime(ctx);

    this.presenceInterval = setInterval(() => {
      if (Date.now() - startTime >= 4500) {
        this.stopPresenceAlert();
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
      const tones = [
        { freq: 880, start: 0.00, dur: 0.30 },
        { freq: 1320, start: 0.18, dur: 0.35 },
        { freq: 1760, start: 0.36, dur: 0.50 }
      ];

      tones.forEach(t => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(t.freq, ctx.currentTime + t.start);
        gain.gain.setValueAtTime(1.0, ctx.currentTime + t.start);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t.start + t.dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + t.start);
        osc.stop(ctx.currentTime + t.start + t.dur);
      });
    } catch (e) {
      console.warn('[SOUND] play_failed:', e);
    }
  }

  /**
   * Play waiter call sound alert (over 6.0 seconds)
   */
  playWaiterAlert() {
    console.log('[SOUND] play_started', { type: 'waiter_bell' });
    this.stopWaiterAlert();

    const ctx = this.getAudioContext();
    if (!ctx) {
      console.warn('[SOUND] play_failed: No AudioContext');
      return;
    }

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const startTime = Date.now();
    this._synthesizeWaiterBell(ctx);

    this.waiterInterval = setInterval(() => {
      if (Date.now() - startTime >= 6000) {
        this.stopWaiterAlert();
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
}

export const soundManager = new NotificationSoundService();
export const unlockNotificationSound = () => soundManager.unlockNotificationSound();
export const playPresenceAlert = () => soundManager.playPresenceAlert();
export const playWaiterAlert = () => soundManager.playWaiterAlert();
export const isNotificationSoundReady = () => soundManager.isNotificationSoundReady();
export const subscribeAudioState = (cb) => soundManager.subscribeAudioState(cb);
