// Scrolls a horizontally-scrolling container while a drag is held near one of
// its edges, so a Respondent can drag a handle (or an Entry) to a time that
// is not currently on screen. A plain helper owned by DragSession: it knows
// nothing about Entries or time, only the container, the pointer's clientX
// and a callback to run after each scroll step (DragSession uses it to
// recompute the drag at the same, now-moved, pointer position).
export const EDGE_ZONE_PX = 56; // how close to an edge scrolling begins
export const MAX_SPEED_PX_PER_SEC = 900; // at the very edge, or beyond it
export const REDUCED_MOTION_SPEED_PX_PER_SEC = 300;
export const DWELL_MS = 200; // in the zone this long before scrolling starts

// signed scroll speed (px/s, negative = towards the start) for a pointer at
// clientX, given the visible span [minX, maxX] of the container. Speed grows
// linearly with how far into the zone the pointer is.
export function edgeScrollSpeed(clientX, minX, maxX, maxSpeed = MAX_SPEED_PX_PER_SEC) {
  const zone = Math.min(EDGE_ZONE_PX, (maxX - minX) / 2);
  if (zone <= 0) {
    return 0;
  }
  if (clientX < minX + zone) {
    return -maxSpeed * Math.min(1, (minX + zone - clientX) / zone);
  }
  if (clientX > maxX - zone) {
    return maxSpeed * Math.min(1, (clientX - (maxX - zone)) / zone);
  }
  return 0;
}

export class AutoScroller {
  constructor({
    getScroller, // () => the scrolling element, or undefined (nothing to scroll)
    getInsets = () => ({ left: 0, right: 0 }), // px of the scroller covered at each side (sticky gutter)
    onScrolled, // () => void, after each step that moved the container
    raf = (cb) => requestAnimationFrame(cb),
    caf = (id) => cancelAnimationFrame(id),
    now = () => performance.now(),
    prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches,
  }) {
    Object.assign(this, {
      getScroller,
      getInsets,
      onScrolled,
      raf,
      caf,
      now,
      prefersReducedMotion,
    });
    this.frame = undefined;
  }

  get running() {
    return this.frame !== undefined;
  }

  // call at the start of a drag
  start(clientX) {
    this.stop();
    this.scroller = this.getScroller();
    if (!this.scroller) {
      return;
    }
    this.clientX = clientX;
    this.enteredZoneAt = undefined;
    this.lastTime = this.now();
    this.frame = this.raf(() => this.tick());
  }

  // call on each pointermove
  update(clientX) {
    this.clientX = clientX;
  }

  stop() {
    if (this.frame !== undefined) {
      this.caf(this.frame);
    }
    this.frame = undefined;
    this.scroller = undefined;
  }

  tick() {
    if (!this.scroller) {
      return;
    }
    const time = this.now();
    const elapsed = Math.min(time - this.lastTime, 50); // a stalled frame must not jump
    this.lastTime = time;
    const rect = this.scroller.getBoundingClientRect();
    const { left, right } = this.getInsets();
    const speed = edgeScrollSpeed(
      this.clientX,
      rect.left + left,
      rect.right - right,
      this.prefersReducedMotion() ? REDUCED_MOTION_SPEED_PX_PER_SEC : MAX_SPEED_PX_PER_SEC
    );
    if (speed === 0) {
      this.enteredZoneAt = undefined;
    } else {
      this.enteredZoneAt ??= time;
      if (time - this.enteredZoneAt >= DWELL_MS) {
        const before = this.scroller.scrollLeft;
        this.scroller.scrollLeft = before + (speed * elapsed) / 1000;
        if (this.scroller.scrollLeft !== before) {
          this.onScrolled();
        }
      }
    }
    this.frame = this.raf(() => this.tick());
  }
}
