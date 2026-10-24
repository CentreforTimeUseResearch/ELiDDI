import { getActivityDisplayName } from './activities';

// Pure activity-search helpers used by ActivityPicker's autocomplete
// popover - no DOM, no store, so these can be tested/reasoned about in
// isolation from rendering and event wiring.

// content is an array of {name, activities} categories (see
// GLOBALS.DATA.timeline[dimensionIndex].categories) - returns the same
// shape with each category's activities filtered to those whose display
// name - the label it's shown with, as hasKnownActivity compares - includes
// searchString (case-insensitive)
export function searchActivities(content, searchString) {
  const lower = searchString.toLowerCase();
  return content.map((category) => ({
    name: category.name,
    activities: category.activities.filter((activity) =>
      getActivityDisplayName(activity)?.toLowerCase().includes(lower)
    ),
  }));
}

// true if searchString exactly matches an already-listed activity's
// display name - used to avoid offering free text as a redundant duplicate
export function hasKnownActivity(content, searchString) {
  const lower = searchString.toLowerCase();
  return content.some((category) =>
    category.activities.some(
      (activity) => getActivityDisplayName(activity)?.toLowerCase() === lower
    )
  );
}
