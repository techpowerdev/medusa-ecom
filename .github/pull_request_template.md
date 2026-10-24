## Task
Spec: `docs/spec/<nn>-<slug>.md` — Task ID: `<XX-n>`
ADRs touched: ADR-___ (or none)

## What changed (3 lines max)
-

## Medusa reuse check
- [ ] I searched Medusa modules/workflows/APIs for this capability and found none / only a partial (explain below)
- Uses: `<module/workflow names>`
- Extends: `<hooks/links/widgets>`

## Acceptance criteria covered
- [ ] AC-1 …
- [ ] AC-2 …

## Tests (paste summary, not full log)
```
unit:        N passed
integration: N passed
e2e:         N passed
```
Full output: `docs/evidence/<feature>/<task-id>-tests.txt`

## Evidence
Screenshots / trace: `docs/evidence/<feature>/<task-id>/` (QA report: `REPORT.md`)

## New dependencies
none | `<pkg>` — reason

## Out of scope / follow-ups
-

## Checklist
- [ ] Tests written before code and fail without the change
- [ ] `pnpm lint && pnpm typecheck` clean
- [ ] Migrations committed (if any)
- [ ] No secrets in diff
- [ ] Diff ≤ ~400 LOC (else explain why it can't be split)
