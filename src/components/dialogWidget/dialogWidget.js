import './dialogWidget.css';
import { TinyBase } from '../base';

const ID = 'id';
const TEXT = 'text';
const POSITION = 'position';
const BACKDROP = 'backdrop';

export class DialogWidget extends TinyBase {
  static observedAttributes = [ID, TEXT, POSITION, BACKDROP];

  dialog;

  constructor() {
    super();
  }

  connectedCallback() {
    this.key = this.getAttribute('key');
    this.props = this.getProps(this.key);

    // register our actions before rendering: content (e.g. Onboarding) can
    // call moveSpotlight/moveModalTop synchronously during its own first
    // render, which happens nested inside ours via the render() call below
    this.props?.registerDialogActions?.({
      open: () => this.open(),
      close: () => this.close(),
      moveSpotlight: (x, y, size) => this.moveSpotlight(x, y, size),
      moveModalTop: (y) => this.moveModalTop(y),
    });

    this.render();
    this.dialog = this.querySelector('dialog');

    this.querySelector('[data-close]').addEventListener('click', () => {
      if (this.props?.onRequestClose) {
        this.props.onRequestClose();
      } else {
        this.close();
      }
    });
  }

  open() {
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
    this.style.setProperty('--spotlight1-x', x + '%');
    this.style.setProperty('--spotlight1-y', y + '%');
    this.style.setProperty('--spotlight-size', size + '%');
  }

  moveModalTop(y) {
    this.style.setProperty('--modal-y-pos', y + 'px');
  }

  render() {
    this.innerHTML = `
        <dialog id="dialog">
            <div class="dialog-layout">
                <div class="dialog-content">
                    ${this.props?.content ?? ''}
                </div>
                <div class="dialog-actions">
                      <button class="reset-to-div" data-close>${this.props?.closeLabel ?? 'close'}</button>
                </div>
            </div>
        </dialog>
        `;
  }
}

customElements.define('el-dialog', DialogWidget);
