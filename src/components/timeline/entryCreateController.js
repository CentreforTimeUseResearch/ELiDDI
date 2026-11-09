import { clampCreateSpan, getNowLimitOffsetMins } from './createSpan';

// how long a touch must rest on empty time before it starts painting a block;
// moving before then reads as a scroll, so the create gesture never takes a
// scroll away from the Respondent
const TOUCH_HOLD_MS = 150;
const TOUCH_CANCEL_DISTANCE_PX = 10;

// Owns the press -> drag -> release gesture that paints a new Entry on empty
// time (docs/design/flows/create-entry.md). It only works out the span and
// shows the provisional block; nothing reaches the store here. On release it
// hands the span to onCreate, and the host opens the details panel.
//
// A press that never leaves its 10-minute slot is a plain click or tap, which
// this controller leaves entirely to the host's click handler (a 30-minute
// block). Pointer capture is taken only once a drag has begun, so the click
// of a plain press still lands on the element that was pressed.
export class EntryCreateController {
  candidate; // { pointerId, pointerType, anchorMins, startX, startY, armed } while a press on empty time is pending
  holdTimer;
  activeDrag; // { pointerId, anchorMins, span, captureElement } while painting
  suppressNextClick = false; // set after a drag, so the click it also fires doesn't make a second block
  suppressClickResetTimer;
  escapedPointerId; // a drag cancelled with Escape: its pointer is ignored until it is released

  constructor({
    svg,
    preview,
    getEntries,
    isSingleChoiceDimension,
    getCurrentDate,
    clientToSvgCoord,
    calculateTheTimeSlotClicked,
    onCreate,
  }) {
    this.svg = svg;
    this.preview = preview;
    this.getEntries = getEntries;
    this.isSingleChoiceDimension = isSingleChoiceDimension;
    this.getCurrentDate = getCurrentDate;
    this.clientToSvgCoord = clientToSvgCoord;
    this.calculateTheTimeSlotClicked = calculateTheTimeSlotClicked;
    this.onCreate = onCreate;
  }

  onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) {
      return;
    }
    // only empty time starts a block: an Entry, a resize handle or the
    // mirror strip have their own gestures
    if (e.target?.dataset?.part !== 'gridline-zone') {
      return;
    }
    this.cancelCandidate();
    const isTouch = e.pointerType === 'touch';
    this.candidate = {
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      anchorMins: this.slotAt(e),
      startX: e.clientX,
      startY: e.clientY,
      armed: !isTouch,
    };
    if (isTouch) {
      this.holdTimer = setTimeout(() => {
        if (this.candidate) {
          this.candidate.armed = true;
        }
      }, TOUCH_HOLD_MS);
    }
  }

  onPointerMove(e) {
    if (e.pointerId === this.escapedPointerId) {
      return;
    }
    if (this.activeDrag && e.pointerId === this.activeDrag.pointerId) {
      // the stack may scroll under a touch drag; touch-action and the host's
      // touchmove handler are the main defence, this is the fallback
      e.preventDefault?.();
      this.updateSpan(this.slotAt(e));
      return;
    }
    const candidate = this.candidate;
    if (!candidate || e.pointerId !== candidate.pointerId) {
      return;
    }
    if (!candidate.armed) {
      const moved = Math.hypot(e.clientX - candidate.startX, e.clientY - candidate.startY);
      if (moved > TOUCH_CANCEL_DISTANCE_PX) {
        this.cancelCandidate(); // a scroll, not a create
      }
      return;
    }
    const slot = this.slotAt(e);
    if (slot !== candidate.anchorMins) {
      this.startDrag(e, candidate);
      this.updateSpan(slot);
    }
  }

  handlePointerUp(e) {
    if (e.pointerId === this.escapedPointerId) {
      // the click that ends an Escaped drag must not make a block either
      this.escapedPointerId = undefined;
      this.suppressClicks();
      return;
    }
    if (this.activeDrag && e.pointerId === this.activeDrag.pointerId) {
      this.commitDrag();
      return;
    }
    if (this.candidate && e.pointerId === this.candidate.pointerId) {
      this.cancelCandidate(); // a plain click: the host's click handler takes it from here
    }
  }

  handlePointerCancel(e) {
    if (this.activeDrag && e.pointerId === this.activeDrag.pointerId) {
      this.cancelDrag();
      return;
    }
    if (this.candidate && e.pointerId === this.candidate.pointerId) {
      this.cancelCandidate();
    }
  }

  handleGlobalKeyDown(e) {
    if (e.key === 'Escape' && this.activeDrag) {
      this.escapedPointerId = this.activeDrag.pointerId;
      this.cancelDrag();
    }
  }

  // a touch that has been held long enough, or is painting, must not also scroll
  handleTouchMove(e) {
    if (this.activeDrag || this.candidate?.armed) {
      e.preventDefault();
    }
  }

  // the click that follows the pointerup of a drag must not also make a
  // plain-click block; checked once per click, and self-resetting
  consumeSuppressedClick() {
    if (!this.suppressNextClick) {
      return false;
    }
    this.suppressNextClick = false;
    return true;
  }

  // when the host disconnects: abandons any gesture without creating anything
  destroy() {
    this.cancelCandidate();
    this.endDrag();
    this.preview.hide();
    clearTimeout(this.suppressClickResetTimer);
    this.suppressNextClick = false;
    this.escapedPointerId = undefined;
  }

  slotAt(e) {
    const coord = this.clientToSvgCoord(e.clientX, e.clientY);
    return this.calculateTheTimeSlotClicked(coord >= 0 ? coord : 0);
  }

  startDrag(e, candidate) {
    this.cancelCandidate();
    try {
      e.target?.setPointerCapture?.(e.pointerId);
    } catch {
      // best-effort: the listeners on the SVG still track the drag without it
    }
    // whole-SVG touch-action:none for the drag's duration - see timeline.css
    this.svg?.classList.add('dragging-handle');
    this.activeDrag = {
      pointerId: e.pointerId,
      anchorMins: candidate.anchorMins,
      span: undefined,
      captureElement: e.target,
    };
  }

  updateSpan(currentMins) {
    const drag = this.activeDrag;
    const span = clampCreateSpan({
      anchorMins: drag.anchorMins,
      currentMins,
      entries: this.getEntries(),
      singleChoice: this.isSingleChoiceDimension(),
      nowLimitMins: getNowLimitOffsetMins(this.getCurrentDate()),
    });
    drag.span = span ?? undefined;
    if (span) {
      this.preview.show(span);
    } else {
      this.preview.hide();
    }
  }

  commitDrag() {
    const span = this.activeDrag?.span;
    this.endDrag();
    this.suppressClicks();
    if (span) {
      this.onCreate(span);
    } else {
      this.preview.hide();
    }
  }

  // an interrupted drag (pointercancel) or Escape: nothing is created. No
  // click follows a pointercancel; after Escape the pointer is still down,
  // and handlePointerUp swallows its click
  cancelDrag() {
    this.endDrag();
    this.preview.hide();
  }

  endDrag() {
    const drag = this.activeDrag;
    this.activeDrag = undefined;
    if (!drag) {
      return;
    }
    try {
      drag.captureElement?.releasePointerCapture?.(drag.pointerId);
    } catch {
      // already released (e.g. by the browser on pointerup)
    }
    this.svg?.classList.remove('dragging-handle');
  }

  cancelCandidate() {
    clearTimeout(this.holdTimer);
    this.holdTimer = undefined;
    this.candidate = undefined;
  }

  // the click that ends this same press arrives right after the pointerup;
  // the timer is a fallback so a click that never comes can't leave the flag
  // set and swallow an unrelated later one
  suppressClicks() {
    this.suppressNextClick = true;
    clearTimeout(this.suppressClickResetTimer);
    this.suppressClickResetTimer = setTimeout(() => {
      this.suppressNextClick = false;
    }, 0);
  }
}
