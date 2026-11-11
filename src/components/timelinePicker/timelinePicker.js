import { TinyBase } from '../base';
import { HIDE_PANEL, SWITCH_DIMENSION } from '../../store/actionTypes';
import './timelinePicker.css';
import { escapeHtml } from '../../utils/html';
import { dimensions } from '../../config/appConfig';
import { t } from '../../i18n/i18n';

export class TimelinePicker extends TinyBase {
  dimensionNames;
  timelinePicker;
  store = super.getStore();
  currentDimensionIndex = 0;

  constructor() {
    super();
    this.parseDimensionNamesFromData();
    this.registerCleanup(this.store.subscribe(() => this.update()));
  }

  parseDimensionNamesFromData() {
    const dimensionsData = dimensions();
    if (!Array.isArray(dimensionsData)) {
      console.error('invalid dimension array');
      return;
    }
    this.dimensionNames = dimensionsData.map((dimension) => dimension.name);
  }

  connectedCallback() {
    // start on the Dimension that is current, not always the first
    this.currentDimensionIndex = this.store.getState().currentDimensionIndex;
    super.connectedCallback();
  }

  assignEventHandlers() {
    this.timelinePicker = this.querySelector('[data-timeline-picker]');
    this.timelinePicker?.addEventListener('change', (e) => {
      e.stopPropagation();
      this.switchDimension(Number(e.target.value));
    });
  }

  // follows the current Dimension by selecting its option in the same
  // <select>, not by building a new one: a new element is not focused, so
  // choosing a Dimension with the keyboard would drop focus, and the next
  // arrow key would go nowhere
  update() {
    const { currentDimensionIndex } = this.store.getState();
    if (this.currentDimensionIndex !== currentDimensionIndex) {
      this.currentDimensionIndex = currentDimensionIndex;
      if (this.timelinePicker) {
        this.timelinePicker.value = String(currentDimensionIndex);
      } else {
        this.render();
      }
    }
  }

  switchDimension(payload) {
    if (typeof payload !== 'number') {
      console.error('Problem with timeline picker value');
      return;
    }

    this.store.dispatch({
      type: HIDE_PANEL,
    });

    this.store.dispatch({
      type: SWITCH_DIMENSION,
      payload,
    });
  }

  createOptions() {
    if (!Array.isArray(this.dimensionNames)) {
      console.error('problem in timeline picker ');
      return;
    }
    return this.dimensionNames
      .map(
        (dimensionName, index) =>
          `<option value="${index}" ${index === this.currentDimensionIndex ? 'selected' : ''}>${escapeHtml(dimensionName)}</option>`
      )
      .join('');
  }

  render() {
    // this component is a work in progress so this output is for debug purposes
    this.innerHTML = `
            <div class="el-form-group width-adjust center">
               <!-- <label class="el-label" for="timeline-picker">Choose dimension:</label> -->
                <select
                  id="timeline-picker"
                  class="el-select"
                  data-timeline-picker
                  name="timeline-picker"
                  aria-label="${t('timelinePicker.label')}"
                >
                    ${this.createOptions()}
                </select>
            </div>
        `;
    this.assignEventHandlers();
  }
}

customElements.define('el-timeline-picker', TimelinePicker);
