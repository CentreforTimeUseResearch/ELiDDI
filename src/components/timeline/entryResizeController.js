import { formatOffsetAsClockTime } from '../../utils/time';
import { SVGNS } from './timelineConstants';
import { computeMove } from './moveSpan';
import { computeResize } from './resizeSpan';
import { getNowLimitOffsetMins } from './createSpan';

// Phase 10.6: which SVG attributes carry "position along the timeline axis"
// vs "fixed cross-axis center" - everything else in this controller already
// operates in minutes, not pixels, so this is the only axis-specific
// knowledge it needs. Timeline (vertical) injects Y_AXIS, HorizontalTimeline
// injects X_AXIS.
const HANDLE_HIT_RADIUS = 22; // ~44px hit target (WCAG target-size guidance), independent of the visible grip size
const HANDLE_GRIP_RADIUS = 6;

// readoutCrossOffset: where the clock-time readout sits across the axis,
// relative to the handle's centre. The vertical Timeline has free space beside
// the handle, so the text starts there. A horizontal row is only ~60px tall,
// so below the handle it would be clipped by the row's SVG: it goes above,
// centred on the handle (text-anchor middle).
export const Y_AXIS = {
  positionAttr: 'y', // rect/foreignObject
  crossAttr: 'x', // rect/foreignObject readout
  sizeAttr: 'height',
  positionCoordAttr: 'cy', // handle circles
  crossCoordAttr: 'cx',
  readoutCrossOffset: HANDLE_HIT_RADIUS + 6,
  readoutAnchor: 'start',
  previousKey: 'ArrowUp', // keyboard: back along the time axis
  nextKey: 'ArrowDown',
};
export const X_AXIS = {
  positionAttr: 'x',
  crossAttr: 'y',
  sizeAttr: 'width',
  positionCoordAttr: 'cx',
  crossCoordAttr: 'cy',
  readoutCrossOffset: -(HANDLE_GRIP_RADIUS + 9),
  readoutAnchor: 'middle',
  previousKey: 'ArrowLeft',
  nextKey: 'ArrowRight',
};

const LONG_PRESS_MS = 500;
const LONG_PRESS_CANCEL_DISTANCE_PX = 10; // pointer movement past this before the timer fires reads as a scroll/mis-tap, not a long-press
const LIMIT_FLASH_MS = 300;

// Owns the long-press -> reveal handles -> drag -> live-resize -> commit/cancel
// pipeline for a Timeline's entries, and the drag of a whole Entry by its body
// (a move: an edge drag with `edge: 'body'`, see startMoveDrag). Pulled out of Timeline because this
// pipeline runs almost entirely on its own state (activeDrag,
// activeHandleEntryId, the pending long-press) and only needs to reach back
// into its host Timeline at the one point a resize becomes a real store
// update - see onCommitResize.
export class EntryResizeController {
  activeHandleEntryId;
  activeDrag; // { entryId, edge, pointerId, currentStart, currentEnd, neighbours, captureElement, wasAtLimit, atLimit } while a handle is being dragged
  longPressTimer;
  longPressCandidate; // { entryId, pointerId, startX, startY } while a press is pending
  suppressNextClick = false; // set when a long-press fires, so the click it also triggers doesn't open the panel
  limitFlashTimer;
  suppressClickResetTimer;
  moveArmed; // { entryId, pointerId, startX, startY } once a long-press has fired and its pointer is still down: moving it now moves the Entry
  ignoredPointerId; // a move cancelled with Escape: its pointer is ignored until it is released

