import '../timelinePicker/timelinePicker.js';
import '../contextualHelp/contextualHelp.js';
import { TinyBase } from '../base';
import { RESET_ONBOARDING, SHOW_PANEL } from '../../store/actionTypes';
import { formatDateKeyAsDDMMYYYY } from '../../utils/time';
import './navbar.css';

export class Navbar extends TinyBase {
  ready = false;
  store = super.getStore();
  dateIndicator;

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    this.assignEventHandlers();
    this.dateIndicator = this.querySelector('.date-indicator');
    this.registerCleanup(this.store.subscribe(() => this.updateDateIndicator()));
    this.updateDateIndicator();
  }

  updateDateIndicator() {
    if (!this.dateIndicator) {
      return;
    }
    const { currentDate } = this.store.getState();
    this.dateIndicator.innerHTML = `Selected day: ${formatDateKeyAsDDMMYYYY(currentDate)} <u>change</u>`;
  }

  assignEventHandlers() {
    if (!this.ready) {
      const hamMenu = this.querySelector('.ham-menu');
      const offScreenMenu = this.querySelector('.off-screen-menu');
      hamMenu?.addEventListener('click', () => {
        hamMenu.classList.toggle('active');
        offScreenMenu.classList.toggle('active');
      });
      this.querySelector('.instructions-button')?.addEventListener('click', () => {
        this.store.dispatch({ type: RESET_ONBOARDING });
        hamMenu.classList.toggle('active');
        offScreenMenu.classList.toggle('active');
      });
      this.querySelector('.change-date-button')?.addEventListener('click', () => {
        this.store.dispatch({ type: SHOW_PANEL, payload: 'date' });
        // hamMenu.classList.toggle('active');
        // offScreenMenu.classList.toggle('active');
      });
      this.ready = true;
    }
  }

  render() {
    // this component is a work in progress so this output is for debug purposes
    this.innerHTML = `

        <div class="off-screen-menu">
            <ul>
                <li><button class="reset-to-div instructions-button" type="button">Instructions</button></li>
           
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
                <button class="reset-to-div date-indicator change-date-button"></button>
            </div>
            <div class="right-pane">
                <el-contextual-help></el-contextual-help>
            </div>
        </nav>
        `;
  }
}

customElements.define('el-nav-bar', Navbar);
