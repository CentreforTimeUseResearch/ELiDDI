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

  assignEventHandlers(isLastStep) {

    this.back = this.querySelector('[data-back]')
    this.back?.addEventListener('click', () => this.onBackClick())

    if (!isLastStep) {
      this.next = this.querySelector('[data-next]')
      this.next?.addEventListener('click', () => this.onNextClick())
    }
    else {
      //assign event handler to button that moves on from onboarding 
      this.next = this.querySelector('[data-next]')
      this.next?.addEventListener('click', () => {
        this.store.dispatch({
          type: 'DISMISS_ONBOARDING'
        })
      })


    }
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

  onOpenPanel(payload) {
    this.store.dispatch({
      type: 'SHOW_PANEL',
      payload
    })
  }

  onClosePanel() {
    this.store.dispatch({
      type: 'HIDE_PANEL'
    })
  }

  render() {
    const { onboardingStep, uipanel } = this.store.getState();
    const numberOfSteps = GLOBALS.DATA.instructions.length;
    const isLastStep = onboardingStep === numberOfSteps - 1; // index is zero indexed so last index is one less than numberOfSteps;
    const { title, text, spotlight, modalTop, showPanel } = GLOBALS.DATA.instructions[onboardingStep];

    if (showPanel && showPanel !== uipanel) {
      this.onOpenPanel(showPanel)
    } else if (showPanel === undefined && uipanel !== undefined) {
      this.onClosePanel()
    }


    if (Array.isArray(spotlight)) {
      this.props.moveSpotlight(...spotlight)
    }
    this.props.moveModalTop(modalTop || 0);

    this.innerHTML = `
            <div class="content spotlight">
              <h4>${title}</h4>            
              <!--<img class="onboarding-card-image" src="/src/assets/images/dummy_timeline.png" />-->
              <div>${text}</div> 
            </div>
            <div class="navigation">
              <progress id="onboarding-progress" max="${numberOfSteps}" value="${onboardingStep + 1}">${onboardingStep} of ${numberOfSteps}</progress>
              <div class="button-bar">
                ${onboardingStep > 0 ? `<button data-back>back</button>` : ''}
                <button data-next ${isLastStep ? `class="last"` : ''} >${isLastStep ? 'start' : 'next'}</button>
              </div>
            </div>
        `;
    this.assignEventHandlers(isLastStep);
  }
}

customElements.define('el-onboarding', Onboarding);
