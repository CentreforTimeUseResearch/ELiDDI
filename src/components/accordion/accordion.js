import { TinyBase } from '../base';
import { getActivityDisplayName } from '../../utils/activities';
import { escapeHtml } from '../../utils/html';
import './accordion.css';

const ID = 'dimensionindex';

export class Accordion extends TinyBase {
  static observedAttributes = [ID];

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    this.listen(this, 'click', (e) => this.handleClick(e));
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (this[name] !== newValue) {
      this[name] = newValue;
    }
  }

  handleClick(e) {
    e.stopPropagation();
    const activityButton = e.target.closest?.('[data-activity]');
    if (activityButton) {
      const activity = activityButton.dataset.activity;
      if (this.props.multi) {
        this.toggleActivityButton(activityButton, activity);
      } else {
        this.props.activitySelect(activity);
      }
      return;
    }
    const trigger = e.target.closest?.('[aria-controls]');
    if (!trigger || !this.contains(trigger)) {
      // the panel background, a wrapper <span>, a heading's margin - nothing
      // to toggle
      return;
    }
    // read from the attribute rather than ariaControlsElements - that ARIA
    // reflection API is null on elements without aria-controls and isn't
    // implemented in every environment (jsdom, for one). Attribute selector,
    // not #id - see HorizontalTimeline.getChildElementReferences
    const section = this.querySelector(`[id="${trigger.getAttribute('aria-controls')}"]`);
    if (section) {
      this.toggleAccordionSectionOpenState(trigger, section);
    }
  }

  toggleActivityButton(element, activity) {
    const isNowSelected = element.getAttribute('aria-pressed') !== 'true';
    element.setAttribute('aria-pressed', `${isNowSelected}`);
    element.classList.toggle('selected', isNowSelected);
    this.props.activityToggle(activity, isNowSelected);
  }

  toggleAccordionSectionOpenState(element, section) {
    const openState = element.ariaExpanded === 'true';
    element.setAttribute('aria-expanded', `${!openState}`);
    if (openState) {
      // its open so need to close it
      section.setAttribute('hidden', '');
    } else {
      section.removeAttribute('hidden');
    }
  }

  createAccordionEntry({ name, activities }, section) {
    const { multi, selected = [] } = this.props;
    if (activities.length === 0) return;

    return `
  <!-- accordion section header -->
  <h3>
    <button type="button" aria-expanded="true" class="accordion-trigger" aria-controls="sect${section}_${this[ID]}" id="accordion${section}id_${this[ID]}">
      <span class="accordion-title">
        ${escapeHtml(name)}
        <span class="accordion-icon"></span>
      </span>
    </button>
  </h3>

  <!-- accordion section body -->
  <div id="sect${section}_${this[ID]}" role="region" aria-labelledby="accordion${section}id_${this[ID]}" class="accordion-panel">
    <div style="display: flex; flex-direction: column">
    ${activities
      .map((activity) => {
        const displayName = getActivityDisplayName(activity);
        const isSelected = multi && selected.includes(displayName);
        // data-activity is read back as the value saved on the Entry, so it
        // must round-trip exactly - see escapeHtml
        const safeName = escapeHtml(displayName);
        return `
      <span>
        <button
          type="button"
          class="btn activity-button${isSelected ? ' selected' : ''}"
          style="border-left: 10px solid ${escapeHtml(activity.color)};"
          aria-label="${safeName}"
          data-activity="${safeName}"
          ${multi ? `aria-pressed="${isSelected}"` : ''}
        >
          ${safeName}
        </button>
      </span>`;
      })
      .join(' ')}


    </div>
  </div>`;
  }

  render() {
    const { content } = this.props;
    this.innerHTML = `
      <div id="accordionGroup" class="accordion">
        <!-- -->
    ${content
      .map((entry, index) => {
        return this.createAccordionEntry(entry, index);
      })
      .join('')}
        <!-- -->
      </div>
    `;
  }
}

customElements.define('el-accordion', Accordion);
