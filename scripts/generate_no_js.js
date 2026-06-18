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

function createCardHTML(timeSlot, cardNum, chunk) {
  return `
        <li id="${chunk}_${cardNum}">
        
            <ul>
                <li class="gridCell"><h3>${timeSlot}</h3></li>
               
                <li class="gridCell">
                    <label for="${chunk}_${cardNum}-main-activity" class="header">What were you doing? Please write down one main activity</label>
                    <input type="text" id="${chunk}_${cardNum}-main-activity" name="${chunk}_${cardNum}-main-activity" list="main-activity-list">
                </li>

                <li class="gridCell">
                    <label for="${chunk}_${cardNum}-secondary-activity" class="gridCell header">If you did something else at the same time, what else did you do? </label>
                    <input type="text" id="${chunk}_${cardNum}-secondary-activity" name="${chunk}_${cardNum}-secondary-activity" list="main-activity-list">
                </li>

                <li class="gridCell">
                    <label for="${chunk}_${cardNum}-deviceUsed" class="gridCell header">Did you use a smartphone tablet, or computer?</label>
                    <input type="checkbox" id="${chunk}_${cardNum}-deviceUsed" name="${chunk}_${cardNum}-deviceUsed" />
                </li>


                <li class="gridCell">
                    <label for="${chunk}_${cardNum}-location" class="gridCell header">Where were you? Location, or mode of transport</label>
                    <input type="text" id="${chunk}_${cardNum}-location" name="${chunk}_${cardNum}-location" list="locations-list">
                </li>

                <li class="gridCell">
                    
                    <fieldset>
                    <legend>Were you alone or with somebody you know? <small>Mark all relevant boxes</small></legend>
                        <label><input type="checkbox" id="${chunk}_${cardNum}-alone" name="${chunk}_${cardNum}-alone"/>Alone</label>
                        <label><input type="checkbox" id="${chunk}_${cardNum}-spouse_partner" name="${chunk}_${cardNum}-spouse_partner"/>Spouse/partner</label>
                        <label><input type="checkbox" id="${chunk}_${cardNum}-mother" name="${chunk}_${cardNum}-mother"/>Mother</label>
                        <label><input type="checkbox" id="${chunk}_${cardNum}-father" name="${chunk}_${cardNum}-father"/>Father</label>
                        <label><input type="checkbox" id="${chunk}_${cardNum}-child_0_7" name="${chunk}_${cardNum}-child_0_7"/>Child aged 0-7</label>
                        <label><input type="checkbox" id="${chunk}_${cardNum}-other_in_household" name="${chunk}_${cardNum}-other_in_household"/>Other Person</label>
                        <label><input type="checkbox" id="${chunk}_${cardNum}-other_outside_household" name="${chunk}_${cardNum}-other_outside_household"/>Others you know</label>
                    </fieldset>
                    
                </li>

                

                <li class="gridCell">
                    <label for="${chunk}_${cardNum}-enjoyed" class="gridCell header">How much did you enjoy this time? 1 = not at all 7 = very much</label>
                     <select id="${chunk}_${cardNum}-enjoyed" name="${chunk}_${cardNum}-enjoyed">
                        <option>1</option>
                        <option>2</option>
                        <option>3</option>
                        <option>4</option>
                        <option>5</option>
                        <option>6</option>
                        <option>7</option>
                    </select>
                </li>

                <li class="gridCell">
                    <label for="${chunk}_${cardNum}-activity_continued_until_next_entry" class="gridCell header">Continue this activity until next entry (if checked you can leave the between entries blank)</label>
                     <input type="checkbox" id="${chunk}_${cardNum}-activity_continued_until_next_entry" name="${chunk}_${cardNum}-activity_continued_until_next_entry"/>
                </li>


               
            </ul>
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

function createCardsHTML(activities, timeSlots, index) {
  const chunk = index + 1;
  // ${activities.timeline.map((activity) => activity.name.trim() ? '<td>' + activity.name + '</td>' : '').join(" ")}
  const cardsHTML = `
        <label>Diary progress:<progress value="${chunk}" max="${numChunks}">${chunk} of ${numChunks}</progress></label>
        <h2 id="chunk_${chunk}">${timeSlots[0].split('-')[0]} - ${timeSlots[timeSlots.length - 1].split('-').slice(-1)}</h2>
        ${generateChunkNav(chunk)}
        <ol>
        ${timeSlots.map((timeSlot, i) => createCardHTML(timeSlot, i + 1, chunk)).join(' ')}
        </ol>
        `;
  return cardsHTML;
}

function generateFooter() {
  return `
        <footer><input type="submit" value="Diary Complete" /></footer>
    `;
}

function processJsonToHTML(jsonData) {
  const activities = JSON.parse(jsonData);
  let html = '<header><h1>Time use diary</h1></header>';
  html += '<form method="post" action="/">';
  for (let i = 0; i < numChunks; i++) {
    // break the table into chunks of 18 (3 hours = 3 * (60 / 10))
    const chunkTimeSlots = timeSlots.slice(i * rowsChunkSize, (i + 1) * rowsChunkSize);

    html += `${createCardsHTML(activities, chunkTimeSlots, i)}`;
  }
  html += generateFooter();

  html += '</form>';

  console.log(html);
  // console.log('<hr />')
  // console.log('<pre>')
  // console.log('hello')
  // console.log(environment)
  // console.log('</pre>')
}

//console.log('<span>'+filePath+'</span>');
