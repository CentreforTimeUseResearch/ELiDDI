import { SWITCH_DIMENSION, SHOW_PANEL } from '../../store/actionTypes';

// The app has ONE <el-details-panel>, in both layouts (ADR 0005). Each stack
// (TimelineStack on mobile, HorizontalTimelineStack on desktop) owns one of
// these, which:
//   - creates the panel and wires its props to whichever Timeline belongs
//     to the current Dimension
//   - gives each Timeline its panelActions (open an Entry, start one, close,
//     report a save conflict)
//   - follows the current Dimension, however it changes (a swipe, the
//     Timeline picker, a click on another row): the panel is retargeted to
//     the new Dimension and stays open or closed as it was
//   - keeps an unsaved draft per Dimension: switching away parks the
//     panel's draft, switching back restores it. A draft ends when it's
//     saved or deleted (the panel resets), or when the Diary date changes.
// Plain class, no element of its own; the stack subscribes onStoreUpdate.
export class DetailsPanelCoordinator {
  panel;
  panelActions; // what the panel registers: openEntry / openNewEntry / close / reportSaveConflict
  dimensionIndex;
  currentDate;
  drafts = new Map(); // Dimension index -> the panel's state when it was switched away from

  // getTimeline(dimensionIndex) -> that Dimension's Timeline element
  constructor({ store, getTimeline }) {
    this.store = store;
    this.getTimeline = getTimeline;
    const { currentDimensionIndex, currentDate } = store.getState();
    this.dimensionIndex = currentDimensionIndex ?? 0;
    this.currentDate = currentDate;
  }

  // the one panel, for the current Dimension. setProps is the owning
  // stack's, so the props keys are released with it
  createPanel(setProps) {
    this.panel = document.createElement('el-details-panel');
    this.applyDimension(this.dimensionIndex);
    this.panel.setAttribute(
      'key',
      setProps(
        {
          registerPanelActions: (actions) => {
            this.panelActions = actions;
          },
          saveEntry: (entry) => this.activeTimeline()?.saveEntry(entry),
          deleteEntry: (id) => this.activeTimeline()?.deleteEntry(id),
          findNextEntryAfter: (offsetMins) => this.activeTimeline()?.findNextEntryAfter(offsetMins),
        },
        true
      )
    );
    return this.panel;
  }

  // the panelActions injected into the Timeline for `dimensionIndex`
  timelineProps(dimensionIndex) {
    return {
      openEntry: (entry) => this.openFor(dimensionIndex, (actions) => actions.openEntry(entry)),
      openNewEntry: (startOffsetMins) =>
        this.openFor(dimensionIndex, (actions) => actions.openNewEntry(startOffsetMins)),
      close: () => this.panelActions?.close(),
      reportSaveConflict: (message) => this.panelActions?.reportSaveConflict(message),
    };
  }

  // makes `dimensionIndex` current (onStoreUpdate retargets the panel),
  // shows the panel, then opens what was clicked - which replaces any draft
  // that Dimension had parked
  openFor(dimensionIndex, open) {
    this.store.dispatch({ type: SWITCH_DIMENSION, payload: dimensionIndex });
    this.store.dispatch({ type: SHOW_PANEL, payload: 'details' });
    open(this.panelActions);
  }

  onStoreUpdate() {
    const { currentDimensionIndex, currentDate } = this.store.getState();
    if (currentDate !== this.currentDate) {
      // drafts belong to a date; each Timeline also drops its selection
      this.currentDate = currentDate;
      this.drafts.clear();
      this.panelActions?.close();
    }
    if (currentDimensionIndex !== undefined && currentDimensionIndex !== this.dimensionIndex) {
      this.switchTo(currentDimensionIndex);
    }
  }

  activeTimeline() {
    return this.getTimeline(this.dimensionIndex);
  }

  switchTo(dimensionIndex) {
    this.parkDraft();
    this.dimensionIndex = dimensionIndex;
    this.applyDimension(dimensionIndex);
    // ActivityPicker reads its Dimension once, at construction, so the
    // panel's content is rebuilt for the new one
    this.panel?.reset();
    this.restoreDraft();
  }

  applyDimension(dimensionIndex) {
    const dimension = GLOBALS.DATA.timeline[dimensionIndex];
    this.panel?.setAttribute('dimensionindex', dimensionIndex);
    this.panel?.setAttribute('heading', dimension?.description ?? '');
    this.panel?.setAttribute('instruction', dimension?.instruction ?? '');
  }

  parkDraft() {
    const draft = { ...(this.panel?.state ?? {}) };
    if (Object.keys(draft).length > 0) {
      this.drafts.set(this.dimensionIndex, draft);
    } else {
      this.drafts.delete(this.dimensionIndex);
    }
  }

  restoreDraft() {
    const draft = this.drafts.get(this.dimensionIndex);
    if (!draft || !this.panel) {
      return;
    }
    this.drafts.delete(this.dimensionIndex);
    if (typeof draft.startOffsetMins === 'number') this.panel.setStartTime(draft.startOffsetMins);
    if (typeof draft.endOffsetMins === 'number') this.panel.setEndTime(draft.endOffsetMins);
    if (draft.activity !== undefined) this.panel.setActivity(draft.activity);
    if (draft.id !== undefined) this.panel.setEntryId(draft.id);
  }
}
