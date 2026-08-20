// Encapsulates the ARIA combobox/grid keyboard-navigation state machine
// used by ActivityPicker's search input (arrow-key/escape handling and the
// active row/column/focus state). This class owns no DOM of its own - the
// `host` passed to the constructor supplies the handful of DOM effects it
// needs (updating the input, setting aria-activedescendant), which keeps
// this state machine testable without mounting a custom element.
//
// Grid-cell lookup/focus (a real getItemAt/focusCell implementation) isn't
// built yet, so rowsCount/colsCount are never populated by ActivityPicker
// today and most of this only runs once that's wired up - this class
// preserves that behavior as-is rather than finishing the feature.

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
  activeColIndex = 0;
  rowsCount = 0;
  colsCount = 0;
  gridFocused = false;
  shown = false;

  // host: { updateResults(), setActiveDescendant(value), clearInputDeferred(), hideResults() }
  constructor(host) {
    this.host = host;
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
      case KEY_CODE.LEFT:
      case KEY_CODE.RIGHT:
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
    let activeRowIndex = this.activeRowIndex;
    let activeColIndex = this.activeColIndex;

    if (key === KEY_CODE.ESC) {
      if (this.gridFocused) {
        this.gridFocused = false;
        this.activeRowIndex = -1;
        this.activeColIndex = 0;
        this.host.setActiveDescendant('');
      } else if (!this.shown) {
        this.host.clearInputDeferred();
      }
      if (this.shown) {
        this.host.hideResults();
      }
      return;
    }

    if (this.rowsCount < 1) {
      return;
    }

    switch (key) {
      case KEY_CODE.UP:
        this.gridFocused = true;
        evt.preventDefault();
        break;
      case KEY_CODE.DOWN:
        this.gridFocused = true;
        evt.preventDefault();
        break;
      case KEY_CODE.LEFT:
        if (activeColIndex <= 0) {
          activeColIndex = this.colsCount - 1;
        } else {
          activeColIndex--;
        }
        if (this.gridFocused) {
          evt.preventDefault();
        }
        break;
      case KEY_CODE.RIGHT:
        if (activeColIndex === -1 || activeColIndex >= this.colsCount - 1) {
          activeColIndex = 0;
        } else {
          activeColIndex++;
        }
        if (this.gridFocused) {
          evt.preventDefault();
        }
        break;
      case KEY_CODE.RETURN:
        this.gridFocused = false;
        return;
      case KEY_CODE.TAB:
        return;
      default:
        return;
    }

    this.activeRowIndex = activeRowIndex;
    this.activeColIndex = activeColIndex;

    // grid-cell lookup/focus (getItemAt, focusCell) isn't implemented yet,
    // so there's never an active item to point aria-activedescendant at
    this.host.setActiveDescendant('');
  }
}
