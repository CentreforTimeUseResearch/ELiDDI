import { Accordion } from '../accordion/accordion';
import { TinyBase } from '../base';
import './activityPicker.css';

const HEADING = 'heading';
const INSTRUCTION = 'instruction';
const ID = 'id';
export class ActivityPicker extends TinyBase {
  static observedAttributes = [HEADING, INSTRUCTION, ID];

  store = super.getStore();
  content;

  input;
  grid;
  popoverElement;

  options;
  accordionDataKey;
  onFocusCallback;

  activeRowIndex = -1;
  activeColIndex = 0;
  rowsCount = 0;
  colsCount = 0;
  gridFocused = false;
  shown = false;
  selectionCol = 0;

  keyCode = {
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
  }

  constructor() {
    super();
    this.extractActivities()
  }

  extractActivities() {
    // read the attribute directly (not this[ID]) since attributeChangedCallback
    // hasn't run yet at construction time; this picker's own dimension is fixed
    // by its id attribute, not the globally-active currentDimensionIndex
    const dimensionIndex = Number(this.getAttribute(ID));
    this.content = GLOBALS.DATA.timeline[dimensionIndex].categories;
  }

  connectedCallback() {
    super.connectedCallback();
    this.render();
  }



  setInputValue(activity) {
    this.input.value = activity || "";
  }

  assignEventHandlers() {
    this.input = this.querySelector('input');
    this.grid = this.querySelector('#ex1-grid');
    this.popoverElement = this.querySelector('#activity-picker-popover');

    document.addEventListener('click', (event) => {
      this.handleClickOutside();
    });

    this.input.addEventListener('keyup', (event) => this.handleInputKeyUp(event));
    this.input.addEventListener('keydown', (event) => this.handleInputKeyDown(event));
    this.input.addEventListener('focus', (event) => this.handleInputFocus());

    // this.grid.addEventListener('click', this.handleGridClick.bind(this));

    // document.addEventListener('keydown', (event) => {
    //   if (event.key === 'Escape') {
    //     this.hidePopover();
    //     this.input.blur();
    //   }
    // })
  }

  handleClickOutside() {
    if (!this.popoverElement.matches(':popover-open')) return;
    const clickedInput = this.input.parentNode.contains(event.target);
    const clickedPopover = this.popoverElement.contains(event.target);
    if (!clickedInput && !clickedPopover) {
      this.hidePopover();
    }
  }

  handleInputFocus() {
    this.showPopover({ source: this.input });
    this.props.onFocusCallback?.();
    // this.updateResults();
  }

  showPopover() {
    // this.props.onPopOverShowing(true)
    this.popoverElement.showPopover({ source: this.input });
  }

  hidePopover() {
    // this.props.onPopOverShowing(false)
    this.popoverElement.hidePopover();
  }


  // handleBodyClick(evt) {
  //     if (evt.target === this.input || this.grid.contains(evt.target)) {
  //         return;
  //     }
  //     this.hideResults();
  // }

  handleInputKeyUp(evt) {


    var key = evt.which || evt.keyCode;

    switch (key) {
      case this.keyCode.UP:
      case this.keyCode.DOWN:
      case this.keyCode.ESC:
      case this.keyCode.RETURN:
        evt.preventDefault();
        return;
      case this.keyCode.LEFT:
      case this.keyCode.RIGHT:
        if (this.gridFocused) {
          evt.preventDefault();
          return;
        }
        break;
      default:
        this.updateResults();
    }
  }

  handleInputKeyDown(evt) {
    const key = evt.which || evt.keyCode;
    let activeRowIndex = this.activeRowIndex;
    let activeColIndex = this.activeColIndex;

    if (key === this.keyCode.ESC) {
      if (this.gridFocused) {
        this.gridFocused = false;
        // this.removeFocusCell(this.activeRowIndex, this.activeColIndex);
        this.activeRowIndex = -1;
        this.activeColIndex = 0;
        this.input.setAttribute('aria-activedescendant', '');
      } else {
        if (!this.shown) {
          setTimeout(
            function () {
              // On Firefox, input does not get cleared here unless wrapped in
              // a setTimeout
              this.input.value = '';
            }.bind(this),
            1
          );
        }
      }
      if (this.shown) {
        this.hideResults();
      }
      return;
    }

    if (this.rowsCount < 1) {
      return;
    }

    const prevActive = this.getItemAt(activeRowIndex, this.selectionCol);
    let activeItem;

    switch (key) {
      case this.keyCode.UP:
        this.gridFocused = true;
        // activeRowIndex = this.getRowIndex(key);
        evt.preventDefault();
        break;
      case this.keyCode.DOWN:
        this.gridFocused = true;
        // activeRowIndex = this.getRowIndex(key);
        evt.preventDefault();
        break;
      case this.keyCode.LEFT:
        if (activeColIndex <= 0) {
          activeColIndex = this.colsCount - 1;
          // activeRowIndex = this.getRowIndex(key);
        } else {
          activeColIndex--;
        }
        if (this.gridFocused) {
          evt.preventDefault();
        }
        break;
      case this.keyCode.RIGHT:
        if (activeColIndex === -1 || activeColIndex >= this.colsCount - 1) {
          activeColIndex = 0;
          // activeRowIndex = this.getRowIndex(key);
        } else {
          activeColIndex++;
        }
        if (this.gridFocused) {
          evt.preventDefault();
        }
        break;
      case this.keyCode.RETURN:
        // activeItem = this.getItemAt(activeRowIndex, this.selectionCol);
        // this.selectItem(activeItem);
        this.gridFocused = false;
        return;
      case this.keyCode.TAB:
        // this.hideResults();
        return;
      default:
        return;
    }

    if (prevActive) {
      // this.removeFocusCell(this.activeRowIndex, this.activeColIndex);
      // prevActive.setAttribute('aria-selected', 'false');
    }

    // activeItem = this.getItemAt(activeRowIndex, activeColIndex);
    this.activeRowIndex = activeRowIndex;
    this.activeColIndex = activeColIndex;

    if (activeItem) {
      this.input.setAttribute(
        'aria-activedescendant',
        'result-item-' + activeRowIndex + 'x' + activeColIndex
      );
      // this.focusCell(activeRowIndex, activeColIndex);
      // var selectedItem = this.getItemAt(activeRowIndex, this.selectionCol);
      selectedItem.setAttribute('aria-selected', 'true');
    } else {
      this.input.setAttribute('aria-activedescendant', '');
    }
  }

