import { describe, it, expect } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import path from 'node:path';
import {
  buildDiaryHtml,
  generateCardNav,
  createCardHTML,
  createDimensionsWithFlattenedActivities,
  generateDataLists,
  SLOTS_PER_DAY,
  SLOTS_PER_CHUNK,
  NUM_CHUNKS,
} from './generateNoJs';
import { deepFreeze } from '../../src/utils/deepfreeze';

// vitest runs from the project root (and under jsdom, URL is jsdom's, which fs rejects)
const CONFIG_JSON = readFileSync(path.join(process.cwd(), 'config', 'config.json'), 'utf8');
const CONFIG = JSON.parse(CONFIG_JSON);

const BACKSLASH = String.fromCharCode(92);
const parse = (html) => new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
const withConfig = (change) => {
  const config = structuredClone(CONFIG);
  change(config);
  return JSON.stringify(config);
};

// the slot (1-144) a card id "{chunk}_{cardNum}" stands for, and back
const slotOf = (id) => {
  const [chunk, cardNum] = id.split('_').map(Number);
  return (chunk - 1) * SLOTS_PER_CHUNK + cardNum;
};
const idOf = (slot) => `${Math.ceil(slot / SLOTS_PER_CHUNK)}_${((slot - 1) % SLOTS_PER_CHUNK) + 1}`;

