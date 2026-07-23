---
title: note 書き出し
description: "`--to note` が保持できる内容と、note の UI 操作が必要な内容。"
---

`mdi build manuscript.mdi --to note` は UTF-8 の
`manuscript_note.txt` を生成します。これは標準 Markdown や `.note`
ファイルではなく、**note エディタ入力用 profile** です。
`--to txt-all` にも、この6番目の text flavor が含まれます。

note 公式は Markdown 表記を import format ではなく editor shortcut と
説明しています。末尾の空白や Return が必要なものがあり、upload や
toolbar-only property は plain text にできません。一方ルビは
`｜親文字《よみ》` を下書き保存・公開時に反映し、全角・半角の縦線を
受け付けます。

note の Import 画面が受け付けるのは WXR（WordPress XML）と MT text
であり、このファイルではありません。文書全体の貼り付けは公式の
Markdown import ではないため、shortcut が反映されない箇所では trigger
と後続の空白／Return を入力し直してください。

## text 表現

| 入力 | note 出力 | 契約 |
| --- | --- | --- |
| H1 | `## 見出し` | note の大見出し |
| H2–H6 | `### 見出し` | note は大・小の2階層 |
| strong / GFM delete | `**太字** ` / `~~取消~~ ` | 末尾の半角空白までが公式の activation input |
| ordered / unordered list | `1. item` / `- item` | 可読な字下げを保持。実際の階層は note で Tab／Shift+Tab を使う |
| blockquote | `> 引用` | 専用の出典欄は text で設定できない |
| code block | source label 付き fence | diagram 契約があるのは正確な triple-backtick `mermaid` のみ |
| thematic break | `---` | 区切り線 shortcut |
| MDI ruby | `｜親文字《よみ》` | note native ruby |
| 本文内の note TeX | `$${...}$$` / `$$` block | 保持。note が inline TeX を許可しない見出し・引用では中身へ flatten |
| bare URL | bare URL | readable source。embed は空段落へ URL を単独で貼り、必要なら Enter |
| link / image | `label (URL)` / `画像: alt (URL)` | readable fallback |
| footnote | 本文番号 + 文末注 | note に footnote block はない |
| table | tab-separated text | note に table block はない |

縦中横、傍点、割注、kerning、no-break、page break、task checkbox、
italic、inline code、raw HTML には公式の対応表現がありません。本文を
残し、未対応の装飾・組版指定だけを落とします。MDI page break は視覚的な
`---` に変換され、pagination semantics は失われます。

note は shortcut や ruby delimiter の backslash escape を文書化して
いません。未定義の escape で通常の記号を汚さず literal text をそのまま
保持するため、note 記法と同じ literal sequence は lossless に表現できません。

## capability・platform property 対応

| note 機能 | text 書き出し |
| --- | --- |
| 段落、改行、2階層見出し、太字、取消線、list、引用、code、区切り線 | shortcut input sequence を出力。bulk paste での activation は保証しない |
| nested list | 可読な字下げを保持。実階層は Tab／Shift+Tab 等で最大5階層 |
| ルビ | native notation を保持。太字／link の選択範囲は `｜親文字《よみ》` 全体を含める |
| inline/display TeX | 対応する本文 context で native notation を保持。見出し・code・引用では inline 不可。KaTeX/iOS に追加制限あり |
| Mermaid | exact triple-backtick `mermaid` を保持。fence collision は readable code へ degrade |
| 文字リンク | label と URL を保持。文字列への link 適用は UI |
| 中央寄せ・右寄せ | 内容のみ保持。配置は UI |
| 引用元と引用元 URL | 引用本文のみ自動。専用欄は UI |
| 目次 | heading を保持。目次の挿入・有効化は UI |
| 本文画像、ALT、画像説明、size、画像 link | alt と URL を保持。upload と属性は UI |
| 見出し画像・title field | body text 外。公開 UI で設定 |
| file、native audio、comic upload | text では表現不可 |
| 外部 video/music/audio/SNS/article/design/business/form/map/shopping/event/development/comic/game/crowdfunding/recruiting/news/recipe/その他 embed | bare URL を保持。空段落への単独 paste／Enter、provider permission、`notebot` access に依存 |
| 日米株価 shortcut / note Money URL | literal を保持。notation は Web のみ、Return 必須、6か月固定。ETF／REIT／投資信託／指数は notation 非対応 |
| hashtag、価格、有料試し読み line、公開状態、comment／スキ等 | body text 外。note の公開 UI で設定 |
| note Import／Export | `--to note` は WXR/MT ではなく Import 不可。note 自身の export は WXR ZIP + assets |

