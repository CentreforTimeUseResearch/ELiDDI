import { SVGNS } from './timelineConstants';

// The ring drawn around whatever has keyboard focus on a Timeline: an Entry or
// an empty slot. It lives in its own layer appended last, above every Entry,
// so a neighbouring block can never draw over it (an outline on the focused
// element itself can be hidden by a later sibling). A white band under the blue
// one keeps it visible on any block colour (at least 3:1 against both).
//
// `container` is the SVG element it is appended to - the one holding the
// Entries layer, so it shares that layer's offset. `crossBox` is where a
// block sits across the time axis ({ start, size } in SVG units).
export class FocusRing {
  layer;

  constructor({ container, axis, getPxPerMinute, crossBox }) {
    this.container = container;
    this.axis = axis;
    this.getPxPerMinute = getPxPerMinute;
    this.crossBox = crossBox;
  }

  get isShowing() {
    return Boolean(this.layer?.firstChild);
  }

  // `stop` is anything with startOffsetMins and endOffsetMins
  show({ startOffsetMins, endOffsetMins }) {
    const layer = this.ensureLayer();
    layer.replaceChildren();
    const { axis, crossBox } = this;
    const pxPerMinute = this.getPxPerMinute();
    const crossSizeAttr = axis.sizeAttr === 'height' ? 'width' : 'height';
    for (const className of ['focus-ring-halo', 'focus-ring-line']) {
      const rect = document.createElementNS(SVGNS, 'rect');
      rect.setAttribute('class', className);
      rect.setAttributeNS(null, axis.positionAttr, startOffsetMins * pxPerMinute);
      rect.setAttributeNS(null, axis.sizeAttr, (endOffsetMins - startOffsetMins) * pxPerMinute);
      rect.setAttributeNS(null, axis.crossAttr, crossBox.start);
      rect.setAttributeNS(null, crossSizeAttr, crossBox.size);
      layer.appendChild(rect);
    }
  }

  hide() {
    this.layer?.replaceChildren();
  }

  ensureLayer() {
    if (this.layer?.parentNode !== this.container) {
      // reuse the layer a previous connection of this Timeline left behind
      this.layer = this.container.querySelector(':scope > [data-part="focus-ring"]');
    }
    if (!this.layer) {
      this.layer = document.createElementNS(SVGNS, 'g');
      this.layer.setAttribute('data-part', 'focus-ring');
      this.layer.setAttribute('pointer-events', 'none');
      this.layer.setAttribute('aria-hidden', 'true');
      this.container.appendChild(this.layer);
    }
    return this.layer;
  }
}
