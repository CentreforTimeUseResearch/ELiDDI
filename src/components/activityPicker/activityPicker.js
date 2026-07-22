import { Accordion } from '../accordion/accordion';
import { TinyBase } from '../base';
import './activityPicker.css';

// const activities = GLOBALS.DATA.timeline[0].categories;

export class ActivityPicker extends TinyBase {
  // properties
  input;
  grid;

  options;
  // searchFn = props.searchFn;
  onFocusCallback;

  activeRowIndex = -1;
  activeColIndex = 0;
  rowsCount = 0;
  colsCount = 0;
  gridFocused = false;
  shown = false;
  selectionCol = 0;

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    console.log(this.props.options);
    this.render();
    //  this.searchFn = searchFn;
    this.input = this.querySelector('#ex1-input');
    this.grid = this.querySelector('#ex1-grid');
    this.assignEventHandlers();
  }

  assignEventHandlers() {
    this.input.addEventListener('focus', this.handleInputFocus.bind(this));
    // this.input.addEventListener('keyup', this.handleInputKeyUp.bind(this));
    // this.input.addEventListener('keydown', this.handleInputKeyDown.bind(this));
    // this.grid.addEventListener('click', this.handleGridClick.bind(this));
    // document.body.addEventListener('click', this.handleBodyClick.bind(this));
  }

  handleInputFocus() {
    this.props.onFocusCallback?.();
    // this.updateResults();
  }

  // handleBodyClick(evt) {
  //     if (evt.target === this.input || this.grid.contains(evt.target)) {
  //         return;
  //     }
  //     this.hideResults();
  // }

  // handleInputKeyUp(evt) {
  //     var key = evt.which || evt.keyCode;

  //     switch (key) {
  //         case aria.KeyCode.UP:
  //         case aria.KeyCode.DOWN:
  //         case aria.KeyCode.ESC:
  //         case aria.KeyCode.RETURN:
  //             evt.preventDefault();
  //             return;
  //         case aria.KeyCode.LEFT:
  //         case aria.KeyCode.RIGHT:
  //             if (this.gridFocused) {
  //                 evt.preventDefault();
  //                 return;
  //             }
  //             break;
  //         default:
  //             this.updateResults();
  //     }
  // }

  // handleInputKeyDown(evt) {
  //     var key = evt.which || evt.keyCode;
  //     var activeRowIndex = this.activeRowIndex;
  //     var activeColIndex = this.activeColIndex;

  //     if (key === aria.KeyCode.ESC) {
  //         if (this.gridFocused) {
  //             this.gridFocused = false;
  //             this.removeFocusCell(this.activeRowIndex, this.activeColIndex);
  //             this.activeRowIndex = -1;
  //             this.activeColIndex = 0;
  //             this.input.setAttribute('aria-activedescendant', '');
  //         } else {
  //             if (!this.shown) {
  //                 setTimeout(
  //                     function () {
  //                         // On Firefox, input does not get cleared here unless wrapped in
  //                         // a setTimeout
  //                         this.input.value = '';
  //                     }.bind(this),
  //                     1
  //                 );
  //             }
  //         }
  //         if (this.shown) {
  //             this.hideResults();
  //         }
  //         return;
  //     }

  //     if (this.rowsCount < 1) {
  //         return;
  //     }

  //     var prevActive = this.getItemAt(activeRowIndex, this.selectionCol);
  //     var activeItem;

  //     switch (key) {
  //         case aria.KeyCode.UP:
  //             this.gridFocused = true;
  //             activeRowIndex = this.getRowIndex(key);
  //             evt.preventDefault();
  //             break;
  //         case aria.KeyCode.DOWN:
  //             this.gridFocused = true;
  //             activeRowIndex = this.getRowIndex(key);
  //             evt.preventDefault();
  //             break;
  //         case aria.KeyCode.LEFT:
  //             if (activeColIndex <= 0) {
  //                 activeColIndex = this.colsCount - 1;
  //                 activeRowIndex = this.getRowIndex(key);
  //             } else {
  //                 activeColIndex--;
  //             }
  //             if (this.gridFocused) {
  //                 evt.preventDefault();
  //             }
  //             break;
  //         case aria.KeyCode.RIGHT:
  //             if (activeColIndex === -1 || activeColIndex >= this.colsCount - 1) {
  //                 activeColIndex = 0;
  //                 activeRowIndex = this.getRowIndex(key);
  //             } else {
  //                 activeColIndex++;
  //             }
  //             if (this.gridFocused) {
  //                 evt.preventDefault();
  //             }
  //             break;
  //         case aria.KeyCode.RETURN:
  //             activeItem = this.getItemAt(activeRowIndex, this.selectionCol);
  //             this.selectItem(activeItem);
  //             this.gridFocused = false;
  //             return;
  //         case aria.KeyCode.TAB:
  //             this.hideResults();
  //             return;
  //         default:
  //             return;
  //     }

  //     if (prevActive) {
  //         this.removeFocusCell(this.activeRowIndex, this.activeColIndex);
  //         prevActive.setAttribute('aria-selected', 'false');
  //     }

  //     activeItem = this.getItemAt(activeRowIndex, activeColIndex);
  //     this.activeRowIndex = activeRowIndex;
  //     this.activeColIndex = activeColIndex;

  //     if (activeItem) {
  //         this.input.setAttribute(
  //             'aria-activedescendant',
  //             'result-item-' + activeRowIndex + 'x' + activeColIndex
  //         );
  //         this.focusCell(activeRowIndex, activeColIndex);
  //         var selectedItem = this.getItemAt(activeRowIndex, this.selectionCol);
  //         selectedItem.setAttribute('aria-selected', 'true');
  //     } else {
  //         this.input.setAttribute('aria-activedescendant', '');
  //     }
  // }

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

  updateResults() {
    const searchString = this.input.value;

    if (!searchString) {
      return;
    }

    // this.dispatchEvent(new CustomEvent(
    //     'activitySearch',
    //     { bubbles: true, detail: { searchString } }
    // ));

    // return

    var results = this.searchFn(searchString);

    debugger;

    this.hideResults();

    if (!searchString) {
      results = [];
    }

    var results = this.searchFn(searchString);

    if (results.length) {
      for (var row = 0; row < results.length; row++) {
        var resultRow = document.createElement('div');
        resultRow.className = 'result-row';
        resultRow.setAttribute('role', 'row');
        resultRow.setAttribute('id', 'result-row-' + row);
        for (var col = 0; col < results[row].length; col++) {
          var resultCell = document.createElement('div');
          resultCell.className = 'result-cell';
          resultCell.setAttribute('role', 'gridcell');
          resultCell.setAttribute('id', 'result-item-' + row + 'x' + col);
          resultCell.innerText = results[row][col];
          resultRow.appendChild(resultCell);
        }
        this.grid.appendChild(resultRow);
      }
      aria.Utils.removeClass(this.grid, 'hidden');
      this.input.setAttribute('aria-expanded', 'true');
      this.rowsCount = results.length;
      this.colsCount = results.length ? results[0].length : 0;
      this.shown = true;
    }
  }

  render() {
    // this component is a work in progress so this output is for debug purposes
    this.innerHTML = `
        <!-- <label for="ex1-input" id="ex1-label" class="combobox-label"> Fruits and vegetables </label> -->
        <div class="combobox-wrapper">
            <div id="ex1-combobox">
                <input 
                    type="text" 
                    role="combobox" 
                    aria-haspopup="grid" 
                    aria-expanded="false" 
                    aria-autocomplete="list" 
                    aria-controls="ex1-grid" 
                    id="ex1-input"
                    value=""
                >
            </div>
            <div aria-labelledby="ex1-label" role="grid" id="ex1-grid" class="grid">
                <el-accordion>
                    <el-accordion-section>
                        <el-button-panel></el-button-panel>
                    </el-accordion-section>
                </el-accordion>
            </div>
        </div>
        `;
  }
}

customElements.define('el-activitypicker', ActivityPicker);