describe('buildDiaryHtml', () => {
  const doc = parse(buildDiaryHtml(CONFIG_JSON));
  const cards = [...doc.querySelectorAll('li.card-tenMinutes')];

  it('renders 144 ten-minute cards in 8 three-hour chunks of 18', () => {
    expect(SLOTS_PER_DAY).toBe(144);
    expect(cards).toHaveLength(144);
    const chunks = [...doc.querySelectorAll('ol.card-threeHours')];
    expect(chunks).toHaveLength(NUM_CHUNKS);
    chunks.forEach((chunk) => expect(chunk.children).toHaveLength(SLOTS_PER_CHUNK));
  });

  it('ids each card {chunk}_{cardNum}, in day order', () => {
    expect(cards.map((card) => card.id)).toEqual(
      Array.from({ length: SLOTS_PER_DAY }, (_, i) => idOf(i + 1))
    );
  });

  it('starts the day at 04:00 and ends it at 03:59', () => {
    expect(cards[0].querySelector('h3').textContent).toBe('04:00 - 04:09');
    expect(cards.at(-1).querySelector('h3').textContent).toBe('03:50 - 03:59');
  });

  // the boundary arithmetic is the riskiest logic here: every link must
  // land exactly 1 or 6 slots away, across chunk boundaries, and exist only
  // when that slot is inside the day
  describe('slot navigation', () => {
    const LINKS = {
      'Skip backwards one hour': -6,
      'Skip backwards ten minutes': -1,
      'Skip forward ten minutes': 1,
      'Skip forward one hour': 6,
    };

    it('links every card exactly 1 or 6 slots away, whenever that slot exists', () => {
      cards.forEach((card) => {
        const slot = slotOf(card.id);
        const links = Object.fromEntries(
          [...card.querySelectorAll('nav a')].map((a) => [a.textContent, a.getAttribute('href')])
        );
        Object.entries(LINKS).forEach(([label, delta]) => {
          const target = slot + delta;
          const expected = target >= 1 && target <= SLOTS_PER_DAY ? `#${idOf(target)}` : undefined;
          expect(links[label], `${card.id}: ${label}`).toBe(expected);
        });
      });
    });

    it.each([
      [
        'the first card',
        '1_1',
        { 'Skip forward ten minutes': '#1_2', 'Skip forward one hour': '#1_7' },
      ],
      [
        'the last card of a chunk',
        '1_18',
        { 'Skip forward ten minutes': '#2_1', 'Skip forward one hour': '#2_6' },
      ],
      [
        'the first card of a chunk',
        '2_1',
        { 'Skip backwards ten minutes': '#1_18', 'Skip backwards one hour': '#1_13' },
      ],
      [
        'the last card',
        '8_18',
        { 'Skip backwards ten minutes': '#8_17', 'Skip backwards one hour': '#8_12' },
      ],
    ])('links %s (%s) across the boundary', (_, id, expected) => {
      const nav = parse(generateCardNav(...id.split('_').map(Number), 'slot'));
      const links = Object.fromEntries(
        [...nav.querySelectorAll('a')].map((a) => [a.textContent, a.getAttribute('href')])
      );
      expect(links).toMatchObject(expected);
    });

    it('links each chunk to the chunks either side', () => {
      const chunkLinks = (n) =>
        [...doc.getElementById(`chunk_${n}`).nextElementSibling.querySelectorAll('a')].map((a) =>
          a.getAttribute('href')
        );
      expect(chunkLinks(1)).toEqual(['#chunk_2']);
      expect(chunkLinks(4)).toEqual(['#chunk_3', '#chunk_5']);
      expect(chunkLinks(8)).toEqual(['#chunk_7']);
    });
  });

  it('emits only the GLOBALS block and an empty mount point when the HTML fallback is off', () => {
    const json = withConfig((config) => {
      config.general.accessibility.generateHtmlFallback = false;
    });
    const html = buildDiaryHtml(json);

    expect(html).toBe(
      `<script>GLOBALS = {DATA: ${json.replaceAll('<', BACKSLASH + 'u003c')} }; </script><el-dynamic-timeline></el-dynamic-timeline>`
    );
  });

  // a config is researcher-authored and can be injected at deploy time
  it('embeds the config so that a "</script>" in any label cannot end the block', () => {
    const json = withConfig((config) => {
      config.timeline[0].categories[0].activities[0].name = '</script><b>escaped</b><!--';
    });
    const parsed = parse(buildDiaryHtml(json));
    const scripts = parsed.querySelectorAll('script');

    expect(scripts).toHaveLength(1);
    expect(parsed.querySelectorAll('b')).toHaveLength(0);
    const embedded = scripts[0].textContent.match(/^GLOBALS = \{DATA: ([\s\S]*) \}; $/)[1];
    expect(JSON.parse(embedded)).toEqual(JSON.parse(json));
  });

  it('gives each Dimension an id with no whitespace, shared by its input and datalist', () => {
    const json = withConfig((config) => {
      config.timeline[0].name = 'Time spent with others';
      config.timeline[0].allow_free_text = true;
    });
    const parsed = parse(buildDiaryHtml(json));

    const datalist = parsed.querySelector('datalist');
    expect(datalist.id).toBe('time-spent-with-others');
    expect(parsed.querySelector('li.card-tenMinutes input[type="text"]').getAttribute('list')).toBe(
      'time-spent-with-others'
    );
  });

  it('round-trips activity names containing HTML special characters', () => {
    const names = [`Children's "quiet" time`, 'R&R <rest>', '5" screen'];
    const json = withConfig((config) => {
      config.timeline[5].categories[0].activities.push(
        ...names.map((name) => ({ name, color: '#000000' }))
      );
    });
    const parsed = parse(buildDiaryHtml(json));

    const options = [
      ...parsed.querySelector('li.card-tenMinutes').querySelectorAll('select option'),
    ]
      .map((option) => option.textContent)
      .slice(-names.length);
    expect(options.map((option) => option.split(' - ').at(-1))).toEqual(names);
  });
});

