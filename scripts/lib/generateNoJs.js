// Builds the no-JS diary: the plain HTML <form> that works without
// JavaScript (the progressive-enhancement baseline), plus the GLOBALS
// <script> block the JS layer reads its config from. Pure - no fs, no
// process.env, no console - so it can be tested directly. The CLI in
// ../generate_no_js.js reads the config and prints the result for Vite.
import { escapeHtml } from '../../src/utils/html.js';

const DAY_STARTS_AT_HOUR = 4;
const MINUTES_PER_SLOT = 10;
export const SLOTS_PER_DAY = (24 * 60) / MINUTES_PER_SLOT; // 144
export const SLOTS_PER_CHUNK = (3 * 60) / MINUTES_PER_SLOT; // 18 - the day is split into 3-hour chunks
export const NUM_CHUNKS = SLOTS_PER_DAY / SLOTS_PER_CHUNK; // 8
const SLOTS_PER_HOUR = 60 / MINUTES_PER_SLOT; // 6

// "HH:MM - HH:MM" for each 10-minute slot of the day, starting at 04:00
const timeSlots = Array.from({ length: SLOTS_PER_DAY }, (_, slotIndex) => {
  const totalMinutes = DAY_STARTS_AT_HOUR * 60 + slotIndex * MINUTES_PER_SLOT;
  const hours = String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0');
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, '0')} - ${hours}:${String(minutes + MINUTES_PER_SLOT - 1).padStart(2, '0')}`;
});

// A card's id is "{chunk}_{cardNum}" (both 1-based); its slot is its
// 1-based position in the whole day. Navigation is slot arithmetic.
const slotOf = (chunk, cardNum) => (chunk - 1) * SLOTS_PER_CHUNK + cardNum;
const cardIdOf = (slot) =>
  `${Math.ceil(slot / SLOTS_PER_CHUNK)}_${((slot - 1) % SLOTS_PER_CHUNK) + 1}`;
const isInDay = (slot) => slot >= 1 && slot <= SLOTS_PER_DAY;

// a Dimension's id fragment: its name, lower-cased, every space a hyphen
const dimensionId = (name) => name.replace(/ /g, '-').toLowerCase();

// links to the slots one hour and ten minutes either side, where they exist
export function generateCardNav(chunk, cardNum, timeSlot) {
  const slot = slotOf(chunk, cardNum);
  const href = (delta) => `#${cardIdOf(slot + delta)}`;
  let navstring = `<nav aria-label="${timeSlot} time slot navigation">`;

  if (isInDay(slot - SLOTS_PER_HOUR)) {
    navstring += `| <a href="${href(-SLOTS_PER_HOUR)}">Skip backwards one hour</a> | `;
  }
  if (isInDay(slot - 1)) {
    navstring += `<a href="${href(-1)}">Skip backwards ten minutes</a> | `;
  }
  if (isInDay(slot + 1)) {
    navstring += `<a href="${href(1)}">Skip forward ten minutes</a> | `;
  }
  if (isInDay(slot + SLOTS_PER_HOUR)) {
    navstring += `<a href="${href(SLOTS_PER_HOUR)}">Skip forward one hour</a> |`;
  }

  return `${navstring}</nav>`;
}

function generateTextFieldInput(chunk, cardNum, uniqueRef, questionText) {
  return `
  <div class="gridCell">
      <label for="${chunk}_${cardNum}-${escapeHtml(uniqueRef)}" class="header">${escapeHtml(questionText)}</label>
      <span><input type="text" id="${chunk}_${cardNum}-${escapeHtml(uniqueRef)}" name="${chunk}_${cardNum}-${escapeHtml(uniqueRef)}" list="${escapeHtml(uniqueRef)}"></span>
  </div>
  `;
}

function generateSingleCheckboxInput(chunk, cardNum, uniqueRef, questionText) {
  return `
  <div class="gridCell">
    <label for="${chunk}_${cardNum}-${escapeHtml(uniqueRef)}" class="header">${escapeHtml(questionText)}</label>
    <span><input type="checkbox" id="${chunk}_${cardNum}-${escapeHtml(uniqueRef)}" name="${chunk}_${cardNum}-${escapeHtml(uniqueRef)}" list="${escapeHtml(uniqueRef)}"/></span>
  </div>
  `;
}

function generateMultiCheckboxInput(chunk, cardNum, uniqueRef, options, questionText) {
  return `
              <div class="gridCell">
                <fieldset>
                    <legend>${escapeHtml(questionText)} <small>Mark all relevant boxes</small></legend>
                    <label><input type="checkbox" id="${chunk}_${cardNum}-alone" name="${chunk}_${cardNum}-${escapeHtml(uniqueRef)}"/>Alone</label><br />
  ${options
    .map((option) => {
      const safeId = option.replace(/ |\//g, '_');

      return `<label><input type="checkbox" id="${chunk}_${cardNum}-${escapeHtml(safeId)}" name="${chunk}_${cardNum}-${escapeHtml(uniqueRef)}"/>${escapeHtml(option)}</label><br />`;
    })
    .join('')}
               </fieldset>
            </div>
            `;
}

function generateSelectDropDown(chunk, cardNum, uniqueRef, options, questionText) {
  return `
            <div class="gridCell">
                <label for="${chunk}_${cardNum}-enjoyed" class="header">${escapeHtml(questionText)}</label>
                <span><select id="${chunk}_${cardNum}-enjoyed" name="${chunk}_${cardNum}-enjoyed">
                    ${options.map((option) => `<option>${escapeHtml(option)}</option>`).join('')}
                </select></span>
            </div>`;
}

