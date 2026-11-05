import './freezeGlobals';
import './components/dynamicTimelineUI/dynamicTimelineUI';
import './sync/appSync';

window.addEventListener('DOMContentLoaded', function () {
  document.querySelector('body').classList.remove('no-js');
});