// regression coverage (#160): a submitted no-JS form must say, for every
// slot, which answer belongs to which Dimension. Before, Primary activity
// and Enjoyment shared the name "{slot}-enjoyed", checkboxes had no value
// (each ticked box sent just "on"), every multiple-choice Dimension got a
// hard-coded "Alone" box, and an untouched dropdown sent its first activity
describe('the submitted form', () => {
  const doc = parse(buildDiaryHtml(CONFIG_JSON));
  const form = doc.querySelector('form');
  const dimensions = createDimensionsWithFlattenedActivities(CONFIG.timeline);
  const card = (id) => doc.getElementById(id);
  const fieldName = (slotId, dimension) => `${slotId}-${dimension.uniqueRef}`;
  const CONTINUE = 'activity_continued_until_next_entry';

  it('gives every element in the document a unique id', () => {
    const ids = [...doc.querySelectorAll('[id]')].map((element) => element.id);
    const repeated = ids.filter((id, index) => ids.indexOf(id) !== index);
    expect(repeated).toEqual([]);
  });

  it("points every label at the control in its own question, named for that label's Dimension", () => {
    [...doc.querySelectorAll('li.card-tenMinutes')].forEach((cardElement) => {
      cardElement.querySelectorAll('label[for]').forEach((label) => {
        const control = doc.getElementById(label.htmlFor);
        // inside the label's own question cell - with a repeated id, the
        // document's first match is a different Dimension's control
        expect(label.closest('.gridCell').contains(control), label.htmlFor).toBe(true);
        expect(control.name, label.htmlFor).toBe(label.htmlFor);
      });
    });
  });

  it('names every control after exactly one Dimension of its slot (or the continue box)', () => {
    const expected = new Set([...dimensions.map((d) => fieldName('1_1', d)), `1_1-${CONTINUE}`]);
    const names = new Set([...card('1_1').querySelectorAll('[name]')].map((c) => c.name));
    expect(names).toEqual(expected);
  });

  it("offers each multiple-choice Dimension exactly its configured options, each box's value its option", () => {
    dimensions
      .filter((dimension) => dimension.mode === 'multiple-choice')
      .forEach((dimension) => {
        const boxes = [
          ...card('1_1').querySelectorAll(
            `input[type="checkbox"][name="${fieldName('1_1', dimension)}"]`
          ),
        ];
        expect(boxes.map((box) => box.value)).toEqual(dimension.options);
        expect(boxes.map((box) => box.parentElement.textContent)).toEqual(dimension.options);
      });
  });

  it('starts each dropdown on an empty "not answered" choice', () => {
    card('1_1')
      .querySelectorAll('select')
      .forEach((select) => {
        expect(select.value, select.name).toBe('');
        expect(select.options[0].textContent).toMatch(/not answered/i);
      });
  });

  it('puts no list attribute on the continue checkbox', () => {
    expect(card('1_1').querySelector(`[name="1_1-${CONTINUE}"]`).hasAttribute('list')).toBe(false);
  });

  it("submits each Dimension's answer under its own name, and nothing for an untouched card", () => {
    const [primary, secondary, location, who, device, enjoyment] = dimensions;
    const set = (name, value) => {
      form.querySelector(`[name="${name}"]`).value = value;
    };
    const tick = (name, option) => {
      [...form.querySelectorAll(`[name="${name}"]`)].find((box) => box.value === option).checked =
        true;
    };

    set(fieldName('1_1', primary), primary.options[3]);
    set(fieldName('1_1', secondary), 'reading the news');
    set(fieldName('1_1', location), location.options[0]);
    tick(fieldName('1_1', who), who.options[1]);
    tick(fieldName('1_1', who), who.options[2]);
    tick(fieldName('1_1', device), device.options[0]);
    set(fieldName('1_1', enjoyment), enjoyment.options[4]);
    form.querySelector(`[name="1_1-${CONTINUE}"]`).checked = true;

    const data = new FormData(form);
    expect(data.getAll(fieldName('1_1', primary))).toEqual([primary.options[3]]);
    expect(data.getAll(fieldName('1_1', secondary))).toEqual(['reading the news']);
    expect(data.getAll(fieldName('1_1', location))).toEqual([location.options[0]]);
    expect(data.getAll(fieldName('1_1', who))).toEqual([who.options[1], who.options[2]]);
    expect(data.getAll(fieldName('1_1', device))).toEqual([device.options[0]]);
    expect(data.getAll(fieldName('1_1', enjoyment))).toEqual([enjoyment.options[4]]);
    expect(data.getAll(`1_1-${CONTINUE}`)).toEqual(['on']);

    // an untouched card: empty dropdowns and text, no checkbox entries
    const untouched = [...data.entries()].filter(([name]) => name.startsWith('1_2-'));
    expect(untouched.every(([, value]) => value === '')).toBe(true);
    expect(untouched.map(([name]) => name).sort()).toEqual(
      dimensions
        .filter((dimension) => dimension.mode === 'single-choice')
        .map((dimension) => fieldName('1_2', dimension))
        .sort()
    );
  });
});

