// The seam between the things that leave the details panel (opening another
// Entry, starting a new one, changing day, closing the panel) and whoever
// knows whether something unsaved would be lost: the DetailsPanelCoordinator,
// which registers itself here. Anything about to drop the panel's contents
// calls guardUnsavedEdits() instead of just going ahead:
//   - nothing unsaved (or no guard registered): `proceed` runs at once
//   - something unsaved: the guard asks the Respondent first, and runs
//     `proceed` only once the edit is saved or discarded; if they keep
//     editing, `onCancel` runs (to put right anything done in advance)
//
// `scope` says what could be lost: { dimensionIndex } is the Dimension being
// opened into (default: the current one), { all: true } is every Dimension's
// draft, for a change of day.

let guard;

// -> a function that takes the guard away again (only if it is still the one)
export function registerUnsavedEditsGuard(fn) {
  guard = fn;
  return () => {
    if (guard === fn) {
      guard = undefined;
    }
  };
}

export function guardUnsavedEdits(scope, proceed, onCancel) {
  if (!guard) {
    proceed();
    return;
  }
  guard(scope ?? {}, proceed, onCancel);
}
