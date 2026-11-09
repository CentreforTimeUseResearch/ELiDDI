import { formatOffsetAsClockTime } from '../../utils/time';
import { SVGNS, MIN_ENTRY_DURATION_MINS } from './timelineConstants';

const NO_ROOM_FLASH_MS = 600;

// The provisional block shown while an Entry is being created: from the
// first press of a drag until the details panel closes (saved or cancelled).
// It is drawn in its own layer above everything else, ignores the pointer,
// and shows its own start-end times as text, with "limit" when a limit (a
// neighbour, the day edge, "now") cut it short, so that is never signalled
// by colour alone. See docs/design/flows/create-entry.md.
//
// `container` is the SVG element it is appended to: the one holding the Entries
// layer, so it shares that layer's offset. `crossBox` is where the block sits across the time axis ({ start, size } in
// SVG units): the same box an Entry block uses in that layout.
export class CreatePreview {
  layer;
  noRoomTimer;

  constructor({ container, axis, getPxPerMinute, crossBox }) {
    this.container = container;
    this.axis = axis;
    this.getPxPerMinute = getPxPerMinute;
    this.crossBox = crossBox;
  }

  get isShowing() {
    return Boolean(this.layer?.firstChild);
  }

  show({ startOffsetMins, endOffsetMins, atLimit }) {
    this.render({
      startOffsetMins,
      endOffsetMins,
      atLimit,
      label: this.timeRange(startOffsetMins, endOffsetMins, atLimit),
    });
  }

  // "there is no free time here": a one-slot block that vanishes by itself
  flashNoRoom(slotMins) {
    this.render({
      startOffsetMins: slotMins,
      endOffsetMins: slotMins + MIN_ENTRY_DURATION_MINS,
      atLimit: true,
      label: 'No room here',
    });
    clearTimeout(this.noRoomTimer);
    this.noRoomTimer = setTimeout(() => this.hide(), NO_ROOM_FLASH_MS);
  }

  hide() {
    clearTimeout(this.noRoomTimer);
    this.layer?.replaceChildren();
  }

  timeRange(startOffsetMins, endOffsetMins, atLimit) {
    const range = `${formatOffsetAsClockTime(startOffsetMins)}–${formatOffsetAsClockTime(endOffsetMins)}`;
    return atLimit ? `${range} · limit` : range;
  }

  render({ startOffsetMins, endOffsetMins, atLimit, label }) {
    const layer = this.ensureLayer();
    clearTimeout(this.noRoomTimer);
    layer.replaceChildren();
    const { axis, crossBox } = this;
    const pxPerMinute = this.getPxPerMinute();
    const position = startOffsetMins * pxPerMinute;
    const size = (endOffsetMins - startOffsetMins) * pxPerMinute;
    const crossSizeAttr = axis.sizeAttr === 'height' ? 'width' : 'height';

    const rect = document.createElementNS(SVGNS, 'rect');
    rect.setAttribute('class', `create-preview${atLimit ? ' create-preview--at-limit' : ''}`);
    rect.setAttributeNS(null, axis.positionAttr, position);
    rect.setAttributeNS(null, axis.sizeAttr, size);
    rect.setAttributeNS(null, axis.crossAttr, crossBox.start);
    rect.setAttributeNS(null, crossSizeAttr, crossBox.size);
    layer.appendChild(rect);

    const text = document.createElementNS(SVGNS, 'text');
    text.setAttribute('class', 'create-preview-readout');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttributeNS(null, axis.positionAttr, position + size / 2);
    text.setAttributeNS(null, axis.crossAttr, crossBox.start + crossBox.size / 2);
    text.textContent = label;
    layer.appendChild(text);
  }

  // created on first use and appended last, so it renders above the Entries
  // and the resize handles
  ensureLayer() {
    if (this.layer?.parentNode !== this.container) {
      // reuse the layer a previous connection of this Timeline left behind
      this.layer = this.container.querySelector(':scope > [data-part="create-preview"]');
    }
    if (!this.layer) {
      this.layer = document.createElementNS(SVGNS, 'g');
      this.layer.setAttribute('data-part', 'create-preview');
      this.layer.setAttribute('pointer-events', 'none');
      this.layer.setAttribute('aria-hidden', 'true');
      this.container.appendChild(this.layer);
    }
    return this.layer;
  }
}
