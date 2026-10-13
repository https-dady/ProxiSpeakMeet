/**
 * Spatial Audio Mixer (Week 3 + 4).
 *
 * Per remote peer the engine builds one branch of the Web Audio graph:
 *
 *   MediaStreamAudioSourceNode
 *        -> BiquadFilterNode (lowpass: air absorption + wall occlusion)
 *        -> GainNode         (distance roll-off x occlusion factor)
 *        -> StereoPannerNode (left/right ear, relative to facing direction)
 *        -> master GainNode -> AudioContext.destination
 *             \-> AnalyserNode (local speaking ring, never leaves the browser)
 *
 * Geometry is pushed in from the render loop, but the DSP graph is only touched
 * at UPDATE_INTERVAL_HZ — 60 FPS visuals, 20 Hz audio parameters, no zipper noise.
 */
import { gainAtDistance, panAtDistance, lowpassFor, rms } from './spatialMath.js';

const DEFAULT = {
  earshotPx: 100,
  fullVolumePx: 35,
  updateIntervalMs: 50,
  speakingThreshold: 0.045,
  maxVoices: 12,
};

export class SpatialAudioEngine {
  constructor(options = {}) {
    this.options = { ...DEFAULT, ...options };
    this.ctx = null;
    this.master = null;
    this.localStream = null;
    this.listener = { x: 0, y: 0, angle: 0 };
    this.peers = new Map();
    this.mediaElements = new Map();
    this.muted = false;
    this.masterVolume = 1;
    this.lastUpdate = 0;
    this.onSpeakingChange = null;
  }

  get ready() {
    return Boolean(this.ctx && this.ctx.state !== 'closed');
  }

  /** Must be called from a user gesture (browser autoplay policy). */
  async init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return this.ctx;
    }
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) throw new Error('Web Audio API is not available in this browser');
    this.ctx = new AudioContextCtor({ latencyHint: 'interactive' });
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.masterVolume;
    this.master.connect(this.ctx.destination);
    return this.ctx;
  }

  /** Local microphone: monitored only through an AnalyserNode, never played back. */
  async setLocalStream(stream) {
    await this.init();
    this.localStream = stream;
    this.localSource = this.ctx.createMediaStreamSource(stream);
    this.localAnalyser = this.ctx.createAnalyser();
    this.localAnalyser.fftSize = 512;
    this.localAnalyser.smoothingTimeConstant = 0.6;
    this.localSource.connect(this.localAnalyser); // analyser output is discarded on purpose
    this.localBuffer = new Float32Array(this.localAnalyser.fftSize);
    return stream;
  }

  getLocalLevel() {
    if (!this.localAnalyser) return 0;
    this.localAnalyser.getFloatTimeDomainData(this.localBuffer);
    return rms(this.localBuffer);
  }

  get isSpeaking() {
    return this.getLocalLevel() > this.options.speakingThreshold;
  }

  setLocalMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : this.masterVolume, this.now(), 0.05);
  }

  setMasterVolume(value) {
    this.masterVolume = Math.max(0, Math.min(1, value));
    if (this.master && !this.muted) this.master.gain.setTargetAtTime(this.masterVolume, this.now(), 0.05);
  }

  setListener({ x, y, angle }) {
    this.listener.x = x;
    this.listener.y = y;
    this.listener.angle = angle;
  }

  /**
   * Attach (or replace) a remote WebRTC stream.
   * @returns {boolean} false when the voice budget is exhausted
   */
  attachRemoteStream(peerId, stream) {
    if (!stream || !this.ctx) return false;
    const existing = this.peers.get(peerId);
    if (existing && existing.stream === stream) return true;
    if (existing) this.detachRemoteStream(peerId);

    if (this.peers.size >= this.options.maxVoices) {
      const oldest = this.peers.keys().next().value;
      this.detachRemoteStream(oldest);
    }

    const source = this.ctx.createMediaStreamSource(stream);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 19000;
    filter.Q.value = 0.0001;

    const gain = this.ctx.createGain();
    gain.gain.value = 0;

    const panner = this.ctx.createStereoPanner();
    panner.pan.value = 0;

    const analyser = this.ctx.createAnalyser();
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
      x: 0,
      y: 0,
      soundFactor: 1,
      gainValue: 0,
      panValue: 0,
      level: 0,
      speaking: false,
    };
    this.peers.set(peerId, peer);
    this.#keepStreamAlive(peerId, stream);
    return true;
  }

  /**
   * Firefox and Safari only pump a remote MediaStream into Web Audio while it
   * is also attached to a (silent) media element.
   */
  #keepStreamAlive(peerId, stream) {
    if (this.mediaElements.has(peerId)) return;
    const element = document.createElement('audio');
    element.srcObject = stream;
    element.muted = true;
    element.autoplay = true;
    element.playsInline = true;
    element.play().catch(() => {});
    this.mediaElements.set(peerId, element);
  }

  detachRemoteStream(peerId) {
    const peer = this.peers.get(peerId);
    if (peer) {
      try {
        peer.source.disconnect();
        peer.filter.disconnect();
        peer.gain.disconnect();
        peer.panner.disconnect();
        peer.analyser.disconnect();
        peer.source.stop?.();
      } catch {
        /* already torn down */
      }
      this.peers.delete(peerId);
    }
    const element = this.mediaElements.get(peerId);
    if (element) {
      element.pause?.();
      element.srcObject = null;
      element.remove?.();
      this.mediaElements.delete(peerId);
    }
  }

  setPeerGeometry(peerId, { x, y }) {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.x = x;
      peer.y = y;
    }
  }

  setPeerOcclusion(peerId, soundFactor) {
    const peer = this.peers.get(peerId);
    if (peer) peer.soundFactor = soundFactor;
  }

  /** Called once per animation frame; throttles the actual DSP work. */
  update(timestampMs = this.now()) {
    if (!this.ctx) return;
    const interval = this.options.updateIntervalMs;
    if (timestampMs - this.lastUpdate < interval) return;
    this.lastUpdate = timestampMs;
    const now = timestampMs / 1000;

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
      const cutoff = lowpassFor({ distancePx, earshotPx: this.options.earshotPx, soundFactor: peer.soundFactor });

      // setTargetAtTime gives a click-free glide instead of stepped jumps.
      peer.gain.gain.setTargetAtTime(gainValue, now, 0.04);
      peer.panner.pan.setTargetAtTime(panValue, now, 0.04);
      peer.filter.frequency.setTargetAtTime(cutoff, now, 0.08);

      peer.gainValue = gainValue;
      peer.panValue = panValue;
      peer.distancePx = distancePx;

      peer.analyser.getFloatTimeDomainData(peer.buffer);
      peer.level = rms(peer.buffer);
      const speaking = peer.level > this.options.speakingThreshold && gainValue > 0.01;
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
    return Boolean(peer && peer.gainValue > 0.01);
  }

  now() {
    return this.ctx ? this.ctx.currentTime * 1000 : performance.now();
  }

  dispose() {
    for (const peerId of [...this.peers.keys()]) this.detachRemoteStream(peerId);
    try {
      this.localSource?.disconnect();
      this.master?.disconnect();
      this.ctx?.close();
    } catch {
      /* noop */
    }
    this.ctx = null;
    this.master = null;
  }
}

export default SpatialAudioEngine;