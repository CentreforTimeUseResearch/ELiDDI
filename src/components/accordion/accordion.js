import { TinyBase } from '../base';
import './accordion.css';

const ID = 'timelineindex';

export class Accordion extends TinyBase {
  static observedAttributes = [ID];

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    this.assignEventHandlers();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (this[name] !== newValue) {
      this[name] = newValue;
    }
  }

  assignEventHandlers() {
    this.addEventListener('click', (e) => this.handleClick(e))
  }

  handleClick(e) {
    e.stopPropagation();
    const element = e.target;
    const activity = element.dataset?.activity
    if (activity) {
      this.props.activitySelect(activity);
      return
    }
    // something else was clicked!
    const section = element.ariaControlsElements[0];
    if (section) {
      this.toggleAccordionSectionOpenState(element, section)
    }

  }

  toggleAccordionSectionOpenState(element, section) {
    const openState = element.ariaExpanded === 'true';
    element.setAttribute('aria-expanded', `${!openState}`)
    if (openState) {
      // its open so need to close it
      section.setAttribute('hidden', '');
    } else {
      section.removeAttribute('hidden')
    }

  }


  createAccordionEntry({ name, activities }, section) {
    const { buttonClick } = this.props;
    if (activities.length === 0) return

    return `
  <!-- accordion section header -->
  <h3>
    <button type="button" aria-expanded="true" class="accordion-trigger" aria-controls="sect${section}_${this[ID]}" id="accordion${section}id_${this[ID]}">
      <span class="accordion-title">
        ${name}
        <span class="accordion-icon"></span>
      </span>
    </button>
  </h3>

  <!-- accordion section body -->
  <div id="sect${section}_${this[ID]}" role="region" aria-labelledby="accordion${section}id_${this[ID]}" class="accordion-panel">
    <div style="display: flex; flex-direction: column">
    ${activities.map(activity => `
      <span>
        <button 
          type="button" 
          class="btn activity-button" 
          style="border-left: 10px solid ${activity.color};" 
          aria-label="${activity.label}" 
          data-activity="${activity.label}"
        >
          ${activity.label}
        </button>
      </span>`
    ).join(" ")}


    </div>
  </div>`;
  }


  render() {
    const { content } = this.props;
    this.innerHTML = `
      <div id="accordionGroup" class="accordion">
        <!-- -->
    ${content.map((entry, index) => {
      return this.createAccordionEntry(entry, index)
    }).join('')};
        <!-- -->
      </div>
    `;
  }
}

customElements.define('el-accordion', Accordion);
