import { TinyBase } from '../base';
import { ADD_TIMELINE, HIDE_PANEL } from '../../store/actionTypes';
import { EntryResizeController } from './entryResizeController';
import { EntryCreateController } from './entryCreateController';
import { CreatePreview } from './createPreview';
import { TimelineKeyboard } from './timelineKeyboard';
import { clampCreateSpan, getNowLimitOffsetMins } from './createSpan';
import { EntryCommands, formatOverlapMessage } from './entryCommands';
import { SVGNS } from './timelineConstants';

const INDEX = 'index';

// a stable shared reference, so a not-yet-touched Dimension/date compares
// === equal to itself across store updates
export const EMPTY_ENTRIES = [];

// Everything one Dimension's Timeline does regardless of layout: reading its
// Entries from the store, click routing (select an Entry / start a new one),
// long-press-to-resize via EntryResizeController, press-and-drag to create via
// EntryCreateController, and saving/deleting via EntryCommands. See docs/adr/0003-one-timeline-base-for-both-layouts.md.
//
// A subclass supplies the layout:
//   static templateId       the <template> its SVG is cloned from
//   static axis             Y_AXIS or X_AXIS (entryResizeController.js)
//   static crossAxisCenter  where resize handles sit across the time axis
//   static crossAxisBox     { start, size }: where an Entry block sits across it
//   getPxPerMinute()        time-axis scale
//   drawEntries()           draws this.entries (see entryBlocks.js); callers use
//                           renderEntries(), which keeps keyboard focus across it
//   updateState()           what a store update redraws
// and may extend connectedCallback and getChildElementReferences. Its
// panelActions are always injected as props by the stack that owns the one
// shared details panel (DetailsPanelCoordinator, ADR 0005).
export class BaseTimeline extends TinyBase {
  static observedAttributes = [INDEX];
  // the SVG and (for Timeline) the details panel are built once and kept
  // across a DOM move - see TinyBase.connectedCallback
  static renderOnce = true;

  store = super.getStore();
  fragment;
  timeLineElement;
  entriesLayer;
  handlesLayer;
  entries = [];
  panelActions; // openEntry / openNewEntry / close / reportSaveConflict
  selectedID; // the Entry open in the details panel, if any
  dimensionIndex;
  currentDate;
  resizeController; // owns the long-press/drag/resize-handle pipeline
  createController; // owns the press-and-drag-to-create gesture
  createPreview; // the provisional block shown while a new Entry is open
  keyboard; // keyboard access: roving focus, names, Enter (timelineKeyboard.js)
  entryCommands;

  constructor() {
    super();
    this.fragment = document.getElementById(this.constructor.templateId).content.cloneNode(true);
    this.entryCommands = new EntryCommands({
      store: this.store,
      getDimensionIndex: () => this.dimensionIndex,
      getCurrentDate: () => this.currentDate,
      getEntries: () => this.entries,
    });
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
    // injected by the stack, whose one shared panel (ADR 0005) it opens
    this.panelActions = this.props;
    this.registerCleanup(this.store.subscribe(() => this.updateState()));
    this.registerCleanup(this.store.subscribe(() => this.syncCreatePreview()));
    this.registerCleanup(this.store.subscribe(() => this.syncKeyboardFocus()));
    this.getChildElementReferences();

    this.listen(document, 'keydown', (e) => this.onGlobalKeyDown(e));
    this.resizeController = this.createResizeController();
    this.registerCleanup(() => this.resizeController.destroy());
    this.createPreview = new CreatePreview({
      container: this.entriesLayer?.parentNode ?? this.timeLineElement,
      axis: this.constructor.axis,
      getPxPerMinute: () => this.getPxPerMinute(),
      crossBox: this.constructor.crossAxisBox,
    });
    this.createController = this.createCreateController();
    this.registerCleanup(() => this.createController.destroy());
    this.keyboard = this.createKeyboard();
    this.registerCleanup(() => this.keyboard.destroy());
    this.assignEventHandlers();
    this.renderEntries();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (this[name] !== newValue) {
      this[name] = newValue;
    }
  }

