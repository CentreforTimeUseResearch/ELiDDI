import { getActivityColor } from '../../utils/activities';
import { SVGNS, XHTMLNS } from './timelineConstants';

const LABEL_FONT_SIZE = 14; // DESIGN.md caption token

// Draws one block per Entry into an SVG layer, replacing what was there.
// Shared by both layouts; only where a block sits differs, so the caller
// passes placeEntry(entry) -> { block, label }, each an { x, y, width,
// height } box in the SVG's user units.
//
// entry element looks like this:
// <g>
//   <rect x="100" y="120" width="220" height="60" fill="#9aa0c3" fill-opacity="0.45" data-id="1" />
//   <foreignObject x="110" y="120" width="200" height="60"><div class="event-label">Sleep</div></foreignObject>
// </g>
export function renderEntryBlocks(layer, entries, dimensionIndex, placeEntry) {
  layer.innerHTML = '';
  const dimensionData = GLOBALS.DATA.timeline[dimensionIndex];

  entries.forEach((entry) => {
    const { block, label } = placeEntry(entry);
    const entryGroup = document.createElementNS(SVGNS, 'g');

    const rect = document.createElementNS(SVGNS, 'rect');
    setBox(rect, block);
    rect.setAttributeNS(null, 'fill', getActivityColor(dimensionData, entry.activity));
    rect.setAttributeNS(null, 'fill-opacity', '0.45');
    rect.setAttributeNS(null, 'data-id', entry.id);
    entryGroup.appendChild(rect);

    const text = Array.isArray(entry.activity) ? entry.activity.join(', ') : entry.activity;
    entryGroup.appendChild(createLabelForeignObject(label, text, entry.id));

    layer.appendChild(entryGroup);
  });
}

// a block's length along the time axis, with a visible minimum for a
// zero-length (or inverted) Entry
export function visibleLength(lengthPx) {
  return lengthPx > 0 ? lengthPx : 20;
}

function setBox(element, { x, y, width, height }) {
  element.setAttributeNS(null, 'x', x);
  element.setAttributeNS(null, 'y', y);
  element.setAttributeNS(null, 'width', width);
  element.setAttributeNS(null, 'height', height);
}

// a <foreignObject> holding an HTML div, so a long label wraps across lines
// (via CSS) instead of being truncated as SVG <text> would be; the div's
// title gives a native tooltip with the full text
function createLabelForeignObject(box, text, id) {
  const foreignObject = document.createElementNS(SVGNS, 'foreignObject');
  setBox(foreignObject, box);

  const labelDiv = document.createElementNS(XHTMLNS, 'div');
  labelDiv.className = 'event-label';
  labelDiv.style.fontSize = `${LABEL_FONT_SIZE}px`;
  labelDiv.title = text;
  labelDiv.setAttribute('data-id', id);
  labelDiv.textContent = text;

  foreignObject.appendChild(labelDiv);
  return foreignObject;
}