  constructor({
    svg,
    entriesLayer,
    handlesLayer,
    getEntries,
    isSingleChoiceDimension,
    getCurrentDate,
    isPanelOpen,
    clientToSvgCoord,
    calculateTheTimeSlotClicked,
    onCommitResize,
    axis,
    getPxPerMinute,
    crossAxisCenter,
  }) {
    this.svg = svg;
    this.entriesLayer = entriesLayer;
    this.handlesLayer = handlesLayer;
    this.getEntries = getEntries;
    this.isSingleChoiceDimension = isSingleChoiceDimension;
    this.getCurrentDate = getCurrentDate;
    this.isPanelOpen = isPanelOpen;
    this.clientToSvgCoord = clientToSvgCoord;
    this.calculateTheTimeSlotClicked = calculateTheTimeSlotClicked;
    this.onCommitResize = onCommitResize;
    this.axis = axis;
    this.getPxPerMinute = getPxPerMinute;
    this.crossAxisCenter = crossAxisCenter;
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
      pointerType: e.pointerType,
      startX: e.clientX,
      startY: e.clientY,
    };
    this.longPressTimer = setTimeout(() => this.onLongPressFire(), LONG_PRESS_MS);
  }

  onEntryPointerMove(e) {
    if (e.pointerId === this.ignoredPointerId) {
      return;
    }
    if (this.activeDrag && e.pointerId === this.activeDrag.pointerId) {
      // touch-action:none on the handle/SVG (see startHandleDrag and
      // timeline.css) should already stop the scrollable timeline stack
      // from panning during this drag, but SVG shape elements have a long
      // history of unreliable touch-action support on their own - this is
      // the reliable fallback, independent of that CSS support level
      e.preventDefault?.();
      this.updateDragToSvgPosition(this.clientToSvgCoord(e.clientX, e.clientY));
      return;
    }
    const armed = this.moveArmed;
    if (armed && e.pointerId === armed.pointerId) {
      // a long-press fired and the finger (or button) is still down: moving
      // it now picks the Entry up
      if (
        Math.hypot(e.clientX - armed.startX, e.clientY - armed.startY) >
        LONG_PRESS_CANCEL_DISTANCE_PX
      ) {
        this.startMoveDrag(e, armed);
      }
      return;
    }
    if (!this.longPressCandidate || e.pointerId !== this.longPressCandidate.pointerId) {
      return;
    }
    const candidate = this.longPressCandidate;
    const dx = e.clientX - candidate.startX;
    const dy = e.clientY - candidate.startY;
    if (Math.hypot(dx, dy) > LONG_PRESS_CANCEL_DISTANCE_PX) {
      if (candidate.pointerType === 'mouse') {
        // a mouse has no scroll to confuse this with: dragging an Entry
        // moves it, without waiting for a long-press
        this.startMoveDrag(e, candidate);
        return;
      }
      // a touch that moved before the hold completed is a scroll/mis-tap,
      // not a long-press
      this.cancelPendingLongPress();
    }
  }

  handlePointerUp(e) {
    if (e.pointerId === this.ignoredPointerId) {
      // the click that ends an Escaped move must not open the Entry either
      this.ignoredPointerId = undefined;
      this.suppressClicks();
      return;
    }
    if (this.activeDrag && e.pointerId === this.activeDrag.pointerId) {
      this.commitDrag();
      return;
    }
    if (this.moveArmed?.pointerId === e.pointerId) {
      this.moveArmed = undefined;
    }
    this.cancelPendingLongPress();
    if (this.suppressNextClick) {
      // normally consumed by the 'click' this same press also fires
      // right after this - fallback in case that click never arrives
      // (e.g. the element moves before it does), so a stuck flag can't
      // swallow an unrelated later click
      clearTimeout(this.suppressClickResetTimer);
      this.suppressClickResetTimer = setTimeout(() => {
        this.suppressNextClick = false;
      }, 0);
    }
  }

  handlePointerCancel(e) {
    if (this.activeDrag && e.pointerId === this.activeDrag.pointerId) {
      this.cancelDrag();
      return;
    }
    if (this.moveArmed?.pointerId === e.pointerId) {
      this.moveArmed = undefined;
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
    // a long-press that has armed a move must not scroll either, before the
    // finger has moved far enough to start it
    if (this.activeDrag || this.moveArmed) {
      e.preventDefault();
    }
  }

  handleGlobalKeyDown(e) {
    if (e.key !== 'Escape') {
      return;
    }
    if (this.activeDrag) {
      if (this.activeDrag.edge === 'body') {
        // the pointer is still down: its release must not count as a click
        this.ignoredPointerId = this.activeDrag.pointerId;
      }
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

  // called from the host's cleanup when it disconnects: clears every pending
  // timer, so none fires against the detached SVG, and abandons any
  // in-progress drag without committing it
  destroy() {
    this.cancelPendingLongPress();
    clearTimeout(this.limitFlashTimer);
    clearTimeout(this.suppressClickResetTimer);
    this.activeDrag = undefined;
    this.moveArmed = undefined;
    this.ignoredPointerId = undefined;
    this.suppressNextClick = false;
  }

  // the click that ends a press that moved an Entry must not also open it;
  // the timer is a fallback so a click that never arrives can't leave the
  // flag set and swallow an unrelated later one
  suppressClicks() {
    this.suppressNextClick = true;
    clearTimeout(this.suppressClickResetTimer);
    this.suppressClickResetTimer = setTimeout(() => {
      this.suppressNextClick = false;
    }, 0);
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
    // and if the finger now moves without lifting, that is a move
    this.moveArmed = { ...candidate };
  }

  // picks an Entry up by its body: a drag whose "edge" is the whole Entry.
  // `source` is the press that began it ({ entryId, pointerId, startX, startY })
  startMoveDrag(e, source) {
    const entry = this.getEntries().find((entry) => entry.id === source.entryId);
    this.cancelPendingLongPress();
    this.moveArmed = undefined;
    if (!entry) {
      return;
    }
    try {
      e.target?.setPointerCapture?.(e.pointerId);
    } catch {
      // pointer capture is best-effort - the delegated listeners on the SVG
      // still track the drag correctly without it in the common case
    }
    this.svg?.classList.add('dragging-handle');
    if (this.activeHandleEntryId !== entry.id) {
      this.showHandles(entry);
    }
    const grabCoord = this.clientToSvgCoord(source.startX, source.startY);
    this.activeDrag = {
      entryId: entry.id,
      edge: 'body',
      pointerId: e.pointerId,
      // the 10-minute slot the Entry was picked up at: the move is how many
      // slots the pointer has travelled from here
      grabMins: this.calculateTheTimeSlotClicked(grabCoord >= 0 ? grabCoord : 0),
      originalStart: entry.startOffsetMins,
      originalEnd: entry.endOffsetMins,
      currentStart: entry.startOffsetMins,
      currentEnd: entry.endOffsetMins,
      neighbours: [],
      captureElement: e.target,
      wasAtLimit: false,
      atLimit: false,
    };
    this.updateDragToSvgPosition(this.clientToSvgCoord(e.clientX, e.clientY));
  }

  updateMoveToSvgPosition(svgCoord) {
    const drag = this.activeDrag;
    const entry = this.getEntries().find((entry) => entry.id === drag.entryId);
    if (!entry) {
      return;
    }
    const slot = this.calculateTheTimeSlotClicked(svgCoord >= 0 ? svgCoord : 0);
    const move = computeMove({
      entry,
      entries: this.getEntries(),
      requestedStart: drag.originalStart + (slot - drag.grabMins),
      singleChoice: this.isSingleChoiceDimension(),
      nowLimitMins: getNowLimitOffsetMins(this.getCurrentDate()),
    });
    drag.currentStart = move.startOffsetMins;
    drag.currentEnd = move.endOffsetMins;
    drag.neighbours = move.neighbours;
    drag.atLimit = move.atLimit;
    this.renderDragFeedback();
    // flash once per approach, not on every tick still pressed against the wall
    if (move.atLimit && !drag.wasAtLimit) {
      this.flashLimitCue();
    }
    drag.wasAtLimit = move.atLimit;
  }

  // the neighbours of a move whose span differs from what is stored
  changedNeighbours(drag) {
    return drag.neighbours
      .filter((neighbour) => {
        const stored = this.getEntries().find((entry) => entry.id === neighbour.id);
        return (
          stored &&
          (stored.startOffsetMins !== neighbour.startOffsetMins ||
            stored.endOffsetMins !== neighbour.endOffsetMins)
        );
      })
      .map((neighbour) => ({
        entryId: neighbour.id,
        startOffsetMins: neighbour.startOffsetMins,
        endOffsetMins: neighbour.endOffsetMins,
      }));
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
    // the rules (the neighbours, the limits) are computeResize's, and read
    // the stored Entries each time, which do not change during the drag
    this.activeDrag = {
      entryId,
      edge,
      pointerId: e.pointerId,
      currentStart: entry.startOffsetMins,
      currentEnd: entry.endOffsetMins,
      neighbours: [],
      captureElement: e.target,
      wasAtLimit: false,
      atLimit: false,
    };
  }

  updateDragToSvgPosition(svgCoord) {
    if (!this.activeDrag) {
      return;
    }
    if (this.activeDrag.edge === 'body') {
      this.updateMoveToSvgPosition(svgCoord);
      return;
    }
    const drag = this.activeDrag;
    const entry = this.getEntries().find((entry) => entry.id === drag.entryId);
    if (!entry) {
      return;
    }
    const resize = computeResize({
      entry,
      entries: this.getEntries(),
      edge: drag.edge,
      requestedOffsetMins: this.calculateTheTimeSlotClicked(svgCoord >= 0 ? svgCoord : 0),
      singleChoice: this.isSingleChoiceDimension(),
      nowLimitMins: getNowLimitOffsetMins(this.getCurrentDate()),
    });
    const hitLimit = resize.atLimit;
    drag.currentStart = resize.startOffsetMins;
    drag.currentEnd = resize.endOffsetMins;
    drag.neighbours = resize.neighbours;
    drag.atLimit = hitLimit;
    this.renderDragFeedback();
    // flash once per approach, not on every tick still pressed against the
    // same wall - otherwise holding at a limit reads as a constant strobe
    if (hitLimit && !this.activeDrag.wasAtLimit) {
      this.flashLimitCue();
    }
    this.activeDrag.wasAtLimit = hitLimit;
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
    if (drag.edge === 'body') {
      this.renderMoveFeedback(drag);
      return;
    }
    this.updateEntryRectLive(drag);
    this.updateNeighbourRects(drag);
    this.updateHandlePosition('start', drag.currentStart, drag.edge === 'start', drag.atLimit);
    this.updateHandlePosition('end', drag.currentEnd, drag.edge === 'end', drag.atLimit);
  }

  // the neighbours the drag is moving the boundary of
  updateNeighbourRects(drag) {
    drag.neighbours.forEach((neighbour) =>
      this.updateEntryRectLive({
        entryId: neighbour.id,
        currentStart: neighbour.startOffsetMins,
        currentEnd: neighbour.endOffsetMins,
      })
    );
  }

  // the Entry, the neighbours it is trimming, and its handles, with the
  // Entry's new times as one readout at its start edge
  renderMoveFeedback(drag) {
    this.updateEntryRectLive(drag);
    this.updateNeighbourRects(drag);
    const times = `${formatOffsetAsClockTime(drag.currentStart)}–${formatOffsetAsClockTime(drag.currentEnd)}`;
    this.updateHandlePosition(
      'start',
      drag.currentStart,
      true,
      false,
      drag.atLimit ? `${times} · limit` : times
    );
    this.updateHandlePosition('end', drag.currentEnd, false);
  }

  // `atLimit` adds "limit" to the dragged handle's readout, so a limit is
  // never signalled only by the flash; `label` replaces the readout text
  updateHandlePosition(edge, offsetMins, showReadout, atLimit = false, label = undefined) {
    const group = this.handlesLayer?.querySelector(`.resize-handle[data-handle-edge="${edge}"]`);
    if (!group) {
      return;
    }
    const position = offsetMins * this.getPxPerMinute();
    group
      .querySelectorAll('circle')
      .forEach((circle) => circle.setAttributeNS(null, this.axis.positionCoordAttr, position));
    let readout = group.querySelector('.resize-handle-readout');
    if (!showReadout) {
      readout?.remove();
      return;
    }
    if (!readout) {
      const crossValue = group
        .querySelector('.resize-handle-hit-area')
        ?.getAttribute(this.axis.crossCoordAttr);
      readout = this.createReadout(Number(crossValue));
      group.appendChild(readout);
    }
    readout.setAttributeNS(null, this.axis.positionAttr, position);
    readout.textContent =
      label ?? formatOffsetAsClockTime(offsetMins) + (atLimit ? ' · limit' : '');
  }

  // the clock-time text beside a handle; the caller sets its position along
  // the axis and its text
  createReadout(crossCenter) {
    const readout = document.createElementNS(SVGNS, 'text');
    readout.setAttribute('class', 'resize-handle-readout');
    readout.setAttributeNS(null, this.axis.crossAttr, crossCenter + this.axis.readoutCrossOffset);
    readout.setAttribute('text-anchor', this.axis.readoutAnchor);
    readout.setAttribute('dominant-baseline', 'middle');
    return readout;
  }

  updateEntryRectLive({ entryId, currentStart, currentEnd }) {
    const rect = this.entriesLayer?.querySelector(`rect[data-id="${entryId}"]`);
    if (!rect) {
      return;
    }
    const pxPerMinute = this.getPxPerMinute();
    const startOffsetPx = currentStart * pxPerMinute;
    const endOffsetPx = currentEnd * pxPerMinute;
    const size = endOffsetPx - startOffsetPx;
    rect.setAttributeNS(null, this.axis.positionAttr, startOffsetPx);
    rect.setAttributeNS(null, this.axis.sizeAttr, size > 0 ? size : 20);
    const foreignObject = rect.parentElement?.querySelector('foreignObject');
    if (foreignObject) {
      foreignObject.setAttributeNS(null, this.axis.positionAttr, startOffsetPx);
      foreignObject.setAttributeNS(null, this.axis.sizeAttr, size > 0 ? size : 20);
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
    // only the neighbours the drag actually moved are passed on
    const neighbourChanges = this.changedNeighbours(drag);
    if (drag.edge === 'body') {
      // the click that ends this press must not open the Entry
      this.suppressClicks();
      if (drag.currentStart === drag.originalStart && neighbourChanges.length === 0) {
        // carried away and brought back: nothing to store
        this.cancelDragVisuals(drag);
        return;
      }
    }
    const updatedEntry = this.onCommitResize(
      drag.entryId,
      { startOffsetMins: drag.currentStart, endOffsetMins: drag.currentEnd },
      neighbourChanges
    );
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
    this.cancelDragVisuals(drag);
  }

  // puts every block the drag touched back to what is stored, and the handles
  // back on the Entry
  cancelDragVisuals(drag) {
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
    (drag.neighbours ?? []).forEach((neighbour) => {
      const stored = this.getEntries().find((other) => other.id === neighbour.id);
      if (stored) {
        this.updateEntryRectLive({
          entryId: stored.id,
          currentStart: stored.startOffsetMins,
          currentEnd: stored.endOffsetMins,
        });
      }
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
    const pxPerMinute = this.getPxPerMinute();
    const startOffsetPx = (entry.startOffsetMins || 0) * pxPerMinute;
    const endOffsetPx = (entry.endOffsetMins || 0) * pxPerMinute;
    this.handlesLayer.appendChild(
      this.createHandle({
        edge: 'start',
        position: startOffsetPx,
        entryId: entry.id,
        showReadout: activeEdge === 'start',
        offsetMins: entry.startOffsetMins,
      })
    );
    this.handlesLayer.appendChild(
      this.createHandle({
        edge: 'end',
        position: endOffsetPx,
        entryId: entry.id,
        showReadout: activeEdge === 'end',
        offsetMins: entry.endOffsetMins,
      })
    );
  }

  createHandle({ edge, position, entryId, showReadout, offsetMins }) {
    const group = document.createElementNS(SVGNS, 'g');
    group.setAttribute('class', 'resize-handle');
    group.setAttribute('data-handle-edge', edge);
    group.setAttribute('data-handle-entry-id', entryId);

    const hitArea = document.createElementNS(SVGNS, 'circle');
    hitArea.setAttributeNS(null, this.axis.positionCoordAttr, position);
    hitArea.setAttributeNS(null, this.axis.crossCoordAttr, this.crossAxisCenter);
    hitArea.setAttributeNS(null, 'r', HANDLE_HIT_RADIUS);
    hitArea.setAttribute('class', 'resize-handle-hit-area');
    group.appendChild(hitArea);

    const grip = document.createElementNS(SVGNS, 'circle');
    grip.setAttributeNS(null, this.axis.positionCoordAttr, position);
    grip.setAttributeNS(null, this.axis.crossCoordAttr, this.crossAxisCenter);
    grip.setAttributeNS(null, 'r', HANDLE_GRIP_RADIUS);
    grip.setAttribute('class', 'resize-handle-grip');
    group.appendChild(grip);

    if (showReadout) {
      const readout = this.createReadout(this.crossAxisCenter);
      readout.setAttributeNS(null, this.axis.positionAttr, position);
      readout.textContent = formatOffsetAsClockTime(offsetMins);
      group.appendChild(readout);
    }

    return group;
  }
}
