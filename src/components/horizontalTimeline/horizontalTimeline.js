import { TinyBase } from '../base';
import { getActivityColor } from '../../utils/activities';
import { ADD_TIMELINE } from '../../store/actionTypes';
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
const ROW_HEIGHT = 110;
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
// 10.5: geometry is recomputed from the current horizontalZoomLevel on every
// store update, keeping 1 viewBox unit = 1 CSS px at every zoom level). No
// click-to-add/select or drag-resize yet (Phase 10.6), no shadow-dimension
// strip (see the Phase 10.3 plan's decision to omit it).
export class HorizontalTimeline extends TinyBase {
  static observedAttributes = [INDEX];

  ready = false;
  store = super.getStore();
  fragment;
  timeLineElement;
  entriesLayer;
  entries = [];
  dimensionIndex;
  currentDate;
  zoomLevel = NATIVE_ZOOM;

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
    this.registerCleanup(this.store.subscribe(() => this.updateState()));
    this.getChildElementReferences();
    this.updateDimensions();
    this.renderEntries();
  }

  getChildElementReferences() {
    this.timeLineElement = this.querySelector('svg');
    this.entriesLayer = this.timeLineElement.querySelector('#events');
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
  }

  updateState() {
    const state = this.store.getState();
    this.currentDate = state.currentDate;
    this.zoomLevel = state.horizontalZoomLevel;
    this.entries = state.diaries[this.currentDate]?.timelines[this.dimensionIndex] ?? EMPTY_ENTRIES;
    // re-render on every store update, not just a date/zoom change - an
    // entry for this dimension may have changed elsewhere (e.g. the
    // vertical timeline on a smaller breakpoint), and there's no
    // interaction loop of its own yet (Phase 10.6) to otherwise trigger a
    // re-render after an edit
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

  attributeChangedCallback(name, oldValue, newValue) {
    if (this[name] !== newValue) {
      this[name] = newValue;
    }
  }

  render() {
    this.appendChild(this.fragment);
  }
}

customElements.define('el-horizontal-timeline', HorizontalTimeline);
