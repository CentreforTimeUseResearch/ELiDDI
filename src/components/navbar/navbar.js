import '../timelinePicker/timelinePicker.js';
import '../contextualHelp/contextualHelp.js';
import { TinyBase } from '../base';
import { RESET_ONBOARDING, SHOW_PANEL } from '../../store/actionTypes';
import { formatDateKeyAsDDMMYYYY } from '../../utils/time';
import './navbar.css';

// the sidebar's generic menu options - rendered twice (sidebar drawer below
// 1024px, nav bar at/above it, see renderMenuItems) rather than switched via
// JS, so this is the one place their labels/handlers are defined
const MENU_ITEMS = [
  { label: 'Instructions', buttonClass: 'instructions-button' },
  { label: 'Reset (clears this day)', buttonClass: 'reset-diary-button' },
  { label: 'View stats' },
  { label: 'About this study' },
];

export class Navbar extends TinyBase {
  ready = false;
  store = super.getStore();
  dateIndicator;

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
      // the Instructions button is duplicated (sidebar drawer + nav bar, see
      // renderMenuItems) so every copy needs wiring, not just the first
      this.querySelectorAll('.instructions-button').forEach((button) => {
        button.addEventListener('click', () => {
          this.store.dispatch({ type: RESET_ONBOARDING });
          hamMenu.classList.toggle('active');
          offScreenMenu.classList.toggle('active');
        });
      });
      // asks first: DynamicTimelineUI's reset dialog does the clearing
      this.querySelectorAll('.reset-diary-button').forEach((button) => {
        button.addEventListener('click', () => {
          this.store.dispatch({ type: SHOW_PANEL, payload: 'reset' });
          hamMenu.classList.remove('active');
          offScreenMenu.classList.remove('active');
        });
      });
      this.querySelector('.change-date-button')?.addEventListener('click', () => {
        this.store.dispatch({ type: SHOW_PANEL, payload: 'date' });
        // hamMenu.classList.toggle('active');
        // offScreenMenu.classList.toggle('active');
      });
      this.ready = true;
    }
  }

  // shared between the sidebar's generic-menu <ul> and its >=1024px nav-bar
  // duplicate (see navbar.css) - same items/labels/handlers, only the
  // wrapping classes differ so each copy can be styled for where it lives
  renderMenuItems(itemClass) {
    return MENU_ITEMS.map((item) =>
      item.buttonClass
        ? `<li class="${itemClass}"><button class="reset-to-div ${item.buttonClass}" type="button">${item.label}</button></li>`
        : `<li class="${itemClass}">${item.label}</li>`
    ).join('');
  }

  render() {
    // this component is a work in progress so this output is for debug purposes
    this.innerHTML = `

        <div class="off-screen-menu">
          <div class="menu-container">
            <ul class="menu-list" data-menu="generic">
                ${this.renderMenuItems('menu-item')}
            </ul>
          </div>
        </div>

        <nav>
            <div class="left-pane">
                <button class="reset-to-div ham-menu">
                    <span></span>
                    <span></span>
                    <span></span>
                </button>
                <ul class="nav-menu-list">
                    ${this.renderMenuItems('nav-menu-item')}
                </ul>
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
