import '../timelinePicker/timelinePicker.js';
import '../contextualHelp/contextualHelp.js';
import './navbar.css';

export class Navbar extends HTMLElement {
  ready = false;

  constructor() {
    super();
  }

  connectedCallback() {
    this.render();
    this.assignEventHandlers();
  }

  assignEventHandlers() {
    if (!this.ready) {
      const hamMenu = this.querySelector('.ham-menu');
      const offScreenMenu = this.querySelector('.off-screen-menu');
      hamMenu?.addEventListener('click', () => {
        hamMenu.classList.toggle('active');
        offScreenMenu.classList.toggle('active');
      });
      this.ready = true;
    }
  }

  render() {
    // this component is a work in progress so this output is for debug purposes
    this.innerHTML = `

        <div class="off-screen-menu">
            <ul>
                <li>Instructions</li>
                <li>Change Date</li>
                <li>Reset</li>
            </ul>
        </div>

        <nav>
            <div class="left-pane">
                <button class="reset-to-div ham-menu">
                    <span></span>
                    <span></span>
                    <span></span>
                </button>
            </div>
            <div class="middle-pane">
                <el-timeline-picker></el-timeline-picker>
            </div>
            <div class="right-pane">
                <el-contextual-help 
                    id="timeline-picker" 
                ></el-contextual-help>
            </div>
        </nav>
        `;
  }
}

customElements.define('nav-bar', Navbar);
