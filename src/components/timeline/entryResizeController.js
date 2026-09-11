import {
  formatOffsetAsClockTime,
  getCurrentOffsetMins,
  getCurrentDiaryDateKey,
} from '../../utils/time';
import { SVGNS, PX_PER_MINUTE, MINUTES_PER_DAY } from './timelineConstants';

const LONG_PRESS_MS = 500;
const LONG_PRESS_CANCEL_DISTANCE_PX = 10; // pointer movement past this before the timer fires reads as a scroll/mis-tap, not a long-press
const HANDLE_HIT_RADIUS = 22; // ~44px hit target (WCAG target-size guidance), independent of the visible grip size
const HANDLE_GRIP_RADIUS = 6;
const MIN_ENTRY_DURATION_MINS = 10; // one slot - the shortest a drag can resize an entry to
const LIMIT_FLASH_MS = 300;

// Owns the long-press -> reveal handles -> drag -> live-resize -> commit/cancel
// pipeline for a Timeline's entries. Pulled out of Timeline because this
// pipeline runs almost entirely on its own state (activeDrag,
// activeHandleEntryId, the pending long-press) and only needs to reach back
// into its host Timeline at the one point a resize becomes a real store
// update - see onCommitResize.
export class EntryResizeController {
  activeHandleEntryId;
  activeDrag; // { entryId, edge, pointerId, currentStart, currentEnd, captureElement, previousNeighborEnd, nextNeighborStart, wasAtLimit } while a handle is being dragged
  longPressTimer;
  longPressCandidate; // { entryId, pointerId, startX, startY } while a press is pending
  suppressNextClick = false; // set when a long-press fires, so the click it also triggers doesn't open the panel
  limitFlashTimer;

  constructor({
    svg,
    entriesLayer,
    handlesLayer,
    getEntries,
    isSingleChoiceDimension,
    getCurrentDate,
    isPanelOpen,
    clientYToSvgY,
    calculateTheTimeSlotClicked,
    onCommitResize,
  }) {
    this.svg = svg;
    this.entriesLayer = entriesLayer;
    this.handlesLayer = handlesLayer;
    this.getEntries = getEntries;
    this.isSingleChoiceDimension = isSingleChoiceDimension;
    this.getCurrentDate = getCurrentDate;
    this.isPanelOpen = isPanelOpen;
    this.clientYToSvgY = clientYToSvgY;
    this.calculateTheTimeSlotClicked = calculateTheTimeSlotClicked;
    this.onCommitResize = onCommitResize;
  }

