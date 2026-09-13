---
title: Editorial comments in MDI 2.1
description: Editorial comments in MDI 2.1
---

MDI 2.1 recognizes `<!-- note -->` in all documents, including declared 2.0 and unversioned source. Comments can be empty, multiline or Unicode; the nearest `-->` closes them and their contents are not interpreted. Code, front matter, link destinations and plain-text MDI parameters remain literal. Escape an opener as `\<!--`.

Source saving retains comments. Default parse/prepare/mdast APIs omit them with IR 1.0; `{ includeComments: true }` returns positional `comment` nodes and IR 1.1. Both report syntax 2.1. Existing front-matter declarations are retained. Public body projections and layout exclude comments even with an inclusive tree, and their source-map runs preserve the gaps.

Every publication format always omits valid comments. This intentionally changes old 2.0 output that displayed them as HTML text. Unterminated comments remain literal and return `mdi.comment.unterminated`: export is allowed, so intended private text may be visible.

Use source serialization or an inclusive IR for lossless comment retention. A filtered external IR cannot restore omitted comments.

```mdi
Before<!-- editorial note -->after
```
