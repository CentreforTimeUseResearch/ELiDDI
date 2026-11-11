import { TinyBase } from '../base';
import { t } from '../../i18n/i18n';
import './keyboardHelp.css';

// The keyboard shortcuts, for the nav bar's "Keyboard shortcuts" dialog. This
// is the app's own help, not the study's: it is the same for every study (the
// Instructions are the study's onboarding tour, written in its config), so it
// lives here rather than in a config. Its words are catalogue keys (ADR 0008).
//
// Keep in step with what the Timelines do: TimelineKeyboard (arrows, Home/End,
// PageUp/PageDown, Enter, Space, grab mode) and the shortcut keys it hands to
// BaseTimeline.onShortcut.
//
// Each row is [alternatives, what it does]: the alternatives are different ways
// of doing it ("or"), each a chord of keys pressed together ("+"). A key is
// either a NAMED key (labelled as keyboards label them, so translated:
// keyboardHelp.key.<name>) or a literal character that is the shortcut itself
// ("[", ",", "t") and is shown as it is.
const NAMED_KEYS = new Set([
  'up',
  'down',
  'home',
  'end',
  'pageUp',
  'pageDown',
  'enter',
  'escape',
  'space',
  'arrowKeys',
  'shift',
  'alt',
]);

const GROUPS = [
  {
    key: 'moving',
    rows: [
      [[['up'], ['down']], 'upDown'],
      [[['home'], ['end']], 'homeEnd'],
      [[['pageUp'], ['pageDown']], 'pageUpDown'],
      [[['enter']], 'enter'],
      [[['escape']], 'escape'],
    ],
  },
  {
    key: 'grab',
    rows: [
      [[['space']], 'space'],
      [[['arrowKeys']], 'arrows'],
      [[['shift', 'arrowKeys']], 'shiftArrows'],
      [[['alt', 'shift', 'arrowKeys']], 'altShiftArrows'],
      [[['pageUp'], ['pageDown']], 'pageUpDown'],
      [[['home'], ['end']], 'homeEnd'],
      [[['enter'], ['space']], 'confirm'],
      [[['escape']], 'cancel'],
    ],
  },
  {
    key: 'switching',
    rows: [
      [[['[']], 'previousDimension'],
      [[[']']], 'nextDimension'],
      [[[',']], 'previousDay'],
      [[['.']], 'nextDay'],
      [[['t']], 'today'],
    ],
  },
];

const keyLabel = (key) => (NAMED_KEYS.has(key) ? t(`keyboardHelp.key.${key}`) : key);
const chord = (keys) => keys.map((key) => `<kbd>${keyLabel(key)}</kbd>`).join(' + ');

export class KeyboardHelp extends TinyBase {
  render() {
    // it scrolls, and a scrollable area with nothing focusable in it cannot be
    // scrolled from the keyboard in every browser: so it can take focus
    this.setAttribute('tabindex', '0');
    this.setAttribute('role', 'region');
    this.setAttribute('aria-label', t('keyboardHelp.title'));
    this.innerHTML = `
      <h2>${t('keyboardHelp.title')}</h2>
      <p>${t('keyboardHelp.intro')}</p>
      ${GROUPS.map(
        ({ key, rows }) => `
        <section>
          <h3>${t(`keyboardHelp.${key}.heading`)}</h3>
          <p>${t(`keyboardHelp.${key}.intro`)}</p>
          <dl>
            ${rows
              .map(
                ([alternatives, what]) =>
                  `<dt>${alternatives.map(chord).join(t('keyboardHelp.or'))}</dt><dd>${t(`keyboardHelp.${key}.${what}`)}</dd>`
              )
              .join('')}
          </dl>
        </section>`
      ).join('')}
    `;
  }
}

customElements.define('el-keyboard-help', KeyboardHelp);
