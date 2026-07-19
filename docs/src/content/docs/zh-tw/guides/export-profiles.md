---
title: 匯出設定檔
description: 在應用程式間共用精確的 PDF、DOCX、EPUB 與文字匯出設定。
---

`@illusions-lab/mdi-export-profile` 是 MDI 匯出的共用、已驗證設定契約。它刻意與 MDI 語法及 front matter 分離，可儲存為 JSON 檔或應用程式偏好設定。

```sh
mdi build novel.mdi --to pdf --config novel.export.json -o novel.pdf
mdi build novel.mdi --to docx --config novel.export.json
mdi build novel.mdi --to epub --config novel.export.json
mdi build novel.mdi --to txt-ruby --config novel.export.json
```

設定檔可以指定書名、作者、出版社、UUID/ISBN、組方向、字體、字下げ、紙張尺寸、方向、每行字數、每頁行數、邊界、頁碼、EPUB 封面與見出し切章，以及 TXT 的全形空格字下げ。相對 `coverPath` 以設定檔所在目錄為基準，且只接受 JPEG/PNG。

未指定設定檔時，PDF 與 DOCX 預設使用符合一般印刷習慣的 A4 直式、橫書、四邊 25.4 mm（與 Word「標準」同為 1 英吋）邊界、每行 40 字與每頁 34 行。front matter 有 `writing-mode: vertical` 時會改用直書；為維持可讀的字格，預設採 A4 橫式。明確指定的設定檔值優先於這些預設。

| 設定                           | PDF  | DOCX     | EPUB                      | TXT / TXT ruby |
| ------------------------------ | ---- | -------- | ------------------------- | -------------- |
| 紙張、方向、邊界、字數、行數   | 支援 | 支援     | EPUB 可重排，沒有固定紙張 | —              |
| 組方向、字體、`em` 字下げ      | 支援 | 支援     | 支援                      | —              |
| 全形空格字下げ                 | 支援 | 支援     | 使用 CSS 字下げ           | 1–4 個空格     |
| 頁碼格式與位置                 | 支援 | 支援     | 沒有穩定固定頁碼          | —              |
| 封面、出版社、識別碼、章節切分 | —    | 文件屬性 | 支援                      | —              |

不合法的紙張尺寸、邊界、頁碼設定或章節切分層級會明確報錯，不會悄悄產生不同版面。UI 可使用匯出的 `PAGE_SIZES` 建立紙張尺寸選擇器。
