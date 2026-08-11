import { TinyBase } from '../base';
import './timeline.css';

const SVGNS = "http://www.w3.org/2000/svg";

const INDEX = 'index';

export class Timeline extends TinyBase {
  static observedAttributes = [INDEX];

  ready = false;
  store = super.getStore();
  fragment;
  timeLineElement;
  entries = [];
  detailsPanel;
  selectedID;
  index;

  constructor() {
    super();
    this.fragment = document.getElementById("svg-timeline").content.cloneNode(true);
  }

  connectedCallback() {
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
    super.connectedCallback();
    this.store.subscribe(() => this.updateState());
    this.getChildElementReferences();
    this.renderEntries();
    this.assignEventHandlers();
  }

  getChildElementReferences() {
    this.timeLineElement = this.querySelector('svg');
    this.entriesLayer = this.timeLineElement.querySelector('#events');
    // get a handle on the details-panel as you need to communicate with it
    this.detailsPanel = this.querySelector('details-panel');
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
    this.entriesLayer.innerHTML = "";

    // at some point there are going to have to have their own event handling 
    // and at that point it might be a good idea to shift them into their own class/object
    this.entries.forEach(entry => {
      const entryGroup = document.createElementNS(SVGNS, 'g');
      const rect = document.createElementNS(SVGNS, 'rect');
      const startOffsetPx = (entry.startOffsetMins || 0) * 2;
      const endOffsetPx = (entry.endOffsetMins || 0) * 2;
      const height = endOffsetPx - startOffsetPx
      rect.setAttributeNS(null, 'x', '100');
      rect.setAttributeNS(null, 'y', startOffsetPx);
      rect.setAttributeNS(null, 'height', height > 0 ? height : 20);
      rect.setAttributeNS(null, 'width', '220');
      rect.setAttributeNS(null, 'fill', '#9aa0c3');
      rect.setAttributeNS(null, 'fill-opacity', '0.45');
      rect.setAttributeNS(null, 'data-id', entry.id);
      entryGroup.appendChild(rect);

      const text = document.createElementNS(SVGNS, 'text');
      const textX = 220;
      const textY = startOffsetPx + 50;
      const fontSize = 13;
      const fill = "#3a3d4d"
      text.setAttributeNS(null, 'x', textX);
      text.setAttributeNS(null, 'y', textY);
      text.setAttributeNS(null, 'text-anchor', 'middle');
      text.setAttributeNS(null, 'dominant-baseline', 'middle');
      text.setAttributeNS(null, 'font-size', fontSize);
      text.setAttributeNS(null, 'fill', fill);
      text.setAttributeNS(null, 'data-id', entry.id);
      text.textContent = entry.activity;
      entryGroup.appendChild(text)

      this.entriesLayer.appendChild(entryGroup)
    })


  }

  calculateTheTimeSlotClicked(y) {
    // round to 10.
    return Math.floor(y / 20) * 10;
  }

  assignEventHandlers() {
    if (!this.ready) {
      // are there times when we don't want the timeline to be clickable?
      this.timeLineElement?.addEventListener('click', (e) => { this.onTimelineClick(e) })
      this.ready = true;
    }
  }

  onTimelineClick(e) {
    const element_id = e.target?.dataset?.id
    if (element_id !== undefined) {
      // set selected 
      const entry_id = Number(e.target?.dataset?.id)
      if (typeof entry_id !== 'number') {
        console.error('Problem with identifying entry from click', e.target)
        return;
      }
      this.selectedID = entry_id;
      // fetch the 
      const entry = this.entries.find((entry) => entry.id === entry_id)
      // set up the panel
      this.detailsPanel.setStartTime(entry.startOffsetMins);
      this.detailsPanel.setEndTime(entry.endOffsetMins);
      this.detailsPanel.setActivity(entry.activity);
      // we need to do soemthing different on save
    } else {
      const { offsetY } = e;
      const startOffsetMins = this.calculateTheTimeSlotClicked(offsetY >= 0 ? offsetY : 0);
      this.detailsPanel.setStartTime(startOffsetMins);
    }

    // open activity panel
    this.store.dispatch({
      type: 'SHOW_PANEL',
      payload: 'activity'
    })
  }

  createEntry(entry) {
    const id = this.entries.length;
    const timelineIndex = Number(this[INDEX]);
    if (typeof timelineIndex !== 'number') {
      console.error('Problem with identifying timeline index', e.target)
      return;
    }
    // create entry
    this.store.dispatch({
      type: "ADD_ENTRY",
      payload: {
        timelineIndex,
        ...entry,
        id
      }
    })
  }

  updateEntry(entry) {
    const timelineIndex = Number(this[INDEX]);
    if (typeof timelineIndex !== 'number') {
      console.error('Problem with identifying timeline index', e.target)
      return;
    }
    const index = this.entries.findIndex((entry) => entry.id === this.selectedID);
    this.store.dispatch({
      type: "UPDATE_ENTRY",
      payload: {
        id: this.selectedID,
        timelineIndex,
        index,
        ...entry
      }
    })
    this.selectedID = undefined
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

  saveEntry(entry) {
    if (this.selectedID === undefined) {
      this.createEntry(entry)
    } else {
      this.updateEntry(entry);
    }
    this.store.dispatch({
      type: 'HIDE_PANEL'
    })
    this.detailsPanel.reset();
    this.renderEntries();
  }

  render() {
    this.appendChild(this.fragment);
    this.innerHTML += `<details-panel 
      ${this.setProps({ saveEntry: (entry) => this.saveEntry(entry) })} 
      timelineindex=${this[INDEX]} 
      heading="${GLOBALS.DATA.timeline[this[INDEX]]?.description}"
    ></details-panel>`
  }
}

customElements.define('el-timeline', Timeline);
