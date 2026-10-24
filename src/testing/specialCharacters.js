// Test fixtures for #146: config text containing the characters HTML gives
// meaning to. None of it is adversarial - an apostrophe, an ampersand, a
// quote for inches are ordinary in activity labels a researcher writes, and
// any config can be injected at deploy time.

export const SPECIAL_NAMES = [
  `Children's "quiet" time`,
  'R&R <rest>',
  '5" screen',
  `Tom & Jerry's`,
];

// a Dimension config whose every displayed string contains special characters
export const SPECIAL_DIMENSION = {
  name: `Who's "with" you <now> & then`,
  description: `Who were you with? (it's "optional")`,
  instruction: `Pick <one> & move on`,
  mode: 'single-choice',
  categories: [
    {
      name: `Family & "friends"`,
      activities: SPECIAL_NAMES.map((name, index) => ({
        name,
        color: `#00000${index}`,
      })),
    },
  ],
};

// appends SPECIAL_DIMENSION to the shared test config for one test;
// returns its index and a function that removes it again
export function addSpecialDimension() {
  const index = GLOBALS.DATA.timeline.push(SPECIAL_DIMENSION) - 1;
  return { index, remove: () => GLOBALS.DATA.timeline.splice(index, 1) };
}
