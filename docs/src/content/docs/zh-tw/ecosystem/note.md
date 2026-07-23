---
title: note 匯出
description: "`--to note` 能保留的內容、必須在 note UI 完成的內容，以及貼上驗證方式。"
---

`mdi build manuscript.mdi --to note` 會產生 UTF-8 的
`manuscript_note.txt`。它是 **note 編輯器輸入 profile**，不是標準
Markdown，也不是 `.note` 檔案。`--to txt-all` 會包含這第六種文字格式。

note 官方將 Markdown 寫法定義為編輯器快捷方式，而不是匯入格式；部分
寫法需要接著輸入空格或 Return。上傳與工具列專用屬性也無法放進純文字。
Ruby 不同：`｜親文字《讀音》` 會在儲存草稿或發布時生效，而且全形、
半形縱線都可以使用。

note 的 Import 畫面只接受 WXR（WordPress XML）與 MT text，不接受這個
檔案。整篇貼上並不是官方保證的 Markdown import；若 shortcut 沒有啟動，
需要重新輸入 trigger 及其後的空格／Return。

## 文字表示

| MDI / Markdown 輸入 | note 輸出 | 契約 |
| --- | --- | --- |
| H1 | `## 標題` | note 大標題 |
| H2–H6 | `### 標題` | note 只有大小兩級標題 |
| strong / GFM delete | `**粗體** ` / `~~刪除線~~ ` | 尾端半形空格是官方 activation input 的一部分 |
| 有序／無序清單 | `1. item` / `- item` | 保留可讀縮排；真正巢狀需在 note 用 Tab／Shift+Tab |
| blockquote | `> 引用` | 引用來源專用欄位無純文字語法 |
| code block | 保留 source label 的 fenced code | 只有精確 triple-backtick `mermaid` 有官方 diagram 契約 |
| thematic break | `---` | note 分隔線 shortcut |
| MDI ruby | `｜親文字《讀音》` | note 原生 ruby |
| 正文已有的 note TeX | `$${...}$$` / `$$` block | 保留；note 不允許 inline TeX 的標題／引用會降級成內容 |
| bare URL | bare URL | 可讀來源；embed 需把 URL 單獨貼到空段落，必要時按 Enter |
| link / image | `label (URL)` / `圖片: alt (URL)` | 可讀降級 |
| footnote | 內文編號 + 文末注 | note 沒有 footnote block |
| table | tab-separated text | note 沒有 table block |

縱中橫、傍點、割注、kerning、no-break、page break、task checkbox、
italic、inline code 與 raw HTML 沒有 note 官方對應表示。匯出器保留可讀
內容，只移除不支援的樣式。MDI page break 會替換成視覺 `---`，因此不保留
分頁語意。

note 沒有文件化 shortcut 或 ruby delimiter 的 backslash escape。匯出器
不會發明 escape 來污染一般標點；與 note 記法相同的 literal sequence
因此無法在這個純文字 profile 中 lossless 表示。

## 能力與平台屬性對照

| note 能力 | 文字匯出狀態 |
| --- | --- |
| 段落、換行、兩級標題、粗體、刪除線、清單、引用、code、分隔線 | 輸出 shortcut input sequence；不保證整篇貼上會自動啟動 |
| 巢狀清單 | 保留可讀縮排；用 Tab／Shift+Tab 等在 UI 建立真正階層，最多五層 |
| Ruby | 保留原生記法；套用粗體／連結時選取範圍需涵蓋完整 `｜親文字《讀音》` |
| inline/display TeX | 在支援的正文 context 保留；inline 不可用於標題、code、引用，另有 KaTeX／iOS 限制 |
| Mermaid | 保留 exact triple-backtick `mermaid`；fence collision 降級成可讀 code |
| 文字連結 | 保留 label 與 URL；把連結套到選取文字仍需 UI |
| 置中／靠右 | 保留內容；對齊需 UI |
| 引用來源與來源 URL | 保留引用；專用來源欄需 UI |
| 目錄 | 保留標題；插入／啟用目錄需 UI |
| 本文圖片、ALT、圖片說明、尺寸、圖片連結 | 保留 alt 與 URL；上傳與圖片屬性需 UI |
| 封面圖與標題欄 | 不屬於正文；從 front matter 參考後在發布 UI 設定 |
| 檔案、原生音訊、comic 上傳 | 純文字無法表示 |
| 外部影片、音樂、音訊、SNS、文章、設計、商務、表單、地圖、購物、活動、開發、漫畫／遊戲、群募、招聘、新聞、食譜及其他 embed | 保留 bare URL；建立 embed 仍取決於空段落單獨貼上／Enter、provider 權限及 `notebot` 存取 |
| 日／美股價 shortcut 與 note Money URL | 保留 literal；記法只支援 Web、需要 Return、固定六個月；ETF／REIT／基金／指數不支援記法 |
| hashtag、價格、付費試讀線、發布狀態、留言／喜歡等 note 屬性 | 不屬於正文；在 note 發布 UI 設定 |
| note Import／Export | `--to note` 不是 WXR/MT，不能交給 Import；note 自身匯出是 WXR ZIP 加 assets |