  render() {
    this.appendChild(this.fragment);
  }

  // The SVG's parts are named with data-part, not id: one Timeline is
  // mounted per Dimension, each cloning the same template, so an id would be
  // repeated in the document (#170)
  getChildElementReferences() {
    this.timeLineElement = this.querySelector('svg');
    this.entriesLayer = this.part('events');
    // real markup (index.html) always has this above #events; test fixtures
    // that build a minimal <svg> don't, so fall back to creating it -
    // appended last so it renders above entries either way
    this.handlesLayer = this.part('drag-handles');
    if (!this.handlesLayer) {
      this.handlesLayer = document.createElementNS(SVGNS, 'g');
      this.handlesLayer.setAttribute('data-part', 'drag-handles');
      (this.entriesLayer?.parentNode ?? this.timeLineElement).appendChild(this.handlesLayer);
    }
  }

  // the element named data-part="<name>" in this Timeline's SVG
  part(name) {
    return this.timeLineElement.querySelector(`[data-part="${name}"]`);
  }

  createResizeController() {
    return new EntryResizeController({
      svg: this.timeLineElement,
      entriesLayer: this.entriesLayer,
      handlesLayer: this.handlesLayer,
      getEntries: () => this.entries,
      isSingleChoiceDimension: () => this.isSingleChoiceDimension,
      getCurrentDate: () => this.currentDate,
      isPanelOpen: () => this.store.getState().uipanel === 'details',
      clientToSvgCoord: (clientX, clientY) => this.clientToSvgCoord(clientX, clientY),
      calculateTheTimeSlotClicked: (coord) => this.calculateTheTimeSlotClicked(coord),
      axis: this.constructor.axis,
      getPxPerMinute: () => this.getPxPerMinute(),
      crossAxisCenter: this.constructor.crossAxisCenter,
      onCommitResize: (entryId, span, neighbourChanges) =>
        this.commitEntryChange(entryId, span, neighbourChanges),
    });
  }

  // stores a drag or a keyboard grab of an Entry: its new span, and the
  // Entries that gave way to it ([{ entryId, startOffsetMins, endOffsetMins }]),
  // as one change -> the Entry as stored afterwards, or undefined if it is gone
  commitEntryChange(entryId, { startOffsetMins, endOffsetMins }, neighbourChanges = []) {
    const entry = this.entries.find((entry) => entry.id === entryId);
    if (!entry) {
      return undefined;
    }
    // the neighbours that gave way, still present in this Timeline
    const neighbours = neighbourChanges
      .map((change) => ({
        change,
        neighbour: this.entries.find((other) => other.id === change.entryId),
      }))
      .filter(({ neighbour }) => neighbour);
    this.selectedID = entryId;
    if (neighbours.length > 0) {
      // the Entry and the ones that gave way change together
      this.entryCommands.updateMany([
        { id: entryId, entry: { ...entry, startOffsetMins, endOffsetMins } },
        ...neighbours.map(({ change, neighbour }) => ({
          id: neighbour.id,
          entry: {
            ...neighbour,
            startOffsetMins: change.startOffsetMins,
            endOffsetMins: change.endOffsetMins,
          },
        })),
      ]);
      this.selectedID = undefined;
    } else {
      this.updateEntry({ ...entry, startOffsetMins, endOffsetMins });
    }
    this.renderEntries();
    return this.entries.find((entry) => entry.id === entryId);
  }

  createCreateController() {
    return new EntryCreateController({
      svg: this.timeLineElement,
      preview: this.createPreview,
      getEntries: () => this.entries,
      isSingleChoiceDimension: () => this.isSingleChoiceDimension,
      getCurrentDate: () => this.currentDate,
      clientToSvgCoord: (clientX, clientY) => this.clientToSvgCoord(clientX, clientY),
      calculateTheTimeSlotClicked: (coord) => this.calculateTheTimeSlotClicked(coord),
      onCreate: (span) => this.startNewEntry(span),
    });
  }

