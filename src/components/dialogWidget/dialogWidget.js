import './dialogWidget.css';
import { TinyBase } from '../base';
import { t } from '../../i18n/i18n';

const ID = 'id';
const TEXT = 'text';
const POSITION = 'position';
const BACKDROP = 'backdrop';

export class DialogWidget extends TinyBase {
  static observedAttributes = [ID, TEXT, POSITION, BACKDROP];

  dialog;
  opener; // what had focus when the dialog opened

  constructor() {
    super();
  }

  connectedCallback() {
    this.resolveProps();

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

    this.querySelector('[data-close]')?.addEventListener('click', () => this.requestClose());
    // Escape fires the native <dialog>'s 'cancel' event, closing it without
    // going through our own close button - without this listener the
    // dialog closes but onRequestClose (e.g. DISMISS_ONBOARDING) never
    // fires, leaving store state stuck as if the dialog were still open
    // (see Onboarding.render(), which reactively re-dispatches HIDE_PANEL
    // for as long as `onboarding` stays true)
    this.dialog.addEventListener('cancel', (event) => {
      if (this.props?.dismissible === false) {
        // a dialog the Respondent must not skip (e.g. the login): Escape does nothing
        event.preventDefault();
        return;
      }
      this.requestClose();
    });
  }

  requestClose() {
    if (this.props?.onRequestClose) {
      this.props.onRequestClose();
    } else {
      this.close();
    }
  }

  open() {
    if (!this.dialog) {
      console.error('missing dialog element!');
      return;
    }
    // the store tells a dialog to open on every update, not once: only the
    // first of those is the Respondent's own focus to come back to
    if (!this.dialog.open) {
      this.opener = document.activeElement;
    }
    this.dialog.showModal();
  }

  close() {
    if (!this.dialog) {
      console.error('missing dialog element!');
      return;
    }
    const wasOpen = this.dialog.open;
    this.dialog.close();
    if (wasOpen) {
      this.returnFocus();
    }
  }

  // closing a modal puts focus back on what had it when it opened (browsers do
  // this themselves, but not all of them, and not when that was a button
  // pressed with the mouse in Safari, which does not focus it)
  returnFocus() {
    const opener = this.opener;
    this.opener = undefined;
    if (opener && opener !== document.body && opener.isConnected) {
      opener.focus?.();
    }
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
    // content is trusted markup and goes in unescaped: callers pass static
    // HTML or study-config text (Onboarding's step text, deliberately HTML).
    // Anything dynamic or Respondent-entered must go through escapeHtml
    // (utils/html.js) before it is put in the content string (#117)
    this.innerHTML = `
        <dialog>
            <div class="dialog-layout">
                <div class="dialog-content">
                    ${this.props?.content ?? ''}
                </div>
                ${
                  this.props?.dismissible === false
                    ? ''
                    : `<div class="dialog-actions">
                      <button class="reset-to-div" data-close>${this.props?.closeLabel ?? t('dialog.close')}</button>
                </div>`
                }
            </div>
        </dialog>
        `;
  }
}

customElements.define('el-dialog', DialogWidget);
