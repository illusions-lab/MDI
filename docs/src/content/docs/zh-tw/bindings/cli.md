---
title: CLI
description: 從 shell 匯出 .mdi，並以一份 export profile 控制 EPUB、DOCX、PDF 與文字輸出。
---

**先備知識：**[快速開始](/zh-tw/guides/getting-started/)、[export profiles](/zh-tw/ecosystem/export-profiles/)。

## 安裝與 build

```bash
npm install --global @illusions-lab/mdi-cli
mdi novel.mdi
mdi build novel.mdi --to epub --config novel.export.json -o dist/novel.epub
mdi check novel.mdi
mdi update --check
```

```text
mdi <input.mdi> [--to <format>] [--config export.json] [-o <output>]
mdi build <input.mdi> [--to <format>] [--config export.json] [-o <output>]
mdi check <input.mdi>
mdi update [--check] [--yes]
```

input 為 UTF-8。`--to` 可省略，預設為 HTML；若沒有 `--to`，也可由 `-o`
的 `.html`、`.json`、`.pdf`、`.epub`、`.docx` 或 `.txt` 副檔名推斷格式。
明確 format 與副檔名衝突時會報錯。`txt-all` 不可搭配 `-o`；`--config` 是
[export profile](/zh-tw/ecosystem/export-profiles/) JSON。成功輸出 `Written <path>`
並以 status `0` 結束；argument/input/profile/renderer/output failure 會在 stderr
寫一行並以 status `1` 結束。

`mdi check` 會解析文件並輸出 parser diagnostics：warning 仍回傳 `0`，error
diagnostic 回傳 `1`。`mdi --version`/`--help` 顯示版本或完整說明；
`mdi update --check` 只檢查，`mdi update --yes` 直接更新。一般執行會在背景以
每日快取檢查 npm registry；檢查失敗不影響原命令。CI 可設定
`MDI_NO_UPDATE_CHECK=1` 關閉提示。

## 每種 format 的設定

| `--to` | 預設 | renderer 與 profile |
| --- | --- | --- |
| `json` | `novel.json` | 輸出包含 parser diagnostics 的 versioned MDI IR envelope，使用美化 JSON。 |
| `html` | `novel.html` | Rust semantic standalone HTML；不使用 page profile。 |
| `pdf` | `novel.pdf` | Rust HTML + local Chromium；使用 print profile。 |
| `epub` | `novel.epub` | 無 config 為 Rust baseline；有 config 則用 metadata/type/chapter/cover。 |
| `docx` | `novel.docx` | 無 config 為 Rust baseline；有 config 則用 metadata/page/type/numbering。 |
| 六種 text | 對應 `.txt` | Rust text；`note` 是 UTF-8 編輯器輸入（見 [note 匯出](/zh-tw/ecosystem/note/)）；profile 控制 indent。`aozora` 使用 Shift_JIS、CRLF；範圍外字元會報錯，不會寫成 `?`。 |
| `txt-all` | 6 files | 輸出全部 text，拒絕 `-o`。 |

CLI 以 profile file 為基準讀取 `epub.coverPath`，只接受 PNG/JPEG；cover bytes 只放進 EPUB，不傳給 parser。`--config` 不再被 EPUB/DOCX 靜默忽略。

沒有 `--config` 時，CLI 依 front matter 選擇 built-in layout：`writing-mode: vertical` 使用 `japanese-publisher` 的 A4 landscape、右裝訂 40×30 小說原稿 grid；其他文件使用 `word` 的流動 A4 layout。只有明確提供的 `--config` 必須包含 `layout.system`。

## profile 範例

```json
{
  "layout": { "system": "japanese-publisher" },
  "metadata": { "title": "雨の東京", "author": "Illusions", "language": "ja" },
  "typesetting": { "writingMode": "vertical", "fontFamily": "Yu Mincho", "fontSize": 10, "textIndentEm": 1 },
  "pagination": { "pageSize": "A4", "landscape": true, "gridMode": "strict", "pageNumbers": { "enabled": true, "position": "bottom-center", "format": "simple" } },
  "epub": { "chapterSplitLevel": "h1", "coverPath": "cover.png" }
}
```

明確提供的 `--config` 必須含有 `layout.system`，缺少時 profile 會被拒絕。`"japanese-publisher"` 是書籍 system：橫書預設為 `Shirokuban`/10 pt 明朝體、鏡像左裝訂 27×26 strict grid；直書預設為 A4 landscape 小說原稿、鏡像右裝訂 40×30 strict grid。`"word"` 是另一個流動 system：A4、四邊 25.4 mm、無鏡像、`gridMode: "typographic"`，不能使用 strict grid。

MDI parse、diagnostic、span、profile validation、紙張目錄與設定型 EPUB/DOCX generation 都由 Rust 負責。PDF 的 print HTML 與 geometry 也由 Rust 準備，host 只提供 machine-specific Chromium process。Chromium 收到的是完成 HTML，不是 `.mdi`。DOCX 支援 page/type/numbering，卻不保證 ruby、tate-chu-yoko、禁則/不換行、kern、blank paragraph 與 browser 排版像素一致，請在目標 reader 驗證。