function generateDimensionInput(chunk, cardNum, dimension) {
  const { uniqueRef, options, description } = dimension;
  if (dimension.mode === 'single-choice') {
    return dimension.allow_free_text
      ? generateTextFieldInput(chunk, cardNum, uniqueRef, description)
      : generateSelectDropDown(chunk, cardNum, uniqueRef, options, description);
  }
  if (dimension.mode === 'multiple-choice') {
    return generateMultiCheckboxInput(chunk, cardNum, uniqueRef, options, description);
  }
  return undefined;
}

// one ten-minute card; `dimensions` is createDimensionsWithFlattenedActivities' output
export function createCardHTML(dimensions, timeSlot, cardNum, chunk) {
  const firstHeader = cardNum === 1 ? 'firstHeader' : '';

  return `
  <li id="${chunk}_${cardNum}" class="card-tenMinutes gridRow ${firstHeader}">
    <h3>${timeSlot}</h3>


  ${dimensions.map((dimension) => generateDimensionInput(chunk, cardNum, dimension)).join('')}




  ${generateSingleCheckboxInput(chunk, cardNum, 'activity_continued_until_next_entry', 'Continue this activity until next entry (if checked you can leave the between entries blank)')}

  ${generateCardNav(chunk, cardNum, timeSlot)}
  </li>
  `;
}

function generateChunkNav(chunk) {
  return `
     <nav aria-label="Jump to time chunk">
        ${chunk > 1 ? `| <a href="#chunk_${chunk - 1}">Skip backwards three hours</a>` : ``}
        ${chunk < NUM_CHUNKS ? `| <a href="#chunk_${chunk + 1}">Skip forward three hours</a>` : ``}
        |
    </nav>
    `;
}

function createCardsHTML(dimensions, chunkTimeSlots, chunk) {
  return `
        <label>Diary progress: ${chunk} of ${NUM_CHUNKS} <progress value="${chunk}" max="${NUM_CHUNKS}" /></label>
        <h2 id="chunk_${chunk}">${chunkTimeSlots[0].split('-')[0]} - ${chunkTimeSlots[chunkTimeSlots.length - 1].split('-').slice(-1)}</h2>
        ${generateChunkNav(chunk)}
        <ol class="card-threeHours">
        ${chunkTimeSlots.map((timeSlot, i) => createCardHTML(dimensions, timeSlot, i + 1, chunk)).join(' ')}
        </ol>
        `;
}

function generateFooter() {
  return `
        <footer><input type="submit" value="Diary Complete" /></footer>
    `;
}

// every activity a respondent can pick in a Dimension, as one flat list of
// "Category - Activity" (or "Category - Activity - Child") strings
function flattenOptions(dimension) {
  return dimension.categories.flatMap((category) => {
    const activities = category.activities.flatMap((activity) =>
      activity.childItems?.length > 0
        ? activity.childItems.map((childItem) => `${activity.name} - ${childItem.name}`)
        : [activity.name]
    );
    return category.name.trim()
      ? activities.map((activity) => `${category.name} - ${activity}`)
      : activities;
  });
}

// the Dimension configs reduced to what the form needs - new objects, the
// input is left untouched
export function createDimensionsWithFlattenedActivities(dimensions) {
  return dimensions.map((dimension) => ({
    dimension: dimension.name,
    uniqueRef: dimensionId(dimension.name),
    mode: dimension.mode,
    description: dimension.description,
    allow_free_text: dimension.allow_free_text,
    options: flattenOptions(dimension),
  }));
}

export function generateDataLists(dimensions) {
  return dimensions
    .map(
      ({ uniqueRef, options }) =>
        `<datalist id="${escapeHtml(uniqueRef)}">${options
          .map((option) => `<option value="${escapeHtml(option)}"></option>`)
          .join('')}</datalist>`
    )
    .join('');
}

// makes the config available to the browser JS as GLOBALS.DATA. The JSON
// text is embedded as written; "<" can only occur inside a JSON string,
// where < means the same character - so a "</script>" or "<!--" in any
// config string can't end or break this block early
function generateGlobalsScript(configJson) {
  return `<script>GLOBALS = {DATA: ${configJson.replace(/</g, '\\u003c')} }; </script>`;
}

// configJson: the study config as JSON text (config/config.json, or the
// ACTIONS_ENV deploy input). Throws if it isn't valid JSON.
export function buildDiaryHtml(configJson) {
  const config = JSON.parse(configJson);
  let html = generateGlobalsScript(configJson);

  // absent or true = generate the no-JS fallback (progressive enhancement);
  // only an explicit false skips it, so configs predating this flag are unaffected
  if (config.general?.accessibility?.generateHtmlFallback === false) {
    // the JS layer only needs GLOBALS plus an empty mount point to render into
    return `${html}<el-dynamic-timeline></el-dynamic-timeline>`;
  }

  const dimensions = createDimensionsWithFlattenedActivities(config.timeline);
  html += generateDataLists(dimensions);
  html += '<el-dynamic-timeline><header><h1>Time use diary</h1></header>';
  html += '<form method="post" action="/">';
  for (let chunk = 1; chunk <= NUM_CHUNKS; chunk++) {
    const chunkTimeSlots = timeSlots.slice((chunk - 1) * SLOTS_PER_CHUNK, chunk * SLOTS_PER_CHUNK);
    html += createCardsHTML(dimensions, chunkTimeSlots, chunk);
  }
  html += generateFooter();
  html += '</form></el-dynamic-timeline>';
  return html;
}
