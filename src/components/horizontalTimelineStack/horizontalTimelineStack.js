import { TinyBase } from '../base';
import '../horizontalTimelineAxis/horizontalTimelineAxis';
import '../horizontalTimeline/horizontalTimeline';
import '../detailsPanel/detailsPanel';
import { DetailsPanelCoordinator } from '../detailsPanel/detailsPanelCoordinator';
import { HIDE_PANEL, SWITCH_DIMENSION } from '../../store/actionTypes';
import { dimension, dimensions } from '../../config/appConfig';
import { t } from '../../i18n/i18n';
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
  numTimelines = dimensions().length;
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
    this.registerCleanup(this.panelCoordinator.registerGuard());
    this.registerCleanup(
      this.store.subscribe(() => {
        this.panelCoordinator.onStoreUpdate();
        this.updateCurrentLabel();
      })
    );
    this.updateCurrentLabel();
  }

  // the tab of the current Dimension is selected (for assistive tech, and the
  // styling in horizontalTimelineStack.css), and is the one Tab stop of the
  // list: the arrow keys move within it
  updateCurrentLabel() {
    const { currentDimensionIndex } = this.store.getState();
    this.labels.forEach((label, index) => {
      const selected = index === currentDimensionIndex;
      label.setAttribute('aria-selected', String(selected));
      label.tabIndex = selected ? 0 : -1;
    });
  }

  // what clicking a label, or arrowing to it, does
  selectDimension(dimensionIndex) {
    this.store.dispatch({ type: HIDE_PANEL });
    this.store.dispatch({ type: SWITCH_DIMENSION, payload: dimensionIndex });
  }

  // Down/Up go to the next/previous tab (wrapping), Home/End to the first and
  // last, selecting it as they go: choosing a Dimension only retargets the
  // panel, so there is nothing to commit to (automatic activation). Other
  // keys, and arrows with a modifier, are left to the browser
  onTabKeyDown(event) {
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
      return;
    }
    const current = Number(event.target?.dataset?.dimensionIndex);
    if (!Number.isInteger(current)) {
      return;
    }
    const count = this.labels.length;
    let next;
    switch (event.key) {
      case 'ArrowDown':
        next = (current + 1) % count;
        break;
      case 'ArrowUp':
        next = (current - 1 + count) % count;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = count - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    this.selectDimension(next);
    this.labels[next].focus();
  }

  // the name of a Dimension, in the same grid row as that Dimension's row,
  // so the two line up whatever the row's height and scroll together. A
  // button, as the sidebar list it replaces was, and a tab of the Dimensions
  // list: it switches the current Dimension without opening an Entry
  createLabel(dimensionIndex, gridRow) {
    const label = document.createElement('button');
    label.type = 'button';
    label.className = 'dimension-label';
    label.setAttribute('role', 'tab');
    label.setAttribute('aria-selected', 'false');
    label.tabIndex = -1;
    label.dataset.dimensionIndex = dimensionIndex;
    label.style.gridRow = gridRow;
    label.textContent = dimension(dimensionIndex).name;
    label.addEventListener('click', () => this.selectDimension(dimensionIndex));
    return label;
  }

  // the labels' tab list. It takes no part in the layout (display: contents,
  // see the CSS), so each tab stays in its grid row beside its Timeline
  createTabList() {
    const tabList = document.createElement('div');
    tabList.className = 'dimension-tabs';
    tabList.setAttribute('role', 'tablist');
    tabList.setAttribute('aria-label', t('horizontalTimelineStack.dimensions'));
    tabList.setAttribute('aria-orientation', 'vertical');
    tabList.addEventListener('keydown', (event) => this.onTabKeyDown(event));
    return tabList;
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

    const tabList = this.createTabList();
    for (let i = 0; i < this.numTimelines; i++) {
      // row 1 of the grid is the axis
      const label = this.createLabel(i, String(i + 2));
      this.labels.push(label);
      tabList.appendChild(label);
    }
    this.appendChild(tabList);

    for (let i = 0; i < this.numTimelines; i++) {
      const gridRow = String(i + 2);
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