// regression coverage (#147): createCardHTML assigned uniqueRef onto the
// caller's dimension objects, once per card - 144 times over the same array
describe('generation does not mutate its input', () => {
  it('builds the dimensions, data lists and a card from frozen input', () => {
    const timeline = deepFreeze(structuredClone(CONFIG.timeline));
    const dimensions = deepFreeze(createDimensionsWithFlattenedActivities(timeline));

    expect(() => generateDataLists(dimensions)).not.toThrow();
    expect(() => createCardHTML(dimensions, '04:00 - 04:09', 1, 1)).not.toThrow();
  });
});

describe('the generate_no_js.js CLI', () => {
  const run = (env) =>
    spawnSync(process.execPath, ['scripts/generate_no_js.js'], {
      env: { ...process.env, ...env },
      encoding: 'utf8',
      maxBuffer: 1 << 26,
    });

  it('prints the diary for the committed config', () => {
    const stdout = execFileSync(process.execPath, ['scripts/generate_no_js.js'], {
      env: { ...process.env, ACTIONS_ENV: '' },
      encoding: 'utf8',
      maxBuffer: 1 << 26,
    });
    expect(stdout.trim()).toBe(buildDiaryHtml(CONFIG_JSON));
  });

  // regression coverage (#147): an unreadable config file was logged and
  // the script exited 0 having printed nothing, so the build silently
  // injected an empty diary. Run from a copy of the scripts with no config/,
  // placed under node_modules/ so it still resolves the ajv package
  it('exits non-zero, printing nothing to stdout, when the config file cannot be read', () => {
    const cache = path.join(process.cwd(), 'node_modules', '.cache');
    mkdirSync(cache, { recursive: true });
    const root = mkdtempSync(path.join(cache, 'eliddi-no-config-'));
    try {
      [
        'scripts/generate_no_js.js',
        'scripts/lib/generateNoJs.js',
        'scripts/lib/validateConfig.js',
        'src/utils/html.js',
      ].forEach((file) => cpSync(file, path.join(root, file)));
      const result = spawnSync(process.execPath, [path.join(root, 'scripts/generate_no_js.js')], {
        env: { ...process.env, ACTIONS_ENV: '' },
        encoding: 'utf8',
      });

      expect(result.status).not.toBe(0);
      expect(result.stdout).toBe('');
      expect(result.stderr).toMatch(/config/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('exits non-zero, printing nothing to stdout, when the config is not valid JSON', () => {
    const result = run({ ACTIONS_ENV: '{ not json' });

    expect(result.status).not.toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toMatch(/config/i);
  });

  // #161: a deploy's injected config was used as-is, so a typo only showed
  // up at runtime, in front of respondents
  it('exits non-zero, naming each problem, when the config breaks config.schema.json', () => {
    const json = withConfig((config) => {
      config.timeline[2].categories[0].activities[3].color = 'red';
      delete config.timeline[1].categories;
    });

    const result = run({ ACTIONS_ENV: json });

    expect(result.status).not.toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain(
      'timeline/2/categories/0/activities/3/color must match pattern "^#[0-9a-fA-F]{6}$"'
    );
    expect(result.stderr).toContain("timeline/1 must have required property 'categories'");
  });
});
