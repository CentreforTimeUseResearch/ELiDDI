import { t } from '../../i18n/i18n';

// The in-panel "Delete this entry?" question (not a browser dialog) - Delete
// does not delete, it asks, with the safe answer focused
// (docs/design/flows/edit-entry.md). A plain class, not an element, owned by
// DetailsPanel: it owns the question's markup, show/hide, the confirm/keep
// answers and focus bookkeeping; the panel injects what the question is
// about - which Entry id is open, how to delete it, and where focus returns
// when the Respondent keeps it.
export class DeleteConfirmFlow {
  confirming = false; // Delete has been pressed and the question is showing

  constructor({ host, getEntryId, deleteEntry, returnFocusTo }) {
    this.host = host; // the panel element: carries the data-confirming-delete attribute its CSS keys on
    this.getEntryId = getEntryId;
    this.deleteEntry = deleteEntry;
    this.returnFocusTo = returnFocusTo;
  }

  // the question's markup, rendered inside the panel's template. instanceId
  // keeps the ids unique per panel (aria needs ids, and a page, or a test,
  // may hold more than one panel)
  markup(instanceId) {
    return `
              <div class="delete-confirm" role="group" aria-labelledby="delete-confirm-question-${instanceId}" hidden>
                <p class="delete-confirm-question" id="delete-confirm-question-${instanceId}">${t('deleteConfirm.question')}</p>
                <button type="button" class="btn btn-confirm-delete-btn">${t('deleteConfirm.confirm')}</button>
                <button type="button" class="btn btn-keep-btn" aria-describedby="delete-confirm-question-${instanceId}">${t('deleteConfirm.keep')}</button>
              </div>`;
  }

  // (re)finds its elements and wires its buttons after the panel renders -
  // called wherever the panel rebuilds its markup
  bind(root) {
    this.group = root.querySelector('.delete-confirm');
    this.confirmButton = root.querySelector('.btn-confirm-delete-btn');
    this.keepButton = root.querySelector('.btn-keep-btn');
    this.confirmButton.addEventListener('click', () => this.confirm());
    this.keepButton.addEventListener('click', () => this.cancel({ returnFocus: true }));
  }

  // only the Entry that is open can be asked about
  begin() {
    if (this.getEntryId() === undefined) return;
    this.confirming = true;
    this.group.removeAttribute('hidden');
    this.host.setAttribute('data-confirming-delete', '');
    this.keepButton.focus();
  }

  confirm() {
    if (!this.confirming || this.getEntryId() === undefined) return;
    const id = this.getEntryId();
    // answered: a second press, or a double-click, cannot delete again
    this.confirming = false;
    this.deleteEntry(id);
    // a successful delete resets the panel (the Timeline closes it); if the
    // Entry was already gone it does not, and the question must not be left up
    if (this.getEntryId() === id) {
      this.hideQuestion();
    }
  }

  // Keep it, Escape, or the panel moving on to something else. Focus goes back
  // to Delete only when the Respondent answered (it would be taken from wherever
  // it is going otherwise)
  cancel({ returnFocus = false } = {}) {
    if (!this.confirming) return;
    this.confirming = false;
    this.hideQuestion();
    if (returnFocus) {
      this.returnFocusTo();
    }
  }

  // unconditional clear, for the panel's reset(): by then confirm() may
  // already have set confirming to false with the question (and the panel's
  // attribute) still up, so this cannot be guarded like cancel()
  dismiss() {
    this.confirming = false;
    this.hideQuestion();
  }

  hideQuestion() {
    this.group?.setAttribute('hidden', '');
    this.host.removeAttribute('data-confirming-delete');
  }
}
