# Contributing to ELiDDI

Thanks for your interest. Ideas and fixes from the time-use research and software engineering communities are welcome. This page covers how to propose a change and what we check before merging it.

## Before you start

- **Find or open an issue.** Work is tracked as [GitHub issues](https://github.com/CentreforTimeUseResearch/ELiDDI/issues) and the [project board](https://github.com/users/CentreforTimeUseResearch/projects/1). For anything bigger than a small fix, comment on the issue (or open one) first, so we can agree the approach before you write it. Issues labelled `good first issue` are a gentle start.
- **Get oriented.** Read the [Architecture](README.md#architecture) section of the README, then the documentation closest to what you're changing:
  - [`CONTEXT.md`](CONTEXT.md) — the project's vocabulary (Dimension, Timeline, Entry, Diary…). Please use these terms in code, comments and PRs.
  - [`src/components/README.md`](src/components/README.md) and the README inside each component folder.
  - [`src/store/README.md`](src/store/README.md) — the store, its reducers and what is persisted.
  - [`docs/adr/`](docs/adr) — decisions already made and why. If your change goes against one, say so in the issue.
  - [`CLAUDE.md`](CLAUDE.md) — build commands, the test setup and architecture notes in more depth.

## Setting up

You need Node.js 22 (what CI uses).

```bash
npm install
npm run dev        # start the dev server
npm test           # tests in watch mode
```

## Ground rules

- **No runtime JavaScript dependencies.** `package.json` has no `dependencies`, only `devDependencies`. The app is written in vanilla JS and DOM APIs. If a task seems to need a library, implement it directly or ask on the issue first.
- **It must work without JavaScript.** The diary is a plain HTML form that JavaScript then enhances. A change to the form or its generation (`scripts/`) needs to keep the no-JS version working.
- **A Respondent's diary lives only in their browser.** If you change the shape of a persisted part of the store, you need a `STATE_VERSION` bump and a migration. Read `src/store/persistence.js` first.
- **Test what you change.** Tests are `*.test.js` files next to the code (Vitest and jsdom). Add or update tests for new behaviour and bug fixes. A fix should come with a test that failed before it.
- **Keep the documentation true.** If you change what a component does, update its README in the same PR.

## Branches, commits and pull requests

1. **Branch from `main`.** Name it after the issue: `el-<issue number>-<short-description>`, for example `el-176-row-gridlines`.
2. **Commit in small, readable steps.** Start the message with a type — `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:` — then say what changed and, where it isn't obvious, why.
3. **Run the checks locally** before you open the PR (see below).
4. **Open a PR into `main`.** Put `Closes #<issue>` in the description so the issue closes on merge. Say what changed and how you checked it, and mention anything you chose not to do. Screenshots help for UI changes.
5. **Review and merge.** A maintainer reviews and merges. Please keep the PR to one change; unrelated fixes go in their own PR.

## Checks before a PR

```bash
npm test -- --run     # all tests, once
npm run lint          # ESLint over src/ and scripts/
npm run format:check  # Prettier; `npm run format` fixes it
```

CI runs the same three checks on every PR into `main`, and they must pass. A pre-commit hook (Husky and lint-staged) also lints and formats the files you commit and runs the full test suite, so a commit can take a little while.

Some component specs are deliberately named `*.te-st.js`. That keeps placeholder specs out of the test run until they have real assertions. When you give one real tests, rename it to `*.test.js`.

## Related repositories

The configuration and deployment tool lives in [ELiDDI_deployer](https://github.com/CentreforTimeUseResearch/ELiDDI_deployer). Changes to the shape of `config/config.json` usually need a matching change there.

## Licence

ELiDDI is released under the [MIT licence](LICENSE), and contributions are accepted under the same terms.
