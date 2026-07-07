import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const environment = process.env.ACTIONS_ENV;
const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

const filePath = path.join(__dirname, '../config/activities.json');
const startTimeHour = 4;
const minutesPerDay = 1440;
const rows = minutesPerDay / 10;
const minutesChunkSize = 180;
const rowsChunkSize = minutesChunkSize / 10;
const numChunks = rows / rowsChunkSize; // we split the day into 8 * 3 hour 'chunks'

/**
 * create the variable timeSlots which is an string array with the cardinality determined by the value of rows
 * the strings form a sequence of time values of the format HH:mm starting with the hour value determined by startTimeHour
 * and increasing 10 minutes with each item
 */
const timeSlots = [...Array(rows).keys()].map((startMinutes) => {
  const totalMinutes = startTimeHour * 60 + startMinutes * 10;
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} - ${String(hours).padStart(2, '0')}:${String(minutes + 9).padStart(2, '0')}`;
});

if (!environment) {
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading file:', err);
      return;
    }
    processJsonToHTML(data);
  });
} else {
  processJsonToHTML(environment);
}

/**
 * to do: swap out magic numbers
 */
function generateCardNav(chunk, cardNum, timeSlot) {
  let navstring = `<nav aria-label="${timeSlot} time slot navigation">`;

  if (chunk > 1 || cardNum > 6) {
    // calculate chunk and cardnum to jump
    let target;

    if (cardNum > 6) {
      // the simple case - not crossing a chunk boundary
      target = `${chunk}_${cardNum - 6}`;
    } else {
      // the difficult case - crossing a chunk boundary
      target = `${chunk - 1}_${rowsChunkSize - (6 - cardNum)}`;
    }

    navstring += `| <a href="#${target}">Skip backwards one hour</a> | `;
  }

  if (chunk > 1 || cardNum > 1) {
    // calculate chunk and cardnum to jump
    // the simple case - not crossing a chunk boundary
    let target = `${chunk}_${cardNum - 1}`;

    if (chunk > 1 && cardNum == 1) {
      // the difficult case - crossing a chunk boundary
      target = `${chunk - 1}_${rowsChunkSize - (1 - cardNum)}`;
    }

    navstring += `<a href="#${target}">Skip backwards ten minutes</a> | `;
  }

  if (chunk !== numChunks || cardNum !== rowsChunkSize) {
    // calculate chunk and cardnum to jump
    // the simple case - not crossing a chunk boundary
    let target = `${chunk}_${cardNum + 1}`;

    if (cardNum === rowsChunkSize) {
      // the difficult case - crossing a chunk boundary
      target = `${chunk + 1}_${1}`;
    }

    navstring += `<a href="#${target}">Skip forward ten minutes</a> | `;
  }

  if (chunk !== numChunks || cardNum < rowsChunkSize - 5) {
    // calculate chunk and cardnum to jump
    // the simple case - not crossing a chunk boundary
    let target = `${chunk}_${cardNum + 6}`;

    if (cardNum > rowsChunkSize - 6) {
      // the difficult case - crossing a chunk boundary
      const cardsLeftInSection = rowsChunkSize - 6;
      target = `${chunk + 1}_${cardNum - cardsLeftInSection}`;
    }

    navstring += `<a href="#${target}">Skip forward one hour</a> |`;
  }

  navstring += `</nav>`;

  return navstring;
}

function createCardHTML(data, timeSlot, cardNum, chunk) {

  const firstHeader = cardNum === 1 ? 'firstHeader' : '';

  const dataListIds = data.map((timelineObject) => timelineObject.timeline.replace(' ', '-').toLowerCase())

  // we can't make these any more generic as the data doesn't indicate what type of form UI (eg select, radio) to use.
  return `
        <li id="${chunk}_${cardNum}" class="card-tenMinutes gridRow ${firstHeader}">
            <h3>${timeSlot}</h3>

            <!-- timeline 0 -->
            <div class="gridCell">
                <label for="${chunk}_${cardNum}-main-activity" class="header">What were you doing? Please write down one main activity</label>
                <span><input type="text" id="${chunk}_${cardNum}-main-activity" name="${chunk}_${cardNum}-main-activity" list="${dataListIds[0]}"></span>
            </div>
 
            <!-- timeline 1 -->
            <div class="gridCell">
                <label for="${chunk}_${cardNum}-secondary-activity" class="header">If you did something else at the same time, what else did you do? </label>
                <span><input type="text" id="${chunk}_${cardNum}-secondary-activity" name="${chunk}_${cardNum}-secondary-activity" list="${dataListIds[1]}"></span>
            </div>

            <!-- timeline 4 -->
            <div class="gridCell">
                <label for="${chunk}_${cardNum}-deviceUsed" class="header">Did you use a smartphone tablet, or computer?</label>
                <span><input type="checkbox" id="${chunk}_${cardNum}-deviceUsed" name="${chunk}_${cardNum}-deviceUsed" list=${dataListIds[4]}/></span>
            </div>

            <!-- timeline 2 -->
            <div class="gridCell">
                <label for="${chunk}_${cardNum}-location" class="header">Where were you? Location, or mode of transport</label>
                <span><input type="text" id="${chunk}_${cardNum}-location" name="${chunk}_${cardNum}-location" list="${dataListIds[2]}"></span>
            </div>

            <!-- timeline 3 -->
            <div class="gridCell">
                <fieldset>
                    <legend>Were you alone or with somebody you know? <small>Mark all relevant boxes</small></legend>
                    <label><input type="checkbox" id="${chunk}_${cardNum}-alone" name="${chunk}_${cardNum}-who"/>Alone</label><br />
  ${data[3].options.map(
    (option) => {
      const safeId = option.replace(/ |\//g, "_");
      return `<label><input type="checkbox" id="${chunk}_${cardNum}-${safeId}" name="${chunk}_${cardNum}-who"/>${option}</label><br />`
    }
  ).join("")}
               </fieldset>
            </div>

            <!-- timeline 7 -->
            <div class="gridCell">
                <label for="${chunk}_${cardNum}-enjoyed" class="header">How much did you enjoy this time? 1 = not at all 7 = very much</label>
                <span><select id="${chunk}_${cardNum}-enjoyed" name="${chunk}_${cardNum}-enjoyed">
                    <option>1</option>
                    <option>2</option>
                    <option>3</option>
                    <option>4</option>
                    <option>5</option>
                    <option>6</option>
                    <option>7</option>
                </select></span>
            </div>

            <div class="gridCell">
                <label for="${chunk}_${cardNum}-activity_continued_until_next_entry" class="header">Continue this activity until next entry (if checked you can leave the between entries blank)</label>
                <span><input type="checkbox" id="${chunk}_${cardNum}-activity_continued_until_next_entry" name="${chunk}_${cardNum}-activity_continued_until_next_entry"/></span>
            </div>

            ${generateCardNav(chunk, cardNum, timeSlot)}
        </li>
        `;
}

function generateChunkNav(chunk) {
  return `
     <nav aria-label="Jump to time chunk">
        ${chunk > 1 ? `| <a href="#chunk_${chunk - 1}">Skip backwards three hours</a>` : ``}
        ${chunk < numChunks ? `| <a href="#chunk_${chunk + 1}">Skip forward three hours</a>` : ``}
        |
    </nav>
    `;
}

function createCardsHTML(data, timeSlots, index) {
  const chunk = index + 1;

  let x = 1;

  const cardsHTML = `
        <label>Diary progress: ${chunk} of ${numChunks} <progress value="${chunk}" max="${numChunks}" /></label>
        <h2 id="chunk_${chunk}">${timeSlots[0].split('-')[0]} - ${timeSlots[timeSlots.length - 1].split('-').slice(-1)}</h2>
        ${generateChunkNav(chunk)}
        <ol class="card-threeHours">
        ${timeSlots.map((timeSlot, i) => createCardHTML(data, timeSlot, i + 1, chunk)).join(' ')}
        </ol>
        `;
  return cardsHTML;
}

function generateFooter() {
  return `
        <footer><input type="submit" value="Diary Complete" /></footer>
    `;
}

function createTimelinesWithFlattenedActivities(data) {
  // extract activity selection lists for timelines
  const timelines = data.timeline.reduce((acc, timeline) => { acc[timeline.name] = timeline.categories; return acc }, {})
  // we need to flatten activities 

  const timelinesWithFlattenedActivities = Object.keys(timelines).map(
    (timeline) => {
      const categoryObjectList = timelines[timeline];

      const categoriesWithFlattenedActivityList = categoryObjectList.reduce(
        (acc, categoryObject) => {
          const categoryName = categoryObject.name;
          const flattenedActivities = [];

          categoryObject.activities.forEach(activity => {
            if (activity.childItems && activity.childItems.length > 0) {
              activity.childItems.forEach((childItem) => {
                flattenedActivities.push(`${activity.name} - ${childItem.name}`);
              })
              return;
            }
            flattenedActivities.push(activity.name)
          });

          acc[categoryName] = flattenedActivities

          return acc;
        },
        {}
      )

      // now flatten this into one list per timeline


      const options = [];
      Object.keys(categoriesWithFlattenedActivityList).forEach(
        (categoryName) => {
          categoriesWithFlattenedActivityList[categoryName].forEach(
            (activity) => {
              if (categoryName.trim()) {
                options.push(`${categoryName} - ${activity}`)
              } else {
                options.push(activity);
              }
            }
          )
        }
      )

      return {
        timeline,
        options
      }
    }
  )

  return timelinesWithFlattenedActivities;
}


function generateDataLists(timelinesWithFlattenedActivities) {
  return timelinesWithFlattenedActivities.map(
    ({ timeline, options }) => {
      return generateDataList(timeline, options);
    }
  ).join("");

}

function generateDataList(timeline, options) {

  return `<datalist id="${timeline.replace(" ", "-").toLowerCase()}">${options.map((option) => {
    return `<option value="${option}"></option>`
  }).join("")
    }</datalist>`
}

// this function makes the values in the environment variable available to 
// the runtime browser javascript
function generateScriptBlockForEnvironmentVariables(jsonData) {
  return `<script>GLOBALS = {DATA: ${jsonData} }; </script>`;
}

function processJsonToHTML(jsonData) {
  const data = JSON.parse(jsonData);
  const timelinesWithFlattenedActivities = createTimelinesWithFlattenedActivities(data);



  let html = generateScriptBlockForEnvironmentVariables(jsonData);

  html += generateDataLists(timelinesWithFlattenedActivities);
  html += '<dynamic-timeline><header><h1>Time use diary</h1></header>';
  html += '<form method="post" action="/">';
  for (let i = 0; i < numChunks; i++) {
    // break the table into chunks of 18 (3 hours = 3 * (60 / 10))
    const chunkTimeSlots = timeSlots.slice(i * rowsChunkSize, (i + 1) * rowsChunkSize);

    html += `${createCardsHTML(timelinesWithFlattenedActivities, chunkTimeSlots, i)}`;
  }
  html += generateFooter();

  html += '</form></dynamic-timeline>';

  console.log(html);
  console.log('<hr />');
  console.log('<pre>');
  console.log(environment);
  console.log('</pre>');



}

//console.log('<span>'+filePath+'</span>');
