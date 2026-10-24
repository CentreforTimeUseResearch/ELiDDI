import { TinyBase } from '../base';
import { getActivityColor } from '../../utils/activities';
import { findOverlappingEntry, findNextEntry } from '../../utils/entries';
import { formatOffsetAsClockTime } from '../../utils/time';
import {
  ADD_TIMELINE,
  ADD_ENTRY,
  UPDATE_ENTRY,
  DELETE_ENTRY,
  HIDE_PANEL,
} from '../../store/actionTypes';
import { EntryResizeController, X_AXIS } from '../timeline/entryResizeController';
import { SVGNS, XHTMLNS, MINUTES_PER_DAY } from '../timeline/timelineConstants';
import { NATIVE_ZOOM, getEffectivePxPerMinute } from '../horizontalTimelineAxis/zoomConstants';
// .event-label is shared with the vertical timeline's entry labels - import
// its CSS directly rather than relying on timeline.js happening to already
// be loaded elsewhere, so this component's labels are styled correctly even
// mounted on its own (e.g. this phase's standalone live preview/tests)
import '../timeline/timeline.css';
import './horizontalTimeline.css';

const INDEX = 'index';
// matches #svg-horizontal-timeline-row's viewBox height in index.html - a
// row's bars always fill the full row height; the gap between stacked rows
// is a Phase 10.4 (HorizontalTimelineStack) CSS concern, not baked in here
const ROW_HEIGHT = 60;
const LABEL_FONT_SIZE = 14; // DESIGN.md caption token - see the Phase 10.1 visual-spec decision
const EMPTY_ENTRIES = [];

// builds a <foreignObject> containing an HTML div for the entry label, axis-
// swapped from timeline.js's createLabelForeignObject: x/width vary with the
// entry's time range, y/height are fixed to the row - see Timeline's version
// for why a foreignObject+div is used instead of SVG <text> (wrapping, and
// the 14px label floor scaling independently of the bar geometry)
function createLabelForeignObject({ x, width, label, id }) {
  const foreignObject = document.createElementNS(SVGNS, 'foreignObject');
  foreignObject.setAttributeNS(null, 'x', x);
  foreignObject.setAttributeNS(null, 'y', 0);
  foreignObject.setAttributeNS(null, 'width', width > 0 ? width : 20);
  foreignObject.setAttributeNS(null, 'height', ROW_HEIGHT);

  const label_div = document.createElementNS(XHTMLNS, 'div');
  label_div.className = 'event-label';
  label_div.style.fontSize = `${LABEL_FONT_SIZE}px`;
  label_div.title = label;
  label_div.setAttribute('data-id', id);
  label_div.textContent = label;

  foreignObject.appendChild(label_div);
  return foreignObject;
}

// One Dimension's entries rendered as a horizontal row, zoom-aware (Phase
// 10.5) and interactive (Phase 10.6): click-to-add/select, long-press to
// reveal resize handles, drag-to-resize - ported from timeline.js, axis-
// swapped via EntryResizeController's X_AXIS config. No shadow-dimension
// strip (see the Phase 10.3 plan's decision to omit it).
//
// panelActions differs from Timeline's: this component does not own/create
// its own <el-details-panel> - HorizontalTimelineStack mounts a single
// shared panel and injects each row with a panelActions-shaped props object
// (openEntry/openNewEntry/close/reportSaveConflict) via setProps/key, same
// shape Timeline's own self-made panel registers for itself. Unlike
// Timeline.onTimelineClick, this component does not dispatch
// SWITCH_DIMENSION/SHOW_PANEL itself - that's the stack's job (it needs to
// detect an actual dimension change first, to decide whether the shared
// panel needs a full reset()), reached via the injected openEntry/
// openNewEntry closures.
export class HorizontalTimeline extends TinyBase {
  static observedAttributes = [INDEX];

  ready = false;
  store = super.getStore();
  fragment;
  timeLineElement;
  entriesLayer;
  handlesLayer;
  gridlineZoneElement;
  entries = [];
  panelActions;
  selectedID;
  dimensionIndex;
  currentDate;
  zoomLevel = NATIVE_ZOOM;
  resizeController;

  constructor() {
    super();
    this.fragment = document.getElementById('svg-horizontal-timeline-row').content.cloneNode(true);
  }

