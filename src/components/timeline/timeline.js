import { TinyBase } from '../base';
import './timeline.css';

const SVGNS = "http://www.w3.org/2000/svg";

const INDEX = 'index';

export class Timeline extends TinyBase {
  static observedAttributes = [INDEX];

  ready = false;
  store = super.getStore();
  fragment;
  timeLineElement
  entries = [];

  constructor() {
    super();
    this.fragment = document.getElementById("svg-timeline").content.cloneNode(true);
  }



  connectedCallback() {
    super.connectedCallback();
    this.assignEventHandlers();
    const state = this.store.getState()
    const timeline = state.timelines[this[INDEX]]
    if (!Array.isArray(timeline)) {
      this.store.dispatch({
        type: "ADD_TIMELINE",
        payload: { timelineIndex: this[INDEX] }
      })
    } else {
      this.entries = timeline
    }
    this.renderEntries();
    this.store.subscribe(() => this.updateState())
  }

  updateState() {
    const state = this.store.getState()
    const timeline = state.timelines[this[INDEX]]
    this.entries = timeline;
  }

  renderEntries() {
    // entry element looks like this
    // <g>
    //   <rect class="event-block" x="105" y="800" width="230" height="450" fill="#9aa0c3" fill-opacity="0.45" />
    //   <text x="220" y="1025" text-anchor="middle" dominant-baseline="middle" font-size="13" fill="#3a3d4d">c/ch</text>
    // </g>
    // debugger;

    // at some point there are going to have to have their own event handling 
    // and at that point it might be a good idea to shift them into their own class/object
    this.entries.map(entry => {
      const rect = document.createElementNS(SVGNS, 'rect');
      const startOffsetPx = (entry.startOffsetMins || 0) * 2;
      const endOffsetPx = (entry.endOffsetMins || 0) * 2;
      rect.setAttributeNS(null, 'x', '100');
      rect.setAttributeNS(null, 'y', startOffsetPx);
      rect.setAttributeNS(null, 'height', endOffsetPx - startOffsetPx);
      rect.setAttributeNS(null, 'width', '220');
      rect.setAttributeNS(null, 'fill', '#9aa0c3');
      rect.setAttributeNS(null, 'fill-opacity', '0.45');
      this.timeLineElement.appendChild(rect)
    })


  }

  calculateTheTimeSlotClicked(y) {
    // round to 10.
    return Math.floor(y / 20) * 10;
  }

  assignEventHandlers() {
    if (!this.ready) {
      this.timeLineElement = this.querySelector("svg");


      // are there times when we don't want the timeline to be clickable?
      this.timeLineElement?.addEventListener('click', (e) => this.onTimelineClick(e))
      this.ready = true;
    }
  }

  onTimelineClick(e) {
    const { offsetY } = e;
    const startOffsetMins = this.calculateTheTimeSlotClicked(offsetY >= 0 ? offsetY : 0);
    const id = this.entries.length;
    const timelineIndex = this[INDEX];
    // create entry
    this.store.dispatch({
      type: "ADD_ENTRY",
      payload: {
        timelineIndex,
        startOffsetMins,
        endOffsetMins: startOffsetMins + 10,
        id
      }
    })

    // state keeps the id and timeline index of the selected entry
    // this means it can be retrieved without having to itterate to find entry with active flag
    this.store.dispatch({
      type: 'SELECT_ENTRY',
      timelineIndex,
      index: id // correct because we use the length as id and always add to the end
    })

    // open activity panel
    this.store.dispatch({
      type: 'SHOW_PANEL',
      payload: 'activity'
    })

  }

  // switchTimeline(payload) {
  //   this.store.dispatch({
  //     action: 'SWITCH_TIMELINE',
  //     payload,
  //   });
  // }

  attributeChangedCallback(name, oldValue, newValue) {
    if (this[name] !== newValue) {
      this[name] = newValue;
    }
  }


  render() {
    this.appendChild(this.fragment)
  }
}

customElements.define('el-timeline', Timeline);
