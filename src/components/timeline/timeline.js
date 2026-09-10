import { TinyBase } from '../base';
import { getActivityColor } from '../../utils/activities';
import { findOverlappingEntry, findNextEntry } from '../../utils/entries';
import {
  formatOffsetAsClockTime,
  getCurrentOffsetMins,
  getCurrentDiaryDateKey,
} from '../../utils/time';
import {
  ADD_TIMELINE,
  SHOW_PANEL,
  ADD_ENTRY,
  UPDATE_ENTRY,
  DELETE_ENTRY,
  HIDE_PANEL,
} from '../../store/actionTypes';
import './timeline.css';

const SVGNS = 'http://www.w3.org/2000/svg';
const XHTMLNS = 'http://www.w3.org/1999/xhtml';

const INDEX = 'index';
const PX_PER_MINUTE = 2;
const MINUTES_PER_DAY = 24 * 60; // -> 2880px, matches the SVG viewBox height
const LONG_PRESS_MS = 500;
const LONG_PRESS_CANCEL_DISTANCE_PX = 10; // pointer movement past this before the timer fires reads as a scroll/mis-tap, not a long-press
const HANDLE_HIT_RADIUS = 22; // ~44px hit target (WCAG target-size guidance), independent of the visible grip size
const HANDLE_GRIP_RADIUS = 6;
const MIN_ENTRY_DURATION_MINS = 10; // one slot - the shortest a drag can resize an entry to
const LIMIT_FLASH_MS = 300;
// stable shared reference so a not-yet-touched dimension/date compares
// === equal to itself across calls, preserving renderShadowDimension's
// skip-if-unchanged check instead of allocating a fresh [] every time
const EMPTY_ENTRIES = [];

// builds a <foreignObject> containing an HTML div for the entry label, so
// long labels wrap across multiple lines (via CSS) instead of being
// truncated - div also carries the title attribute for a native tooltip
// with the full text, mirroring the old SVG <title> behavior
function createLabelForeignObject({ x, y, width, height, label, fontSize, id }) {
  const foreignObject = document.createElementNS(SVGNS, 'foreignObject');
  foreignObject.setAttributeNS(null, 'x', x);
  foreignObject.setAttributeNS(null, 'y', y);
  foreignObject.setAttributeNS(null, 'width', width);
  foreignObject.setAttributeNS(null, 'height', height > 0 ? height : 20);

  const label_div = document.createElementNS(XHTMLNS, 'div');
  label_div.className = 'event-label';
  label_div.style.fontSize = `${fontSize}px`;
  label_div.title = label;
  label_div.setAttribute('data-id', id);
  label_div.textContent = label;

  foreignObject.appendChild(label_div);
  return foreignObject;
}

export class Timeline extends TinyBase {
  static observedAttributes = [INDEX];

  ready = false;
  store = super.getStore();
  fragment;
  timeLineElement;
  entries = [];
  panelActions;
  selectedID;
  shadowIndex = 0; // we want to render primary activities as shadow dimension on other dimensions
  entriesLayer;
  shadowEntriesLayer;
  shadowDimensionEntries;
  futureOverlayElement;
  handlesLayer;
  longPressTimer;
  longPressCandidate; // { entryId, pointerId, startX, startY } while a press is pending
  suppressNextClick = false; // set when a long-press fires, so the click it also triggers doesn't open the panel
  activeHandleEntryId; // id of the entry currently showing resize handles, if any
  activeDrag; // { entryId, edge, pointerId, currentStart, currentEnd, captureElement, previousNeighborEnd, nextNeighborStart, wasAtLimit } while a handle is being dragged
  limitFlashTimer;

  constructor() {
    super();
    this.fragment = document.getElementById('svg-timeline').content.cloneNode(true);
  }

  connectedCallback() {
    const state = this.store.getState();
    this.dimensionIndex = Number(this.getAttribute(INDEX));
    this.currentDate = state.currentDate;
    const timeline = state.diaries[this.currentDate]?.timelines[this.dimensionIndex];
    if (!Array.isArray(timeline)) {
      this.store.dispatch({
        type: ADD_TIMELINE,
        payload: { dimensionIndex: this.dimensionIndex, date: this.currentDate },
      });
    } else {
      this.entries = timeline;
    }
    super.connectedCallback();
    this.registerCleanup(this.store.subscribe(() => this.updateState()));
    this.getChildElementReferences();
    this.updateFutureOverlay();
    const futureOverlayIntervalId = setInterval(this.updateFutureOverlay.bind(this), 30000);
    this.registerCleanup(() => clearInterval(futureOverlayIntervalId));
    this.renderEntries();
    if (this.dimensionIndex !== this.shadowIndex) {
      this.renderShadowDimension();
    }
    this.assignEventHandlers();
  }

