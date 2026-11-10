import { TinyBase } from '../base';
import './keyboardHelp.css';

// The keyboard shortcuts, for the nav bar's "Keyboard shortcuts" dialog. This
// is the app's own help, not the study's: it is the same for every study (the
// Instructions are the study's onboarding tour, written in its config), so it
// lives here rather than in a config. Static markup, nothing to escape.
//
// Keep in step with what the Timelines do: TimelineKeyboard (arrows, Home/End,
// PageUp/PageDown, Enter, Space, grab mode) and the shortcut keys it hands to
// BaseTimeline.onShortcut.
// Each row is [alternatives, what it does]: the alternatives are different ways
// of doing it ("or"), each a chord of keys pressed together ("+").
const GROUPS = [
  {
    heading: 'Moving around a timeline',
    intro:
      'Press Tab to reach a timeline, then use these keys. A timeline is one Tab stop; the arrow keys move inside it.',
    rows: [
      [
        [['Up'], ['Down']],
        'the previous or next entry or empty slot (Left and Right on the desktop rows)',
      ],
      [[['Home'], ['End']], 'the start or end of the day'],
      [[['Page Up'], ['Page Down']], 'an hour earlier or later'],
      [[['Enter']], 'open an entry, or start a new one at an empty slot, and move into the panel'],
      [[['Escape']], 'close the panel and come back to the timeline'],
    ],
  },
  {
    heading: 'Moving or resizing an entry',
    intro:
      'Press Space on an entry to pick it up. Nothing changes until you confirm, and what is happening is written in the bar at the bottom of the window.',
    rows: [
      [[['Space']], 'pick up the focused entry'],
      [[['Arrow keys']], 'move it 10 minutes (along the time axis)'],
      [[['Shift', 'Arrow keys']], 'move its end'],
      [[['Alt', 'Shift', 'Arrow keys']], 'move its start'],
      [[['Page Up'], ['Page Down']], 'an hour at a time instead of 10 minutes'],
      [[['Home'], ['End']], 'as far as it will go'],
      [[['Enter'], ['Space']], 'confirm'],
      [[['Escape']], 'cancel and put everything back'],
    ],
  },
  {
    heading: 'Switching Dimension and day',
    intro: 'These work while a timeline has focus, and not in text fields or the panel.',
    rows: [
      [[['[']], 'previous Dimension'],
      [[[']']], 'next Dimension'],
      [[[',']], 'previous day'],
      [[['.']], 'next day (never a day that has not happened)'],
      [[['t']], 'today'],
    ],
  },
];

const chord = (keys) => keys.map((key) => `<kbd>${key}</kbd>`).join(' + ');

export class KeyboardHelp extends TinyBase {
  render() {
    // it scrolls, and a scrollable area with nothing focusable in it cannot be
    // scrolled from the keyboard in every browser: so it can take focus
    this.setAttribute('tabindex', '0');
    this.setAttribute('role', 'region');
    this.setAttribute('aria-label', 'Keyboard shortcuts');
    this.innerHTML = `
      <h2>Keyboard shortcuts</h2>
      <p>These work while a timeline has keyboard focus (press Tab to reach one).</p>
      ${GROUPS.map(
        ({ heading, intro, rows }) => `
        <section>
          <h3>${heading}</h3>
          <p>${intro}</p>
          <dl>
            ${rows
              .map(
                ([alternatives, what]) =>
                  `<dt>${alternatives.map(chord).join(' or ')}</dt><dd>${what}</dd>`
              )
              .join('')}
          </dl>
        </section>`
      ).join('')}
    `;
  }
}

customElements.define('el-keyboard-help', KeyboardHelp);
