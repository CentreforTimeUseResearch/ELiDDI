import { MINUTES_PER_DAY, SVGNS } from '../timeline/timelineConstants';

export const GRID_STEP_MINS = 10; // matches the vertical Timeline's own grid-lines resolution

// same three line styles as the vertical Timeline's grid (index.html's
// svg-timeline): hour, half hour (dashed), and every other 10 minutes
const HOUR_COLOR = '#8f97a3';
const MINOR_COLOR = '#d8dbe0';

// Fills `group` with a vertical line every GRID_STEP_MINS across the day, at
// the given scale, from y1 to y2. Shared by the axis (short ticks) and the
// rows (full height), so the two always draw the same grid.
export function renderGridLines(group, pxPerMinute, y1, y2) {
  group.innerHTML = '';
  for (let offset = 0; offset <= MINUTES_PER_DAY; offset += GRID_STEP_MINS) {
    const x = offset * pxPerMinute;
    const isHourMark = offset % 60 === 0;
    const isHalfHourMark = !isHourMark && offset % 30 === 0;

    const line = document.createElementNS(SVGNS, 'line');
    line.setAttributeNS(null, 'x1', x);
    line.setAttributeNS(null, 'x2', x);
    line.setAttributeNS(null, 'y1', y1);
    line.setAttributeNS(null, 'y2', y2);
    line.setAttributeNS(null, 'stroke', isHourMark ? HOUR_COLOR : MINOR_COLOR);
    line.setAttributeNS(null, 'stroke-width', '1');
    if (isHalfHourMark) {
      line.setAttributeNS(null, 'stroke-dasharray', '2,3');
    }
    group.appendChild(line);
  }
}