  getChildElementReferences() {
    this.timeLineElement = this.querySelector('svg');
    this.entriesLayer = this.timeLineElement.querySelector('#events');
    this.shadowEntriesLayer = this.timeLineElement.querySelector('#timeline-shadow');
    this.futureOverlayElement = this.timeLineElement.querySelector('#future-overlay');
    // real markup (index.html) always has this above #events; test fixtures
    // that build a minimal <svg> don't, so fall back to creating it -
    // appended last so it renders above entries either way
    this.handlesLayer = this.timeLineElement.querySelector('#drag-handles');
    if (!this.handlesLayer) {
      this.handlesLayer = document.createElementNS(SVGNS, 'g');
      this.handlesLayer.setAttribute('id', 'drag-handles');
      (this.entriesLayer?.parentNode ?? this.timeLineElement).appendChild(this.handlesLayer);
    }
  }

  updateFutureOverlay() {
    if (!this.futureOverlayElement) {
      return;
    }
    if (this.currentDate !== getCurrentDiaryDateKey()) {
      // "future" only means anything on the actual current diary day -
      // a past (or future) diary date has nothing left to grey out
      this.futureOverlayElement.setAttributeNS(null, 'height', 0);
      return;
    }
    const nowOffsetPx = getCurrentOffsetMins() * PX_PER_MINUTE;
    const totalHeightPx = MINUTES_PER_DAY * PX_PER_MINUTE;
    this.futureOverlayElement.setAttributeNS(null, 'y', nowOffsetPx);
    this.futureOverlayElement.setAttributeNS(null, 'height', totalHeightPx - nowOffsetPx);
  }

  updateState() {
    const state = this.store.getState();
    const { currentDimensionIndex, currentDate } = state;
    const dateChanged = currentDate !== this.currentDate;
    this.currentDate = currentDate;
    this.entries = state.diaries[currentDate]?.timelines[this.dimensionIndex] ?? EMPTY_ENTRIES;
    if (dateChanged) {
      // every mounted dimension's entries potentially changed wholesale -
      // unlike an edit (which the acting Timeline instance already
      // re-renders itself after), nothing else triggers a re-render here
      this.renderEntries();
      this.updateFutureOverlay();
      this.hideHandles(); // the entry any showing handles belonged to may no longer exist on the new date
    }
    if (this.dimensionIndex !== this.shadowIndex && currentDimensionIndex === this.dimensionIndex) {
      // this is not primary activity timeline and we're currently viewing this timeline
      this.renderShadowDimension(); // render primary activity entries as shadow timeline
    }
  }

  // Shared renderer for both the primary entries layer and the shadow
  // (secondary-timeline-on-other-dimensions) layer - they only differ in
  // which entries/layer they draw into and how wide each block is, since
  // the shadow layer is a narrower strip alongside the full-width entries.
  //
  // entry element looks like this:
  // <g>
  //   <rect class="event-block" x="105" y="800" width="230" height="450" fill="#9aa0c3" fill-opacity="0.45" />
  //   <text x="220" y="1025" text-anchor="middle" dominant-baseline="middle" font-size="13" fill="#3a3d4d">c/ch</text>
  // </g>
  renderEntriesInto({ layer, entries, dimensionIndex, blockWidth, labelX, labelWidth }) {
    layer.innerHTML = '';

    const dimensionData = GLOBALS.DATA.timeline[dimensionIndex];

    entries.forEach((entry) => {
      const entryGroup = document.createElementNS(SVGNS, 'g');
      const rect = document.createElementNS(SVGNS, 'rect');
      const startOffsetPx = (entry.startOffsetMins || 0) * PX_PER_MINUTE;
      const endOffsetPx = (entry.endOffsetMins || 0) * PX_PER_MINUTE;
      const height = endOffsetPx - startOffsetPx;
      rect.setAttributeNS(null, 'x', '100');
      rect.setAttributeNS(null, 'y', startOffsetPx);
      rect.setAttributeNS(null, 'height', height > 0 ? height : 20);
      rect.setAttributeNS(null, 'width', blockWidth);
      rect.setAttributeNS(null, 'fill', getActivityColor(dimensionData, entry.activity));
      rect.setAttributeNS(null, 'fill-opacity', '0.45');
      rect.setAttributeNS(null, 'data-id', entry.id);
      entryGroup.appendChild(rect);

      const label = Array.isArray(entry.activity) ? entry.activity.join(', ') : entry.activity;
      const labelForeignObject = createLabelForeignObject({
        x: labelX,
        y: startOffsetPx,
        width: labelWidth,
        height,
        label,
        fontSize: 13,
        id: entry.id,
      });
      entryGroup.appendChild(labelForeignObject);

      layer.appendChild(entryGroup);
    });
  }

