import { TinyBase } from '../base';
import '../horizontalTimelineAxis/horizontalTimelineAxis';
import '../horizontalTimeline/horizontalTimeline';
import { SWITCH_DIMENSION, SHOW_PANEL } from '../../store/actionTypes';
import './horizontalTimelineStack.css';

// Phase 10.6: mounts the shared axis + one HorizontalTimeline per Dimension,
// plus a single shared <el-details-panel> (not one per row - DetailsPanel
// hides itself unless its dimensionindex attribute matches the store's
// currentDimensionIndex, correct for the vertical swipe-between-dimensions
// model but incompatible with all six rows being visible at once here; its
// CSS is also explicitly "mobile only for now" - see the Phase 10.6 plan).
// This class orchestrates that shared panel: each row is injected with its
// own panelActions-shaped props (the same openEntry/openNewEntry/close/
// reportSaveConflict shape Timeline's own self-made panel exposes to
// itself), and the panel's own registerPanelActions is captured here too,
// so this class sits in the middle routing between whichever row is
// currently "active" and the one real panel instance.
export class HorizontalTimelineStack extends TinyBase {
  // its axis, rows and shared panel are built once and kept across a DOM
  // move - see TinyBase.connectedCallback
  static renderOnce = true;
  store = super.getStore();
  numTimelines = GLOBALS.DATA.timeline.length;
  panelElement;
  detailsPanelActions;
  activeDimensionIndex;
  rows = [];

  connectedCallback() {
    super.connectedCallback();
    this.getChildElementReferences();
  }

  getChildElementReferences() {
    this.panelElement = this.querySelector('el-details-panel');
    this.rows = [...this.querySelectorAll('el-horizontal-timeline')];
  }

  get activeRow() {
    return this.activeDimensionIndex !== undefined
      ? this.rows[this.activeDimensionIndex]
      : undefined;
  }

  // switches which row's entries the shared panel acts on. Only rebuilds
  // the panel (new dimensionindex/heading/instruction attributes + reset(),
  // which rebuilds its <el-activity-picker> fresh - ActivityPicker reads its
  // own dimensionindex once at construction, not on a later attribute
  // change, see the Phase 10.6 plan) on an actual change, not on repeat
  // clicks within the same row.
  activateRow(dimensionIndex) {
    const dimensionChanged = dimensionIndex !== this.activeDimensionIndex;
    this.activeDimensionIndex = dimensionIndex;
    if (dimensionChanged) {
      const dimensionData = GLOBALS.DATA.timeline[dimensionIndex];
      this.panelElement.setAttribute('dimensionindex', dimensionIndex);
      this.panelElement.setAttribute('heading', dimensionData?.description ?? '');
      this.panelElement.setAttribute('instruction', dimensionData?.instruction ?? '');
      this.panelElement.reset();
    }
    this.store.dispatch({ type: SWITCH_DIMENSION, payload: dimensionIndex });
    this.store.dispatch({ type: SHOW_PANEL, payload: 'details' });
  }

  openEntryForRow(dimensionIndex, entry) {
    this.activateRow(dimensionIndex);
    this.detailsPanelActions.openEntry(entry);
  }

  openNewEntryForRow(dimensionIndex, startOffsetMins) {
    this.activateRow(dimensionIndex);
    this.detailsPanelActions.openNewEntry(startOffsetMins);
  }

  // the panel's own registered actions (saveEntry/deleteEntry/
  // findNextEntryAfter) delegate to whichever row is currently active,
  // rather than implementing entry CRUD themselves - that logic already
  // lives on HorizontalTimeline (ported from Timeline), per row
  saveEntry(entry) {
    this.activeRow?.saveEntry(entry);
  }

  deleteEntry(id) {
    this.activeRow?.deleteEntry(id);
  }

  findNextEntryAfter(offsetMins) {
    return this.activeRow?.findNextEntryAfter(offsetMins);
  }

  // built via document.createElement()+appendChild() one at a time, not one
  // combined innerHTML string - mirrors TimelineStack.render()'s own loop
  // (the proven pattern for mounting several instances that each clone a
  // shared SVG <template>). A single innerHTML assignment inserts every
  // child in one batch, and jsdom's custom-element reaction-queue
  // processing for that many interdependent elements at once proved
  // unreliable in testing (intermittent null child-element references) -
  // appending one at a time, each fully constructed/connected before the
  // next starts, sidesteps that entirely.
  render() {
    const axis = document.createElement('el-horizontal-timeline-axis');
    this.appendChild(axis);

    for (let i = 0; i < this.numTimelines; i++) {
      const row = document.createElement('el-horizontal-timeline');
      row.setAttribute('index', i);
      row.setAttribute(
        'key',
        this.setProps(
          {
            openEntry: (entry) => this.openEntryForRow(i, entry),
            openNewEntry: (startOffsetMins) => this.openNewEntryForRow(i, startOffsetMins),
            close: () => this.detailsPanelActions?.close(),
            reportSaveConflict: (message) => this.detailsPanelActions?.reportSaveConflict(message),
          },
          true
        )
      );
      this.appendChild(row);
    }

    const panel = document.createElement('el-details-panel');
    // dimensionindex="0" is just a safe initial value so <el-activity-picker>
    // can construct at all (it reads GLOBALS.DATA.timeline[dimensionIndex]
    // unconditionally in its own constructor) - activateRow() overwrites
    // this with the real value, and calls reset() to rebuild it, before the
    // panel is ever actually shown to the user
    const dimensionZero = GLOBALS.DATA.timeline[0];
    panel.setAttribute('dimensionindex', '0');
    panel.setAttribute('heading', dimensionZero?.description ?? '');
    panel.setAttribute('instruction', dimensionZero?.instruction ?? '');
    panel.setAttribute(
      'key',
      this.setProps(
        {
          registerPanelActions: (actions) => {
            this.detailsPanelActions = actions;
          },
          saveEntry: (entry) => this.saveEntry(entry),
          deleteEntry: (id) => this.deleteEntry(id),
          findNextEntryAfter: (offsetMins) => this.findNextEntryAfter(offsetMins),
        },
        true
      )
    );
    this.appendChild(panel);
  }
}

customElements.define('el-horizontal-timeline-stack', HorizontalTimelineStack);
