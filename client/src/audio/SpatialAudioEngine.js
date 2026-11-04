/**
 * Spatial Audio Mixer.
 *
 * Remote audio graph:
 *
 * MediaStreamSource
 *   -> Lowpass Filter
 *   -> Distance / Occlusion Gain
 *   -> Stereo Panner
 *   -> Master Gain
 *   -> AudioContext Destination
 *
 * Geometry is supplied by the world render loop.
 * Audio parameters are updated at a controlled interval.
 */

import {
  gainAtDistance,
  panAtDistance,
  lowpassFor,
  rms,
} from './spatialMath.js';

const DEFAULT = {
  earshotPx: 100,
  fullVolumePx: 35,
  updateIntervalMs: 50,
  speakingThreshold: 0.045,
  maxVoices: 12,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export class SpatialAudioEngine {
  constructor(options = {}) {
    /*
     * ProxiContext historically passes earshotRadiusPx.
     * The audio math uses earshotPx, so support both names.
     */
    const earshotPx =
      options.earshotPx ??
      options.earshotRadiusPx ??
      DEFAULT.earshotPx;

    const fullVolumePx =
      options.fullVolumePx ??
      options.fullVolumeRadiusPx ??
      DEFAULT.fullVolumePx;

    this.options = {
      ...DEFAULT,
      ...options,
      earshotPx: Math.max(1, Number(earshotPx) || DEFAULT.earshotPx),
      fullVolumePx: Math.max(
        0,
        Number(fullVolumePx) || 0,
      ),
      updateIntervalMs: Math.max(
        16,
        Number(options.updateIntervalMs) || DEFAULT.updateIntervalMs,
      ),
      maxVoices: Math.max(
        1,
        Number(options.maxVoices) || DEFAULT.maxVoices,
      ),
    };

    this.ctx = null;
    this.master = null;

    this.localStream = null;
    this.localSource = null;
    this.localAnalyser = null;
    this.localBuffer = null;

    this.listener = {
      x: 0,
      y: 0,
      angle: 0,
    };

    this.peers = new Map();
    this.mediaElements = new Map();

    /*
     * Keep streams that arrive before AudioContext initialization.
     * They will be attached once init() succeeds.
     */
    this.pendingStreams = new Map();

    this.muted = false;
    this.masterVolume = 1;
    this.lastUpdate = 0;
    this.onSpeakingChange = null;
    this.disposed = false;
  }

  get ready() {
    return Boolean(
      this.ctx &&
      this.ctx.state !== 'closed' &&
      this.master,
    );
  }

  /**
   * Initialize or resume Web Audio.
   *
   * Call from a user gesture when possible because browsers may
   * block autoplay until the user interacts with the page.
   */
  async init() {
    this.disposed = false;

    if (this.ctx && this.ctx.state !== 'closed') {
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }

      this.#flushPendingStreams();
      return this.ctx;
    }

    const AudioContextCtor =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContextCtor) {
      throw new Error(
        'Web Audio API is not available in this browser.',
      );
    }

    this.ctx = new AudioContextCtor({
      latencyHint: 'interactive',
    });

    this.master = this.ctx.createGain();

    this.master.gain.value = this.muted
      ? 0
      : this.masterVolume;

    this.master.connect(this.ctx.destination);

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    this.#flushPendingStreams();

    return this.ctx;
  }

  /**
   * Resume playback after browser autoplay suspension.
   */
  async resume() {
    if (!this.ctx || this.ctx.state === 'closed') {
      await this.init();
      return;
    }

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    this.#flushPendingStreams();
  }

  /**
   * Attach the local microphone for level detection.
   * Local microphone audio is never played through the speakers.
   */
  async setLocalStream(stream) {
    if (!stream) {
      throw new Error('A microphone MediaStream is required.');
    }

    await this.init();

    if (
      this.localStream === stream &&
      this.localAnalyser
    ) {
      return stream;
    }

    this.#disconnectLocalNodes();

    this.localStream = stream;

    this.localSource =
      this.ctx.createMediaStreamSource(stream);

    this.localAnalyser =
      this.ctx.createAnalyser();

    this.localAnalyser.fftSize = 512;
    this.localAnalyser.smoothingTimeConstant = 0.6;

    this.localSource.connect(this.localAnalyser);

    this.localBuffer = new Float32Array(
      this.localAnalyser.fftSize,
    );

    return stream;
  }

  #disconnectLocalNodes() {
    try {
      this.localSource?.disconnect();
    } catch {
      // The source may already be disconnected.
    }

    try {
      this.localAnalyser?.disconnect();
    } catch {
      // The analyser may already be disconnected.
    }

    this.localSource = null;
    this.localAnalyser = null;
    this.localBuffer = null;
  }

  getLocalLevel() {
    if (
      !this.localAnalyser ||
      !this.localBuffer
    ) {
      return 0;
    }

    this.localAnalyser.getFloatTimeDomainData(
      this.localBuffer,
    );

    return rms(this.localBuffer);
  }

  get isSpeaking() {
    return (
      this.getLocalLevel() >
      this.options.speakingThreshold
    );
  }

  /**
   * This controls remote playback volume.
   * Microphone transmission is controlled separately by its audio track.
   */
  setLocalMuted(muted) {
    this.muted = Boolean(muted);

    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(
        this.muted ? 0 : this.masterVolume,
        this.ctx.currentTime,
        0.05,
      );
    }
  }

  setMasterVolume(value) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      return;
    }

    this.masterVolume = clamp(numericValue, 0, 1);

    if (this.master && this.ctx && !this.muted) {
      this.master.gain.setTargetAtTime(
        this.masterVolume,
        this.ctx.currentTime,
        0.05,
      );
    }
  }

  setListener(position = {}) {
    const x = Number(position.x);
    const y = Number(position.y);
    const angle = Number(position.angle);

    if (Number.isFinite(x)) {
      this.listener.x = x;
    }

    if (Number.isFinite(y)) {
      this.listener.y = y;
    }

    if (Number.isFinite(angle)) {
      this.listener.angle = angle;
    }
  }

  /**
   * Attach or replace a remote WebRTC stream.
   *
   * If Web Audio is not initialized yet, preserve the stream and
   * attach it as soon as init() runs.
   */
  attachRemoteStream(peerId, stream) {
    if (!peerId || !stream) {
      return false;
    }

    const audioTracks = stream.getAudioTracks?.() ?? [];

    if (audioTracks.length === 0) {
      this.pendingStreams.delete(peerId);
      return false;
    }

    const existing = this.peers.get(peerId);

    if (existing && existing.stream === stream) {
      this.#keepStreamAlive(peerId, stream);
      return true;
    }

    if (!this.ready) {
      this.pendingStreams.set(peerId, stream);
      this.#keepStreamAlive(peerId, stream);
      return true;
    }

    return this.#attachReadyStream(peerId, stream);
  }

  #attachReadyStream(peerId, stream) {
    if (!this.ready || !stream) {
      this.pendingStreams.set(peerId, stream);
      return false;
    }

    const tracks = stream.getAudioTracks?.() ?? [];

    if (tracks.length === 0) {
      return false;
    }

    const existing = this.peers.get(peerId);

    if (existing) {
      if (existing.stream === stream) {
        return true;
      }

      this.detachRemoteStream(peerId);
    }

    /*
     * Do not evict another participant silently when the configured
     * voice budget is reached. Keep the stream pending instead.
     */
    if (this.peers.size >= this.options.maxVoices) {
      this.pendingStreams.set(peerId, stream);
      this.#keepStreamAlive(peerId, stream);
      return false;
    }

    try {
      const source =
        this.ctx.createMediaStreamSource(stream);

      const filter =
        this.ctx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.value = 19000;
      filter.Q.value = 0.0001;

      const gain = this.ctx.createGain();

      /*
       * Start silent and let update() calculate the spatial gain.
       */
      gain.gain.value = 0;

      const panner =
        this.ctx.createStereoPanner();

      panner.pan.value = 0;

      const analyser =
        this.ctx.createAnalyser();

      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.5;

      source.connect(filter);
      filter.connect(gain);
      gain.connect(panner);
      panner.connect(analyser);
      panner.connect(this.master);

      const peer = {
        id: peerId,
        stream,
        source,
        filter,
        gain,
        panner,
        analyser,
        buffer: new Float32Array(analyser.fftSize),

        /*
         * Position will be populated by setPeerGeometry().
         */
        x: 0,
        y: 0,

        soundFactor: 1,
        gainValue: 0,
        panValue: 0,
        level: 0,
        speaking: false,
        distancePx: Infinity,
      };

      this.peers.set(peerId, peer);
      this.pendingStreams.delete(peerId);

      this.#keepStreamAlive(peerId, stream);

      return true;
    } catch (error) {
      console.error(
        `[SpatialAudioEngine] Could not attach audio for peer ${peerId}:`,
        error,
      );

      this.pendingStreams.set(peerId, stream);

      return false;
    }
  }

  #flushPendingStreams() {
    if (!this.ready || this.pendingStreams.size === 0) {
      return;
    }

    for (const [peerId, stream] of [
      ...this.pendingStreams.entries(),
    ]) {
      if (!stream || stream.active === false) {
        this.pendingStreams.delete(peerId);
        continue;
      }

      if (this.peers.has(peerId)) {
        this.pendingStreams.delete(peerId);
        continue;
      }

      if (this.peers.size >= this.options.maxVoices) {
        break;
      }

      this.#attachReadyStream(peerId, stream);
    }
  }

  /**
   * Keep the remote MediaStream attached to a media element as a
   * compatibility fallback for browsers that need media-element playback.
   *
   * The element is muted to prevent duplicate playback; audible output
   * is routed through the spatial Web Audio graph.
   */
  #keepStreamAlive(peerId, stream) {
    let element = this.mediaElements.get(peerId);

    if (element && element.srcObject === stream) {
      return;
    }

    if (element) {
      element.pause?.();
      element.srcObject = null;
      element.remove?.();
    }

    element = document.createElement('audio');
    element.dataset.peerId = String(peerId);
    element.srcObject = stream;
    element.muted = true;
    element.autoplay = true;
    element.playsInline = true;

    /*
     * Playback failure is not fatal: the actual audible signal is
     * routed through the Web Audio graph above.
     */
    const playPromise = element.play();

    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        // Autoplay may be blocked; init()/resume() handles Web Audio.
      });
    }

    this.mediaElements.set(peerId, element);
  }

  detachRemoteStream(peerId) {
    this.pendingStreams.delete(peerId);

    const peer = this.peers.get(peerId);

    if (peer) {
      try {
        peer.source.disconnect();
      } catch {
        // Already disconnected.
      }

      try {
        peer.filter.disconnect();
      } catch {
        // Already disconnected.
      }

      try {
        peer.gain.disconnect();
      } catch {
        // Already disconnected.
      }

      try {
        peer.panner.disconnect();
      } catch {
        // Already disconnected.
      }

      try {
        peer.analyser.disconnect();
      } catch {
        // Already disconnected.
      }

      this.peers.delete(peerId);
    }

    const element = this.mediaElements.get(peerId);

    if (element) {
      try {
        element.pause();
      } catch {
        // Ignore media-element cleanup errors.
      }

      element.srcObject = null;
      element.remove();

      this.mediaElements.delete(peerId);
    }

    this.#flushPendingStreams();
  }

  setPeerGeometry(peerId, position = {}) {
    const peer = this.peers.get(peerId);

    if (!peer) {
      return;
    }

    const x = Number(position.x);
    const y = Number(position.y);

    if (Number.isFinite(x)) {
      peer.x = x;
    }

    if (Number.isFinite(y)) {
      peer.y = y;
    }
  }

  setPeerOcclusion(peerId, soundFactor) {
    const peer = this.peers.get(peerId);

    if (!peer) {
      return;
    }

    const factor = Number(soundFactor);

    if (Number.isFinite(factor)) {
      peer.soundFactor = clamp(factor, 0, 1);
    }
  }

  /**
   * Called by the world render loop.
   */
  update(timestampMs = this.now()) {
    if (!this.ready) {
      return;
    }

    if (this.ctx.state === 'suspended') {
      /*
       * Do not repeatedly call resume() from the animation loop.
       * Resume is triggered by init() or an explicit user gesture.
       */
      return;
    }

    const interval = this.options.updateIntervalMs;

    if (timestampMs - this.lastUpdate < interval) {
      return;
    }

    this.lastUpdate = timestampMs;

    /*
     * AudioParam timestamps must use AudioContext.currentTime,
     * which is measured in seconds, not RAF milliseconds.
     */
    const audioTime = this.ctx.currentTime;

    for (const peer of this.peers.values()) {
      const dx = peer.x - this.listener.x;
      const dy = peer.y - this.listener.y;

      const distancePx = Math.hypot(dx, dy);

      const gainValue = gainAtDistance(distancePx, {
        earshotPx: this.options.earshotPx,
        fullVolumePx: this.options.fullVolumePx,
        soundFactor: peer.soundFactor,
      });

      const panValue = panAtDistance({
        dx,
        dy,
        distancePx,
        listenerAngle: this.listener.angle,
        earshotPx: this.options.earshotPx,
      });

      const cutoff = lowpassFor({
        distancePx,
        earshotPx: this.options.earshotPx,
        soundFactor: peer.soundFactor,
      });

      peer.gain.gain.setTargetAtTime(
        gainValue,
        audioTime,
        0.04,
      );

      peer.panner.pan.setTargetAtTime(
        panValue,
        audioTime,
        0.04,
      );

      peer.filter.frequency.setTargetAtTime(
        cutoff,
        audioTime,
        0.08,
      );

      peer.gainValue = gainValue;
      peer.panValue = panValue;
      peer.distancePx = distancePx;

      peer.analyser.getFloatTimeDomainData(
        peer.buffer,
      );

      peer.level = rms(peer.buffer);

      const speaking =
        peer.level > this.options.speakingThreshold &&
        gainValue > 0.01;

      if (speaking !== peer.speaking) {
        peer.speaking = speaking;
        this.onSpeakingChange?.(peer.id, speaking);
      }
    }
  }

  getLevel(peerId) {
    return this.peers.get(peerId)?.level ?? 0;
  }

  isAudible(peerId) {
    const peer = this.peers.get(peerId);

    return Boolean(
      peer &&
      peer.gainValue > 0.01 &&
      !this.muted &&
      this.masterVolume > 0,
    );
  }

  now() {
    return this.ctx
      ? this.ctx.currentTime * 1000
      : performance.now();
  }

  dispose() {
    this.disposed = true;

    for (const peerId of [
      ...new Set([
        ...this.peers.keys(),
        ...this.pendingStreams.keys(),
        ...this.mediaElements.keys(),
      ]),
    ]) {
      this.detachRemoteStream(peerId);
    }

    this.#disconnectLocalNodes();

    try {
      this.master?.disconnect();
    } catch {
      // Already disconnected.
    }

    const context = this.ctx;

    this.ctx = null;
    this.master = null;
    this.localStream = null;
    this.lastUpdate = 0;

    if (context && context.state !== 'closed') {
      context.close().catch(() => {});
    }
  }
}

export default SpatialAudioEngine;