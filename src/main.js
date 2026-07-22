// eslint-disable-next-line no-unused-vars
import { DynamicTimelineUI } from './components/dynamicTimelineUI/dynamicTimelineUI';
import { deepFreeze } from './utils/deepfreeze';

window.addEventListener('DOMContentLoaded', function () {
  document.querySelector('body').classList.remove('no-js');
  // freeze globals all mutation must be using local vars
  GLOBALS = deepFreeze(GLOBALS);
});