外部 provider 清單會獨立更新，不應硬編成 MDI grammar；以 note 官方即時
清單為準。

## 驗證方式

在新 note 文章正文貼上 UTF-8 輸出。這只證明文字保留，不證明 shortcut
已啟動；仍為 literal 的區塊要重新輸入 marker 與空格／Return，巢狀清單
用 Tab／Shift+Tab 設定。embed URL 要單獨貼進空段落並在必要時按 Enter。
儲存草稿後驗證 Ruby；圖片上傳、對齊、圖片說明、引用來源、目錄和發布
metadata 必須在 UI 完成。

官方資料：

- [編輯器完整能力](https://www.help-note.com/hc/ja/articles/360012426133-%E3%82%A8%E3%83%87%E3%82%A3%E3%82%BF-%E8%A8%98%E4%BA%8B%E7%B7%A8%E9%9B%86%E7%94%BB%E9%9D%A2-%E3%81%A7%E3%81%A7%E3%81%8D%E3%82%8B%E3%81%93%E3%81%A8)
- [Markdown shortcuts](https://www.help-note.com/hc/ja/articles/4410617032217-Markdown%E3%82%B7%E3%83%A7%E3%83%BC%E3%83%88%E3%82%AB%E3%83%83%E3%83%88)
- [清單階層](https://www.help-note.com/hc/ja/articles/4410433722777-%E7%AE%87%E6%9D%A1%E6%9B%B8%E3%81%8D-%E7%95%AA%E5%8F%B7%E4%BB%98%E3%81%8D%E3%83%AA%E3%82%B9%E3%83%88%E3%81%AB%E3%81%99%E3%82%8B)
- [Ruby 記法](https://www.help-note.com/hc/ja/articles/4406430353817-%E3%83%AB%E3%83%93-%E3%81%B5%E3%82%8A%E3%81%8C%E3%81%AA-%E3%82%92%E3%81%B5%E3%82%8B)
- [數式記法](https://www.help-note.com/hc/ja/articles/4410665086873-%E6%95%B0%E5%BC%8F%E8%A8%98%E6%B3%95%E3%81%AE%E4%BD%BF%E3%81%84%E6%96%B9)
- [Mermaid](https://www.help-note.com/hc/ja/articles/25858251439513-Mermaid%E3%82%92%E4%BD%BF%E3%81%A3%E3%81%A6%E3%83%80%E3%82%A4%E3%82%A2%E3%82%B0%E3%83%A9%E3%83%A0%E3%82%92%E4%BD%9C%E6%88%90%E3%81%99%E3%82%8B)
- [可 embed 的服務清單](https://www.help-note.com/hc/ja/articles/360019596133-%E3%83%86%E3%82%AD%E3%82%B9%E3%83%88%E8%A8%98%E4%BA%8B%E3%81%AB%E5%9F%8B%E3%82%81%E8%BE%BC%E3%81%BF%E3%81%A7%E3%81%8D%E3%82%8B%E3%82%B5%E3%83%BC%E3%83%93%E3%82%B9%E4%B8%80%E8%A6%A7)
- [Import 規格](https://www.help-note.com/hc/ja/articles/16143759138329-%E3%82%A4%E3%83%B3%E3%83%9D%E3%83%BC%E3%83%88%E6%A9%9F%E8%83%BD%E3%81%AE%E4%BB%95%E6%A7%98)
- [Export 規格](https://www.help-note.com/hc/ja/articles/16143457500953-%E3%82%A8%E3%82%AF%E3%82%B9%E3%83%9D%E3%83%BC%E3%83%88%E6%A9%9F%E8%83%BD%E3%81%AE%E4%BB%95%E6%A7%98)
- [股價圖表](https://www.help-note.com/hc/ja/articles/43881079418137-%E8%A8%98%E4%BA%8B%E3%81%AB%E6%A0%AA%E4%BE%A1%E3%83%81%E3%83%A3%E3%83%BC%E3%83%88%E3%82%92%E5%9F%8B%E3%82%81%E8%BE%BC%E3%82%81%E3%82%8B%E6%A9%9F%E8%83%BD%E3%81%AB%E3%81%A4%E3%81%84%E3%81%A6)
