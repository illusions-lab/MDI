---
title: Export Profiles
description: Share exact PDF, DOCX, EPUB, and text export settings across applications.
---

`@illusions-lab/mdi-export-profile` is the common, validated contract for an MDI export. Keep it beside a manuscript or in an application's preferences; it is intentionally separate from MDI syntax and front matter.

```json
{
  "metadata": {
    "title": "The Last Station",
    "author": "A Writer",
    "publisher": "Example Press",
    "identifier": "isbn:9780000000000"
  },
  "typesetting": {
    "writingMode": "horizontal",
    "fontFamily": "Noto Serif JP",
    "textIndentEm": 1,
    "fullwidthSpaceIndent": false
  },
  "pagination": {
    "pageSize": "A4",
    "landscape": false,
    "charactersPerLine": 40,
    "linesPerPage": 34,
    "margins": { "top": 25, "bottom": 25, "left": 25, "right": 25 },
    "pageNumbers": {
      "enabled": true,
      "format": "simple",
      "position": "bottom-center"
    }
  },
  "epub": { "chapterSplitLevel": "h1", "coverPath": "cover.png" },
  "text": { "fullwidthSpaceIndent": true, "indentCount": 1 }
}
```

```sh
mdi build novel.mdi --to pdf --config novel.export.json -o novel.pdf
mdi build novel.mdi --to docx --config novel.export.json
mdi build novel.mdi --to epub --config novel.export.json
mdi build novel.mdi --to txt-ruby --config novel.export.json
```

The CLI resolves a relative `coverPath` against the profile file and accepts JPEG and PNG covers only. Invalid dimensions, ranges, page-number values, and chapter split levels fail clearly instead of producing a different layout.

Without a profile, PDF and DOCX use a conventional A4 portrait, horizontal layout: 25.4 mm (one-inch, matching Word's Normal preset) margins, 40 characters per line, and 34 lines per page. Front matter `writing-mode: vertical` selects vertical composition; it uses landscape A4 by default to keep the character grid readable. An explicit profile overrides either default.

## Format support

| Setting                              | PDF               | DOCX              | EPUB                                         | TXT / TXT ruby  |
| ------------------------------------ | ----------------- | ----------------- | -------------------------------------------- | --------------- |
| Paper size, orientation, margins     | Yes               | Yes               | Reflowable EPUB has no paper geometry        | —               |
| Writing direction, font, em indent   | Yes               | Yes               | Yes                                          | —               |
| Characters per line / lines per page | Yes               | Yes               | Reflowable EPUB cannot guarantee fixed pages | —               |
| Full-width-space indent              | Yes               | Yes               | CSS `em` indent only                         | Yes, 1–4 spaces |
| Page number format and position      | Yes               | Yes               | Reflowable EPUB has no stable page number    | —               |
| Title, author, publisher, identifier | Document metadata | Document metadata | OPF metadata                                 | —               |
| Cover and heading chapter split      | —                 | —                 | Yes                                          | —               |

`pageSize` supports the complete Illusions page-size collection: ISO A, JIS B, ISO B, Japanese literary/book/envelope sizes, North American office sizes, and postcard/photo sizes. Use the exported `PAGE_SIZES` list when building a UI.
