import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DialogWidget } from './dialogWidget';
import { TinyBase } from '../base';

class TestHarness extends TinyBase {}
if (!customElements.get('test-harness-dialog')) {
  customElements.define('test-harness-dialog', TestHarness);
}

function createDialog(props) {
  const harness = document.createElement('test-harness-dialog');
  const key = harness.setProps(props, true);
  const el = document.createElement('el-dialog');
  el.setAttribute('key', key);
  document.body.appendChild(el);
  return el;
}

describe('DialogWidget', () => {
  beforeEach(() => {
    if (!customElements.get('el-dialog')) {
      customElements.define('el-dialog', DialogWidget);
    }
    document.body.innerHTML = '';
  });

  it('hands its owner a named set of open/close/spotlight actions via registerDialogActions', () => {
    const registerDialogActions = vi.fn();
    createDialog({ registerDialogActions });

    expect(registerDialogActions).toHaveBeenCalledOnce();
    const actions = registerDialogActions.mock.calls[0][0];
    expect(actions).toHaveProperty('open');
    expect(actions).toHaveProperty('close');
    expect(actions).toHaveProperty('moveSpotlight');
    expect(actions).toHaveProperty('moveModalTop');
  });

  it('opens and closes the underlying <dialog> when the registered actions are called', () => {
    let dialogActions;
    const el = createDialog({ registerDialogActions: (actions) => (dialogActions = actions) });
    const dialog = el.querySelector('dialog');

    dialogActions.open();
    expect(dialog.hasAttribute('open')).toBe(true);

    dialogActions.close();
    expect(dialog.hasAttribute('open')).toBe(false);
  });

  it('renders the supplied content prop inside .dialog-content', () => {
    const el = createDialog({ content: '<p data-marker>hello</p>' });

    expect(el.querySelector('.dialog-content [data-marker]').textContent).toBe('hello');
  });

  it('treats content as trusted HTML, not text (callers must escape dynamic data themselves)', () => {
    const el = createDialog({ content: '<strong data-marker>bold</strong> &amp; <em>more</em>' });
    const body = el.querySelector('.dialog-content');

    expect(body.querySelector('strong[data-marker]')).not.toBeNull();
    expect(body.querySelector('em')).not.toBeNull();
    expect(body.textContent).toContain('bold & more');
  });

  it('defaults the close button label to "close" when no closeLabel is supplied', () => {
    const el = createDialog({});

    expect(el.querySelector('[data-close]').textContent).toBe('close');
  });

  it('uses a caller-supplied closeLabel instead of the default', () => {
    const el = createDialog({ closeLabel: 'skip' });

    expect(el.querySelector('[data-close]').textContent).toBe('skip');
  });

  it('calls onRequestClose when the close button is clicked, instead of closing itself directly', () => {
    const onRequestClose = vi.fn();
    let dialogActions;
    const el = createDialog({
      onRequestClose,
      registerDialogActions: (actions) => (dialogActions = actions),
    });
    dialogActions.open();

    el.querySelector('[data-close]').click();

    expect(onRequestClose).toHaveBeenCalledOnce();
    expect(el.querySelector('dialog').hasAttribute('open')).toBe(true);
  });

  it('falls back to closing itself when no onRequestClose is supplied', () => {
    let dialogActions;
    const el = createDialog({ registerDialogActions: (actions) => (dialogActions = actions) });
    dialogActions.open();

    el.querySelector('[data-close]').click();

    expect(el.querySelector('dialog').hasAttribute('open')).toBe(false);
  });

  // Escape closes a modal <dialog> natively via its 'cancel' event, bypassing
  // our own [data-close] button entirely - without a listener for it,
  // onRequestClose (e.g. DISMISS_ONBOARDING) never fires, leaving store
  // state stuck as if the dialog were still open even though it's visibly
  // closed (see Onboarding.render()'s reactive HIDE_PANEL re-dispatch)
  it('calls onRequestClose when the dialog is dismissed via the native cancel event (Escape)', () => {
    const onRequestClose = vi.fn();
    let dialogActions;
    const el = createDialog({
      onRequestClose,
      registerDialogActions: (actions) => (dialogActions = actions),
    });
    dialogActions.open();

    el.querySelector('dialog').dispatchEvent(new Event('cancel', { cancelable: true }));

    expect(onRequestClose).toHaveBeenCalledOnce();
  });

  it('falls back to closing itself on the native cancel event when no onRequestClose is supplied', () => {
    let dialogActions;
    const el = createDialog({ registerDialogActions: (actions) => (dialogActions = actions) });
    dialogActions.open();

    el.querySelector('dialog').dispatchEvent(new Event('cancel', { cancelable: true }));

    expect(el.querySelector('dialog').hasAttribute('open')).toBe(false);
  });

  it('does not prevent Escape when dismissible is left at its default', () => {
    const el = createDialog({});
    const cancel = new Event('cancel', { cancelable: true });

    el.querySelector('dialog').dispatchEvent(cancel);

    expect(cancel.defaultPrevented).toBe(false);
  });

  // a dialog the Respondent must act on rather than skip, e.g. the login
  // #231: a dialog hands focus back to what had it when it opened
  describe('focus', () => {
    function mountWithOpener(props = {}) {
      let actions;
      const opener = document.createElement('button');
      opener.textContent = 'open';
      document.body.appendChild(opener);
      const el = createDialog({ registerDialogActions: (a) => (actions = a), ...props });
      return { el, actions, opener };
    }

    it('returns to whatever had focus when it opened, once it closes', () => {
      const { actions, opener } = mountWithOpener();
      opener.focus();

      actions.open();
      document.querySelector('[data-close]').focus(); // focus moved into the dialog
      actions.close();

      expect(document.activeElement).toBe(opener);
    });

    it('returns when closed by its close button, or by Escape', () => {
      const { el, actions, opener } = mountWithOpener();
      opener.focus();
      actions.open();
      el.querySelector('[data-close]').focus();
      el.querySelector('[data-close]').click();
      expect(document.activeElement).toBe(opener);

      actions.open();
      el.querySelector('[data-close]').focus();
      el.querySelector('dialog').dispatchEvent(new Event('cancel', { cancelable: true }));
      expect(document.activeElement).toBe(opener);
    });

    it('returns when its owner closes it from its own request-close handler', () => {
      let dialogActions;
      const onRequestClose = vi.fn(() => dialogActions.close());
      const { actions, opener } = mountWithOpener({ onRequestClose });
      dialogActions = actions;
      opener.focus();
      actions.open();

      document.querySelector('[data-close]').click();

      expect(onRequestClose).toHaveBeenCalled();
      expect(document.activeElement).toBe(opener);
    });

    it('goes back to what had focus first, not to something inside it, if opened again while open', () => {
      const { actions, opener } = mountWithOpener();
      opener.focus();
      actions.open();
      document.querySelector('[data-close]').focus();

      actions.open(); // the store tells it to open on every update

      actions.close();
      expect(document.activeElement).toBe(opener);
    });

    it('does not take focus when it was never open', () => {
      const { actions } = mountWithOpener();
      const other = document.createElement('button');
      document.body.appendChild(other);
      other.focus();

      actions.close();
      actions.close();

      expect(document.activeElement).toBe(other);
    });

    it('does nothing more than once for one opening', () => {
      const { actions, opener } = mountWithOpener();
      opener.focus();
      actions.open();
      actions.close();
      const other = document.createElement('button');
      document.body.appendChild(other);
      other.focus();

      actions.close();

      expect(document.activeElement).toBe(other);
    });

    it('copes with what had focus having gone', () => {
      const { actions, opener } = mountWithOpener();
      opener.focus();
      actions.open();
      opener.remove();

      expect(() => actions.close()).not.toThrow();
      expect(document.activeElement).not.toBe(opener);
    });

    it('has no one to return to when nothing had focus', () => {
      const { actions } = mountWithOpener();
      document.activeElement?.blur?.();

      actions.open();

      expect(() => actions.close()).not.toThrow();
    });
  });

  describe('when dismissible is false', () => {
    it('renders no close button', () => {
      const el = createDialog({ dismissible: false, content: '<p>log in</p>' });

      expect(el.querySelector('[data-close]')).toBeNull();
      expect(el.querySelector('.dialog-actions')).toBeNull();
      expect(el.querySelector('.dialog-content').textContent).toContain('log in');
    });

    it('ignores Escape: the native cancel is prevented and onRequestClose is not called', () => {
      const onRequestClose = vi.fn();
      let dialogActions;
      const el = createDialog({
        dismissible: false,
        onRequestClose,
        registerDialogActions: (actions) => (dialogActions = actions),
      });
      dialogActions.open();
      const cancel = new Event('cancel', { cancelable: true });

      el.querySelector('dialog').dispatchEvent(cancel);

      expect(cancel.defaultPrevented).toBe(true);
      expect(onRequestClose).not.toHaveBeenCalled();
      expect(el.querySelector('dialog').hasAttribute('open')).toBe(true);
    });

    it('can still be closed by its owner', () => {
      let dialogActions;
      const el = createDialog({
        dismissible: false,
        registerDialogActions: (actions) => (dialogActions = actions),
      });
      dialogActions.open();

      dialogActions.close();

      expect(el.querySelector('dialog').hasAttribute('open')).toBe(false);
    });
  });
});
