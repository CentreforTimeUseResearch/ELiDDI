import '../detailsPanel/detailsPanel';
import '../navbar/navbar';
import '../dialogWidget/dialogWidget';
import '../timelineStack/timelineStack';
import '../horizontalTimelineStack/horizontalTimelineStack';
import '../onboarding/onboarding';
import '../datePicker/datePicker';
import '../keyboardHelp/keyboardHelp';
import '../validationPanel/validationPanel';
import '../login/login';
import '../syncNotice/syncNotice';

import { TinyBase } from '../base';
import {
  CLEAR_DIARY,
  DISMISS_ONBOARDING,
  HIDE_PANEL,
  SET_DESKTOP_LAYOUT,
} from '../../store/actionTypes';
import { watchDesktopBreakpoint } from '../../utils/breakpoint';
import { accounts as serverAccounts } from '../../config/appConfig';
import { appSession } from '../../auth/session';
import { appSyncStatus, BLOCKS_DIARY } from '../../sync/syncStatus';
import { t } from '../../i18n/i18n';

import './dynamicTimelineUI.css';

export class DynamicTimelineUI extends TinyBase {
  store = super.getStore();
  onboardingDialogActions;
  dateDialogActions;
  shortcutsDialogActions;
  resetDialogActions;
  loginDialogActions;
  accounts = serverAccounts();
  stackContainer;
  isDesktopLayout;

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    this.registerCleanup(this.store.subscribe(this.onStoreUpdate.bind(this)));
    this.registerCleanup(
      watchDesktopBreakpoint((matches) =>
        this.store.dispatch({ type: SET_DESKTOP_LAYOUT, payload: matches })
      )
    );
    if (this.accounts.enabled) {
      this.registerCleanup(appSession.subscribe(() => this.onStoreUpdate()));
      this.registerCleanup(appSyncStatus.subscribe(() => this.onStoreUpdate()));
      // a tablet left asleep can wake after its login has run out
      this.listen(document, 'visibilitychange', () => appSession.check());
    }
    this.onStoreUpdate();
  }

  // With server accounts on, nobody sees the diary (or its onboarding) until
  // they have logged in: on a shared device what is behind the dialog would be
  // somebody else's. The dialog also stays up while their own diary is being
  // fetched from the server (or cannot be used), so a Respondent never sees an
  // empty diary that is about to be replaced.
  isLoginRequired() {
    return (
      this.accounts.enabled && (appSession.get() === null || BLOCKS_DIARY.has(appSyncStatus.get()))
    );
  }

  onStoreUpdate() {
    const { onboarding, uipanel, isDesktopLayout } = this.store.getState();
    const loginRequired = this.isLoginRequired();
    this.toggleAttribute('data-login-required', loginRequired);
    if (this.accounts.enabled) {
      if (loginRequired) {
        this.loginDialogActions?.open();
      } else {
        this.loginDialogActions?.close();
      }
    }

    if (onboarding && !loginRequired) {
      this.onboardingDialogActions.open();
    } else {
      this.onboardingDialogActions.close();
    }

    if (uipanel === 'date') {
      this.dateDialogActions.open();
    } else {
      this.dateDialogActions.close();
    }

    if (uipanel === 'shortcuts') {
      this.shortcutsDialogActions.open();
    } else {
      this.shortcutsDialogActions.close();
    }

    if (uipanel === 'reset') {
      this.resetDialogActions.open();
    } else {
      this.resetDialogActions.close();
    }

    // only swap (and so only tear down/rebuild) the stack on an actual
    // breakpoint crossing, never on an unrelated store update (e.g. adding
    // an entry anywhere in the app) - mirrors the dateChanged-style guard
    // Timeline.updateState uses for its own conditional re-render
    if (isDesktopLayout !== this.isDesktopLayout) {
      this.isDesktopLayout = isDesktopLayout;
      this.renderStack();
    }
  }

  // the Respondent confirmed the Navbar's Reset: empty the viewed day's Diary
  clearCurrentDiary() {
    this.store.dispatch({
      type: CLEAR_DIARY,
      payload: { date: this.store.getState().currentDate },
    });
    this.store.dispatch({ type: HIDE_PANEL });
  }

  // swaps the single mounted stack component in #stack-container - never
  // touches the rest of the tree (el-nav-bar, the dialogs), unlike
  // re-running the whole render() would
  renderStack() {
    this.stackContainer.innerHTML = this.isDesktopLayout
      ? '<el-horizontal-timeline-stack></el-horizontal-timeline-stack>'
      : '<el-timeline-stack></el-timeline-stack>';
  }

  // only present when the study turns on server accounts; the Respondent cannot
  // dismiss it, they have to log in
  renderLoginDialog() {
    if (!this.accounts.enabled) {
      return '';
    }
    return `<el-dialog id="login-dialog" ${this.setProps({
      registerDialogActions: (actions) => {
        this.loginDialogActions = actions;
      },
      content: '<el-login></el-login>',
      dismissible: false,
    })}></el-dialog>`;
  }

  render() {
    // this component is a work in progress
    const onboardingMarkup = `<el-onboarding ${this.setProps({
      moveSpotlight: (x, y, size) => this.onboardingDialogActions.moveSpotlight(x, y, size),
      moveModalTop: (y) => this.onboardingDialogActions.moveModalTop(y),
    })}></el-onboarding>`;

    this.innerHTML = `
            <el-nav-bar></el-nav-bar>
            ${this.accounts.enabled ? '<el-sync-notice></el-sync-notice>' : ''}
            <div id="stack-container"></div>
            <el-validation-panel></el-validation-panel>
            <el-dialog id="dialog" ${this.setProps({
              registerDialogActions: (actions) => {
                this.onboardingDialogActions = actions;
              },
              content: onboardingMarkup,
              closeLabel: t('dialog.skip'),
              onRequestClose: () => this.store.dispatch({ type: DISMISS_ONBOARDING }),
            })}></el-dialog>
            <el-dialog id="date-dialog" ${this.setProps({
              registerDialogActions: (actions) => {
                this.dateDialogActions = actions;
              },
              content: '<el-date-picker></el-date-picker>',
              onRequestClose: () => this.store.dispatch({ type: HIDE_PANEL }),
            })}></el-dialog>
            <el-dialog id="shortcuts-dialog" ${this.setProps({
              registerDialogActions: (actions) => {
                this.shortcutsDialogActions = actions;
              },
              content: '<el-keyboard-help></el-keyboard-help>',
              onRequestClose: () => this.store.dispatch({ type: HIDE_PANEL }),
            })}></el-dialog>
            ${this.renderLoginDialog()}
            <el-dialog id="reset-dialog" ${this.setProps({
              registerDialogActions: (actions) => {
                this.resetDialogActions = actions;
              },
              content: `<p>${t('resetDialog.message')}</p>
                <button type="button" data-confirm-reset>${t('resetDialog.confirm')}</button>`,
              closeLabel: t('dialog.cancel'),
              onRequestClose: () => this.store.dispatch({ type: HIDE_PANEL }),
            })}></el-dialog>
            `;
    this.querySelector('#reset-dialog').addEventListener('click', (event) => {
      if (event.target.closest('[data-confirm-reset]')) {
        this.clearCurrentDiary();
      }
    });
    this.stackContainer = this.querySelector('#stack-container');
  }
}

customElements.define('el-dynamic-timeline', DynamicTimelineUI);
