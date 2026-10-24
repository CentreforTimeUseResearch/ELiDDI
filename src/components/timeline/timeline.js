import { getCurrentOffsetMins, getCurrentDiaryDateKey } from '../../utils/time';
import { SHOW_PANEL } from '../../store/actionTypes';
import { BaseTimeline, EMPTY_ENTRIES } from './baseTimeline';
import { renderEntryBlocks, visibleLength } from './entryBlocks';
import { Y_AXIS } from './entryResizeController';
import { PX_PER_MINUTE, MINUTES_PER_DAY } from './timelineConstants';
import './timeline.css';

const INDEX = 'index';

// One Dimension's Timeline in the mobile (vertical) layout. What's its own,
// on top of BaseTimeline: the Primary activity mirror strip (the "shadow"
// layer - Primary activity Entries drawn alongside every other Dimension),
// the future overlay greying out the rest of today, and its own
// <el-details-panel>, which registers this Timeline's panelActions.
export class Timeline extends BaseTimeline {
  static templateId = 'svg-timeline';
  static axis = Y_AXIS;
  static crossAxisCenter = 100 + 220 / 2; // matches the entriesLayer block's x="100" width="220"

  shadowIndex = 0; // the Dimension mirrored onto every other one: Primary activity
  shadowEntriesLayer;
  shadowDimensionEntries;
  futureOverlayElement;

  connectedCallback() {
    super.connectedCallback();
    this.updateFutureOverlay();
    const futureOverlayIntervalId = setInterval(this.updateFutureOverlay.bind(this), 30000);
    this.registerCleanup(() => clearInterval(futureOverlayIntervalId));
    if (this.dimensionIndex !== this.shadowIndex) {
      this.renderShadowDimension();
    }
  }

  getChildElementReferences() {
    super.getChildElementReferences();
    this.shadowEntriesLayer = this.timeLineElement.querySelector('[id="timeline-shadow"]');
    this.futureOverlayElement = this.timeLineElement.querySelector('[id="future-overlay"]');
  }

  getPxPerMinute() {
    return PX_PER_MINUTE;
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
    if (this.syncEntriesFromStore(state)) {
      // every mounted dimension's entries potentially changed wholesale -
      // unlike an edit (which the acting Timeline instance already
      // re-renders itself after), nothing else triggers a re-render here
      this.renderEntries();
      this.updateFutureOverlay();
      this.resizeController.hideHandles(); // the entry any showing handles belonged to may no longer exist on the new date
      this.dropSelectionFromPreviousDate();
    }
    if (
      this.dimensionIndex !== this.shadowIndex &&
      state.currentDimensionIndex === this.dimensionIndex
    ) {
      // this is not primary activity timeline and we're currently viewing this timeline
      this.renderShadowDimension(); // render primary activity entries as shadow timeline
    }
  }

  // Shared renderer for both the primary entries layer and the mirror
  // (shadow) layer - they only differ in which entries/layer they draw into
  // and how wide each block is, since the mirror is a narrower strip
  // alongside the full-width entries. Doesn't touch `this`.
  renderEntriesInto({ layer, entries, dimensionIndex, blockWidth, labelX, labelWidth }) {
    renderEntryBlocks(layer, entries, dimensionIndex, (entry) => {
      const y = (entry.startOffsetMins || 0) * PX_PER_MINUTE;
      const height = visibleLength((entry.endOffsetMins || 0) * PX_PER_MINUTE - y);
      return {
        block: { x: '100', y, width: blockWidth, height },
        label: { x: labelX, y, width: labelWidth, height },
      };
    });
  }

  renderEntries() {
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

  // this Timeline owns its details panel, so it opens it itself (unlike
  // HorizontalTimeline, whose stack does)
  onPanelOpened() {
    this.store.dispatch({
      type: SHOW_PANEL,
      payload: 'details',
    });
  }

  render() {
    super.render();
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
      heading="${GLOBALS.DATA.timeline[this[INDEX]]?.description ?? ''}"
      instruction="${GLOBALS.DATA.timeline[this[INDEX]]?.instruction ?? ''}"
    ></el-details-panel>`;
  }
}

customElements.define('el-timeline', Timeline);
