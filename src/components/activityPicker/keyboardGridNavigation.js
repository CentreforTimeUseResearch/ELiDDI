// Encapsulates the ARIA combobox keyboard-navigation state machine used by
// ActivityPicker's search input (arrow-key/Enter/Escape handling and which
// item is active). This class owns no DOM of its own - the `host` passed to
// the constructor supplies the handful of DOM effects it needs (listing the
// items, marking one active, activating one), which keeps this state machine
// testable without mounting a custom element.
//
// The "grid" is the popover's visible items in document order, one per row
// in a single column: the free-text button, each Category header, and each
// Activity button inside an open Category. The list is read from the host on
// every key press, so it always matches what is on screen. Focus stays in
// the input throughout; the active item is announced through
// aria-activedescendant.

export const KEY_CODE = {
  BACKSPACE: 8,
  TAB: 9,
  RETURN: 13,
  SHIFT: 16,
  ESC: 27,
  SPACE: 32,
  PAGE_UP: 33,
  PAGE_DOWN: 34,
  END: 35,
  HOME: 36,
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,
  DELETE: 46,
};

export class KeyboardGridNavigation {
  activeRowIndex = -1;
  rowsCount = 0;
  gridFocused = false;
  shown = false;

  // host: { updateResults(), getItems(), setActiveItem(item | null),
  //         activateItem(item), clearInputDeferred(), hideResults() }
  constructor(host) {
    this.host = host;
  }

  // back to "typing in the input": nothing active. Called when the items
  // are replaced or the popover closes, so the index can't point at a
  // stale row
  reset() {
    this.gridFocused = false;
    this.activeRowIndex = -1;
    this.host.setActiveItem(null);
  }

  handleKeyUp(evt) {
    const key = evt.which || evt.keyCode;

    switch (key) {
      case KEY_CODE.UP:
      case KEY_CODE.DOWN:
      case KEY_CODE.ESC:
      case KEY_CODE.RETURN:
        evt.preventDefault();
        return;
      case KEY_CODE.HOME:
      case KEY_CODE.END:
        if (this.gridFocused) {
          evt.preventDefault();
          return;
        }
        break;
      default:
        this.host.updateResults();
    }
  }

  handleKeyDown(evt) {
    const key = evt.which || evt.keyCode;

    if (key === KEY_CODE.ESC) {
      if (this.gridFocused) {
        this.reset();
      } else if (!this.shown) {
        this.host.clearInputDeferred();
      }
      if (this.shown) {
        this.host.hideResults();
      }
      return;
    }

    const items = this.host.getItems();
    this.rowsCount = items.length;
    if (this.rowsCount < 1) {
      return;
    }

    let row = this.activeRowIndex;
    switch (key) {
      case KEY_CODE.DOWN:
        row = this.gridFocused ? (row + 1) % this.rowsCount : 0;
        break;
      case KEY_CODE.UP:
        if (this.gridFocused && row <= 0) {
          // above the first item is the input again
          evt.preventDefault();
          this.reset();
          return;
        }
        row = this.gridFocused ? row - 1 : this.rowsCount - 1;
        break;
      case KEY_CODE.HOME:
      case KEY_CODE.END:
        if (!this.gridFocused) {
          return; // the caret keys, in the input
        }
        row = key === KEY_CODE.HOME ? 0 : this.rowsCount - 1;
        break;
      case KEY_CODE.RETURN:
        if (this.gridFocused && items[row]) {
          evt.preventDefault();
          this.host.activateItem(items[row]);
        }
        return;
      default:
        return;
    }

    evt.preventDefault();
    this.gridFocused = true;
    this.activeRowIndex = Math.min(row, this.rowsCount - 1);
    this.host.setActiveItem(items[this.activeRowIndex]);
  }
}
