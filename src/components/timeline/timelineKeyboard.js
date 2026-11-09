import { formatOffsetAsClockTime } from '../../utils/time';
import { SVGNS } from './timelineConstants';
import { FocusRing } from './focusRing';
import {
  buildStops,
  stopKey,
  stopContaining,
  neighbourStop,
  hourStop,
  firstStop,
  lastStop,
} from './timelineStops';

// Keyboard access to one Timeline (docs/design/flows/keyboard-interaction.md).
//
// The Timeline is a group with ONE Tab stop. Inside it focus roves, along the
// time axis, over its "stops": each Entry, and each empty 10-minute slot. An
// Entry's stop is its block; an empty slot has no element until it is
// reached, when a button for just that slot is made (and the previous one
// removed), so there are never 144 of them in the page and each move is a real
// focus change that a screen reader announces. Exactly one element has
// tabindex 0: the current stop. Enter opens an Entry, or makes the default
// block at a slot.
//
// Owns no store state. The host supplies what it needs (see the constructor)
// and calls beforeRender()/afterRender() around every redraw of the Entries,
// which replace their blocks, so focus is put back where it was.

export class TimelineKeyboard {
  cursor; // the current stop: { type, id?, startOffsetMins, endOffsetMins }
  slotElement; // the button for the current stop when that is an empty slot
  usingKeyboard = false; // the last input was a key, so a focus ring is shown
  refocusAfterRender = false;
  pendingReturn; // { startOffsetMins }: focus goes back here once the panel has closed

  constructor({
    svg,
    entriesLayer,
    slotContainer,
    axis,
    getPxPerMinute,
    crossBox,
    getEntries,
    getDimensionName,
    isPanelOpen,
    onOpenEntry,
    onCreateAt,
  }) {
    this.svg = svg;
    this.entriesLayer = entriesLayer;
    this.slotContainer = slotContainer;
    this.axis = axis;
    this.getEntries = getEntries;
    this.getDimensionName = getDimensionName;
    this.isPanelOpen = isPanelOpen;
    this.onOpenEntry = onOpenEntry;
    this.onCreateAt = onCreateAt;
    this.ring = new FocusRing({ container: slotContainer, axis, getPxPerMinute, crossBox });
  }

  // once the host's SVG is in place: names the group and makes the first Tab stop
  connect() {
    this.svg.setAttribute('role', 'group');
    this.svg.setAttribute('aria-label', `${this.getDimensionName()} timeline`);
    this.cursor = firstStop(this.stops());
    this.syncRoving();
  }

  destroy() {
    this.slotElement?.remove();
    this.slotElement = undefined;
    this.ring.hide();
    this.pendingReturn = undefined;
  }

  stops() {
    return buildStops(this.getEntries());
  }

  // --- names -------------------------------------------------------------

  entryName(entry) {
    const activity = Array.isArray(entry.activity) ? entry.activity.join(', ') : entry.activity;
    const start = formatOffsetAsClockTime(entry.startOffsetMins);
    const end = formatOffsetAsClockTime(entry.endOffsetMins);
    return `${activity}, ${start} to ${end}, ${this.getDimensionName()}`;
  }

  slotName(startOffsetMins) {
    return `Add entry at ${formatOffsetAsClockTime(startOffsetMins)}, ${this.getDimensionName()}`;
  }

  // called by renderEntryBlocks for each block of this Timeline (never for the
  // read-only mirror strip): makes the block a button the keyboard can reach
  decorateEntry(rect, entry, group) {
    rect.setAttribute('role', 'button');
    rect.setAttribute('tabindex', this.isCursorEntry(entry.id) ? '0' : '-1');
    rect.setAttribute('aria-label', this.entryName(entry));
    // the visible label says the same as the name: do not read it twice
    group.querySelector('foreignObject')?.setAttribute('aria-hidden', 'true');
  }