## 確認方法

新規 note 記事の本文へ UTF-8 出力を貼ります。貼り付けは text 保持の
確認であり shortcut activation の証明ではありません。literal のままの
block は marker と空白／Return を入力し直し、nested list は Tab／Shift+Tab
で設定します。embed URL は空段落へ単独で貼り、必要なら Enter を押します。
下書き保存後にルビを確認し、画像 upload、配置、画像説明、引用元、目次、
公開 metadata は UI で仕上げます。

公式資料：

- [エディタでできること](https://www.help-note.com/hc/ja/articles/360012426133-%E3%82%A8%E3%83%87%E3%82%A3%E3%82%BF-%E8%A8%98%E4%BA%8B%E7%B7%A8%E9%9B%86%E7%94%BB%E9%9D%A2-%E3%81%A7%E3%81%A7%E3%81%8D%E3%82%8B%E3%81%93%E3%81%A8)
- [Markdown shortcut](https://www.help-note.com/hc/ja/articles/4410617032217-Markdown%E3%82%B7%E3%83%A7%E3%83%BC%E3%83%88%E3%82%AB%E3%83%83%E3%83%88)
- [list 階層](https://www.help-note.com/hc/ja/articles/4410433722777-%E7%AE%87%E6%9D%A1%E6%9B%B8%E3%81%8D-%E7%95%AA%E5%8F%B7%E4%BB%98%E3%81%8D%E3%83%AA%E3%82%B9%E3%83%88%E3%81%AB%E3%81%99%E3%82%8B)
- [ルビ](https://www.help-note.com/hc/ja/articles/4406430353817-%E3%83%AB%E3%83%93-%E3%81%B5%E3%82%8A%E3%81%8C%E3%81%AA-%E3%82%92%E3%81%B5%E3%82%8B)
- [数式](https://www.help-note.com/hc/ja/articles/4410665086873-%E6%95%B0%E5%BC%8F%E8%A8%98%E6%B3%95%E3%81%AE%E4%BD%BF%E3%81%84%E6%96%B9)
- [Mermaid](https://www.help-note.com/hc/ja/articles/25858251439513-Mermaid%E3%82%92%E4%BD%BF%E3%81%A3%E3%81%A6%E3%83%80%E3%82%A4%E3%82%A2%E3%82%B0%E3%83%A9%E3%83%A0%E3%82%92%E4%BD%9C%E6%88%90%E3%81%99%E3%82%8B)
- [embed service 一覧](https://www.help-note.com/hc/ja/articles/360019596133-%E3%83%86%E3%82%AD%E3%82%B9%E3%83%88%E8%A8%98%E4%BA%8B%E3%81%AB%E5%9F%8B%E3%82%81%E8%BE%BC%E3%81%BF%E3%81%A7%E3%81%8D%E3%82%8B%E3%82%B5%E3%83%BC%E3%83%93%E3%82%B9%E4%B8%80%E8%A6%A7)
- [Import 仕様](https://www.help-note.com/hc/ja/articles/16143759138329-%E3%82%A4%E3%83%B3%E3%83%9D%E3%83%BC%E3%83%88%E6%A9%9F%E8%83%BD%E3%81%AE%E4%BB%95%E6%A7%98)
- [Export 仕様](https://www.help-note.com/hc/ja/articles/16143457500953-%E3%82%A8%E3%82%AF%E3%82%B9%E3%83%9D%E3%83%BC%E3%83%88%E6%A9%9F%E8%83%BD%E3%81%AE%E4%BB%95%E6%A7%98)
- [株価 chart](https://www.help-note.com/hc/ja/articles/43881079418137-%E8%A8%98%E4%BA%8B%E3%81%AB%E6%A0%AA%E4%BE%A1%E3%83%81%E3%83%A3%E3%83%BC%E3%83%88%E3%82%92%E5%9F%8B%E3%82%81%E8%BE%BC%E3%82%81%E3%82%8B%E6%A9%9F%E8%83%BD%E3%81%AB%E3%81%A4%E3%81%84%E3%81%A6)
