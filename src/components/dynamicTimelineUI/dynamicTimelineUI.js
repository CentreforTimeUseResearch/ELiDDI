import { DetailsPanel } from '../detailsPanel/detailsPanel';
import { Navbar } from '../navbar/navbar';
import { DialogWidget } from '../dialogWidget/dialogWidget';
import { TimelineStack } from '../timelineStack/timelineStack';
import { Onboarding } from '../onboarding/onboarding';

import { TinyBase } from '../base';
import { DISMISS_ONBOARDING } from '../../store/actionTypes';

import './dynamicTimelineUI.css';

export class DynamicTimelineUI extends TinyBase {
  store = super.getStore();
  dialogActions;

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    this.registerCleanup(this.store.subscribe(this.onStoreUpdate.bind(this)));
    this.onStoreUpdate();
  }

  onStoreUpdate() {
    const { onboarding } = this.store.getState();
    if (onboarding) {
      this.dialogActions.open();
    } else {
      this.dialogActions.close();
    }
  }

  render() {
    // this component is a work in progress
    const onboardingMarkup = `<el-onboarding ${this.setProps({
      moveSpotlight: (x, y, size) => this.dialogActions.moveSpotlight(x, y, size),
      moveModalTop: (y) => this.dialogActions.moveModalTop(y),
    })}></el-onboarding>`;

    this.innerHTML = `
            <el-nav-bar></el-nav-bar>
            <el-timeline-stack></el-timeline-stack>
            <el-dialog id="dialog" ${this.setProps({
              registerDialogActions: (actions) => {
                this.dialogActions = actions;
              },
              content: onboardingMarkup,
              closeLabel: 'skip',
              onRequestClose: () => this.store.dispatch({ type: DISMISS_ONBOARDING }),
            })}></el-dialog>
            `;
  }
}

customElements.define('el-dynamic-timeline', DynamicTimelineUI);
