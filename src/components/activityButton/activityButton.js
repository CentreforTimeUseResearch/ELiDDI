import { TinyBase } from '../base';

import './activityButton.css';

const LABEL = 'label';
const COLOR = 'color';

export class ActivityButton extends TinyBase {
    static observedAttributes = [LABEL, COLOR];

    ready

    constructor() {
        super();
    }

    connectedCallback() {
        super.connectedCallback();
        this.assignEventHandlers();
        // console.log(this.props)
    }

    assignEventHandlers() {
        if (!this.ready) {
            this.addEventListener('click', this.props.onClick);
            this.ready = true;
        }
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (this[name] !== newValue) {
            this[name] = newValue;
        }
    }

    render() {
        this.innerHTML = `
  <button type="button" class="btn" style="border-left: 10px solid ${this.color};" aria-label="Download document as PDF">
    <!-- SVG Icon hidden from screen readers to prevent duplicate reading 
    <svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="7 10 12 15 17 10"></polyline>
      <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg> -->
    <span>${this.label}</span>
  </button>
        `;
    }
}



customElements.define('el-activity-button', ActivityButton);
