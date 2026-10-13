/** Small dependency-free token bucket used to throttle socket events. */
export class TokenBucket {
  constructor({ capacity, refillPerSec }) {
    this.capacity = capacity;
    this.refillPerSec = refillPerSec;
    this.tokens = capacity;
    this.last = Date.now();
  }

  /** @returns {boolean} true when the event is allowed to proceed. */
  take(now = Date.now()) {
    const elapsedSeconds = Math.max(0, now - this.last) / 1000;
    this.last = now;
    this.tokens = Math.min(this.capacity, this.tokens + elapsedSeconds * this.refillPerSec);
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}