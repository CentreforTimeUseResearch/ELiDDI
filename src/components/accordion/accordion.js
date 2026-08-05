import { ActivityButton } from '../activityButton/activityButton';
import { TinyBase } from '../base';
import './accordion.css';

export class Accordion extends TinyBase {
  // properties

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    console.log(this.props)
    // this.assignEventHandlers();
  }

  assignEventHandlers() { }

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
                <el-activity-button 
                  label=${activity.name} 
                  color=${activity.color} 
                  ${this.setProps({ onClick: (event) => { buttonClick(event) } })}
                >
                </el-activity-button>`).join(" ")}
    </div>
  </div>`;
  }


  render() {
    const { content } = this.props;




    const first = content[0]; // just for test
    // this component is a work in progress so this output is for debug purposes
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
