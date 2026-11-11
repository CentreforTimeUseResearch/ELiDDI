import { TinyBase } from '../base';
import {
  DISMISS_ONBOARDING,
  PREVIOUS_INSTRUCTION,
  NEXT_INSTRUCTION,
  SHOW_PANEL,
  HIDE_PANEL,
} from '../../store/actionTypes';
import './onboarding.css';
import { escapeHtml } from '../../utils/html';
import { onboardingSteps } from '../../config/appConfig';
import { t } from '../../i18n/i18n';

export class Onboarding extends TinyBase {
  store = super.getStore();
  back;
  next;

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    this.registerCleanup(this.store.subscribe(this.render.bind(this)));
  }

  assignEventHandlers(isLastStep) {
    this.back = this.querySelector('[data-back]');
    this.back?.addEventListener('click', () => this.onBackClick());

    if (!isLastStep) {
      this.next = this.querySelector('[data-next]');
      this.next?.addEventListener('click', () => this.onNextClick());
    } else {
      //assign event handler to button that moves on from onboarding
      this.next = this.querySelector('[data-next]');
      this.next?.addEventListener('click', () => {
        this.store.dispatch({
          type: DISMISS_ONBOARDING,
        });
      });
    }
    this.ready = true;
  }

  onBackClick() {
    this.store.dispatch({
      type: PREVIOUS_INSTRUCTION,
    });
  }

  onNextClick() {
    this.store.dispatch({
      type: NEXT_INSTRUCTION,
    });
  }

  onOpenPanel(payload) {
    this.store.dispatch({
      type: SHOW_PANEL,
      payload,
    });
  }

  onClosePanel() {
    this.store.dispatch({
      type: HIDE_PANEL,
    });
  }

  render() {
    const { onboarding, onboardingStep, uipanel } = this.store.getState();
    if (!onboarding) {
      return;
    }
    const steps = onboardingSteps();
    const isLastStep = onboardingStep === steps.length - 1; // index is zero indexed so last index is one less than the step count;
    const { title, text, spotlight, modalTop, showPanel } = steps[onboardingStep];

    if (showPanel && showPanel !== uipanel) {
      this.onOpenPanel(showPanel);
    } else if (showPanel === undefined && uipanel !== undefined) {
      this.onClosePanel();
    }

    if (Array.isArray(spotlight)) {
      this.props.moveSpotlight(...spotlight);
    }
    this.props.moveModalTop(modalTop || 0);

    // title is plain text; text is deliberately HTML (e.g. <strong>), written
    // by whoever authors the study config - trusted, like DialogWidget's
    // content (#117)
    this.innerHTML = `
            <div class="content spotlight">
              <h4>${escapeHtml(title)}</h4>            
              <!--<img class="onboarding-card-image" src="/src/assets/images/dummy_timeline.png" />-->
              <div>${text}</div> 
            </div>
            <div class="navigation">
              <progress id="onboarding-progress" max="${steps.length}" value="${onboardingStep + 1}">${t('onboarding.progress', { step: onboardingStep, total: steps.length })}</progress>
              <div class="button-bar">
                ${onboardingStep > 0 ? `<button data-back>${t('onboarding.back')}</button>` : ''}
                <button data-next ${isLastStep ? `class="last"` : ''} >${isLastStep ? t('onboarding.start') : t('onboarding.next')}</button>
              </div>
            </div>
        `;
    this.assignEventHandlers(isLastStep);
  }
}

customElements.define('el-onboarding', Onboarding);
