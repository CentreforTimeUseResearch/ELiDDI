import { ActivityPicker } from '../activityPicker/activityPicker'; // as el-autocomplete
import { TinyBase } from '../base';
import './activityPanel.css';

export class ActivityPanel extends TinyBase {

  store = super.getStore();
  key;
  props;
  popoverElement;

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    this.store.subscribe(this.onStateUpdate.bind(this));
    this.popoverElement = document.getElementById('popover');
  }

  showPanel() {
    this.classList.add('active');
  }

  hidePanel() {
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
  //<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>

  render() {
    // this component is a work in progress so this output is for debug purposes
    this.innerHTML = `
            <div>
                <button class="reset-to-div right">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="24" height="24" 
                    viewBox="0 0 24 24" 
                    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                  >
                    <polyline points="18 15 12 9 6 15"></polyline>
                    <!-- <polyline points="6 9 12 15 18 9"></polyline> -->
                  </svg>
                </button>
            </div>
            <el-activityPicker ${this.setProps({ onFocusCallback: this.onFocusCallback })}></el-activityPicker>
            `;
  }
}

customElements.define('activity-panel', ActivityPanel);
