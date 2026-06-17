import fs from 'fs'
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
const numChunks = rows / rowsChunkSize;  // we split the day into 8 * 3 hour 'chunks'

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
})

fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading file:', err);
        return;
    }
    processJsonToHTML(data);
});

function generateCardNav(chunk, cardNum) {
    let navstring =  `<nav aria-label="navigate this page">`

    if(chunk > 1 || cardNum > 6) {
        // calculate chunk and cardnum to jump
        let target;


        if(cardNum > 6) {
            // the simple case - not crossing a chunk boundary
            target = `${chunk}_${cardNum - 6}`
        } else {
            // the difficult case - crossing a chunk boundary
            target = `${chunk - 1}_${rowsChunkSize - (6 - cardNum)}`
        }

        


        navstring += `<a href="#${target}">Skip backwards one hour</a> | `;
    }

    if(chunk > 1 || cardNum > 1) {
        // calculate chunk and cardnum to jump 
        let target = `${chunk}_${cardNum - 1}`

        if(chunk > 1 && cardNum == 1) {
            // the simple case - not crossing a chunk boundary
             target = `${chunk - 1}_${rowsChunkSize - (1 - cardNum)}`
        }


        navstring += `<a href="#${target}">Skip backwards ten minutes</a> | `;
    }

    if(chunk < numChunks && cardNum < rowsChunkSize)
    {
         // calculate chunk and cardnum to jump 
        navstring += `<a href="#">Skip forward ten minutes</a> | `
    }

    if(chunk < numChunks && cardNum < rowsChunkSize)
    {
        // calculate chunk and cardnum to jump
        navstring += `<a href="#">Skip forward one hour</a>`; 
    }
    
    navstring += `</nav>`;




    return navstring;
}

function createCardHTML(timeSlot, cardNum, chunk) {
    return `
        <li id=${chunk}_${cardNum}>
        <hr /> ${chunk} --- ${cardNum}
            <ul>
                <li class="gridCell"><h3>${timeSlot}</h3></li>
               
                <li class="gridCell">
                    <span class="header">What were you doing? Please write down one main activity</span>
                    <input type="text" id="main-activity" name="main-activity" list="main-activity-list">
                </li>

                <li class="gridCell">
                    <span class="gridCell header">If you did something else at the same time, what else did you do? </span>
                    <input type="text" id="secondary-activity" name="secondary-activity" list="main-activity-list">
                </li>

                <li class="gridCell">
                    <span class="gridCell header">Did you use a smartphone tablet, or computer?</span>
                    <input type="checkbox" />
                </li>


                <li class="gridCell">
                    <span class="gridCell header">Where were you? Location, or mode of transport</span>
                    <input type="text" id="location" name="location" list="locations-list">
                </li>

                <li class="gridCell">
                    <span class="gridCell header">Were you alone of with somebody you know? <small>Mark all relevant boxes</small> </span>
                    <ul>
                        <li><span>Alone</span><input type="checkbox" /></li>
                        <li><span>Spouse/partner</span><input type="checkbox" /></li>
                        <li><span>Mother</span><input type="checkbox" /></li>
                        <li><span>Father</span><input type="checkbox" /></li>
                        <li><span>Child aged 0-7</span><input type="checkbox" /></li>
                        <li><span>Other Person</span><input type="checkbox" /></li>
                        <li><span>Others you know</span><input type="checkbox" /></li>
                    </ul>
                </li>

                

                <li class="gridCell">
                    <span class="gridCell header">How much did you enjoy this time? 1 = not at all 7 = very much</span>
                     <select>
                        <option>&nbsp;7</option>
                        <option>&nbsp;6</option>
                        <option>&nbsp;5</option>
                        <option>&nbsp;4</option>
                        <option>&nbsp;3</option>
                        <option>&nbsp;2</option>
                        <option>&nbsp;1</option>
                    </select>
                </li>

                <li class="gridCell">
                    <span class="gridCell header">Continue this activity until next entry (if checked you can leave the inbetween entries blank)</span>
                     <input type="checkbox" />
                </li>


               
            </ul>
             ${generateCardNav(chunk, cardNum)}
        </li>
        `;
}

function generateChunkNav(chunk) {
    return `
     <nav aria-label="navigate this page">
        ${ chunk > 1 ? `<a href="#chunk_${chunk-1}">Skip backwards three hours</a>` : ``}
        ${ chunk < numChunks ? `<a href="#chunk_${chunk+1}">Skip forward three hours</a>` : ``}
    </nav>
    `;
}

function createCardsHTML(activities, timeSlots, index) {
    const chunk = index + 1;
// ${activities.timeline.map((activity) => activity.name.trim() ? '<td>' + activity.name + '</td>' : '').join(" ")}
    const cardsHTML = `
        <hr />${chunk} of ${numChunks}<hr />
        <h2 id="chunk_${chunk}">${timeSlots[0].split("-")[0]} - ${timeSlots[(timeSlots.length-1)].split("-").slice(-1)}</h2>
        ${generateChunkNav(chunk)}
        ${timeSlots.map((timeSlot, i)=>createCardHTML(timeSlot, i + 1, chunk)).join(' ')}
        `;
    return cardsHTML;
}

function processJsonToHTML(jsonData) {
    const activities = JSON.parse(jsonData);
    let html = '<h1>Time use diary</h1>';
    for (let i = 0; i < numChunks; i++) {
        // break the table into chunks of 18 (3 hours = 3 * (60 / 10)) 
        const chunkTimeSlots = timeSlots.slice(
            i * rowsChunkSize, 
            ((i + 1) * rowsChunkSize)
        );

        html += `<br />${createCardsHTML(activities, chunkTimeSlots, i)}`;
    }

    console.log(html);
    console.log('<hr />')
    console.log('<pre>')
    console.log('hello')
    console.log(environment)
    console.log('</pre>')
}

//console.log('<span>'+filePath+'</span>');