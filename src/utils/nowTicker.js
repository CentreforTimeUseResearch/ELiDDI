// One shared "the clock has moved on" tick for everything that tracks the
// current time at a coarse grain - the future overlays (timeline.js,
// horizontalTimelineAxis.js) and the end-time constraint (timePicker.js).
// Before #254 each rolled its own 30-second setInterval, so a page with the
// vertical stack mounted ran eight of them; now one interval runs while
// anything is subscribed, and none when nothing is.
//
// Subscribers tolerate 30-second granularity and a shared phase (the first
// tick after subscribing may come sooner than 30s, set by whoever
// subscribed first) - they re-derive "now" from the clock on every tick,
// so a tick is never wrong, at worst slightly early.
//
// onHalfMinuteTick(callback) -> unsubscribe, shaped to drop straight into
// TinyBase.registerCleanup().
const TICK_MS = 30000;

const subscribers = new Set();
let intervalId;

export function onHalfMinuteTick(callback) {
  subscribers.add(callback);
  if (subscribers.size === 1) {
    intervalId = setInterval(tick, TICK_MS);
  }
  return () => {
    if (!subscribers.delete(callback)) {
      return; // already unsubscribed - never stops an interval others still need
    }
    if (subscribers.size === 0) {
      clearInterval(intervalId);
      intervalId = undefined;
    }
  };
}

function tick() {
  // a copy, so a callback that unsubscribes (or subscribes) mid-tick
  // doesn't change who this tick reaches
  [...subscribers].forEach((callback) => callback());
}
