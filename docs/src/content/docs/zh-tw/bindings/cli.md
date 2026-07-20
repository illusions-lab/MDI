---
title: CLI
description: "@illusions-lab/mdi-cli：安裝、每個 flag、每種輸出的實際行為與錯誤訊息。"
---

**先備知識：**[快速開始](/zh-tw/guides/getting-started/)。

## 這個綁定解決什麼

有一份 `.mdi` 並想得到 HTML、PDF、EPUB、DOCX 或五種純文字慣例時，使用 `mdi build`，不需寫程式。它呼叫所有其他 binding 共用的 Rust functions；除了決定副檔名與將 bytes 寫入磁碟外，沒有自己的 rendering logic。

## 安裝

```bash
npm install --global @illusions-lab/mdi-cli
```

它安裝一個 binary `mdi`，只有 `build` subcommand。今日沒有獨立 `help`/`version`；沒有參數或未知 `--to` 都印出下列 usage 並以 status `1` 結束。

## 所有 command 與 flag

```text
mdi build <input.mdi> --to html|pdf|epub|docx|txt|txt-ruby|narou|kakuyomu|aozora|txt-all [--config export.json] [-o <output>]
```

| Flag | 必填 | 含義 |
| --- | --- | --- |
| `<input.mdi>` | 是 | source file path，以 UTF-8 讀取。 |
| `--to <format>` | 是 | 下列十種 format 之一。 |
| `-o <path>` | 否 | output path；省略時由 input path 推導。不可與 `txt-all` 一起使用。 |
| `--config <path>` | 否 | [export-profile](/zh-tw/ecosystem/export-profiles/) JSON file path。 |

## 最小可執行範例

```bash
echo '{東京|とうきょう}は雨だった。' > novel.mdi
mdi build novel.mdi --to html
```

```text
Written /home/you/novel.html
```

## Output formats，一次一種

| `--to` | 預設 output（無 `-o`） | Renderer |
| --- | --- | --- |
| `html` | `novel.html` | `renderHtml`（Rust） |
| `pdf` | `novel.pdf` | `renderHtml`（Rust）+ Chromium `printToPDF` |
| `epub` | `novel.epub` | `renderEpub`（Rust） |
| `docx` | `novel.docx` | `renderDocx`（Rust） |
| `txt` | `novel.txt` | `renderTextFormat(..., "txt")`（Rust）；捨棄 ruby |
| `txt-ruby` | `novel_ruby.txt` | 保留 `{base\|reading}` |
| `narou` | `novel_narou.txt` | 小說家になろう投稿記法 |
| `kakuyomu` | `novel_kakuyomu.txt` | カクヨム投稿記法 |
| `aozora` | `novel_aozora.txt`，**Shift_JIS encoding** | 青空文庫 annotation 記法 |
| `txt-all` | 寫入以上六個 text files；拒絕 `-o` | — |

HTML、每個 text format、EPUB、DOCX 都由 Rust core **直接**轉譯，CLI 不會在 `renderX(source)` 與 `fs.writeFile` 間重新解析或改變含義。PDF 唯一多一步：將同一份 Rust HTML 交給 `@illusions-lab/mdi-to-pdf`，其啟動本機 Chromium-family browser；Chromium 永遠不接收 `.mdi` source，見[轉譯模型](/zh-tw/core/rendering/#chromiumpdf-邊界)。

## Text formats

```bash
mdi build novel.mdi --to txt-ruby
mdi build novel.mdi --to aozora
mdi build novel.mdi --to txt-all
```

`txt-all` 每個 file 印一行，共六行。每個 MDI construct 的精確 mapping 見[TXT export flavors](/zh-tw/syntax/reference/#txt-匯出風格)。

## 使用 export profile

```bash
mdi build novel.mdi --to pdf --config novel.export.json -o dist/novel.pdf
```

`--config` 目前影響 PDF page geometry/fonts 與 text formats 的 indentation；EPUB/DOCX 今日刻意只使用 front-matter metadata，見[export profiles](/zh-tw/ecosystem/export-profiles/)。對尚未消費 config 的 format 傳入它不會報錯，只是不套用。

## Error handling 與 exit codes

CLI 絕不印 stack trace。任何失敗都只寫 **一行** stderr 並以 status `1` 結束；未知 `--to`、缺 required flag 或其他 malformed arguments 都印 usage，而非猜測。成功 status 為 `0`，stdout 對每個輸出 file 印 `Written <path>`。

```text
--to txt-all does not accept -o; it writes all text formats next to the input file
```

## 目前實作狀態

所有 format 均真實存在，直接由表中 Rust functions 支援；不再透過另一套 JavaScript renderer 或 `remark`/`micromark` pass。EPUB/DOCX 尚未套用除 front matter 外的 export-profile 設定；PDF 要求執行 CLI 的機器已安裝 Chromium-family browser，詳見[轉譯模型](/zh-tw/core/rendering/#chromiumpdf-邊界)。

## 此綁定不做什麼

- **沒有 watch mode、server 或 interactive editor。**`mdi build` 執行一次即結束。
- **沒有 batch/glob input。**一次一個 `<input.mdi>`；大量轉換請在 shell 寫 loop。
- **沒有自己的 syntax authority。**CLI 從未有獨立 MDI tokenizer；轉換有誤應檢查 `mdi-core` 或個別 renderer。

## 下一步

- [Export profiles](/zh-tw/ecosystem/export-profiles/)
- [轉譯模型](/zh-tw/core/rendering/)
- [JavaScript / TypeScript](/zh-tw/bindings/javascript/)
