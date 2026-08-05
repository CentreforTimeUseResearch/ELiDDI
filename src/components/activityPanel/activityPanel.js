import { ActivityPicker } from '../activityPicker/activityPicker'; // as el-autocomplete
import { TimePickerPanel } from '../timePickerPanel/timePickerPanel';
import { TinyBase } from '../base';
import './activityPanel.css';

export class ActivityPanel extends TinyBase {

  store = super.getStore();
  key;
  props;
  popoverElement;
  open;

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    this.store.subscribe(this.onStateUpdate.bind(this));
    this.popoverElement = document.getElementById('popover');
  }

  showPanel() {
    this.open = true;
    this.classList.add('active');
  }

  hidePanel() {
    this.open = false;
    this.classList.remove('active')
  }

  onStateUpdate() {
    const { uipanel } = this.store.getState();
    if (uipanel === 'activity') {
      this.showPanel();
    } else {
      this.hidePanel();
    }
  }

  onFocusCallback() {
    this.showPanel();
  }

  render() {
    this.innerHTML = `
            <div>
                <button class="reset-to-div right">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="24" height="24" 
                    viewBox="0 0 24 24" 
                    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                  >
                    ${this.open ? `<polyline points="18 15 12 9 6 15"></polyline>` : `<polyline points="6 9 12 15 18 9"></polyline>`}
                  </svg>
                </button>
            </div>
            <el-activityPicker ${this.setProps({ onFocusCallback: () => this.onFocusCallback() })}></el-activityPicker>
            <el-time-picker-panel ${this.setProps({})}></el-time-picker-panel>
            `;
  }
}

customElements.define('activity-panel', ActivityPanel);
