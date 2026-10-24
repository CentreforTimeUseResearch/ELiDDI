import '../detailsPanel/detailsPanel';
import '../navbar/navbar';
import '../dialogWidget/dialogWidget';
import '../timelineStack/timelineStack';
import '../horizontalTimelineStack/horizontalTimelineStack';
import '../onboarding/onboarding';
import '../datePicker/datePicker';

import { TinyBase } from '../base';
import { DISMISS_ONBOARDING, HIDE_PANEL, SET_DESKTOP_LAYOUT } from '../../store/actionTypes';
import { watchDesktopBreakpoint } from '../../utils/breakpoint';

import './dynamicTimelineUI.css';

export class DynamicTimelineUI extends TinyBase {
  store = super.getStore();
  onboardingDialogActions;
  dateDialogActions;
  stackContainer;
  isDesktopLayout;

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    this.registerCleanup(this.store.subscribe(this.onStoreUpdate.bind(this)));
    this.registerCleanup(
      watchDesktopBreakpoint((matches) =>
        this.store.dispatch({ type: SET_DESKTOP_LAYOUT, payload: matches })
      )
    );
    this.onStoreUpdate();
  }

  onStoreUpdate() {
    const { onboarding, uipanel, isDesktopLayout } = this.store.getState();
    if (onboarding) {
      this.onboardingDialogActions.open();
    } else {
      this.onboardingDialogActions.close();
    }

    if (uipanel === 'date') {
      this.dateDialogActions.open();
    } else {
      this.dateDialogActions.close();
    }

    // only swap (and so only tear down/rebuild) the stack on an actual
    // breakpoint crossing, never on an unrelated store update (e.g. adding
    // an entry anywhere in the app) - mirrors the dateChanged-style guard
    // Timeline.updateState uses for its own conditional re-render
    if (isDesktopLayout !== this.isDesktopLayout) {
      this.isDesktopLayout = isDesktopLayout;
      this.renderStack();
    }
  }

  // swaps the single mounted stack component in #stack-container - never
  // touches the rest of the tree (el-nav-bar, the dialogs), unlike
  // re-running the whole render() would
  renderStack() {
    this.stackContainer.innerHTML = this.isDesktopLayout
      ? '<el-horizontal-timeline-stack></el-horizontal-timeline-stack>'
      : '<el-timeline-stack></el-timeline-stack>';
  }

  render() {
    // this component is a work in progress
    const onboardingMarkup = `<el-onboarding ${this.setProps({
      moveSpotlight: (x, y, size) => this.onboardingDialogActions.moveSpotlight(x, y, size),
      moveModalTop: (y) => this.onboardingDialogActions.moveModalTop(y),
    })}></el-onboarding>`;

    this.innerHTML = `
            <el-nav-bar></el-nav-bar>
            <div id="stack-container"></div>
            <el-dialog id="dialog" ${this.setProps({
              registerDialogActions: (actions) => {
                this.onboardingDialogActions = actions;
              },
              content: onboardingMarkup,
              closeLabel: 'skip',
              onRequestClose: () => this.store.dispatch({ type: DISMISS_ONBOARDING }),
            })}></el-dialog>
            <el-dialog id="date-dialog" ${this.setProps({
              registerDialogActions: (actions) => {
                this.dateDialogActions = actions;
              },
              content: '<el-date-picker></el-date-picker>',
              onRequestClose: () => this.store.dispatch({ type: HIDE_PANEL }),
            })}></el-dialog>
            `;
    this.stackContainer = this.querySelector('#stack-container');
  }
}

customElements.define('el-dynamic-timeline', DynamicTimelineUI);
