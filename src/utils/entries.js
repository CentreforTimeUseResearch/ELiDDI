// two half-open spans [s1,e1) and [s2,e2) overlap iff s1 < e2 && s2 < e1 -
// strict inequalities so back-to-back entries (one ending exactly when the
// next starts) are correctly NOT treated as overlapping
function spansOverlap(a, b) {
  return a.startOffsetMins < b.endOffsetMins && b.startOffsetMins < a.endOffsetMins;
}

// returns the first entry in `entries` (other than the one being edited,
// identified by excludeId) whose time span overlaps candidate's, or
// undefined if there's no conflict
export function findOverlappingEntry(entries, candidate, excludeId) {
  return entries.find((entry) => entry.id !== excludeId && spansOverlap(entry, candidate));
}

// returns the entry (other than excludeId) with the soonest startOffsetMins
// strictly after `afterOffsetMins`, or undefined if none
export function findNextEntry(entries, afterOffsetMins, excludeId) {
  return entries
    .filter((entry) => entry.id !== excludeId && entry.startOffsetMins > afterOffsetMins)
    .sort((a, b) => a.startOffsetMins - b.startOffsetMins)[0];
}
