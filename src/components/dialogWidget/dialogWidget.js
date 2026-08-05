import './dialogWidget.css';
import { Onboarding } from '../onboarding/onboarding';
import { TinyBase } from '../base';

const ID = 'id';
const TEXT = 'text';
const POSITION = 'position';
const POINTER = 'pointer';
const BACKDROP = 'backdrop';

export class DialogWidget extends TinyBase {
    static observedAttributes = [ID, TEXT, POSITION, POINTER, BACKDROP];

    // text;
    // onboarding;
    // contentWindow;
    dialog;
    store;
    onboarding;

    constructor() {
        super();
        this.store = super.getStore();
        const { onboarding } = this.store.getState();
        this.onboarding = onboarding;
    }

    connectedCallback() {
        this.render();
        this.dialog = this.querySelector('dialog');


        this.querySelector('[data-skip]').addEventListener('click', () => {
            this.store.dispatch({
                type: 'DISMISS_ONBOARDING'
            })
        })
        this.store.subscribe(this.updateState.bind(this))
        this.updateState();
    }

    updateState() {
        const { onboarding } = this.store.getState();
        this.onboarding = onboarding;
        if (this.onboarding) {
            this.showModal();
        } else {
            this.close();
        }
    }

    showModal() {
        if (!this.dialog) {
            console.error('missing dialog element!');
            return;
        }
        this.dialog.showModal();
    }

    close() {
        if (!this.dialog) {
            console.error('missing dialog element!');
            return;
        }
        this.dialog.close();
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (this[name] !== newValue) {
            this[name] = newValue;
        }
    }

    moveSpotlight(x, y, size) {
        this.style.setProperty("--spotlight1-x", x + "%");
        this.style.setProperty("--spotlight1-y", y + "%");
        this.style.setProperty("--spotlight-size", size + "%");
    }

    moveModalTop(y) {
        this.style.setProperty("--modal-y-pos", y + "px");
    }

    render() {

        this.innerHTML = `
        <dialog id="dialog">
            <div class="dialog-layout">
                <div class="dialog-content"> 
                    ${this.onboarding ? `<el-onboarding ${this.setProps({ moveSpotlight: this.moveSpotlight, moveModalTop: this.moveModalTop })}></el-onboarding>` : `<div></div>`}
                </div>
                <div class="dialog-actions">
                      <button data-skip>skip</button>
                </div>
            </div>
        </dialog>
        `;
    }
}

// <div class="help-popover-content">${this[TEXT]}</div>


customElements.define('el-dialog', DialogWidget);
