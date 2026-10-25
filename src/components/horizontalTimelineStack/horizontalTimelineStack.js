import { TinyBase } from '../base';
import '../horizontalTimelineAxis/horizontalTimelineAxis';
import '../horizontalTimeline/horizontalTimeline';
import '../detailsPanel/detailsPanel';
import { DetailsPanelCoordinator } from '../detailsPanel/detailsPanelCoordinator';
import './horizontalTimelineStack.css';

// The desktop layout: the shared axis, one HorizontalTimeline row per
// Dimension, and the app's one details panel (ADR 0005), which a
// DetailsPanelCoordinator routes to the current Dimension's row - the same
// arrangement as TimelineStack on mobile.
export class HorizontalTimelineStack extends TinyBase {
  // its axis, rows and panel are built once and kept across a DOM move -
  // see TinyBase.connectedCallback
  static renderOnce = true;
  store = super.getStore();
  numTimelines = GLOBALS.DATA.timeline.length;
  rows = [];

  constructor() {
    super();
    this.panelCoordinator = new DetailsPanelCoordinator({
      store: this.store,
      getTimeline: (dimensionIndex) => this.rows[dimensionIndex],
    });
  }

  connectedCallback() {
    super.connectedCallback();
    this.rows = [...this.querySelectorAll('el-horizontal-timeline')];
    this.registerCleanup(this.store.subscribe(() => this.panelCoordinator.onStoreUpdate()));
  }

  get panelElement() {
    return this.panelCoordinator.panel;
  }

  get detailsPanelActions() {
    return this.panelCoordinator.panelActions;
  }

  // what a row does when an Entry (or empty time) on it is clicked
  openEntryForRow(dimensionIndex, entry) {
    this.panelCoordinator.timelineProps(dimensionIndex).openEntry(entry);
  }

  openNewEntryForRow(dimensionIndex, startOffsetMins) {
    this.panelCoordinator.timelineProps(dimensionIndex).openNewEntry(startOffsetMins);
  }

  // what the panel saves, deletes and looks up goes to the current
  // Dimension's row
  saveEntry(entry) {
    this.panelCoordinator.activeTimeline()?.saveEntry(entry);
  }

  deleteEntry(id) {
    this.panelCoordinator.activeTimeline()?.deleteEntry(id);
  }

  findNextEntryAfter(offsetMins) {
    return this.panelCoordinator.activeTimeline()?.findNextEntryAfter(offsetMins);
  }

  // built via document.createElement()+appendChild() one at a time, not one
  // combined innerHTML string: a single innerHTML assignment inserts every
  // child in one batch, and jsdom's custom-element reaction-queue
  // processing for that many interdependent elements at once proved
  // unreliable in testing (intermittent null child-element references)
  render() {
    this.appendChild(document.createElement('el-horizontal-timeline-axis'));

    for (let i = 0; i < this.numTimelines; i++) {
      const row = document.createElement('el-horizontal-timeline');
      row.setAttribute('index', i);
      row.setAttribute('key', this.setProps(this.panelCoordinator.timelineProps(i), true));
      this.appendChild(row);
    }

    this.appendChild(
      this.panelCoordinator.createPanel((props, returnKey) => this.setProps(props, returnKey))
    );
  }
}

customElements.define('el-horizontal-timeline-stack', HorizontalTimelineStack);
