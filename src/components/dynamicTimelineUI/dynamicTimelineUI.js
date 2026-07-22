import { ActivityPanel } from '../activityPanel/activityPanel';
import { DialogWidget } from '../dialogWidget/dialogWidget';

import { TinyBase } from '../base';

import './dynamicTimelineUI.css';

export class DynamicTimelineUI extends TinyBase {
  store;
    constructor() {
        super();
    }

    connectedCallback() {
        this.render();
    }

    render() {
        // this component is a work in progress
    this.innerHTML = `
            <activity-panel></activity-panel>
            <el-dialog id="dialog"></el-dialog>
            `;
    }
}


customElements.define('dynamic-timeline', DynamicTimelineUI);