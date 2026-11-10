const LONG_PRESS_MS = 500;
const LONG_PRESS_CANCEL_DISTANCE_PX = 10; // pointer movement past this before the timer fires reads as a scroll/mis-tap, not a long-press

// Recognizes the gestures that begin with a press on an Entry's body
// (docs/design/flows/move-resize.md): a press held without moving far, for
// long enough, is a long-press (`onFired`); a press that moves far is the
// start of a move - at once for a mouse, which has no scroll to confuse it
// with, or after a long-press has fired and the finger stayed down
// (`onMoveStart`). A plain state machine owned by EntryResizeController
// (same pattern as GrabSession for the keyboard): it knows nothing about
// Entries, handles or the SVG - just pointers, distance and time.
//
// onFired(candidate) -> boolean: the owner says whether the press landed on
// a live Entry (it showed the handles). Only then does the still-down
// pointer arm a move.
export class LongPressRecognizer {
  candidate; // { entryId, pointerId, pointerType, startX, startY } while a press is pending
  moveArmed; // same shape, once a long-press has fired and its pointer is still down: moving it now moves the Entry
  timer;

  constructor({ onFired, onMoveStart }) {
    this.onFired = onFired;
    this.onMoveStart = onMoveStart;
  }

  // a press on an Entry the owner has vetted - starts the hold timer
  begin(e, entryId) {
    this.candidate = {
      entryId,
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      startX: e.clientX,
      startY: e.clientY,
    };
    this.timer = setTimeout(() => this.fire(), LONG_PRESS_MS);
  }

  onPointerMove(e) {
    const armed = this.moveArmed;
    if (armed && e.pointerId === armed.pointerId) {
      // a long-press fired and the finger (or button) is still down: moving
      // it now picks the Entry up
      if (
        Math.hypot(e.clientX - armed.startX, e.clientY - armed.startY) >
        LONG_PRESS_CANCEL_DISTANCE_PX
      ) {
        this.startMove(e, armed);
      }
      return;
    }
    if (!this.candidate || e.pointerId !== this.candidate.pointerId) {
      return;
    }
    const candidate = this.candidate;
    const dx = e.clientX - candidate.startX;
    const dy = e.clientY - candidate.startY;
    if (Math.hypot(dx, dy) > LONG_PRESS_CANCEL_DISTANCE_PX) {
      if (candidate.pointerType === 'mouse') {
        // a mouse has no scroll to confuse this with: dragging an Entry
        // moves it, without waiting for a long-press
        this.startMove(e, candidate);
        return;
      }
      // a touch that moved before the hold completed is a scroll/mis-tap,
      // not a long-press
      this.cancelPending();
    }
  }

  // the pointer went up or was cancelled: whatever it was pending or armed
  // for is over
  release(e) {
    if (this.moveArmed?.pointerId === e.pointerId) {
      this.moveArmed = undefined;
    }
    this.cancelPending();
  }

  startMove(e, source) {
    this.cancelPending();
    this.moveArmed = undefined;
    this.onMoveStart(e, source);
  }

  fire() {
    const candidate = this.candidate;
    this.timer = undefined;
    this.candidate = undefined;
    if (!candidate) {
      return;
    }
    if (this.onFired(candidate)) {
      // and if the finger now moves without lifting, that is a move
      this.moveArmed = { ...candidate };
    }
  }

  cancelPending() {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.candidate = undefined;
  }

  // everything, timer included - for the owner's destroy()
  cancel() {
    this.cancelPending();
    this.moveArmed = undefined;
  }
}
