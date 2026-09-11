# ELiDDI

### Extended Light Digital Diary Instrument

> **🌱 Early-stage, active development.** A working prototype exists — a full time-use diary that runs with or without JavaScript — but the feature set, accessibility conformance, and documentation are all still being built out. Watch or star the repo to follow along, and see [Contributing](#contributing) if you'd like to get involved.

---

## What is ELiDDI?

ELiDDI is an Extended Light Digital Diary Instrument — a web-based tool for collecting daily activities in a timeline format, built for research studies and time-use surveys.

Respondents record their day as a series of Entries against fixed Dimensions (Primary activity, Secondary activity, Location, Who, Device, Enjoyment) on a scrollable timeline, with drag-to-resize and an accessible searchable Activity picker. Activity categories, Dimensions, wording, and onboarding instructions are all driven by a single configuration file (`config/activities.json`), rather than hard-coded, so the instrument can be adapted to a different study without touching application code.

See [CONTEXT.md](CONTEXT.md) for the full domain glossary (Diary, Dimension, Timeline, Entry, Respondent, Activity, Category, Mode) used throughout the codebase and this documentation.

---

## Current Status

| Area                        | Status                                             |
| --------------------------- | -------------------------------------------------- |
| Core concept & architecture | ✅ Defined                                         |
| Working prototype           | ✅ Diary, Activity picker, drag-resize, onboarding |
| Accessibility conformance   | 🔄 In progress                                     |
| Documentation               | 🔄 Component & store READMEs added; more to come   |
| Contribution guidelines     | 🕐 Coming soon                                     |
| First tagged release        | 🕐 Coming soon                                     |

---

## Getting Started

```bash
git clone https://github.com/CentreforTimeUseResearch/ELiDDI.git
cd ELiDDI
npm install
npm run dev          # starts the Vite dev server
```

Other useful commands:

```bash
npm run build        # production build -> dist/
npm run preview      # preview a production build locally
npm run lint          # ESLint over src/ and scripts/
npm run format        # Prettier over src/ and scripts/
```

The diary's content (Dimensions, Activities, wording, onboarding) comes from `config/activities.json` — see [json_schema.md](json_schema.md) for the schema.

---

## Architecture

ELiDDI is built as a **progressive enhancement** time-use diary: it must work as a plain HTML form with no JavaScript at all, then be enhanced by a set of Web Components when JavaScript is available.

- **No-JS layer** — a build-time script (`scripts/generate_no_js.js`) reads `config/activities.json` and generates the full diary as a real, submittable `<form>` of time-slot cards, injected into `index.html`.
- **JS layer** — a hand-rolled set of Web Components (extending a small shared base class, `TinyBase`) takes over rendering once JavaScript loads, replacing the no-JS form with the interactive timeline UI.
- **State management** — a single, hand-rolled Redux-style store (no external state-management library — see the "no runtime JS dependencies" rule in [CLAUDE.md](CLAUDE.md)) holds all diary data, persisted to `localStorage`.

Full documentation of every component and the store lives alongside the code itself:

- [`src/components/`](src/components/README.md) — the shared `TinyBase` base class, the props-passing mechanism, and a README per component (linked from that index).
- [`src/store/`](src/store/README.md) — how state is shaped, what each store file does, and how the reducer tree maps onto the diary domain.
- [CONTEXT.md](CONTEXT.md) — the domain glossary.
- [`docs/adr/`](docs/adr/) — architecture decision records (e.g. why the diary day doesn't run midnight-to-midnight).

---

## Running Tests

Tests are written with [Vitest](https://vitest.dev/).

```bash
npm test          # watch mode
npm test -- --run # single pass
```

---

## Contributing

It's early days for formal contribution guidelines, but interest and ideas from the time-use research and software engineering communities are very welcome. In the meantime:

- Start with the [Architecture](#architecture) section above and the linked component/store documentation to get oriented.
- Open a [discussion or issue](https://github.com/CentreforTimeUseResearch/ELiDDI/issues) — bug reports, questions, and feature ideas are all welcome.
- Run `npm test`, `npm run lint`, and `npm run format:check` before proposing changes; a pre-commit hook (Husky + lint-staged) runs a subset of these automatically.

Formal contribution guidelines will be published as the project matures.

---

## Roadmap

Immediate priorities:

1. Improve and test accessibility conformance (targeting UK Government accessibility standards)
2. Expand configuration/customisation options (activity categories, internationalisation, data definitions)
3. Publish formal contribution guidelines
4. First tagged release
5. Build a user-friendly deployment pipeline with configuration tooling

---

## Licence

MIT

---

_Last updated: September 2026_
