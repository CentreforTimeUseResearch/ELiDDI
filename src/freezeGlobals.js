import { deepFreeze } from './utils/deepfreeze';

// GLOBALS is assigned synchronously by an inline classic <script> injected
// by scripts/generate_no_js.js (see index.html), before any module script
// runs. Freezing it here - as main.js's first import, ahead of the
// DynamicTimelineUI import - guarantees it's immutable before any custom
// element's constructor/connectedCallback can read it.
//
// Freezing inside main.js's own DOMContentLoaded handler (the previous
// approach) was too late: <script type="module"> tags are deferred, but
// still execute - and, via each component module's customElements.define()
// call, upgrade and render every already-parsed custom element - before
// DOMContentLoaded fires. All mutation must be using local vars from here on.
GLOBALS = deepFreeze(GLOBALS);
