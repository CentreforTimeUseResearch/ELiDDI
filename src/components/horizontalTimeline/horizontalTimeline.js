import { BaseTimeline } from '../timeline/baseTimeline';
import { renderEntryBlocks, visibleLength } from '../timeline/entryBlocks';
import { X_AXIS } from '../timeline/entryResizeController';
import { MINUTES_PER_DAY } from '../timeline/timelineConstants';
import { NATIVE_ZOOM, getEffectivePxPerMinute } from '../horizontalTimelineAxis/zoomConstants';
// .event-label is shared with the vertical timeline's entry labels - import
// its CSS directly rather than relying on timeline.js happening to already
// be loaded elsewhere, so this component's labels are styled correctly even
// mounted on its own
import '../timeline/timeline.css';
import './horizontalTimeline.css';

// matches #svg-horizontal-timeline-row's viewBox height in index.html - a
// row's bars always fill the full row height; the gap between stacked rows
// is HorizontalTimelineStack's CSS concern, not baked in here
const ROW_HEIGHT = 60;

// One Dimension's Timeline in the desktop layout: a horizontal row, one of
// up to six in HorizontalTimelineStack. What's its own, on top of
// BaseTimeline: zoom, and the row sizing that follows from it
// (updateDimensions). No Primary activity mirror strip.
//
// It does not own a details panel: HorizontalTimelineStack mounts one
// shared panel and injects each row's panelActions (openEntry/
// openNewEntry/close/reportSaveConflict) as this element's props. Nor does
// it dispatch SHOW_PANEL on a click - the stack does, reached through
// openEntry/openNewEntry, since it first has to detect a Dimension change
// to decide whether the shared panel needs a full reset().
export class HorizontalTimeline extends BaseTimeline {
  static templateId = 'svg-horizontal-timeline-row';
  static axis = X_AXIS;
  static crossAxisCenter = ROW_HEIGHT / 2;

  gridlineZoneElement;
  zoomLevel = NATIVE_ZOOM;

  connectedCallback() {
    this.zoomLevel = this.store.getState().horizontalZoomLevel;
    super.connectedCallback();
    this.updateDimensions();
  }

  getChildElementReferences() {
    super.getChildElementReferences();
    this.gridlineZoneElement = this.part('gridline-zone');
  }

  getPxPerMinute() {
    return getEffectivePxPerMinute(this.zoomLevel);
  }

  // keeps 1 viewBox unit = 1 CSS px as an invariant at every zoom level,
  // rather than ever relying on implicit viewBox-stretching - the row's own
  // height never changes, only its width. Also sets this host element's own
  // width to match the svg's, not just the svg's own attribute - see
  // HorizontalTimelineAxis.renderAxis()'s comment for why a too-wide
  // replaced child alone doesn't grow its parent's box.
  updateDimensions() {
    const totalWidthPx = MINUTES_PER_DAY * this.getPxPerMinute();
    this.timeLineElement.setAttribute('viewBox', `0 0 ${totalWidthPx} ${ROW_HEIGHT}`);
    this.timeLineElement.setAttribute('width', totalWidthPx);
    this.style.width = `${totalWidthPx}px`;
    this.gridlineZoneElement?.setAttribute('width', totalWidthPx);
  }

  updateState() {
    const state = this.store.getState();
    const dateChanged = this.syncEntriesFromStore(state);
    this.zoomLevel = state.horizontalZoomLevel;
    // re-render on every store update, not just a date/zoom change - an
    // entry for this dimension may have changed elsewhere (e.g. the
    // vertical timeline on a smaller breakpoint)
    this.updateDimensions();
    this.renderEntries();
    if (dateChanged) {
      this.dropSelectionFromPreviousDate();
    }
  }

  // doesn't touch `this`
  renderEntriesInto({
    layer,
    entries,
    dimensionIndex,
    effectivePxPerMinute = getEffectivePxPerMinute(NATIVE_ZOOM),
  }) {
    renderEntryBlocks(layer, entries, dimensionIndex, (entry) => {
      const x = (entry.startOffsetMins || 0) * effectivePxPerMinute;
      const width = visibleLength((entry.endOffsetMins || 0) * effectivePxPerMinute - x);
      const box = { x, y: 0, width, height: ROW_HEIGHT };
      return { block: box, label: box };
    });
  }

  renderEntries() {
    this.renderEntriesInto({
      layer: this.entriesLayer,
      entries: this.entries,
      dimensionIndex: this.dimensionIndex,
      effectivePxPerMinute: this.getPxPerMinute(),
    });
  }
}

customElements.define('el-horizontal-timeline', HorizontalTimeline);
