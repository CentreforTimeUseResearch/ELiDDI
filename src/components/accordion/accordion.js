import { TinyBase } from '../base';
import './accordion.css';

export class Accordion extends TinyBase {
  // properties

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    this.assignEventHandlers();
  }

  assignEventHandlers() {
    this.addEventListener('click', this.props.buttonClick)
  }

  createAccordionEntry({ name, activities }) {
    const { buttonClick } = this.props;
    if (activities.length === 0) return
    return `<h3>
    <button type="button" aria-expanded="true" class="accordion-trigger" aria-controls="sect1" id="accordion1id">
      <span class="accordion-title">
        ${name}
        <span class="accordion-icon"></span>
      </span>
    </button>
  </h3>
  <div id="sect1" role="region" aria-labelledby="accordion1id" class="accordion-panel">
    <div style="display: flex; flex-direction: column">
    ${activities.map(activity => `
      <span>
        <button 
          type="button" 
          class="btn" 
          style="border-left: 10px solid ${activity.color};" aria-label="${activity.label}" 
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
    ${content.map((entry) => {
      return this.createAccordionEntry(entry)
    }).join('')};
        <!-- -->
      </div>
    `;
  }
}

customElements.define('el-accordion', Accordion);
