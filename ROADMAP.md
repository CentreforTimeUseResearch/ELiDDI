# Roadmap

This is where larger, not-yet-broken-down work lives before it becomes a ticket. The [project board](https://github.com/users/CentreforTimeUseResearch/projects/1) tracks "what are we actively doing" (Backlog → Todo this sprint → In Progress → Done); this doc tracks "what might we do, and roughly when" — the layer above that.

Once an item here is well-defined enough to act on, split it into one or more GitHub issues, add them to the board, and mark this entry **🎫 Ticketed** with links to those issues (or move it down to the archive section). Target dates are planning signal, not commitments.

## Status key

| Status       | Meaning                                                                    |
| ------------ | -------------------------------------------------------------------------- |
| 💡 Idea      | Captured, not yet thought through                                          |
| 🔍 Exploring | Actively being scoped/researched                                           |
| 📋 Planned   | Scope is clear enough to ticket, just not done yet                         |
| 🎫 Ticketed  | Broken down — see linked issue(s); move to the archive once all are closed |

---

## Now (this quarter)

| Item                                         | Theme         | Status       | Target  | Notes                                                                                                            |
| -------------------------------------------- | ------------- | ------------ | ------- | ---------------------------------------------------------------------------------------------------------------- |
| Desktop / horizontal layout for the timeline | UI            | 🔍 Exploring | Q1 2027 | Current layout is mobile-vertical only (see `CONTEXT.md`'s note on avoiding "column" terminology ahead of this). |
| Accessibility conformance pass               | Accessibility | 🔍 Exploring | Q1 2027 | Targeting UK Government accessibility standards (WCAG-aligned). Needs scoping into concrete audit + fix tickets. |

## Next (next 1–2 quarters)

| Item                      | Theme      | Status  | Target | Notes                                                                                                                                          |
| ------------------------- | ---------- | ------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Internationalisation      | Config     | 💡 Idea | TBD    | Translating instructions/activity labels; interacts with `config/config.json`'s structure.                                                     |
| Server-side user accounts | Data/Infra | 💡 Idea | TBD    | Already has a seed ticket: [#111](https://github.com/CentreforTimeUseResearch/ELiDDI/issues/111) — kept here too until its scope is firmed up. |

## Later / Someday

| Item                                                  | Theme      | Status  | Target | Notes                                                                                                                                |
| ----------------------------------------------------- | ---------- | ------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| User-friendly deployment pipeline with config tooling | Deployment | 💡 Idea | TBD    | Let a study configure + deploy their own instance without hand-editing `config/config.json` or the GitHub Actions workflow directly. |
| Expanded data-definition options                      | Config     | 💡 Idea | TBD    | Beyond the current fixed six-Dimension model — scope TBD.                                                                            |

---

## Shipped / Ticketed archive

| Item                                      | Ticketed as                                                           | Date       |
| ----------------------------------------- | --------------------------------------------------------------------- | ---------- |
| Write and publish contribution guidelines | [#120](https://github.com/CentreforTimeUseResearch/ELiDDI/issues/120) | 2026-10-12 |