  connectedCallback() {
    const state = this.store.getState();
    this.dimensionIndex = Number(this.getAttribute(INDEX));
    this.currentDate = state.currentDate;
    this.zoomLevel = state.horizontalZoomLevel;
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
    this.panelActions = this.props;
    this.registerCleanup(this.store.subscribe(() => this.updateState()));
    this.getChildElementReferences();
    this.updateDimensions();
    this.renderEntries();

    this.resizeController = new EntryResizeController({
      svg: this.timeLineElement,
      entriesLayer: this.entriesLayer,
      handlesLayer: this.handlesLayer,
      getEntries: () => this.entries,
      isSingleChoiceDimension: () => this.isSingleChoiceDimension,
      getCurrentDate: () => this.currentDate,
      isPanelOpen: () => this.store.getState().uipanel === 'details',
      clientToSvgCoord: (clientX, clientY) => this.clientXToSvgX(clientX, clientY),
      calculateTheTimeSlotClicked: (x) => this.calculateTheTimeSlotClicked(x),
      axis: X_AXIS,
      getPxPerMinute: () => getEffectivePxPerMinute(this.zoomLevel),
      crossAxisCenter: ROW_HEIGHT / 2,
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

    this.assignEventHandlers();
  }

  // Uses attribute selectors ('[id="x"]'), not ID selectors ('#x') - up to
  // six HorizontalTimeline rows are mounted simultaneously (HorizontalTimelineStack),
  // each cloning the same template, so ids like #events are duplicated
  // across the document. Real browsers correctly scope a #id selector to
  // the calling element's own subtree regardless of document-wide
  // duplicates, but jsdom (this project's test environment) doesn't -
  // confirmed empirically: querySelector('#events') on a second instance's
  // own <svg> returned null while the id was genuinely present, even though
  // querySelector('[id="events"]') found it correctly. Attribute selectors
  // sidestep whatever fast-path jsdom's ID matching takes, with identical
  // results in real browsers.
  getChildElementReferences() {
    this.timeLineElement = this.querySelector('svg');
    this.entriesLayer = this.timeLineElement.querySelector('[id="events"]');
    this.gridlineZoneElement = this.timeLineElement.querySelector('[id="gridline_zone"]');
    // real markup (index.html) always has this above #events; test fixtures
    // that build a minimal <svg> don't, so fall back to creating it -
    // appended last so it renders above entries either way (mirrors
    // Timeline's own getChildElementReferences)
    this.handlesLayer = this.timeLineElement.querySelector('[id="drag-handles"]');
    if (!this.handlesLayer) {
      this.handlesLayer = document.createElementNS(SVGNS, 'g');
      this.handlesLayer.setAttribute('id', 'drag-handles');
      (this.entriesLayer?.parentNode ?? this.timeLineElement).appendChild(this.handlesLayer);
    }
  }

  // keeps 1 viewBox unit = 1 CSS px as an invariant at every zoom level,
  // rather than ever relying on implicit viewBox-stretching (see the Phase
  // 10.5 plan) - the row's own height never changes, only its width. Also
  // sets this host element's own width to match the svg's, not just the
  // svg's own attribute - see HorizontalTimelineAxis.renderAxis()'s comment
  // for why a too-wide replaced child alone doesn't grow its parent's box.
  updateDimensions() {
    const totalWidthPx = MINUTES_PER_DAY * getEffectivePxPerMinute(this.zoomLevel);
    this.timeLineElement.setAttribute('viewBox', `0 0 ${totalWidthPx} ${ROW_HEIGHT}`);
    this.timeLineElement.setAttribute('width', totalWidthPx);
    this.style.width = `${totalWidthPx}px`;
    this.gridlineZoneElement?.setAttribute('width', totalWidthPx);
  }

  updateState() {
    const state = this.store.getState();
    this.currentDate = state.currentDate;
    this.zoomLevel = state.horizontalZoomLevel;
    this.entries = state.diaries[this.currentDate]?.timelines[this.dimensionIndex] ?? EMPTY_ENTRIES;
    // re-render on every store update, not just a date/zoom change - an
    // entry for this dimension may have changed elsewhere (e.g. the
    // vertical timeline on a smaller breakpoint)
    this.updateDimensions();
    this.renderEntries();
  }

  // entry element looks like this:
  // <g>
  //   <rect class="event-block" x="120" y="0" width="60" height="110" fill="#9aa0c3" fill-opacity="0.45" />
  //   <foreignObject x="120" y="0" width="60" height="110"><div class="event-label">c/ch</div></foreignObject>
  // </g>
  renderEntriesInto({
    layer,
    entries,
    dimensionIndex,
    effectivePxPerMinute = getEffectivePxPerMinute(NATIVE_ZOOM),
  }) {
    layer.innerHTML = '';

    const dimensionData = GLOBALS.DATA.timeline[dimensionIndex];

    entries.forEach((entry) => {
      const entryGroup = document.createElementNS(SVGNS, 'g');
      const rect = document.createElementNS(SVGNS, 'rect');
      const startOffsetPx = (entry.startOffsetMins || 0) * effectivePxPerMinute;
      const endOffsetPx = (entry.endOffsetMins || 0) * effectivePxPerMinute;
      const width = endOffsetPx - startOffsetPx;
      rect.setAttributeNS(null, 'x', startOffsetPx);
      rect.setAttributeNS(null, 'y', '0');
      rect.setAttributeNS(null, 'width', width > 0 ? width : 20);
      rect.setAttributeNS(null, 'height', ROW_HEIGHT);
      rect.setAttributeNS(null, 'fill', getActivityColor(dimensionData, entry.activity));
      rect.setAttributeNS(null, 'fill-opacity', '0.45');
      rect.setAttributeNS(null, 'data-id', entry.id);
      entryGroup.appendChild(rect);

      const label = Array.isArray(entry.activity) ? entry.activity.join(', ') : entry.activity;
      const labelForeignObject = createLabelForeignObject({
        x: startOffsetPx,
        width,
        label,
        id: entry.id,
      });
      entryGroup.appendChild(labelForeignObject);

      layer.appendChild(entryGroup);
    });
  }

  renderEntries() {
    this.renderEntriesInto({
      layer: this.entriesLayer,
      entries: this.entries,
      dimensionIndex: this.dimensionIndex,
      effectivePxPerMinute: getEffectivePxPerMinute(this.zoomLevel),
    });
  }

  calculateTheTimeSlotClicked(x) {
    // zoom-aware, unlike Timeline's fixed-constant version - the vertical
    // timeline has no zoom, so PX_PER_MINUTE alone is always correct there
    return Math.floor(x / (getEffectivePxPerMinute(this.zoomLevel) * 10)) * 10;
  }

  assignEventHandlers() {
    if (!this.ready) {
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
      // belt-and-braces against the stack's horizontal scroll (see
      // horizontalTimelineStack.css's overflow-x: auto) panning during a
      // touch drag - axis-flipped from Timeline's own vertical-scroll
      // defense, see timeline.js for the full reasoning
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
  // coordinate space - axis-swapped from Timeline.clientYToSvgY, reads .x
  // instead of .y off the transformed point. See that method's own comment
  // for why this goes through getScreenCTM()/matrixTransform() rather than
  // assuming a 1:1 CSS-px-to-viewBox-unit mapping.
  clientXToSvgX(clientX, clientY) {
    const svg = this.timeLineElement;
    if (typeof svg?.createSVGPoint !== 'function' || typeof svg.getScreenCTM !== 'function') {
      return clientX; // no SVG geometry support (e.g. a test environment)
    }
    const ctm = svg.getScreenCTM();
    if (!ctm) {
      return clientX;
    }
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    return point.matrixTransform(ctm.inverse()).x;
  }

  onGlobalKeyDown(e) {
    this.resizeController.handleGlobalKeyDown(e);
  }

  // unlike Timeline.onTimelineClick, this does not dispatch SWITCH_DIMENSION
  // or SHOW_PANEL itself - that's HorizontalTimelineStack's job (reached via
  // panelActions.openEntry/openNewEntry below), since it needs to detect an
  // actual dimension change first to decide whether the shared panel needs
  // a full reset() (see the Phase 10.6 plan)
  onTimelineClick(e) {
    if (e.target?.closest?.('.resize-handle')) {
      return;
    }
    if (this.resizeController.consumeSuppressedClick()) {
      return;
    }
    if (this.resizeController.activeHandleEntryId !== undefined) {
      this.resizeController.hideHandles();
    }
    const element_id = e.target?.dataset?.id;
    if (element_id !== undefined) {
      const entry_id = Number(element_id);
      // see Timeline.onTimelineClick - a miss covers malformed and stale ids
      const entry = this.entries.find((entry) => entry.id === entry_id);
      if (!entry) {
        console.error('Problem with identifying entry from click', e.target);
        return;
      }
      this.selectedID = entry_id;
      this.panelActions.openEntry(entry);
    } else {
      if (e.target.id !== 'gridline_zone') {
        return;
      }
      this.selectedID = undefined;
      const svgX = this.clientXToSvgX(e.clientX, e.clientY);
      const startOffsetMins = this.calculateTheTimeSlotClicked(svgX >= 0 ? svgX : 0);
      this.panelActions.openNewEntry(startOffsetMins);
    }
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
    if (!Number.isInteger(dimensionIndex)) {
      console.error('Problem with identifying dimension index', dimensionIndex);
      return;
    }
    this.store.dispatch({
      type: ADD_ENTRY,
      payload: {
        dimensionIndex,
        date: this.currentDate,
        ...entry,
        id,
      },
    });
    return id;
  }

  updateEntry(entry) {
    const dimensionIndex = this.dimensionIndex;
    if (!Number.isInteger(dimensionIndex)) {
      console.error('Problem with identifying dimension index', dimensionIndex);
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
      return;
    }
    this.resizeController.hideHandlesIfActiveFor(id);
    this.store.dispatch({
      type: DELETE_ENTRY,
      payload: { dimensionIndex, date: this.currentDate, id },
    });
    this.store.dispatch({ type: HIDE_PANEL });
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
    let newEntryId;
    if (this.selectedID === undefined) {
      newEntryId = this.createEntry(entry);
    } else {
      this.updateEntry(entry);
    }
    this.store.dispatch({ type: HIDE_PANEL });
    this.panelActions.close();
    this.renderEntries();
    if (newEntryId !== undefined) {
      const createdEntry = this.entries.find((entry) => entry.id === newEntryId);
      if (createdEntry) {
        this.resizeController.showHandles(createdEntry);
      }
    }
  }

  render() {
    this.appendChild(this.fragment);
  }
}

customElements.define('el-horizontal-timeline', HorizontalTimeline);
