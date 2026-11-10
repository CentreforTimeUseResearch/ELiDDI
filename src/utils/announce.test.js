import { describe, it, expect, beforeEach } from 'vitest';
import { announce, ensureAnnouncer } from './announce';

const regions = () => document.querySelectorAll('.announcer');
const said = () => regions()[0].textContent.replaceAll(String.fromCharCode(0xa0), '');

describe('announce', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('is a polite, atomic status region that is hidden from view', () => {
    ensureAnnouncer();

    const region = regions()[0];
    expect(region.getAttribute('role')).toBe('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.getAttribute('aria-atomic')).toBe('true');
    expect(region.classList.contains('sr-only')).toBe(true);
  });

  it('says what it is given', () => {
    announce('Showing Monday 9 November, 3 of 6 timelines started');

    expect(said()).toBe('Showing Monday 9 November, 3 of 6 timelines started');
  });

  it('is one element however often it is used, and is made again if the page lost it', () => {
    ensureAnnouncer();
    announce('one');
    announce('two');
    expect(regions()).toHaveLength(1);

    document.body.innerHTML = '';
    announce('three');

    expect(regions()).toHaveLength(1);
    expect(said()).toBe('three');
  });

  it('changes the region even when the same words are said twice in a row', () => {
    announce('Zoom 125%');
    const first = regions()[0].textContent;

    announce('Zoom 125%');
    const second = regions()[0].textContent;

    expect(second).not.toBe(first);
    expect(said()).toBe('Zoom 125%');
  });

  it('replaces the last message rather than adding to it', () => {
    announce('one');
    announce('two');

    expect(said()).toBe('two');
  });
});
