import { TinyBase } from '../base';
import './timeline.css';

export class Timeline extends TinyBase {
  ready = false;
  store = super.getStore();
  fragment;

  constructor() {
    super();
    this.fragment = document.getElementById("svg-timeline").content.cloneNode(true);
  }



  connectedCallback() {
    super.connectedCallback();
  }

  assignEventHandlers() {
    if (!this.ready) {

      this.ready = true;
    }
  }

  // switchTimeline(payload) {
  //   this.store.dispatch({
  //     action: 'SWITCH_TIMELINE',
  //     payload,
  //   });
  // }



  render() {
    console.log('render timeline')
    // this component is a work in progress so this output is for debug purposes
    this.appendChild(this.fragment)
  }
}

customElements.define('el-timeline', Timeline);
