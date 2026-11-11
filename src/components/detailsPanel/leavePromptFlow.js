import { announce } from '../../utils/announce';
import { t } from '../../i18n/i18n';

// The in-panel "You have unsaved changes" question (not a browser dialog) -
// shown by the DetailsPanelCoordinator's guard when something is about to
// drop an unsaved edit (docs/design/flows/edit-entry.md). A plain class, not
// an element, owned by DetailsPanel (same pattern as DetailsPanelCoordinator
// itself): it owns the question's markup, show/hide, answers and focus
// bookkeeping, and the panel injects the two things it cannot know - why the
// entry can't be saved yet, and where focus should land when "Keep editing"
// has nowhere to return to.
//
// Each callback in show()'s argument is called once, by the answer: onSave,
// onDiscard, onKeep. Focus goes to Keep editing, the safe one.
export class LeavePromptFlow {
  callbacks; // set while the question is showing
  returnFocus; // where focus was when it was asked

  constructor({ host, getIncompleteReasons, focusFallback }) {
    this.host = host; // the panel element: carries the data-leaving attribute its CSS keys on
    this.getIncompleteReasons = getIncompleteReasons;
    this.focusFallback = focusFallback;
  }

  // the question's markup, rendered inside the panel's template. instanceId
  // keeps the ids unique per panel (aria needs ids, and a page, or a test,
  // may hold more than one panel)
  markup(instanceId) {
    return `
              <div class="leave-prompt" role="group" aria-labelledby="leave-prompt-question-${instanceId}" hidden>
                <p class="leave-prompt-question" id="leave-prompt-question-${instanceId}">${t('leavePrompt.question')}</p>
                <p class="leave-prompt-reason" hidden></p>
                <button type="button" class="btn btn-leave-save">${t('leavePrompt.save')}</button>
                <button type="button" class="btn btn-leave-discard">${t('leavePrompt.discard')}</button>
                <button type="button" class="btn btn-leave-keep" aria-describedby="leave-prompt-question-${instanceId}">${t('leavePrompt.keep')}</button>
              </div>`;
  }

  // (re)finds its elements and wires its buttons after the panel renders -
  // called wherever the panel rebuilds its markup
  bind(root) {
    this.prompt = root.querySelector('.leave-prompt');
    this.reason = root.querySelector('.leave-prompt-reason');
    this.saveButton = root.querySelector('.btn-leave-save');
    this.discardButton = root.querySelector('.btn-leave-discard');
    this.keepButton = root.querySelector('.btn-leave-keep');
    this.saveButton.addEventListener('click', () => this.answer('onSave'));
    this.discardButton.addEventListener('click', () => this.answer('onDiscard'));
    this.keepButton.addEventListener('click', () => this.answer('onKeep'));
  }

  get isShowing() {
    return Boolean(this.callbacks);
  }

  show(callbacks) {
    this.callbacks = callbacks;
    const active = document.activeElement;
    this.returnFocus = active && active !== document.body ? active : undefined;
    const reasons = this.getIncompleteReasons();
    const complete = reasons.length === 0;
    this.saveButton.toggleAttribute('hidden', !complete);
    this.reason.textContent = complete
      ? ''
      : t('leavePrompt.cannotSave', { reasons: reasons.join(t('common.sentenceJoin')) });
    this.reason.toggleAttribute('hidden', complete);
    this.prompt.removeAttribute('hidden');
    this.host.setAttribute('data-leaving', '');
    announce(`${t('leavePrompt.question')} ${this.reason.textContent}`.trim());
    this.keepButton.focus();
  }

  answer(which) {
    const callbacks = this.callbacks;
    if (!callbacks) return; // already answered
    const returnTo = this.returnFocus;
    this.hide();
    if (which === 'onKeep') {
      if (returnTo?.isConnected) {
        returnTo.focus();
      } else {
        this.focusFallback();
      }
    }
    callbacks[which]?.();
  }

  hide() {
    this.callbacks = undefined;
    this.returnFocus = undefined;
    this.prompt?.setAttribute('hidden', '');
    this.host.removeAttribute('data-leaving');
  }
}
