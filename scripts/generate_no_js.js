import fs from 'fs'
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory

const filePath = path.join(__dirname, '../config/activities.json');


fs.readFile(filePath, 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading file:', err);
    return;
  }
  processJson(data);
});

function processJson(jsonData) {
    const activities = JSON.parse(jsonData);
    activities.timeline.forEach(
        (timeline) => {
            console.log(timeline.name)
        }
    )
}

//console.log('<span>'+filePath+'</span>');