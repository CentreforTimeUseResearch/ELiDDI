import { PX_PER_MINUTE } from '../timeline/timelineConstants';

export const NATIVE_ZOOM = 1;
export const MAX_ZOOM = 4;
export const ZOOM_STEP = 0.25;

export function getEffectivePxPerMinute(zoomLevel) {
  return PX_PER_MINUTE * zoomLevel;
}
