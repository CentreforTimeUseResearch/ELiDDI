import { computeMove } from './moveSpan';
import { computeResize } from './resizeSpan';
import { getNowLimitOffsetMins } from './createSpan';

// One pointer drag of an Entry, from start to commit or cancel: a handle
// drag (edge 'start'/'end', the rules are computeResize's) or a move of the
// whole Entry by its body (edge 'body', computeMove's). A plain state
// machine owned by EntryResizeController: it owns the drag's state, pointer
// capture, the dragging-handle class and the span computation on every
// tick, and reports through callbacks - onFeedback(drag) after each tick,
// onLimit(drag) once per approach to a limit (not on every tick still
// pressed against the same wall), onCommit(drag, neighbourChanges) on
// release, onCancelled(drag) on pointercancel/Escape. What those do to the
// SVG (live feedback, the flash, the store dispatch) is the owner's
// business, not this session's.
export class DragSession {
  drag; // { entryId, edge, pointerId, currentStart, currentEnd, neighbours, captureElement, wasAtLimit, atLimit } while a drag is live

  constructor({
    svg,
    getEntries,
    isSingleChoiceDimension,
    getCurrentDate,
    clientToSvgCoord,
    calculateTheTimeSlotClicked,
    onFeedback,
    onLimit,
    onCommit,
    onCancelled,
  }) {
    this.svg = svg;
    this.getEntries = getEntries;
    this.isSingleChoiceDimension = isSingleChoiceDimension;
    this.getCurrentDate = getCurrentDate;
    this.clientToSvgCoord = clientToSvgCoord;
    this.calculateTheTimeSlotClicked = calculateTheTimeSlotClicked;
    this.onFeedback = onFeedback;
    this.onLimit = onLimit;
    this.onCommit = onCommit;
    this.onCancelled = onCancelled;
  }

  get active() {
    return this.drag;
  }

  has(pointerId) {
    return Boolean(this.drag) && pointerId === this.drag.pointerId;
  }

  // picks an Entry up by its body: a drag whose "edge" is the whole Entry.
  // `source` is the press that began it ({ entryId, pointerId, startX, startY })
  startMove(e, source, entry) {
    this.capture(e);
    this.svg?.classList.add('dragging-handle');
    const grabCoord = this.clientToSvgCoord(source.startX, source.startY);
    this.drag = {
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
    this.updateTo(this.clientToSvgCoord(e.clientX, e.clientY));
  }

  // starts dragging a handle that's already visible (long-press already
  // fired) - captures the pointer so drag tracking keeps working even if
  // the pointer strays outside the handle's small hit area mid-drag
  startResize(e, entry, edge) {
    e.preventDefault?.();
    this.capture(e);
    // stops the scrollable timeline stack (see timelineStack.css) from
    // panning under a touch drag - see the pointermove preventDefault() in
    // EntryResizeController.onEntryPointerMove for why this alone isn't relied on
    this.svg?.classList.add('dragging-handle');
    // the rules (the neighbours, the limits) are computeResize's, and read
    // the stored Entries each time, which do not change during the drag
    this.drag = {
      entryId: entry.id,
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

  // one tick of the drag: computes the constrained span at this position,
  // then reports - feedback every tick, the limit once per approach
  updateTo(svgCoord) {
    const drag = this.drag;
    if (!drag) {
      return;
    }
    const entry = this.getEntries().find((entry) => entry.id === drag.entryId);
    if (!entry) {
      return;
    }
    const requested = this.calculateTheTimeSlotClicked(svgCoord >= 0 ? svgCoord : 0);
    const result =
      drag.edge === 'body'
        ? computeMove({
            entry,
            entries: this.getEntries(),
            requestedStart: drag.originalStart + (requested - drag.grabMins),
            singleChoice: this.isSingleChoiceDimension(),
            nowLimitMins: getNowLimitOffsetMins(this.getCurrentDate()),
          })
        : computeResize({
            entry,
            entries: this.getEntries(),
            edge: drag.edge,
            requestedOffsetMins: requested,
            singleChoice: this.isSingleChoiceDimension(),
            nowLimitMins: getNowLimitOffsetMins(this.getCurrentDate()),
          });
    drag.currentStart = result.startOffsetMins;
    drag.currentEnd = result.endOffsetMins;
    drag.neighbours = result.neighbours;
    drag.atLimit = result.atLimit;
    this.onFeedback(drag);
    // flash once per approach, not on every tick still pressed against the
    // same wall - otherwise holding at a limit reads as a constant strobe
    if (result.atLimit && !drag.wasAtLimit) {
      this.onLimit(drag);
    }
    drag.wasAtLimit = result.atLimit;
  }

  // the neighbours of a drag whose span differs from what is stored
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

  commit() {
    const drag = this.end();
    if (!drag) {
      return;
    }
    // only the neighbours the drag actually moved are passed on
    this.onCommit(drag, this.changedNeighbours(drag));
  }

  // an interrupted drag (pointercancel) or Escape mid-drag - nothing was
  // ever dispatched, so the owner only has to undo the live visual feedback
  cancel() {
    const drag = this.end();
    if (!drag) {
      return;
    }
    this.onCancelled(drag);
  }

  // drops the session without releasing capture or reporting anything - for
  // the owner's destroy() and hideHandles(), where the SVG is going away or
  // the drag's visuals are being cleared wholesale anyway
  abandon() {
    this.drag = undefined;
  }

  end() {
    const drag = this.drag;
    this.drag = undefined;
    if (drag) {
      this.releaseCapture(drag);
      this.svg?.classList.remove('dragging-handle');
    }
    return drag;
  }

  capture(e) {
    try {
      e.target?.setPointerCapture?.(e.pointerId);
    } catch {
      // pointer capture is best-effort - the delegated listeners on the SVG
      // still track the drag correctly without it in the common case
    }
  }

  releaseCapture(drag) {
    try {
      drag.captureElement?.releasePointerCapture?.(drag.pointerId);
    } catch {
      // already released (e.g. by the browser on pointerup) - nothing to do
    }
  }
}