  createKeyboard() {
    const keyboard = new TimelineKeyboard({
      svg: this.timeLineElement,
      entriesLayer: this.entriesLayer,
      slotContainer: this.entriesLayer?.parentNode ?? this.timeLineElement,
      axis: this.constructor.axis,
      getPxPerMinute: () => this.getPxPerMinute(),
      crossBox: this.constructor.crossAxisBox,
      getEntries: () => this.entries,
      getDimensionName: () => GLOBALS.DATA.timeline[this.dimensionIndex]?.name ?? '',
      isPanelOpen: () => this.store.getState().uipanel === 'details',
      isSingleChoice: () => this.isSingleChoiceDimension,
      getNowLimitMins: () => getNowLimitOffsetMins(this.currentDate),
      onOpenEntry: (entry) => this.openEntryFromKeyboard(entry),
      onCreateAt: (anchorMins) => this.createAtFromKeyboard(anchorMins),
      // a grab draws its blocks live, as a handle drag does, and stores nothing until confirmed
      onPreview: (spans) =>
        spans.forEach(({ id, startOffsetMins, endOffsetMins }) =>
          this.resizeController.updateEntryRectLive({
            entryId: id,
            currentStart: startOffsetMins,
            currentEnd: endOffsetMins,
          })
        ),
      onRestore: () => this.renderEntries(),
      onCommit: (entryId, span, neighbourChanges) =>
        this.commitEntryChange(entryId, span, neighbourChanges),
    });
    keyboard.connect();
    return keyboard;
  }

  // Enter on an Entry: the same as clicking it, then focus goes into the panel
  openEntryFromKeyboard(entry) {
    this.createPreview.hide(); // opening an Entry ends any new-Entry block
    this.selectedID = entry.id;
    this.panelActions.openEntry(entry);
    this.panelActions.focus?.();
  }

  // Enter on an empty slot: the same as clicking it -> whether anything opened
  createAtFromKeyboard(anchorMins) {
    const span = this.defaultSpanAt(anchorMins);
    if (!span) {
      this.createPreview.flashNoRoom(anchorMins);
      return false;
    }
    this.startNewEntry(span);
    this.panelActions.focus?.();
    return true;
  }

  // the block a plain click or Enter makes at a slot: the default length, as
  // much of it as fits -> a span, or null when there is no room at all
  defaultSpanAt(anchorMins) {
    return clampCreateSpan({
      anchorMins,
      entries: this.entries,
      singleChoice: this.isSingleChoiceDimension,
      nowLimitMins: getNowLimitOffsetMins(this.currentDate),
    });
  }

  // the panel closing hands keyboard focus back to the Timeline (if it was a
  // keyboard that opened it)
  syncKeyboardFocus() {
    if (this.store.getState().uipanel !== 'details') {
      this.keyboard?.panelClosed();
    }
  }

  // opens the details panel for a new Entry spanning `span`, and keeps a
  // provisional block on the Timeline until the panel closes (saved or not)
  startNewEntry({ startOffsetMins, endOffsetMins, atLimit }) {
    // clear anything left over from an edit opened but never saved/deleted
    this.selectedID = undefined;
    this.panelActions.openNewEntry(startOffsetMins, endOffsetMins);
    // after opening: the panel's own store updates run first, and
    // syncCreatePreview hides the block unless the panel is showing
    this.createPreview.show({ startOffsetMins, endOffsetMins, atLimit });
  }

  // the provisional block belongs to the new-Entry panel session: it goes
  // when the panel closes, moves to another Dimension or Diary date, or
  // opens something else. Never while the Respondent is still painting it.
  syncCreatePreview() {
    if (!this.createPreview?.isShowing || this.createController?.activeDrag) {
      return;
    }
    const state = this.store.getState();
    const stillOpen =
      state.uipanel === 'details' &&
      state.currentDimensionIndex === this.dimensionIndex &&
      state.currentDate === this.currentDate;
    if (!stillOpen) {
      this.createPreview.hide();
    }
  }

