import { Accordion } from '../accordion/accordion';
import { TinyBase } from '../base';
import { escapeHtml, searchActivities, hasKnownActivity } from '../../utils/activitySearch';
import { KeyboardGridNavigation } from './keyboardGridNavigation';
import './activityPicker.css';

const HEADING = 'heading';
const INSTRUCTION = 'instruction';
const ID = 'id';

export class ActivityPicker extends TinyBase {
  static observedAttributes = [HEADING, INSTRUCTION, ID];

  store = super.getStore();
  content;
  mode;
  selectedActivities = [];

  input;
  grid;
  popoverElement;

  constructor() {
    super();
    this.extractActivities();
    this.gridNavigation = new KeyboardGridNavigation({
      updateResults: () => this.updateResults(),
      setActiveDescendant: (value) => this.input.setAttribute('aria-activedescendant', value),
      clearInputDeferred: () => this.clearInputDeferred(),
      hideResults: () => this.hideResults(),
    });
  }

  extractActivities() {
    // read the attribute directly (not this[ID]) since attributeChangedCallback
    // hasn't run yet at construction time; this picker's own dimension is fixed
    // by its id attribute, not the globally-active currentDimensionIndex
    const dimensionIndex = Number(this.getAttribute(ID));
    this.content = GLOBALS.DATA.timeline[dimensionIndex].categories;
    this.mode = GLOBALS.DATA.timeline[dimensionIndex].mode;
    this.allowFreeText = GLOBALS.DATA.timeline[dimensionIndex].allow_free_text === true;
  }

  get isMulti() {
    return this.mode === 'multiple-choice';
  }

  connectedCallback() {
    super.connectedCallback();
  }

  setInputValue(activity) {
    this.input.value = Array.isArray(activity) ? activity.join(', ') : activity || '';
  }

  assignEventHandlers() {
    this.input = this.querySelector('input');
    this.grid = this.querySelector('#ex1-grid');
    this.popoverElement = this.querySelector('#activity-picker-popover');

    document.addEventListener('click', () => this.handleClickOutside());

    this.input.addEventListener('keyup', (evt) => this.gridNavigation.handleKeyUp(evt));
    this.input.addEventListener('keydown', (evt) => this.gridNavigation.handleKeyDown(evt));
    this.input.addEventListener('focus', () => this.handleInputFocus());
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
    this.showPopover();
    this.props.onFocusCallback?.();
  }

  showPopover() {
    this.popoverElement.showPopover({ source: this.input });
  }

  hidePopover() {
    this.popoverElement.hidePopover();
  }

  // On Firefox the input does not get cleared unless wrapped in a
  // setTimeout - invoked by the keyboard-navigation state machine on Escape
  clearInputDeferred() {
    setTimeout(() => {
      this.input.value = '';
    }, 1);
  }

  updateResults() {
    const searchString = this.input.value;
    const results = searchActivities(this.content, searchString);
    this.renderAccordion(results, searchString);
  }

  onActivitySelect(activity) {
    if (!activity) {
      console.log('problem with button to set label');
      return;
    }

    this.props.onSetActivityOnSelectedEntry(activity);
    this.hidePopover();
  }

  // multi-choice only: called on every toggle, popover stays open
  onActivityToggle(activity, isSelected) {
    if (isSelected) {
      this.selectedActivities = [...this.selectedActivities, activity];
    } else {
      this.selectedActivities = this.selectedActivities.filter((name) => name !== activity);
    }
    this.setInputValue(this.selectedActivities);
    this.props.onSetActivitiesOnSelectedEntry([...this.selectedActivities]);
  }

  // called by DetailsPanel when opening the panel for an existing multi-choice
  // entry, so the picker shows the previously-selected activities as pressed
  setSelectedActivities(activities) {
    this.selectedActivities = [...(activities || [])];
    this.renderAccordion(this.content);
  }

  accordionProps() {
    return { multi: this.isMulti, selected: this.selectedActivities };
  }

  doneButtonHtml() {
    return this.isMulti
      ? `<button type="button" class="btn activity-picker-done-btn" data-done>Done</button>`
      : '';
  }

  assignDoneButtonHandler() {
    this.popoverElement
      .querySelector('[data-done]')
      ?.addEventListener('click', () => this.hidePopover());
  }

  freeTextOptionHtml(searchString = '') {
    const trimmed = searchString.trim();
    if (!this.allowFreeText || !trimmed || hasKnownActivity(this.content, trimmed)) {
      return '';
    }
    const safeText = escapeHtml(trimmed);
    return `<button type="button" class="btn activity-picker-freetext-btn" data-free-text="${safeText}">Use &quot;${safeText}&quot;</button>`;
  }

  assignFreeTextHandler() {
    this.popoverElement.querySelector('[data-free-text]')?.addEventListener('click', (e) => {
      this.onActivitySelect(e.currentTarget.dataset.freeText);
    });
  }

  renderAccordion(results, searchString = '') {
    this.popoverElement.innerHTML = `${this.freeTextOptionHtml(searchString)}<el-accordion ${this.setProps({ content: results, activitySelect: this.onActivitySelect, activityToggle: (activity, isSelected) => this.onActivityToggle(activity, isSelected), ...this.accordionProps() })}></el-accordion>${this.doneButtonHtml()}`;
    this.assignDoneButtonHandler();
    this.assignFreeTextHandler();
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
                  <el-accordion dimensionindex=${this[ID]} ${this.setProps({ content: this.content, activitySelect: this.onActivitySelect, activityToggle: (activity, isSelected) => this.onActivityToggle(activity, isSelected), ...this.accordionProps() })}></el-accordion>
                  ${this.doneButtonHtml()}
                </div>
            </div>
        </div>
        `;
    this.assignEventHandlers();
    this.assignDoneButtonHandler();
  }
}

customElements.define('el-activitypicker', ActivityPicker);
