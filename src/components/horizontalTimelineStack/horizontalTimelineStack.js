import { TinyBase } from '../base';
import '../horizontalTimelineAxis/horizontalTimelineAxis';
import '../horizontalTimeline/horizontalTimeline';
import '../detailsPanel/detailsPanel';
import { DetailsPanelCoordinator } from '../detailsPanel/detailsPanelCoordinator';
import { HIDE_PANEL, SWITCH_DIMENSION } from '../../store/actionTypes';
import './horizontalTimelineStack.css';

// The desktop layout: the shared axis, one HorizontalTimeline row per
// Dimension with its Dimension label beside it, and the app's one details
// panel (ADR 0005), which a
// DetailsPanelCoordinator routes to the current Dimension's row - the same
// arrangement as TimelineStack on mobile.
export class HorizontalTimelineStack extends TinyBase {
  // its axis, rows and panel are built once and kept across a DOM move -
  // see TinyBase.connectedCallback
  static renderOnce = true;
  store = super.getStore();
  numTimelines = GLOBALS.DATA.timeline.length;
  rows = [];
  labels = [];

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
    this.registerCleanup(
      this.store.subscribe(() => {
        this.panelCoordinator.onStoreUpdate();
        this.updateCurrentLabel();
      })
    );
    this.updateCurrentLabel();
  }

  // the label of the current Dimension is marked, for assistive tech and
  // for the styling in horizontalTimelineStack.css
  updateCurrentLabel() {
    const { currentDimensionIndex } = this.store.getState();
    this.labels.forEach((label, index) => {
      if (index === currentDimensionIndex) {
        label.setAttribute('aria-current', 'true');
      } else {
        label.removeAttribute('aria-current');
      }
    });
  }

  // the name of a Dimension, in the same grid row as that Dimension's row,
  // so the two line up whatever the row's height and scroll together. A
  // button, as the sidebar list it replaces was: it switches the current
  // Dimension without opening an Entry
  createLabel(dimensionIndex, gridRow) {
    const label = document.createElement('button');
    label.type = 'button';
    label.className = 'dimension-label';
    label.dataset.dimensionIndex = dimensionIndex;
    label.style.gridRow = gridRow;
    label.textContent = GLOBALS.DATA.timeline[dimensionIndex].name;
    label.addEventListener('click', () => {
      this.store.dispatch({ type: HIDE_PANEL });
      this.store.dispatch({ type: SWITCH_DIMENSION, payload: dimensionIndex });
    });
    return label;
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
      // row 1 of the grid is the axis
      const gridRow = String(i + 2);
      const label = this.createLabel(i, gridRow);
      this.labels.push(label);
      this.appendChild(label);

      const row = document.createElement('el-horizontal-timeline');
      row.style.gridRow = gridRow;
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
