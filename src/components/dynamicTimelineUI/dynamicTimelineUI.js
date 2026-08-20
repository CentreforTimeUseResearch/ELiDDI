import { DetailsPanel } from '../detailsPanel/detailsPanel';
import { Navbar } from '../navbar/navbar';
import { DialogWidget } from '../dialogWidget/dialogWidget';
import { TimelineStack } from '../timelineStack/timelineStack';

import { TinyBase } from '../base';

import './dynamicTimelineUI.css';

export class DynamicTimelineUI extends TinyBase {
  store;
  constructor() {
    super();
  }

  render() {
    // this component is a work in progress
    this.innerHTML = `
            <el-nav-bar></el-nav-bar>
            <el-timeline-stack></el-timeline-stack>
            <el-dialog id="dialog"></el-dialog>
            `;
  }
}

customElements.define('el-dynamic-timeline', DynamicTimelineUI);
