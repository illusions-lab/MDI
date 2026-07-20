---
title: エクスポートプロファイル
description: 出力時のページ設定、フォント、字下げを指定する JSON 設定
---

エクスポートプロファイルは、ページサイズ、フォント、余白、字下げなどの**表示設定**を指定する。MDI の構文や文書の意味を変更するものではない。パッケージは `@illusions-lab/mdi-export-profile` である。

## 設定例

```json
{
  "metadata": { "title": "The Last Station", "author": "A Writer" },
  "typesetting": {
    "writingMode": "horizontal",
    "fontFamily": "Noto Serif JP",
    "textIndentEm": 1
  },
  "pagination": {
    "pageSize": "A4",
    "landscape": false,
    "charactersPerLine": 40,
    "linesPerPage": 34,
    "margins": { "top": 25.4, "bottom": 25.4, "left": 25.4, "right": 25.4 }
  },
  "text": { "fullwidthSpaceIndent": true, "indentCount": 1 }
}
```

すべての項目は任意であり、未指定の項目には既定値が適用される。不正な値は補正されず、対象フィールド名を含むエラーとなる。

```bash
mdi build novel.mdi --to pdf --config novel.export.json -o novel.pdf
```

`writingMode` は `horizontal` または `vertical`、`textIndentEm` は 0〜4、`pageSize` は `PAGE_DIMENSIONS` のキーを指定する。余白の単位は mm である。

## 出力形式ごとの対応状況

| 設定 | PDF | テキスト | EPUB / DOCX |
| --- | --- | --- | --- |
| ページ設定・フォント | 対応 | 非対応 | 未対応の項目あり |
| front matter のメタデータ・書字方向 | 対応 | 非対応 | 対応（プロファイルからは未対応） |
| 全角空白による字下げ | 対応 | 対応 | 未対応 |
| カバー・章分割 | 非対応 | 非対応 | 未対応 |

## 次のステップ

- [CLI](/ja/bindings/cli/) — `--config` を指定して出力する。
- [出力形式](/ja/ecosystem/outputs/) — 形式ごとの制限を確認する。