  // redraws the Entries, keeping keyboard focus where it was (a redraw
  // replaces every block, and focus on a removed element is lost)
  renderEntries() {
    this.keyboard?.beforeRender();
    this.drawEntries();
    this.keyboard?.afterRender();
  }

  // reads this Timeline's Entries for the current Diary date from the store
  // -> whether the date changed since the last read
  syncEntriesFromStore(state) {
    const dateChanged = state.currentDate !== this.currentDate;
    this.currentDate = state.currentDate;
    this.entries = state.diaries[this.currentDate]?.timelines[this.dimensionIndex] ?? EMPTY_ENTRIES;
    return dateChanged;
  }

  // Entry ids are only unique within one date's Timeline - every date has
  // an entry 0 - so a selection carried across a date switch would point
  // Save/Delete at a different date's entry that happens to share its id
  dropSelectionFromPreviousDate() {
    if (this.selectedID === undefined) {
      return;
    }
    this.selectedID = undefined;
    this.panelActions?.close();
  }

  // the 10-minute slot a time-axis position (in SVG user units) falls in
  calculateTheTimeSlotClicked(coord) {
    return Math.floor(coord / (this.getPxPerMinute() * 10)) * 10;
  }

  // converts a pointer's screen coordinates into this SVG's own user
  // coordinate along the time axis, accounting for the viewBox and any CSS
  // transforms on ancestors (e.g. the wrapper part's translateX), rather than
  // assuming 1 CSS px === 1 viewBox unit - which breaks whenever the SVG
  // renders narrower than its viewBox (seen on a real device, Chrome, under
  // zoom/text-scaling)
  clientToSvgCoord(clientX, clientY) {
    const coord = this.constructor.axis.positionAttr; // 'x' or 'y'
    const client = { x: clientX, y: clientY };
    const svg = this.timeLineElement;
    if (typeof svg?.createSVGPoint !== 'function' || typeof svg.getScreenCTM !== 'function') {
      return client[coord]; // no SVG geometry support (e.g. a test environment)
    }
    const ctm = svg.getScreenCTM();
    if (!ctm) {
      return client[coord];
    }
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    return point.matrixTransform(ctm.inverse())[coord];
  }

  // once per connection: the SVG outlives a disconnect (renderOnce), so its
  // listeners are removed on disconnect and added again on reconnect
  assignEventHandlers() {
    const svg = this.timeLineElement;
    this.listen(svg, 'click', (e) => this.onTimelineClick(e));
    this.listen(svg, 'keydown', (e) => this.keyboard.onKeyDown(e));
    this.listen(svg, 'focusin', (e) => this.keyboard.onFocusIn(e));
    this.listen(svg, 'focusout', (e) => this.keyboard.onFocusOut(e));
    // the focus ring is for keyboard users: any key says that's who this is,
    // any press says it is a pointer (capture: before anything else reacts)
    this.listen(document, 'keydown', () => this.keyboard.noteInput(true), true);
    this.listen(document, 'pointerdown', () => this.keyboard.noteInput(false), true);
    // each controller acts only on its own kind of press (an Entry or a
    // handle -> resize; empty time -> create)
    this.listen(svg, 'pointerdown', (e) => {
      this.resizeController.onEntryPointerDown(e);
      this.createController.onPointerDown(e);
    });
    this.listen(svg, 'pointermove', (e) => {
      this.resizeController.onEntryPointerMove(e);
      this.createController.onPointerMove(e);
    });
    this.listen(svg, 'pointerup', (e) => {
      this.resizeController.handlePointerUp(e);
      this.createController.handlePointerUp(e);
    });
    this.listen(svg, 'pointercancel', (e) => {
      this.resizeController.handlePointerCancel(e);
      this.createController.handlePointerCancel(e);
    });
    // belt-and-braces against the scrollable stack panning during a touch
    // drag. touch-action:none (on the handle, and for the drag's duration
    // the whole SVG - see startHandleDrag/timeline.css) is the primary
    // defense, but Chromium sometimes doesn't honour it on the very first
    // touch on a freshly-inserted SVG shape (its touch-action hit regions
    // can be a frame stale right after a DOM insert). A non-passive
    // touchstart/touchmove preventDefault() forces main-thread arbitration
    // and is honoured regardless - Pointer Events alone weren't enough (a
    // pointercancel fired on the first drag after a fresh long-press)
    this.listen(svg, 'touchstart', (e) => this.resizeController.handleTouchStart(e), {
      passive: false,
    });
    this.listen(
      svg,
      'touchmove',
      (e) => {
        this.resizeController.handleTouchMove(e);
        this.createController.handleTouchMove(e);
      },
      { passive: false }
    );
  }

