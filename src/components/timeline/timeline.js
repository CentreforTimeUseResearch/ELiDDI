import { TinyBase } from '../base';
import { getActivityColor } from '../../utils/activities';
import { findOverlappingEntry } from '../../utils/entries';
import { formatOffsetAsClockTime } from '../../utils/time';
import './timeline.css';

const SVGNS = "http://www.w3.org/2000/svg";

const INDEX = 'index';

// sets textElement's content to fullText (with a <title> child carrying the
// untruncated text for hover/screen readers), then shortens the visible text
// with an ellipsis until it fits maxWidth - requires textElement to already be
// attached to a connected SVG, since it measures actual rendered width
function fitTextToBlockWidth(textElement, fullText, maxWidth) {
  const title = document.createElementNS(SVGNS, 'title');
  title.textContent = fullText;
  textElement.appendChild(title);

  const textNode = document.createTextNode(fullText);
  textElement.appendChild(textNode);

  let truncated = fullText;
  while (truncated.length > 1 && textElement.getBBox().width > maxWidth) {
    truncated = truncated.slice(0, -1);
    textNode.textContent = `${truncated}…`;
  }
}

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
        payload: { dimensionIndex: this[INDEX] }
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
    const dimensionData = GLOBALS.DATA.timeline[this[INDEX]];

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
      rect.setAttributeNS(null, 'fill', getActivityColor(dimensionData, entry.activity));
      rect.setAttributeNS(null, 'fill-opacity', '0.45');
      rect.setAttributeNS(null, 'data-id', entry.id);
      entryGroup.appendChild(rect);

      const text = document.createElementNS(SVGNS, 'text');
      const textX = 220;
      const textY = startOffsetPx + 5;
      const fontSize = 13;
      const fill = "#3a3d4d"
      text.setAttributeNS(null, 'x', textX);
      text.setAttributeNS(null, 'y', textY);
      text.setAttributeNS(null, 'text-anchor', 'middle');
      text.setAttributeNS(null, 'dominant-baseline', 'middle');
      text.setAttributeNS(null, 'font-size', fontSize);
      text.setAttributeNS(null, 'fill', fill);
      text.setAttributeNS(null, 'data-id', entry.id);
      entryGroup.appendChild(text)

      this.entriesLayer.appendChild(entryGroup)

      // fitTextToBlockWidth needs the text element attached to a connected
      // SVG (it measures rendered width), so this runs after the append above
      const label = Array.isArray(entry.activity) ? entry.activity.join(', ') : entry.activity;
      fitTextToBlockWidth(text, label, 200);
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
      this.detailsPanel.setEntryId(entry_id);
      // we need to do soemthing different on save
    } else {
      // starting a brand new entry - clear out anything left over from a
      // previous edit that was opened but never saved/deleted
      this.selectedID = undefined;
      this.detailsPanel.reset();
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

  get isSingleChoiceDimension() {
    return GLOBALS.DATA.timeline[Number(this[INDEX])].mode !== 'multiple-choice';
  }

  formatOverlapMessage(conflict) {
    const start = formatOffsetAsClockTime(conflict.startOffsetMins);
    const end = formatOffsetAsClockTime(conflict.endOffsetMins);
    return `This overlaps with your existing "${conflict.activity}" entry (${start}–${end}). Adjust the time, or edit/delete that entry first.`;
  }

  getNextEntryId() {
    // not entries.length - deleting an entry can leave gaps, so length would
    // eventually collide with an id that's still in use
    return this.entries.reduce((maxId, entry) => Math.max(maxId, entry.id), -1) + 1;
  }

  createEntry(entry) {
    const id = this.getNextEntryId();
    const dimensionIndex = Number(this[INDEX]);
    if (typeof dimensionIndex !== 'number') {
      console.error('Problem with identifying dimension index', e.target)
      return;
    }
    // create entry
    this.store.dispatch({
      type: "ADD_ENTRY",
      payload: {
        dimensionIndex,
        ...entry,
        id
      }
    })
  }

  updateEntry(entry) {
    const dimensionIndex = Number(this[INDEX]);
    if (typeof dimensionIndex !== 'number') {
      console.error('Problem with identifying dimension index', e.target)
      return;
    }
    const index = this.entries.findIndex((entry) => entry.id === this.selectedID);
    this.store.dispatch({
      type: "UPDATE_ENTRY",
      payload: {
        id: this.selectedID,
        dimensionIndex,
        index,
        ...entry
      }
    })
    this.selectedID = undefined
  }

  deleteEntry(id) {
    const dimensionIndex = Number(this[INDEX]);
    if (!this.entries.some((entry) => entry.id === id)) {
      // already gone (e.g. a stray double-click) - nothing to do
      return;
    }
    this.store.dispatch({
      type: 'DELETE_ENTRY',
      payload: { dimensionIndex, id }
    })
    this.store.dispatch({
      type: 'HIDE_PANEL'
    })
    this.selectedID = undefined;
    this.detailsPanel.reset();
    this.renderEntries();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (this[name] !== newValue) {
      this[name] = newValue;
    }
  }

  saveEntry(entry) {
    if (this.isSingleChoiceDimension) {
      const conflict = findOverlappingEntry(this.entries, entry, this.selectedID);
      if (conflict) {
        this.detailsPanel.showError(this.formatOverlapMessage(conflict));
        return;
      }
    }
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
      ${this.setProps({ saveEntry: (entry) => this.saveEntry(entry), deleteEntry: (id) => this.deleteEntry(id) })}
      dimensionindex=${this[INDEX]}
      heading="${GLOBALS.DATA.timeline[this[INDEX]]?.description}"
      instruction="${GLOBALS.DATA.timeline[this[INDEX]]?.instruction}"
    ></details-panel>`
  }
}

customElements.define('el-timeline', Timeline);