  // handleGridClick(evt) {
  //     if (!evt.target) {
  //         return;
  //     }

  //     var row;
  //     if (evt.target.getAttribute('role') === 'row') {
  //         row = evt.target;
  //     } else if (evt.target.getAttribute('role') === 'gridcell') {
  //         row = evt.target.parentNode;
  //     } else {
  //         return;
  //     }

  //     var selectItem = row.querySelector('.result-cell');
  //     this.selectItem(selectItem);
  // }

  set data(data) {
    this.options = data;
  }

  set searchFunction(searchFn) {
    this.searchFn = searchFn;
  }


  searchActivities(searchString) {

    return this.content.map((category) => {
      return {
        name: category.name,
        activities: category.activities.filter(activity => {
          return activity.name?.toLowerCase().includes(searchString.toLowerCase())
        })
      }
    })
  }

  updateResults() {
    const searchString = this.input.value;

    if (!searchString) {
      return;
    }

    var results = this.searchActivities(searchString);

    //   debugger;

    //   this.hideResults();

    //   if (!searchString) {
    //     results = [];
    //   }

    //   var results = this.searchFn(searchString);

    //   if (results.length) {
    //     for (var row = 0; row < results.length; row++) {
    //       var resultRow = document.createElement('div');
    //       resultRow.className = 'result-row';
    //       resultRow.setAttribute('role', 'row');
    //       resultRow.setAttribute('id', 'result-row-' + row);
    //       for (var col = 0; col < results[row].length; col++) {
    //         var resultCell = document.createElement('div');
    //         resultCell.className = 'result-cell';
    //         resultCell.setAttribute('role', 'gridcell');
    //         resultCell.setAttribute('id', 'result-item-' + row + 'x' + col);
    //         resultCell.innerText = results[row][col];
    //         resultRow.appendChild(resultCell);
    //       }
    //       this.grid.appendChild(resultRow);
    //     }
    //     aria.Utils.removeClass(this.grid, 'hidden');
    //     this.input.setAttribute('aria-expanded', 'true');
    //     this.rowsCount = results.length;
    //     this.colsCount = results.length ? results[0].length : 0;
    //     this.shown = true;
    //   }
    this.renderAccordion(results)
  }

  onActivitySelect(activity) {



    if (!activity) {
      console.log('problem with button to set label')
      return;
    }

    this.props.onSetActivityOnSelectedEntry(activity)
    this.hidePopover();
  }

  renderAccordion(results) {
    this.popoverElement.innerHTML = `<el-accordion ${this.setProps({ content: results, activitySelect: this.onActivitySelect })}></el-accordion>`
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (this[name] !== newValue) {
      this[name] = newValue;
    }
  }

  render() {
    this.innerHTML = `
        <label class="el-label el-label--l" for="activity-input_${this[ID]}">
          ${this[HEADING]}
        </label>
        <div class="combobox-wrapper">
            <div class="combobox-input-wrapper">
                <input 
                    type="text" 
                    role="combobox" 
                    aria-haspopup="grid" 
                    aria-expanded="false" 
                    aria-autocomplete="list" 
                    aria-controls="ex1-grid" 
                    id="activity-input_${this[ID]}"
                    value=""
                >
                 <span class="instruction"> ${this[INSTRUCTION]} </span>
                <div id="activity-picker-popover" popover="manual" class="activity-picker-popover">
                  <el-accordion dimensionindex=${this[ID]} ${this.setProps({ content: this.content, activitySelect: this.onActivitySelect })}></el-accordion>
                </div>
            </div>
        </div>
        `;
    this.assignEventHandlers();
  }
}

customElements.define('el-activitypicker', ActivityPicker);
