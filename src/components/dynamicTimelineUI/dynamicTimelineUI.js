import { DetailsPanel } from '../detailsPanel/detailsPanel';
import { Navbar } from '../navbar/navbar';
import { DialogWidget } from '../dialogWidget/dialogWidget';
import { TimelineStack } from '../timelineStack/timelineStack';
import { Onboarding } from '../onboarding/onboarding';
import { DatePicker } from '../datePicker/datePicker';

import { TinyBase } from '../base';
import { DISMISS_ONBOARDING, HIDE_PANEL } from '../../store/actionTypes';

import './dynamicTimelineUI.css';

export class DynamicTimelineUI extends TinyBase {
  store = super.getStore();
  onboardingDialogActions;
  dateDialogActions;

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    this.registerCleanup(this.store.subscribe(this.onStoreUpdate.bind(this)));
    this.onStoreUpdate();
  }

  onStoreUpdate() {
    const { onboarding, uipanel } = this.store.getState();
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
  }

  render() {
    // this component is a work in progress
    const onboardingMarkup = `<el-onboarding ${this.setProps({
      moveSpotlight: (x, y, size) => this.onboardingDialogActions.moveSpotlight(x, y, size),
      moveModalTop: (y) => this.onboardingDialogActions.moveModalTop(y),
    })}></el-onboarding>`;

    this.innerHTML = `
            <el-nav-bar></el-nav-bar>
            <el-timeline-stack></el-timeline-stack>
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
  }
}

customElements.define('el-dynamic-timeline', DynamicTimelineUI);
