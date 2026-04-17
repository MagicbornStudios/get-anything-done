---
id: context-engineering-snapshot-compaction-01
title: Kill the XML wrappers
category: context-engineering
difficulty: intermediate
tags: [snapshot, tokens, compaction, xml]
source: static
date: 2026-04-17
---

# Kill the XML wrappers

The GAD snapshot used to dump raw STATE.xml verbatim. Something like:

```xml
<references>
  <reference>path/to/fileA</reference>
  <reference>path/to/fileB</reference>
  <reference>path/to/fileC</reference>
</references>
```

Each `<reference>...</reference>` pair wraps ~60 chars of actual path in ~23 chars of presentation. On 37 references: **~850 bytes of pure tag overhead** per snapshot, repeated every time `gad snapshot` fires.

## The rewrite

```
refs:
- path/to/fileA
- path/to/fileB
- path/to/fileC
```

Same information. Every wrapper dropped. Measured on `get-anything-done`: **26,261 chars → 22,814 chars (-13%, ~860 tokens saved per call)**.

## The principle

XML structure is valuable when it carries real semantic information (attributes, nesting, multiple properties per element). It's wasteful when the payload is a flat scalar array.

| Use XML when | Use a flat list when |
|---|---|
| Multiple attributes per item | Single scalar per item |
| Nested structure | Flat sequence |
| Type discrimination in same list | Homogeneous type |
| Downstream parser expects it | Downstream is a human or LLM |

## When you design for LLM reading

Presentation tokens (opening tags, closing tags, XML prolog) cost real money on every read. They don't help the model — the model extracts meaning from content, not from angle brackets. If the structure doesn't add information, remove it.

The one exception: if an existing skill or script greps for `<next-action>` or similar, keep the wrapper OR provide an `--format=xml` escape hatch. GAD kept the escape hatch.

## Takeaway

Before shipping any context-dumping pipeline: grep it for closing tags. Count the characters in tags vs content. If tags are more than ~10% of bytes, you're paying for presentation, not information.
