import { describe, it, expect } from 'vitest';
import { renderGridLines } from './gridLines';

function renderInto(pxPerMinute, y1 = 0, y2 = 60) {
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  renderGridLines(group, pxPerMinute, y1, y2);
  return [...group.querySelectorAll('line')];
}

describe('renderGridLines', () => {
  it('draws a line every 10 minutes across the day, both ends included', () => {
    const lines = renderInto(2);

    expect(lines).toHaveLength(145); // 0..1440 step 10
    expect(lines[0].getAttribute('x1')).toBe('0');
    expect(lines[1].getAttribute('x1')).toBe('20'); // 10min * 2px/min
    expect(lines[144].getAttribute('x1')).toBe('2880');
  });

  it('draws each line vertically, between the given y values', () => {
    const [line] = renderInto(2, 28, 40);

    expect(line.getAttribute('x1')).toBe(line.getAttribute('x2'));
    expect(line.getAttribute('y1')).toBe('28');
    expect(line.getAttribute('y2')).toBe('40');
  });

  it('scales the lines with the zoom', () => {
    const lines = renderInto(4);

    expect(lines[1].getAttribute('x1')).toBe('40');
    expect(lines[144].getAttribute('x1')).toBe('5760');
  });

  it('styles hours darker, half hours dashed, and the rest light and solid', () => {
    const lines = renderInto(2);
    const at = (mins) => lines[mins / 10];

    expect(at(60).getAttribute('stroke')).toBe('#8f97a3');
    expect(at(60).hasAttribute('stroke-dasharray')).toBe(false);
    expect(at(30).getAttribute('stroke')).toBe('#d8dbe0');
    expect(at(30).getAttribute('stroke-dasharray')).toBe('2,3');
    expect(at(10).getAttribute('stroke')).toBe('#d8dbe0');
    expect(at(10).hasAttribute('stroke-dasharray')).toBe(false);
  });

  it('replaces what was in the group rather than adding to it', () => {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    renderGridLines(group, 2, 0, 60);
    renderGridLines(group, 4, 0, 60);

    expect(group.querySelectorAll('line')).toHaveLength(145);
  });
});
