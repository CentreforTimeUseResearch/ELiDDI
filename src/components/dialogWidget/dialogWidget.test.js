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
});