  isCursorEntry(id) {
    return this.cursor?.type === 'entry' && this.cursor.id === id;
  }

  // --- redraws -----------------------------------------------------------

  beforeRender() {
    const active = document.activeElement;
    this.refocusAfterRender =
      Boolean(active) &&
      this.svg.contains(active) &&
      (active === this.slotElement || this.entriesLayer.contains(active));
  }

  afterRender() {
    // the cursor's Entry may be gone, or a slot may now be covered
    const stops = this.stops();
    if (this.cursor && !stops.some((stop) => stopKey(stop) === stopKey(this.cursor))) {
      this.cursor = stopContaining(stops, this.cursor.startOffsetMins);
    }
    this.syncRoving();
    if (this.pendingReturn && !this.isPanelOpen()) {
      this.returnFocus();
    } else if (this.refocusAfterRender) {
      this.focusCursor();
    }
    this.refocusAfterRender = false;
    if (this.ring.isShowing && this.cursor) {
      this.ring.show(this.cursor);
    }
  }

  // --- focus -------------------------------------------------------------

  elementFor(stop) {
    if (stop.type === 'entry') {
      return this.entriesLayer.querySelector(`rect[data-id="${stop.id}"]`);
    }
    return this.slotElement;
  }

  // makes `stop` the current one: the only Tab stop, with its own element
  moveTo(stop) {
    this.cursor = stop;
    this.syncRoving();
    this.focusCursor();
  }

  focusCursor() {
    this.elementFor(this.cursor)?.focus();
  }

  // keeps exactly one tabindex 0 in the Timeline, on the current stop, and
  // the slot button for the current stop only while that is a slot
  syncRoving() {
    const cursor = this.cursor;
    this.entriesLayer.querySelectorAll('rect[role="button"]').forEach((rect) => {
      rect.setAttribute(
        'tabindex',
        cursor.type === 'entry' && String(cursor.id) === rect.dataset.id ? '0' : '-1'
      );
    });
    if (cursor.type === 'slot') {
      this.showSlotElement(cursor);
    } else if (this.slotElement) {
      this.slotElement.remove();
      this.slotElement = undefined;
    }
  }

  showSlotElement(stop) {
    if (this.slotElement?.dataset.start === String(stop.startOffsetMins)) {
      this.placeSlot(this.slotElement, stop); // the scale may have changed (zoom)
      return;
    }
    const hadFocus = this.slotElement && document.activeElement === this.slotElement;
    this.slotElement?.remove();
    const rect = document.createElementNS(SVGNS, 'rect');
    rect.setAttribute('data-part', 'slot');
    rect.setAttribute('data-start', stop.startOffsetMins);
    rect.setAttribute('role', 'button');
    rect.setAttribute('tabindex', '0');
    rect.setAttribute('aria-label', this.slotName(stop.startOffsetMins));
    // invisible: it is only where focus lives, and the ring marks the slot.
    // It ignores the pointer, so a click still reaches the gridline zone
    rect.setAttribute('fill', 'transparent');
    rect.setAttribute('pointer-events', 'none');
    this.placeSlot(rect, stop);
    this.slotContainer.appendChild(rect);
    this.slotElement = rect;
    if (hadFocus) {
      rect.focus();
    }
  }

  placeSlot(rect, { startOffsetMins, endOffsetMins }) {
    const { axis } = this;
    const ring = this.ring;
    const pxPerMinute = ring.getPxPerMinute();
    const crossSizeAttr = axis.sizeAttr === 'height' ? 'width' : 'height';
    rect.setAttributeNS(null, axis.positionAttr, startOffsetMins * pxPerMinute);
    rect.setAttributeNS(null, axis.sizeAttr, (endOffsetMins - startOffsetMins) * pxPerMinute);
    rect.setAttributeNS(null, axis.crossAttr, ring.crossBox.start);
    rect.setAttributeNS(null, crossSizeAttr, ring.crossBox.size);
  }

