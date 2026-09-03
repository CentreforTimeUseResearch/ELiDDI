// Activities in config/config.json come in two flavors: "coded" (Primary/Secondary,
// which have a `label`) and "example" (Location/Who/Device/Enjoyment, which only have
// `name`). Anything reading an activity's display text must fall back to `name`.
export function getActivityDisplayName(activity) {
  return activity?.label || activity?.name;
}

function findInActivityList(activities, activityName) {
  for (const activity of activities) {
    if (getActivityDisplayName(activity) === activityName) {
      return activity;
    }
    if (Array.isArray(activity.childItems) && activity.childItems.length > 0) {
      const found = findInActivityList(activity.childItems, activityName);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}

// dimensionData is one entry of GLOBALS.DATA.timeline (a Dimension config object).
export function findActivityInDimension(dimensionData, activityName) {
  if (!dimensionData || typeof activityName !== 'string') {
    return undefined;
  }
  for (const category of dimensionData.categories) {
    const found = findInActivityList(category.activities, activityName);
    if (found) {
      return found;
    }
  }
  return undefined;
}

// multiple-choice entries store activity as string[]; use the first selection
// for the block's fill color (no blending of multiple colors)
export function getPrimaryActivityName(activityOrActivities) {
  return Array.isArray(activityOrActivities) ? activityOrActivities[0] : activityOrActivities;
}

const FALLBACK_COLOR = '#9aa0c3';

export function getActivityColor(dimensionData, activityOrActivities) {
  const activityName = getPrimaryActivityName(activityOrActivities);
  return findActivityInDimension(dimensionData, activityName)?.color || FALLBACK_COLOR;
}
