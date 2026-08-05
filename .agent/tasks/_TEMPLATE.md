# T<NN> — <Title>

| Field | Value |
|---|---|
| **Status** | pending |
| **Phase** | 0 \| 1 |
| **Cluster** | <cluster id> |
| **Blocked by** | T<NN>, … (or —) |
| **Blocks** | T<NN>, … (or —) |
| **Spec** | ARCHITECTURE §<n>, §<n> |
| **PRD** | F<n>, N<n>, D<n> (or —) |

## Goal

One paragraph, present tense: what exists when this task is done that did not exist
before. Name the artifact, not the activity. A reader who knows nothing about the
project should be able to tell whether the task is finished by reading this alone.

## Why this shape

Two to four sentences of architectural reasoning, drawn from the spec, explaining why
the deliverable takes the form it does rather than an obvious alternative. This is the
section that stops an implementer "improving" the design into something the rest of the
system cannot use. Cite the decision record (D-NN) where one exists.

## Scope

**In scope**

- Bulleted, concrete, each item traceable to a spec section.

**Out of scope**

- What a reasonable implementer might assume belongs here but does not, and where it
  lives instead (task id or phase). Being explicit here is what keeps the tasks from
  overlapping.

## Deliverables

Files created or modified, with real repository paths from ARCHITECTURE §4.2.

```
path/to/file.ts          what it holds
path/to/other.test.ts    what it proves
```

## Interface contract

The exact types, signatures, schemas, or CLI surface this task must expose, copied from
the spec rather than paraphrased. Downstream tasks are written against this block, so it
is normative. Omit the section only if the task exposes no interface (docs, CI config).

```ts
// verbatim from ARCHITECTURE §<n>
```

## Acceptance criteria

Testable statements, checkbox form. Each must be verifiable by running something or
reading a specific file — never "works correctly" or "is well tested". Aim for the
smallest set that, all true, means the task is genuinely done.

- [ ] …
- [ ] …

## Verification

The commands a reviewer runs, and what passing looks like.

```bash
npm run …
```

## Notes and hazards

Known risks by identifier (R-NN), spec caveats, version traps, and anything the
architecture flags as an accepted trade-off that an implementer might otherwise try to
fix. Keep it short; this is not a place for speculation.
