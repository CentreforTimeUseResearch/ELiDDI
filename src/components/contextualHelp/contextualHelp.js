import helpIconSource from '../../assets/icons/help-252.svg?raw';
import doneIconSource from '../../assets/icons/check-252.svg?raw';

import { TinyBase } from '../base';

import './contextualHelp.css';

const ID = 'id';
const TEXT = 'text';
const POSITION = 'position';
const POINTER = 'pointer';
const BACKDROP = 'backdrop';

export class ContextualHelp extends TinyBase {
  static observedAttributes = [ID];

  ready = false;
  popover;
  helpButton;
  store;
  done = true;
  // contentWindow;

  constructor() {
    super();
    this.store = super.getStore();
  }

  connectedCallback() {
    this.render();
    // get a handle on the popover it has to be outside this component so it can be fullscreen

    this.popover = document.querySelector('el-help-popover');
    const isHelpWindowReadyPromise = customElements.whenDefined('el-help-popover'); // there is only one el-help-popover so this works

    isHelpWindowReadyPromise.then(() => {
      this.stateUpdate();
    });

    this.helpButton = this.querySelector(`#help-button-${this[ID]}`);

    // set up state management
    // this.store.subscribe(this.stateUpdate.bind(this))
    // this.stateUpdate();
    // console.log(this.store.getState());
    // this.store.dispatch({
    //     type: 'NEXT_INSTRUCTION'
    // })
    // console.log(this.store.getState());
    // this.assignEventHandlers();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (this[name] !== newValue) {
      this[name] = newValue;
    }
  }

  stateUpdate() {
    const { onboarding, instructionStep } = this.store.getState();
    if (onboarding) {
      this.popover.showPopover({ source: this.helpButton });
      this.popover.currentText = GLOBALS.DATA.instructions[instructionStep].text;
    }
    // this.render();
  }

  render() {
    // this component is a work in progress so this output is for debug purposes
    this.innerHTML = `
            <button id="help-button-${this[ID]}" class="reset-to-div" popovertarget="help-popover-${this[ID]}">
            ${this.done ? doneIconSource : helpIconSource}
            </button>
            `;
  }
}

customElements.define('el-contextual-help', ContextualHelp);
