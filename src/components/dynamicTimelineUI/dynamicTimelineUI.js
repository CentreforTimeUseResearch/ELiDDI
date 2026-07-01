import { ActivityPanel } from "../activityPanel/activityPanel";
import { Sidebar } from "../sidebar/sidebar";

import './dynamicTimelineUI.css';

export class DynamicTimelineUI extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        this.render();
    }

    render() {
        // this component is a work in progress
        this.innerHTML = `<activity-panel></activity-panel><side-bar></side-bar>`;
    }
}


customElements.define('dynamic-timeline', DynamicTimelineUI);