  // thin delegating wrappers onto EntryResizeController, kept so the
  // element stays the single entry point callers (and tests) use
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

  onGlobalKeyDown(e) {
    this.resizeController.handleGlobalKeyDown(e);
    this.createController.handleGlobalKeyDown(e);
  }

  onTimelineClick(e) {
    if (e.target?.closest?.('.resize-handle')) {
      // a click landing on a handle itself is never a normal timeline click
      return;
    }
    if (this.resizeController.consumeSuppressedClick()) {
      return;
    }
    if (this.createController.consumeSuppressedClick()) {
      return; // the click that ended a drag-to-create
    }
    if (this.resizeController.activeHandleEntryId !== undefined) {
      // any real click - elsewhere on the timeline, or on a different entry -
      // dismisses whatever handles are currently showing
      this.resizeController.hideHandles();
    }
    const elementId = e.target?.dataset?.id;
    if (elementId !== undefined) {
      const entryId = Number(elementId);
      // a miss covers both a malformed id (NaN never matches) and a stale
      // one - this.entries can change (another surface, a date switch)
      // between rendering a block and it being clicked
      const entry = this.entries.find((entry) => entry.id === entryId);
      if (!entry) {
        console.error('Problem with identifying entry from click', e.target);
        return;
      }
      this.createPreview.hide(); // opening an Entry ends any new-Entry block
      this.selectedID = entryId;
      this.panelActions.openEntry(entry);
    } else {
      // only a click in the gridline zone starts a new Entry
      if (e.target.dataset?.part !== 'gridline-zone') {
        return;
      }
      // a plain click or tap: a default-length block from the clicked slot,
      // as much of it as fits
      const svgCoord = this.clientToSvgCoord(e.clientX, e.clientY);
      const anchorMins = this.calculateTheTimeSlotClicked(svgCoord >= 0 ? svgCoord : 0);
      const span = this.defaultSpanAt(anchorMins);
      if (!span) {
        this.createPreview.flashNoRoom(anchorMins);
        return;
      }
      this.startNewEntry(span);
    }
  }

  get isSingleChoiceDimension() {
    return this.entryCommands.isSingleChoiceDimension;
  }

  findNextEntryAfter(afterOffsetMins) {
    return this.entryCommands.findNextEntryAfter(afterOffsetMins, this.selectedID);
  }

  createEntry(entry) {
    return this.entryCommands.create(entry);
  }

  // updates the selected Entry, and clears the selection
  updateEntry(entry) {
    this.entryCommands.update(this.selectedID, entry);
    this.selectedID = undefined;
  }

  deleteEntry(id) {
    this.resizeController.hideHandlesIfActiveFor(id);
    if (!this.entryCommands.remove(id)) {
      return;
    }
    this.store.dispatch({ type: HIDE_PANEL });
    this.selectedID = undefined;
    this.panelActions.close();
    this.renderEntries();
  }

  saveEntry(entry) {
    // the details panel already keeps Save disabled for these (#162)
    const durationProblem = this.entryCommands.findDurationProblem(entry);
    if (durationProblem) {
      this.panelActions.reportSaveConflict(durationProblem);
      return;
    }
    const conflict = this.entryCommands.findConflict(entry, this.selectedID);
    if (conflict) {
      this.panelActions.reportSaveConflict(formatOverlapMessage(conflict));
      return;
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
}
