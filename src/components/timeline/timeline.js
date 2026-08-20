import { TinyBase } from '../base';
import { getActivityColor } from '../../utils/activities';
import { findOverlappingEntry, findNextEntry } from '../../utils/entries';
import { formatOffsetAsClockTime, getCurrentOffsetMins } from '../../utils/time';
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
  detailsPanel;
  selectedID;
  shadowIndex = 0; // we want to render primary activities as shadow dimension on other dimensions
  entriesLayer;
  shadowEntriesLayer;
  shadowDimensionEntries;
  futureOverlayElement;

  constructor() {
    super();
    this.fragment = document.getElementById('svg-timeline').content.cloneNode(true);
  }

  connectedCallback() {
    const state = this.store.getState();
    this.dimensionIndex = Number(this.getAttribute(INDEX));
    const timeline = state.timelines[this.dimensionIndex];
    if (!Array.isArray(timeline)) {
      this.store.dispatch({
        type: ADD_TIMELINE,
        payload: { dimensionIndex: this.dimensionIndex },
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
    // get a handle on the details panel as you need to communicate with it
    this.detailsPanel = this.querySelector('el-details-panel');
  }

  updateFutureOverlay() {
    if (!this.futureOverlayElement) {
      return;
    }
    const nowOffsetPx = getCurrentOffsetMins() * PX_PER_MINUTE;
    const totalHeightPx = MINUTES_PER_DAY * PX_PER_MINUTE;
    this.futureOverlayElement.setAttributeNS(null, 'y', nowOffsetPx);
    this.futureOverlayElement.setAttributeNS(null, 'height', totalHeightPx - nowOffsetPx);
  }

  updateState() {
    const state = this.store.getState();
    const timeline = state.timelines[this.dimensionIndex];
    const currentDimensionIndex = state.currentDimensionIndex;
    this.entries = timeline;
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
    const nextShadowDimensionEntries = this.store.getState()?.timelines[dimensionIndex];
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
      this.ready = true;
    }
  }

  onTimelineClick(e) {
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
      this.detailsPanel.setStartTime(entry.startOffsetMins);
      this.detailsPanel.setEndTime(entry.endOffsetMins);
      this.detailsPanel.setActivity(entry.activity);
      this.detailsPanel.setEntryId(entry_id);
      // we need to do soemthing different on save
    } else {
      // starting a brand new entry - clear out anything left over from a
      // previous edit that was opened but never saved/deleted
      this.selectedID = undefined;
      this.detailsPanel.reset();
      const { offsetY } = e;
      const startOffsetMins = this.calculateTheTimeSlotClicked(offsetY >= 0 ? offsetY : 0);
      this.detailsPanel.setStartTime(startOffsetMins);
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
    this.store.dispatch({
      type: DELETE_ENTRY,
      payload: { dimensionIndex, id },
    });
    this.store.dispatch({
      type: HIDE_PANEL,
    });
    this.selectedID = undefined;
    this.detailsPanel.reset();
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
        this.detailsPanel.showError(this.formatOverlapMessage(conflict));
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
    this.detailsPanel.reset();
    this.renderEntries();
  }

  render() {
    this.appendChild(this.fragment);
    this.innerHTML += `<el-details-panel
      ${this.setProps({ saveEntry: (entry) => this.saveEntry(entry), deleteEntry: (id) => this.deleteEntry(id), findNextEntryAfter: (offsetMins) => this.findNextEntryAfter(offsetMins) })}
      dimensionindex=${this[INDEX]}
      heading="${GLOBALS.DATA.timeline[this[INDEX]]?.description}"
      instruction="${GLOBALS.DATA.timeline[this[INDEX]]?.instruction}"
    ></el-details-panel>`;
  }
}

customElements.define('el-timeline', Timeline);
