import fs from 'fs'
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

const filePath = path.join(__dirname, '../config/activities.json');
const minutesPerDay = 1440;
const rows = minutesPerDay / 10;
const minutesChunkSize = 180;
const rowsChunkSize = minutesChunkSize / 10; 
const numChunks = rows / rowsChunkSize;

const timeSlots = [...Array(rows).keys()].map((startMinutes)=>{
    const rowStartTime = 0
    return `${rowStartTime}am + ${startMinutes * 10}`   
})

fs.readFile(filePath, 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading file:', err);
    return;
  }
  processJsonToHTML(data);
});

function createColsHTML(timeSlot) {
    return `
    <td>${timeSlot}</td>
    <td><select><option>main activity </option></select></td>
    <td><select><option>secondary activity </option></select></td>
      <td><select><option>location </option></select></td>
    <td><select><option>other people</option></select></td>
      <td><input type="checkbox"/></td>
    <td><select><option>how much did you enjoy</option></select></td>
    `
}

function createRowHTML(timeSlot) {
    const row = `<tr>${createColsHTML(timeSlot)}</tr>`;
    return row;
}

function createTableHTML(activities, timeSlots) {

    const tableHTML = `
        <table border="1" cellpadding="10">
            <th>
            ${activities.timeline.map((activity)=> activity.name.trim() ? '<td>'+activity.name+'</td>' : '').join(" ")}
            </th>
            ${timeSlots.map(createRowHTML).join(' ')}
        </table>`;

    return tableHTML;
}

function processJsonToHTML(jsonData) {
    const activities = JSON.parse(jsonData);
    let html = '';
    for(let i=0; i<numChunks; i++) {
        // break the table into chunks of 18 (3 hours = 3 * (60 / 10)) 
        const chunkTimeSlots = timeSlots.slice(i * rowsChunkSize, ((i+1) * rowsChunkSize) -1 );
        html += `<br />${createTableHTML(activities, chunkTimeSlots)}`;
    }

    console.log(html);

}

//console.log('<span>'+filePath+'</span>');