  renderEntries() {
    // at some point there are going to have to have their own event handling
    // and at that point it might be a good idea to shift them into their own class/object
    this.renderEntriesInto({
      layer: this.entriesLayer,
      entries: this.entries,
      dimensionIndex: this.dimensionIndex,
      blockWidth: '220',
      labelX: 110,
      labelWidth: 200,
    });
  }

  renderShadowDimension() {
    const dimensionIndex = this.shadowIndex;
    const state = this.store.getState();
    const nextShadowDimensionEntries =
      state.diaries[state.currentDate]?.timelines[dimensionIndex] ?? EMPTY_ENTRIES;
    if (this.shadowDimensionEntries === nextShadowDimensionEntries) {
      return; // do not rerender if nothing changed
    }
    this.shadowDimensionEntries = nextShadowDimensionEntries;

    this.renderEntriesInto({
      layer: this.shadowEntriesLayer,
      entries: this.shadowDimensionEntries,
      dimensionIndex,
      blockWidth: '50',
      labelX: 100,
      labelWidth: 50,
    });
  }

  calculateTheTimeSlotClicked(y) {
    // round to 10.
    return Math.floor(y / 20) * 10;
  }

  assignEventHandlers() {
    if (!this.ready) {
      // are there times when we don't want the timeline to be clickable?
      this.timeLineElement?.addEventListener('click', (e) => {
        this.onTimelineClick(e);
      });
      this.timeLineElement?.addEventListener('pointerdown', (e) => {
        this.onEntryPointerDown(e);
      });
      this.timeLineElement?.addEventListener('pointermove', (e) => {
        this.onEntryPointerMove(e);
      });
      this.timeLineElement?.addEventListener('pointerup', (e) => {
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
      });
      this.timeLineElement?.addEventListener('pointercancel', (e) => {
        if (this.activeDrag && e.pointerId === this.activeDrag.pointerId) {
          this.cancelDrag();
          return;
        }
        this.cancelPendingLongPress();
      });
      // belt-and-braces against the scrollable timeline stack panning
      // during a touch drag (see timelineStack.css's overflow-y: auto).
      // touch-action:none (on the handle, and for the drag's duration the
      // whole SVG - see startHandleDrag/timeline.css) is the primary
      // defense, but freshly-inserted SVG shape elements have a documented
      // history of Chromium sometimes not honouring it on the very first
      // touch that lands on them (the compositor's touch-action hit
      // regions can be a frame stale right after a DOM insert) - a genuine
      // non-passive touchstart/touchmove preventDefault() forces main-
      // thread arbitration and is honoured unconditionally regardless of
      // that, so it's kept as the reliable fallback alongside the Pointer
      // Events handling above (which alone was not enough - see the
      // pointercancel firing on the very first drag attempt after a fresh
      // long-press, and only that first attempt, that prompted this)
      this.timeLineElement?.addEventListener(
        'touchstart',
        (e) => {
          if (e.target?.closest?.('.resize-handle')) {
            e.preventDefault();
          }
        },
        { passive: false }
      );
      this.timeLineElement?.addEventListener(
        'touchmove',
        (e) => {
          if (this.activeDrag) {
            e.preventDefault();
          }
        },
        { passive: false }
      );
      const onKeyDown = (e) => this.onGlobalKeyDown(e);
      document.addEventListener('keydown', onKeyDown);
      this.registerCleanup(() => document.removeEventListener('keydown', onKeyDown));
      this.ready = true;
    }
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
    if (this.store.getState().uipanel === 'activity') {
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
    const entry = this.entries.find((entry) => entry.id === candidate.entryId);
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
    const entry = this.entries.find((entry) => entry.id === entryId);
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
    this.timeLineElement?.classList.add('dragging-handle');
    // fixed for the whole drag, rather than recomputed as the pointer moves
    // past other entries - "the adjacent entry" means this entry's immediate
    // temporal neighbors as they stood when the drag started
    const neighborBounds = this.isSingleChoiceDimension
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
    const others = this.entries.filter((other) => other.id !== entry.id);
    const previousEnd = others
      .filter((other) => other.endOffsetMins <= entry.startOffsetMins)
      .reduce((max, other) => Math.max(max, other.endOffsetMins), 0);
    const nextStart = others
      .filter((other) => other.startOffsetMins >= entry.endOffsetMins)
      .reduce((min, other) => Math.min(min, other.startOffsetMins), MINUTES_PER_DAY);
    return { previousEnd, nextStart };
  }

  // converts a pointer event's screen coordinates into this SVG's own user
  // coordinate space (accounting for the viewBox and any CSS transforms on
  // ancestors, e.g. #wrapper's translateX) rather than assuming a 1:1
  // mapping to CSS pixels, which only happens to hold at this SVG's
  // "natural" render size
  clientYToSvgY(clientX, clientY) {
    const svg = this.timeLineElement;
    if (typeof svg?.createSVGPoint !== 'function' || typeof svg.getScreenCTM !== 'function') {
      return clientY; // no SVG geometry support (e.g. a test environment)
    }
    const ctm = svg.getScreenCTM();
    if (!ctm) {
      return clientY;
    }
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    return point.matrixTransform(ctm.inverse()).y;
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
      this.currentDate === getCurrentDiaryDateKey()
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

  commitDrag() {
    const drag = this.activeDrag;
    this.activeDrag = undefined;
    if (!drag) {
      return;
    }
    this.releaseDragCapture(drag);
    this.timeLineElement?.classList.remove('dragging-handle');
    const entry = this.entries.find((entry) => entry.id === drag.entryId);
    if (!entry) {
      return;
    }
    this.selectedID = drag.entryId;
    this.updateEntry({
      ...entry,
      startOffsetMins: drag.currentStart,
      endOffsetMins: drag.currentEnd,
    });
    this.renderEntries();
    const updatedEntry = this.entries.find((entry) => entry.id === drag.entryId);
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
    this.timeLineElement?.classList.remove('dragging-handle');
    const entry = this.entries.find((entry) => entry.id === drag.entryId);
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

  onGlobalKeyDown(e) {
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

  onTimelineClick(e) {
    if (e.target?.closest?.('.resize-handle')) {
      // a click landing on a handle itself is never a normal timeline click
      return;
    }
    if (this.suppressNextClick) {
      this.suppressNextClick = false;
      return;
    }
    if (this.activeHandleEntryId !== undefined) {
      // any real click - elsewhere on the timeline, or on a different entry -
      // dismisses whatever handles are currently showing
      this.hideHandles();
    }
    const element_id = e.target?.dataset?.id;
    if (element_id !== undefined) {
      // set selected
      const entry_id = Number(e.target?.dataset?.id);
      if (typeof entry_id !== 'number') {
        console.error('Problem with identifying entry from click', e.target);
        return;
      }
      this.selectedID = entry_id;
      // fetch the
      const entry = this.entries.find((entry) => entry.id === entry_id);
      // set up the panel
      this.panelActions.openEntry(entry);
      // we need to do soemthing different on save
    } else {
      // is click in the timeline target zone in the gridlines
      if (e.target.id !== 'gridline_zone') {
        return;
      }
      // starting a brand new entry - clear out anything left over from a
      // previous edit that was opened but never saved/deleted
      this.selectedID = undefined;
      // not offsetY - that assumes 1 CSS px === 1 viewBox unit, which breaks
      // whenever the SVG's rendered width comes out narrower than its
      // viewBox (100vw can be less than the 375-unit viewBox width, e.g.
      // under certain zoom/accessibility text-scaling conditions - seen on
      // a real device in Chrome but not Firefox): preserveAspectRatio then
      // uniformly shrinks the whole coordinate system, including the time
      // axis, to fit - the same reason the drag handles use this helper
      // instead of raw offsets (see clientYToSvgY/getScreenCTM)
      const svgY = this.clientYToSvgY(e.clientX, e.clientY);
      const startOffsetMins = this.calculateTheTimeSlotClicked(svgY >= 0 ? svgY : 0);
      this.panelActions.openNewEntry(startOffsetMins);
    }

    // open activity panel
    this.store.dispatch({
      type: SHOW_PANEL,
      payload: 'activity',
    });
  }

  get isSingleChoiceDimension() {
    return GLOBALS.DATA.timeline[Number(this.dimensionIndex)].mode !== 'multiple-choice';
  }

  formatOverlapMessage(conflict) {
    const start = formatOffsetAsClockTime(conflict.startOffsetMins);
    const end = formatOffsetAsClockTime(conflict.endOffsetMins);
    return `This overlaps with your existing "${conflict.activity}" entry (${start}–${end}). Adjust the time, or edit/delete that entry first.`;
  }

  getNextEntryId() {
    return this.entries.reduce((maxId, entry) => Math.max(maxId, entry.id), -1) + 1;
  }

  findNextEntryAfter(afterOffsetMins) {
    return findNextEntry(this.entries, afterOffsetMins, this.selectedID);
  }

  createEntry(entry) {
    const id = this.getNextEntryId();
    const dimensionIndex = this.dimensionIndex;
    if (typeof dimensionIndex !== 'number') {
      console.error('Problem with identifying dimension index', e.target);
      return;
    }
    // create entry
    this.store.dispatch({
      type: ADD_ENTRY,
      payload: {
        dimensionIndex,
        date: this.currentDate,
        ...entry,
        id,
      },
    });
  }

  updateEntry(entry) {
    const dimensionIndex = this.dimensionIndex;
    if (typeof dimensionIndex !== 'number') {
      console.error('Problem with identifying dimension index', e.target);
      return;
    }
    const index = this.entries.findIndex((entry) => entry.id === this.selectedID);
    this.store.dispatch({
      type: UPDATE_ENTRY,
      payload: {
        id: this.selectedID,
        dimensionIndex,
        date: this.currentDate,
        index,
        ...entry,
      },
    });
    this.selectedID = undefined;
  }

  deleteEntry(id) {
    const dimensionIndex = this.dimensionIndex;
    if (!this.entries.some((entry) => entry.id === id)) {
      // already gone (e.g. a stray double-click) - nothing to do
      return;
    }
    if (this.activeHandleEntryId === id) {
      this.hideHandles();
    }
    this.store.dispatch({
      type: DELETE_ENTRY,
      payload: { dimensionIndex, date: this.currentDate, id },
    });
    this.store.dispatch({
      type: HIDE_PANEL,
    });
    this.selectedID = undefined;
    this.panelActions.close();
    this.renderEntries();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (this[name] !== newValue) {
      this[name] = newValue;
    }
  }

  saveEntry(entry) {
    if (this.isSingleChoiceDimension) {
      const conflict = findOverlappingEntry(this.entries, entry, this.selectedID);
      if (conflict) {
        this.panelActions.reportSaveConflict(this.formatOverlapMessage(conflict));
        return;
      }
    }
    if (this.selectedID === undefined) {
      this.createEntry(entry);
    } else {
      this.updateEntry(entry);
    }
    this.store.dispatch({
      type: HIDE_PANEL,
    });
    this.panelActions.close();
    this.renderEntries();
  }

  render() {
    this.appendChild(this.fragment);
    this.innerHTML += `<el-details-panel
      ${this.setProps({
        saveEntry: (entry) => this.saveEntry(entry),
        deleteEntry: (id) => this.deleteEntry(id),
        findNextEntryAfter: (offsetMins) => this.findNextEntryAfter(offsetMins),
        registerPanelActions: (actions) => {
          this.panelActions = actions;
        },
      })}
      dimensionindex=${this[INDEX]}
      heading="${GLOBALS.DATA.timeline[this[INDEX]]?.description}"
      instruction="${GLOBALS.DATA.timeline[this[INDEX]]?.instruction}"
    ></el-details-panel>`;
  }
}

customElements.define('el-timeline', Timeline);