  // --- events ------------------------------------------------------------

  // any key means the next focus is the keyboard's; any press means the mouse's
  noteInput(isKeyboard) {
    this.usingKeyboard = isKeyboard;
  }

  // focus landed on one of this Timeline's elements, by Tab, a click or a move
  onFocusIn(e) {
    const target = e.target;
    if (target === this.slotElement) {
      this.cursor =
        this.stops().find(
          (stop) => stop.type === 'slot' && String(stop.startOffsetMins) === target.dataset.start
        ) ?? this.cursor;
    } else if (this.entriesLayer.contains(target) && target.dataset?.id !== undefined) {
      const entry = this.getEntries().find((entry) => String(entry.id) === target.dataset.id);
      if (!entry) {
        return;
      }
      this.cursor = this.stops().find((stop) => stop.type === 'entry' && stop.id === entry.id);
      this.syncRoving();
    } else {
      return;
    }
    if (this.usingKeyboard) {
      this.ring.show(this.cursor);
    } else {
      this.ring.hide();
    }
  }

  onFocusOut(e) {
    // focus moving to another part of this Timeline is followed by a focusin
    if (e.relatedTarget && this.svg.contains(e.relatedTarget)) {
      return;
    }
    // an element removed by a redraw is not focus leaving
    if (!e.target.isConnected) {
      return;
    }
    this.ring.hide();
  }

  onKeyDown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }
    const { axis } = this;
    const target = e.target;
    if (target !== this.slotElement && !this.entriesLayer.contains(target)) {
      return;
    }
    this.noteInput(true);
    const stops = this.stops();
    const current = this.cursor;
    let next;
    switch (e.key) {
      case axis.nextKey:
        next = neighbourStop(stops, current, 1);
        break;
      case axis.previousKey:
        next = neighbourStop(stops, current, -1);
        break;
      case 'Home':
        next = firstStop(stops);
        break;
      case 'End':
        next = lastStop(stops);
        break;
      case 'PageDown':
        next = hourStop(stops, current, 1);
        break;
      case 'PageUp':
        next = hourStop(stops, current, -1);
        break;
      case 'Enter':
        e.preventDefault();
        this.activate(current);
        return;
      default:
        return;
    }
    e.preventDefault();
    this.moveTo(next);
    this.ring.show(this.cursor);
  }

  // Enter on a stop: opens the Entry, or makes the default block at the slot
  activate(stop) {
    let opened = false;
    if (stop.type === 'entry') {
      const entry = this.getEntries().find((entry) => entry.id === stop.id);
      if (entry) {
        this.onOpenEntry(entry);
        opened = true;
      }
    } else {
      opened = this.onCreateAt(stop.startOffsetMins);
    }
    // armed only once the panel is open: opening it redraws the Timeline on the
    // way, which must not be mistaken for the panel having closed again
    this.pendingReturn = opened ? { startOffsetMins: stop.startOffsetMins } : undefined;
  }

  // --- returning from the panel ------------------------------------------

  // the panel has closed (saved, cancelled or deleted): focus goes back to
  // where the Respondent was, which may now be a different stop - an Entry
  // that now covers the slot, or the empty slot where an Entry was deleted.
  // Waits a microtask so a save, which closes the panel and then redraws, has
  // redrawn first; afterRender() does it if the redraw comes first.
  panelClosed() {
    if (!this.pendingReturn) {
      return;
    }
    queueMicrotask(() => {
      if (!this.isPanelOpen()) {
        this.returnFocus();
      }
    });
  }

  returnFocus() {
    const pending = this.pendingReturn;
    if (!pending) {
      return;
    }
    this.pendingReturn = undefined;
    this.cursor = stopContaining(this.stops(), pending.startOffsetMins);
    this.syncRoving();
    this.noteInput(true);
    this.focusCursor();
    this.ring.show(this.cursor);
  }
}
