import { TinyBase } from '../base';
import '../horizontalTimelineAxis/horizontalTimelineAxis';
import '../horizontalTimeline/horizontalTimeline';
import './horizontalTimelineStack.css';

// Phase 10.4: mounts the shared axis + one HorizontalTimeline per Dimension
// under a single horizontally-scrolling region, replacing <el-timeline-stack>
// at the >=1024px breakpoint (see DynamicTimelineUI.renderStack()). No store
// subscription of its own - no interactions yet (Phases 10.5-10.7), and each
// mounted child already owns its own store wiring.
export class HorizontalTimelineStack extends TinyBase {
  numTimelines = GLOBALS.DATA.timeline.length;

  render() {
    const rows = Array.from(
      { length: this.numTimelines },
      (_, i) => `<el-horizontal-timeline index="${i}"></el-horizontal-timeline>`
    ).join('');
    this.innerHTML = `<el-horizontal-timeline-axis></el-horizontal-timeline-axis>${rows}`;
  }
}

customElements.define('el-horizontal-timeline-stack', HorizontalTimelineStack);
