import { MINUTES_PER_DAY, MIN_ENTRY_DURATION_MINS } from './timelineConstants';
import { t } from '../../i18n/i18n';
import { computeMove } from './moveSpan';
import { computeResize } from './resizeSpan';

// One keyboard "grab" of an Entry: from Space picking it up to Enter or
// Escape. It holds nothing but numbers, so the rules can be tested without a
// DOM, and it uses the same pure rules as the pointer (computeMove and
// computeResize), so the two cannot give different answers.
//
// A step is one of three kinds: 'move' (the whole Entry), 'end' or 'start'
// (that edge). Within a run of the same kind each step is worked out from where
// the run began, so it is reversible: moving on and then back restores the
// neighbours it trimmed. Switching kind starts a new run from wherever the last
// one left things (the Entries it changed become the new starting point).
// Escape needs none of this: nothing is stored until the grab is confirmed.
export class GrabSession {
  constructor({ entries, entryId, singleChoice, nowLimitMins }) {
    this.entryId = entryId;
    this.singleChoice = singleChoice;
    this.nowLimitMins = nowLimitMins;
    // the stored spans, for working out what changed and for cancelling
    this.initial = new Map(
      entries.map((entry) => [entry.id, { start: entry.startOffsetMins, end: entry.endOffsetMins }])
    );
    this.base = entries.map((entry) => ({ ...entry })); // where the current run began
    const grabbed = this.base.find((entry) => entry.id === entryId);
    this.current = { start: grabbed.startOffsetMins, end: grabbed.endOffsetMins };
    this.neighbours = []; // the Entries the current run is moving the boundaries of
    this.kind = undefined;
  }

  get initialSpan() {
    return this.initial.get(this.entryId);
  }

  // `kind`: 'move', 'end' or 'start'. `delta`: minutes, negative for earlier;
  // +/-Infinity asks for the limit.
  // -> { startOffsetMins, endOffsetMins, atLimit, reason, neighbours }, where
  // reason says which limit held it back (when atLimit) and neighbours are the
  // Entries this step is moving a boundary of, each with what moved
  step(kind, delta) {
    if (kind !== this.kind) {
      this.rebase();
      this.kind = kind;
    }
    const entry = this.base.find((entry) => entry.id === this.entryId);
    const shared = {
      entry,
      entries: this.base,
      singleChoice: this.singleChoice,
      nowLimitMins: this.nowLimitMins,
    };
    const result =
      kind === 'move'
        ? computeMove({ ...shared, requestedStart: this.current.start + delta })
        : computeResize({
            ...shared,
            edge: kind,
            requestedOffsetMins: (kind === 'end' ? this.current.end : this.current.start) + delta,
          });
    this.current = { start: result.startOffsetMins, end: result.endOffsetMins };
    this.neighbours = result.neighbours;
    return {
      startOffsetMins: result.startOffsetMins,
      endOffsetMins: result.endOffsetMins,
      atLimit: result.atLimit,
      reason: result.atLimit ? this.limitReason(kind, Math.sign(delta)) : undefined,
      neighbours: result.neighbours.map((neighbour) => {
        const was = this.base.find((entry) => entry.id === neighbour.id);
        return {
          ...neighbour,
          startMoved: neighbour.startOffsetMins !== was.startOffsetMins,
          endMoved: neighbour.endOffsetMins !== was.endOffsetMins,
        };
      }),
    };
  }

  // which limit held the last step back, as a phrase for "Limit reached: ..."
  limitReason(kind, direction) {
    const { start, end } = this.current;
    const movesStart = kind === 'move' || kind === 'start';
    const movesEnd = kind === 'move' || kind === 'end';
    if (direction < 0 && movesStart && start === 0) {
      return t('grabSession.limit.startOfDay');
    }
    if (direction > 0 && movesEnd && end === MINUTES_PER_DAY) {
      return t('grabSession.limit.endOfDay');
    }
    if (direction > 0 && movesEnd && end === this.nowLimitMins) {
      return t('grabSession.limit.now');
    }
    if (
      this.neighbours.some(
        (neighbour) =>
          neighbour.endOffsetMins - neighbour.startOffsetMins === MIN_ENTRY_DURATION_MINS
      )
    ) {
      return t('grabSession.limit.neighbourMin', { minutes: MIN_ENTRY_DURATION_MINS });
    }
    return t('grabSession.limit.entryMin', { minutes: MIN_ENTRY_DURATION_MINS });
  }

  // the Entries as they stand after the current run
  currentEntries() {
    return this.base.map((entry) => {
      if (entry.id === this.entryId) {
        return { ...entry, startOffsetMins: this.current.start, endOffsetMins: this.current.end };
      }
      const moved = this.neighbours.find((neighbour) => neighbour.id === entry.id);
      return moved
        ? { ...entry, startOffsetMins: moved.startOffsetMins, endOffsetMins: moved.endOffsetMins }
        : entry;
    });
  }

  // a new run starts from what the last one produced
  rebase() {
    this.base = this.currentEntries();
    this.neighbours = [];
  }

  // what to draw for the grab as it stands: the Entries that now differ from
  // the stored ones, and the grabbed Entry and the Entries the current run is
  // moving the boundary of even if they are back to their stored spans (so they
  // are drawn back where they were)
  previewEntries() {
    const ids = new Set([
      this.entryId,
      ...this.neighbours.map((neighbour) => neighbour.id),
      ...this.changedEntries().map((entry) => entry.id),
    ]);
    return this.currentEntries()
      .filter((entry) => ids.has(entry.id))
      .map(({ id, startOffsetMins, endOffsetMins }) => ({ id, startOffsetMins, endOffsetMins }));
  }

  // every Entry whose span now differs from the stored one, as
  // [{ id, startOffsetMins, endOffsetMins }] - to draw them, or to store them
  changedEntries() {
    return this.currentEntries()
      .filter((entry) => {
        const before = this.initial.get(entry.id);
        return before.start !== entry.startOffsetMins || before.end !== entry.endOffsetMins;
      })
      .map(({ id, startOffsetMins, endOffsetMins }) => ({ id, startOffsetMins, endOffsetMins }));
  }

  // what confirming would store: the grabbed Entry's span and the other
  // Entries that gave way; changed is false if it all ended where it began
  outcome() {
    const changed = this.changedEntries();
    return {
      changed: changed.length > 0,
      span: { startOffsetMins: this.current.start, endOffsetMins: this.current.end },
      neighbourChanges: changed
        .filter((entry) => entry.id !== this.entryId)
        .map(({ id, startOffsetMins, endOffsetMins }) => ({
          entryId: id,
          startOffsetMins,
          endOffsetMins,
        })),
    };
  }
}
