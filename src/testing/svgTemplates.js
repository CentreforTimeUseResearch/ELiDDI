import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// The Timelines' real SVG <template>s, and the shared gradient definitions,
// copied from index.html into the test document - so component tests run
// against the markup the app ships, not hand-made copies that drift from it.
// vitest runs from the project root.
const INDEX_HTML = readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
const TEMPLATE_IDS = [
  'svg-timeline',
  'svg-horizontal-timeline-row',
  'svg-horizontal-timeline-axis',
];

// idempotent; installs into <head>, so a test clearing document.body keeps them
export function installSvgTemplates() {
  if (document.getElementById(TEMPLATE_IDS[0])) {
    return;
  }
  const source = new DOMParser().parseFromString(INDEX_HTML, 'text/html');
  TEMPLATE_IDS.forEach((id) => {
    document.head.appendChild(document.importNode(source.getElementById(id), true));
  });
  document.head.appendChild(document.importNode(source.querySelector('.shared-svg-defs'), true));
}
