import { TinyBase } from '../base';
import './onboarding.css';

export class Onboarding extends TinyBase {

  store = super.getStore();
  back;
  next;

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    this.store.subscribe(this.render.bind(this))
  }

  assignEventHandlers() {

    this.back = this.querySelector('[data-back]')
    this.back?.addEventListener('click', () => this.onBackClick())

    this.next = this.querySelector('[data-next]')
    this.next?.addEventListener('click', () => this.onNextClick())

    this.ready = true;

  }

  onBackClick() {
    this.store.dispatch({
      type: 'PREVIOUS_INSTRUCTION'
    })
  }

  onNextClick() {
    this.store.dispatch({
      type: 'NEXT_INSTRUCTION'
    })
  }


  render() {
    const { onboardingStep } = this.store.getState();
    const { title, text } = GLOBALS.DATA.instructions[onboardingStep];
    const isLastStep = onboardingStep === GLOBALS.DATA.instructions.length - 1
    console.log(isLastStep)
    this.innerHTML = `
            <div class="content">
              <h4>${title}</h4>
              <img class="onboarding-card-image" src="/src/assets/images/dummy_timeline.png" />
              <div>${text}</div> 
            </div>
            <div class="navigation">
              <progress id="onboarding-progress" max="3" value="${onboardingStep + 1}">1 of 3</progress>
              <div class="button-bar">
                ${onboardingStep > 0 ? `<button data-back>back</button>` : ''}
                <button data-next ${isLastStep ? `class="last"` : ''} >${isLastStep ? 'start' : 'next'}</button>
              </div>
            </div>
        `;
    this.assignEventHandlers();
  }
}

customElements.define('el-onboarding', Onboarding);
