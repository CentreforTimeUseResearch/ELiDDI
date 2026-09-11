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
import { EntryResizeController } from './entryResizeController';
import { SVGNS, XHTMLNS, PX_PER_MINUTE, MINUTES_PER_DAY } from './timelineConstants';
import './timeline.css';

const INDEX = 'index';
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
  resizeController; // owns the long-press/drag/resize-handle pipeline - see entryResizeController.js

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
    this.resizeController = new EntryResizeController({
      svg: this.timeLineElement,
      entriesLayer: this.entriesLayer,
      handlesLayer: this.handlesLayer,
      getEntries: () => this.entries,
      isSingleChoiceDimension: () => this.isSingleChoiceDimension,
      getCurrentDate: () => this.currentDate,
      isPanelOpen: () => this.store.getState().uipanel === 'activity',
      clientYToSvgY: (clientX, clientY) => this.clientYToSvgY(clientX, clientY),
      calculateTheTimeSlotClicked: (y) => this.calculateTheTimeSlotClicked(y),
      onCommitResize: (entryId, { startOffsetMins, endOffsetMins }) => {
        const entry = this.entries.find((entry) => entry.id === entryId);
        if (!entry) {
          return undefined;
        }
        this.selectedID = entryId;
        this.updateEntry({ ...entry, startOffsetMins, endOffsetMins });
        this.renderEntries();
        return this.entries.find((entry) => entry.id === entryId);
      },
    });
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
      this.resizeController.hideHandles(); // the entry any showing handles belonged to may no longer exist on the new date
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
        this.resizeController.onEntryPointerDown(e);
      });
      this.timeLineElement?.addEventListener('pointermove', (e) => {
        this.resizeController.onEntryPointerMove(e);
      });
      this.timeLineElement?.addEventListener('pointerup', (e) => {
        this.resizeController.handlePointerUp(e);
      });
      this.timeLineElement?.addEventListener('pointercancel', (e) => {
        this.resizeController.handlePointerCancel(e);
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
          this.resizeController.handleTouchStart(e);
        },
        { passive: false }
      );
      this.timeLineElement?.addEventListener(
        'touchmove',
        (e) => {
          this.resizeController.handleTouchMove(e);
        },
        { passive: false }
      );
      const onKeyDown = (e) => this.onGlobalKeyDown(e);
      document.addEventListener('keydown', onKeyDown);
      this.registerCleanup(() => document.removeEventListener('keydown', onKeyDown));
      this.ready = true;
    }
  }

  // Phase 1-4 of the drag-handle resize feature (see
  // plans/drag-handle-resize.md) - long-press to reveal handles, drag to
  // live-resize, commit/cancel on release - lives in EntryResizeController
  // (entryResizeController.js). These are thin delegating wrappers, kept so
  // this remains the single entry point external callers (and the existing
  // test suite) use; the controller itself is only reachable from inside
  // Timeline via the event listeners wired up in assignEventHandlers.
  onEntryPointerDown(e) {
    this.resizeController.onEntryPointerDown(e);
  }

  onEntryPointerMove(e) {
    this.resizeController.onEntryPointerMove(e);
  }

  commitDrag() {
    this.resizeController.commitDrag();
  }

  cancelDrag() {
    this.resizeController.cancelDrag();
  }

  get activeDrag() {
    return this.resizeController.activeDrag;
  }

  get activeHandleEntryId() {
    return this.resizeController.activeHandleEntryId;
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

  onGlobalKeyDown(e) {
    this.resizeController.handleGlobalKeyDown(e);
  }

  onTimelineClick(e) {
    if (e.target?.closest?.('.resize-handle')) {
      // a click landing on a handle itself is never a normal timeline click
      return;
    }
    if (this.resizeController.consumeSuppressedClick()) {
      return;
    }
    if (this.resizeController.activeHandleEntryId !== undefined) {
      // any real click - elsewhere on the timeline, or on a different entry -
      // dismisses whatever handles are currently showing
      this.resizeController.hideHandles();
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
    this.resizeController.hideHandlesIfActiveFor(id);
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
