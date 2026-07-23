import { ActivityPicker } from '../activityPicker/activityPicker'; // as el-autocomplete
import { TinyBase } from '../base';
import './activityPanel.css';

export class ActivityPanel extends TinyBase {

  store = super.getStore();
  key;
  props;

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    this.store.subscribe(this.onStateUpdate.bind(this))
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

  render() {
    // this component is a work in progress so this output is for debug purposes
    this.innerHTML = `
            <el-activityPicker ${this.setProps({ onFocusCallback: this.onFocusCallback })}></el-autocomplete>
            `;
  }
}

customElements.define('activity-panel', ActivityPanel);