  // long-press detection - a press held on an entry (never on the read-only
  // shadow/mirror strip) without moving far, for long enough, reveals resize
  // handles instead of the click that would otherwise open the details panel
  onEntryPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) {
      return;
    }
    const handleGroup = e.target?.closest?.('.resize-handle');
    if (handleGroup) {
      this.startHandleDrag(e, handleGroup);
      return;
    }
    const entryIdRaw = e.target?.dataset?.id;
    if (entryIdRaw === undefined || !this.entriesLayer?.contains(e.target)) {
      // no entry under the pointer, or it's on the shadow/mirror strip -
      // never a long-press candidate
      return;
    }
    if (this.isPanelOpen()) {
      // the details panel is open (for this entry or any other) - long-press
      // is a no-op while it is, to keep a typed edit and a live drag from
      // ever being in flight at the same time
      return;
    }
    this.longPressCandidate = {
      entryId: Number(entryIdRaw),
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
    };
    this.longPressTimer = setTimeout(() => this.onLongPressFire(), LONG_PRESS_MS);
  }

  onEntryPointerMove(e) {
    if (this.activeDrag && e.pointerId === this.activeDrag.pointerId) {
      // touch-action:none on the handle/SVG (see startHandleDrag and
      // timeline.css) should already stop the scrollable timeline stack
      // from panning during this drag, but SVG shape elements have a long
      // history of unreliable touch-action support on their own - this is
      // the reliable fallback, independent of that CSS support level
      e.preventDefault?.();
      this.updateDragToSvgY(this.clientYToSvgY(e.clientX, e.clientY));
      return;
    }
    if (!this.longPressCandidate || e.pointerId !== this.longPressCandidate.pointerId) {
      return;
    }
    const dx = e.clientX - this.longPressCandidate.startX;
    const dy = e.clientY - this.longPressCandidate.startY;
    if (Math.hypot(dx, dy) > LONG_PRESS_CANCEL_DISTANCE_PX) {
      // moved too far before the hold completed - read as a scroll/mis-tap,
      // not a long-press
      this.cancelPendingLongPress();
    }
  }

  handlePointerUp(e) {
    if (this.activeDrag && e.pointerId === this.activeDrag.pointerId) {
      this.commitDrag();
      return;
    }
    this.cancelPendingLongPress();
    if (this.suppressNextClick) {
      // normally consumed by the 'click' this same press also fires
      // right after this - fallback in case that click never arrives
      // (e.g. the element moves before it does), so a stuck flag can't
      // swallow an unrelated later click
      setTimeout(() => {
        this.suppressNextClick = false;
      }, 0);
    }
  }

  handlePointerCancel(e) {
    if (this.activeDrag && e.pointerId === this.activeDrag.pointerId) {
      this.cancelDrag();
      return;
    }
    this.cancelPendingLongPress();
  }

  // belt-and-braces against the scrollable timeline stack panning during a
  // touch drag (see timelineStack.css's overflow-y: auto). touch-action:none
  // (on the handle, and for the drag's duration the whole SVG - see
  // startHandleDrag/timeline.css) is the primary defense, but freshly-
  // inserted SVG shape elements have a documented history of Chromium
  // sometimes not honouring it on the very first touch that lands on them
  // (the compositor's touch-action hit regions can be a frame stale right
  // after a DOM insert) - a genuine non-passive touchstart/touchmove
  // preventDefault() forces main-thread arbitration and is honoured
  // unconditionally regardless of that
  handleTouchStart(e) {
    if (e.target?.closest?.('.resize-handle')) {
      e.preventDefault();
    }
  }

  handleTouchMove(e) {
    if (this.activeDrag) {
      e.preventDefault();
    }
  }

  handleGlobalKeyDown(e) {
    if (e.key !== 'Escape') {
      return;
    }
    if (this.activeDrag) {
      this.cancelDrag();
      return;
    }
    if (this.activeHandleEntryId !== undefined) {
      this.hideHandles();
    }
  }

  // the click that follows the pointerup of a press that just fired a
  // long-press should not also open the details panel - callers (Timeline's
  // click handler) check this once per click and it self-resets
  consumeSuppressedClick() {
    if (!this.suppressNextClick) {
      return false;
    }
    this.suppressNextClick = false;
    return true;
  }

  cancelPendingLongPress() {
    clearTimeout(this.longPressTimer);
    this.longPressTimer = undefined;
    this.longPressCandidate = undefined;
  }

  onLongPressFire() {
    const candidate = this.longPressCandidate;
    this.longPressTimer = undefined;
    this.longPressCandidate = undefined;
    if (!candidate) {
      return;
    }
    const entry = this.getEntries().find((entry) => entry.id === candidate.entryId);
    if (!entry) {
      return;
    }
    this.showHandles(entry);
    // the pointerup that ends this same press still fires a 'click' after
    // this - swallow that one click so it doesn't also open the panel
    this.suppressNextClick = true;
  }

  // starts dragging a handle that's already visible (long-press already
  // fired) - captures the pointer so drag tracking keeps working even if
  // the pointer strays outside the handle's small hit area mid-drag
  startHandleDrag(e, handleGroup) {
    const entryId = Number(handleGroup.dataset.handleEntryId);
    const edge = handleGroup.dataset.handleEdge;
    const entry = this.getEntries().find((entry) => entry.id === entryId);
    if (!entry) {
      return;
    }
    e.preventDefault?.();
    try {
      e.target?.setPointerCapture?.(e.pointerId);
    } catch {
      // pointer capture is best-effort - the delegated listeners on the SVG
      // still track the drag correctly without it in the common case
    }
    // stops the scrollable timeline stack (see timelineStack.css) from
    // panning under a touch drag - see the pointermove preventDefault() in
    // onEntryPointerMove for why this alone isn't relied on
    this.svg?.classList.add('dragging-handle');
    // fixed for the whole drag, rather than recomputed as the pointer moves
    // past other entries - "the adjacent entry" means this entry's immediate
    // temporal neighbors as they stood when the drag started
    const neighborBounds = this.isSingleChoiceDimension()
      ? this.findNeighborBounds(entry)
      : { previousEnd: 0, nextStart: MINUTES_PER_DAY };
    this.activeDrag = {
      entryId,
      edge,
      pointerId: e.pointerId,
      currentStart: entry.startOffsetMins,
      currentEnd: entry.endOffsetMins,
      captureElement: e.target,
      previousNeighborEnd: neighborBounds.previousEnd,
      nextNeighborStart: neighborBounds.nextStart,
      wasAtLimit: false,
    };
  }

  // among this entry's timeline siblings, the latest end time at or before
  // this entry's own start, and the earliest start time at or after this
  // entry's own end - the immediate temporal neighbors a drag can't cross
  // in a single-choice dimension (dimensions that already tolerate
  // overlapping entries have no such neighbors to respect)
  findNeighborBounds(entry) {
    const others = this.getEntries().filter((other) => other.id !== entry.id);
    const previousEnd = others
      .filter((other) => other.endOffsetMins <= entry.startOffsetMins)
      .reduce((max, other) => Math.max(max, other.endOffsetMins), 0);
    const nextStart = others
      .filter((other) => other.startOffsetMins >= entry.endOffsetMins)
      .reduce((min, other) => Math.min(min, other.startOffsetMins), MINUTES_PER_DAY);
    return { previousEnd, nextStart };
  }

  updateDragToSvgY(svgY) {
    if (!this.activeDrag) {
      return;
    }
    const rawOffsetMins = this.calculateTheTimeSlotClicked(svgY >= 0 ? svgY : 0);
    const clampedOffsetMins = this.clampDragOffset(rawOffsetMins);
    const hitLimit = clampedOffsetMins !== rawOffsetMins;
    if (this.activeDrag.edge === 'start') {
      this.activeDrag.currentStart = clampedOffsetMins;
    } else {
      this.activeDrag.currentEnd = clampedOffsetMins;
    }
    this.renderDragFeedback();
    // flash once per approach, not on every tick still pressed against the
    // same wall - otherwise holding at a limit reads as a constant strobe
    if (hitLimit && !this.activeDrag.wasAtLimit) {
      this.flashLimitCue();
    }
    this.activeDrag.wasAtLimit = hitLimit;
  }

  // the [min, max] this drag's moving edge may snap to - the day's own
  // bounds, this entry's minimum duration, this entry's fixed neighbors
  // (see startHandleDrag), and, only for the current diary day, "now"
  clampDragOffset(rawOffsetMins) {
    const { min, max } = this.getDragBounds(this.activeDrag);
    return Math.min(Math.max(rawOffsetMins, min), max);
  }

  getDragBounds(drag) {
    // floored to the grid, like every other offset here - otherwise the
    // "now" wall could land on a non-slot minute no other time in the app
    // ever produces
    const nowLimit =
      this.getCurrentDate() === getCurrentDiaryDateKey()
        ? Math.floor(getCurrentOffsetMins() / 10) * 10
        : MINUTES_PER_DAY;
    if (drag.edge === 'start') {
      const min = drag.previousNeighborEnd;
      const max = Math.min(drag.currentEnd - MIN_ENTRY_DURATION_MINS, nowLimit);
      return { min, max: Math.max(max, min) }; // never let max fall below min if there's no room left
    }
    const min = drag.currentStart + MIN_ENTRY_DURATION_MINS;
    const max = Math.min(drag.nextNeighborStart, MINUTES_PER_DAY, nowLimit);
    return { min, max: Math.max(max, min) };
  }

  flashLimitCue() {
    const rect = this.entriesLayer?.querySelector(`rect[data-id="${this.activeDrag.entryId}"]`);
    if (!rect) {
      return;
    }
    rect.classList.remove('resize-limit-flash');
    void rect.offsetWidth; // force reflow so re-adding the class restarts the animation mid-flash
    rect.classList.add('resize-limit-flash');
    clearTimeout(this.limitFlashTimer);
    this.limitFlashTimer = setTimeout(() => {
      rect.classList.remove('resize-limit-flash');
    }, LIMIT_FLASH_MS);
  }

  // live visual feedback while a handle is being dragged: resizes the
  // entry's actual rect/label in place (no store dispatch yet - see
  // commitDrag) and repositions the handles, with a clock-time readout on
  // the one currently being dragged. Updates the existing handle elements'
  // attributes rather than rebuilding them (unlike renderHandles) - this
  // runs on every pointermove, and the handle being dragged holds pointer
  // capture (see startHandleDrag), which is silently lost the instant its
  // element is removed from the DOM, breaking the rest of the drag
  renderDragFeedback() {
    const drag = this.activeDrag;
    if (!drag) {
      return;
    }
    this.updateEntryRectLive(drag);
    this.updateHandlePosition('start', drag.currentStart, drag.edge === 'start');
    this.updateHandlePosition('end', drag.currentEnd, drag.edge === 'end');
  }

  updateHandlePosition(edge, offsetMins, showReadout) {
    const group = this.handlesLayer?.querySelector(`.resize-handle[data-handle-edge="${edge}"]`);
    if (!group) {
      return;
    }
    const cy = offsetMins * PX_PER_MINUTE;
    group.querySelectorAll('circle').forEach((circle) => circle.setAttributeNS(null, 'cy', cy));
    let readout = group.querySelector('.resize-handle-readout');
    if (!showReadout) {
      readout?.remove();
      return;
    }
    if (!readout) {
      const cx = group.querySelector('.resize-handle-hit-area')?.getAttribute('cx');
      readout = document.createElementNS(SVGNS, 'text');
      readout.setAttribute('class', 'resize-handle-readout');
      readout.setAttributeNS(null, 'x', Number(cx) + HANDLE_HIT_RADIUS + 6);
      readout.setAttribute('dominant-baseline', 'middle');
      group.appendChild(readout);
    }
    readout.setAttributeNS(null, 'y', cy);
    readout.textContent = formatOffsetAsClockTime(offsetMins);
  }

  updateEntryRectLive({ entryId, currentStart, currentEnd }) {
    const rect = this.entriesLayer?.querySelector(`rect[data-id="${entryId}"]`);
    if (!rect) {
      return;
    }
    const startOffsetPx = currentStart * PX_PER_MINUTE;
    const endOffsetPx = currentEnd * PX_PER_MINUTE;
    const height = endOffsetPx - startOffsetPx;
    rect.setAttributeNS(null, 'y', startOffsetPx);
    rect.setAttributeNS(null, 'height', height > 0 ? height : 20);
    const foreignObject = rect.parentElement?.querySelector('foreignObject');
    if (foreignObject) {
      foreignObject.setAttributeNS(null, 'y', startOffsetPx);
      foreignObject.setAttributeNS(null, 'height', height > 0 ? height : 20);
    }
  }

  // asks the host Timeline to turn this drag into a real store update -
  // onCommitResize looks up the entry, dispatches, re-renders the entries
  // layer, and hands back the post-dispatch entry (or undefined if it's
  // gone) so this controller knows whether to keep showing handles
  commitDrag() {
    const drag = this.activeDrag;
    this.activeDrag = undefined;
    if (!drag) {
      return;
    }
    this.releaseDragCapture(drag);
    this.svg?.classList.remove('dragging-handle');
    const updatedEntry = this.onCommitResize(drag.entryId, {
      startOffsetMins: drag.currentStart,
      endOffsetMins: drag.currentEnd,
    });
    if (updatedEntry) {
      // handles stay up, re-draggable, at the just-committed position -
      // no need to re-trigger long-press for a follow-up adjustment
      this.showHandles(updatedEntry);
    } else {
      this.hideHandles();
    }
  }

  // an interrupted drag (pointercancel) or Escape mid-drag - nothing was
  // ever dispatched, so this only has to undo the live visual feedback
  cancelDrag() {
    const drag = this.activeDrag;
    this.activeDrag = undefined;
    if (!drag) {
      return;
    }
    this.releaseDragCapture(drag);
    this.svg?.classList.remove('dragging-handle');
    const entry = this.getEntries().find((entry) => entry.id === drag.entryId);
    if (!entry) {
      this.hideHandles();
      return;
    }
    this.updateEntryRectLive({
      entryId: drag.entryId,
      currentStart: entry.startOffsetMins,
      currentEnd: entry.endOffsetMins,
    });
    this.showHandles(entry);
  }

  releaseDragCapture(drag) {
    try {
      drag.captureElement?.releasePointerCapture?.(drag.pointerId);
    } catch {
      // already released (e.g. by the browser on pointerup) - nothing to do
    }
  }

  showHandles(entry) {
    this.activeHandleEntryId = entry.id;
    this.renderHandles(entry);
  }

  hideHandles() {
    this.activeHandleEntryId = undefined;
    this.activeDrag = undefined;
    if (this.handlesLayer) {
      this.handlesLayer.innerHTML = '';
    }
  }

  hideHandlesIfActiveFor(entryId) {
    if (this.activeHandleEntryId === entryId) {
      this.hideHandles();
    }
  }

  renderHandles(entry, { activeEdge } = {}) {
    this.handlesLayer.innerHTML = '';
    const startOffsetPx = (entry.startOffsetMins || 0) * PX_PER_MINUTE;
    const endOffsetPx = (entry.endOffsetMins || 0) * PX_PER_MINUTE;
    const centerX = 100 + 220 / 2; // matches the entriesLayer block's x="100" width="220"
    this.handlesLayer.appendChild(
      this.createHandle({
        edge: 'start',
        cx: centerX,
        cy: startOffsetPx,
        entryId: entry.id,
        showReadout: activeEdge === 'start',
        offsetMins: entry.startOffsetMins,
      })
    );
    this.handlesLayer.appendChild(
      this.createHandle({
        edge: 'end',
        cx: centerX,
        cy: endOffsetPx,
        entryId: entry.id,
        showReadout: activeEdge === 'end',
        offsetMins: entry.endOffsetMins,
      })
    );
  }

  createHandle({ edge, cx, cy, entryId, showReadout, offsetMins }) {
    const group = document.createElementNS(SVGNS, 'g');
    group.setAttribute('class', 'resize-handle');
    group.setAttribute('data-handle-edge', edge);
    group.setAttribute('data-handle-entry-id', entryId);

    const hitArea = document.createElementNS(SVGNS, 'circle');
    hitArea.setAttributeNS(null, 'cx', cx);
    hitArea.setAttributeNS(null, 'cy', cy);
    hitArea.setAttributeNS(null, 'r', HANDLE_HIT_RADIUS);
    hitArea.setAttribute('class', 'resize-handle-hit-area');
    group.appendChild(hitArea);

    const grip = document.createElementNS(SVGNS, 'circle');
    grip.setAttributeNS(null, 'cx', cx);
    grip.setAttributeNS(null, 'cy', cy);
    grip.setAttributeNS(null, 'r', HANDLE_GRIP_RADIUS);
    grip.setAttribute('class', 'resize-handle-grip');
    group.appendChild(grip);

    if (showReadout) {
      const readout = document.createElementNS(SVGNS, 'text');
      readout.setAttribute('class', 'resize-handle-readout');
      readout.setAttributeNS(null, 'x', cx + HANDLE_HIT_RADIUS + 6);
      readout.setAttributeNS(null, 'y', cy);
      readout.setAttribute('dominant-baseline', 'middle');
      readout.textContent = formatOffsetAsClockTime(offsetMins);
      group.appendChild(readout);
    }

    return group;
  }
}
