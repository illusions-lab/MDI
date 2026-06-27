# illusion Markdown — MDI

**illusion Markdown (`.mdi`)** is a Markdown extension format designed for Japanese typography.  
It inherits all standard Markdown syntax and adds a minimal set of extensions to express ruby, tate-chu-yoko, no-break, line breaks, and kerning — things that are difficult or verbose in plain Markdown.

**illusion Markdown (`.mdi`)** は日本語組版のための Markdown 拡張フォーマットです。  
標準 Markdown の構文をすべて継承しつつ、ルビ・縦中横・改行抑止・改行マーカー・字間調整など、プレーンな Markdown では表現しにくい要素を簡潔な記法で補います。

---

## Documentation / ドキュメント

| Document | 内容 |
|----------|------|
| **[SYNTAX.md](./SYNTAX.md)** | **Full MDI syntax reference / MDI 構文リファレンス（英日双語）** |

The syntax reference covers every MDI extension with examples, HTML output, and CSS hooks.  
All standard Markdown features (headings, lists, links, tables, code blocks, etc.) are inherited from CommonMark and are not re-documented here.

構文リファレンスは、全 MDI 拡張の例・HTML 出力・CSS クラスを英日双語で解説しています。  
見出し・リスト・リンク・表・コードブロックなど標準 Markdown 機能は CommonMark をそのまま継承します。

---

## At a Glance / 構文一覧

| Feature | Syntax | Example |
|---------|--------|---------|
| **Ruby** ルビ | `{base\|ruby}` | `{東京\|とうきょう}` |
| **Ruby (split)** 分割ルビ | `{base\|r.u.by}` | `{東京\|とう.きょう}` |
| **Tate-chu-yoko** 縦中横 | `^text^` | `第^12^話` |
| **No-break** 改行抑止 | `[[no-break:text]]` | `[[no-break:新宿区]]` |
| **Line break** 改行 | `[[br]]` | `曙。[[br]]やうやう` |
| **Blank paragraph** 空白段落 | `[[blank]]` | `[[blank]]` |
| **Kerning** 字間調整 | `[[kern:<em>:text]]` | `[[kern:-0.1em:言葉]]` |

---

## Key Features / 主な特徴

- **Japanese typography out of the box** — ruby, tate-chu-yoko, no-break, kerning without HTML tags.  
  ルビ・縦中横・改行抑止・字間調整を HTML タグなしで記述できます。
- **Fully compatible with standard Markdown** — headings, lists, links, tables work as-is.  
  見出し・リスト・リンク・表はそのまま使えます。
- **Semantic, CSS-driven rendering** — MDI provides annotation; appearance is controlled by CSS.  
  MDI は意味的なアノテーションのみを担い、見た目は CSS に委ねます。

---

## Ideal Use Cases / 活用シーン

- **Novels and scenarios / 小説・シナリオ** — ruby and line-break control for literary Japanese.
- **Blogs and articles / ブログ・記事** — readable Japanese web layout with proper typography.
- **Manuals and specs / マニュアル・仕様書** — structured Japanese technical documents.

---

*MDI is developed as part of the [illusions](https://github.com/Iktahana/illusions) project.*

<div align="right">
  <a href="https://www.art.nihon-u.ac.jp/education/department/literature/">
    <img src="https://raw.githubusercontent.com/illusions-lab/.github/44b758b310ab3f16a6f11fd3b3b7eb583a9244cc/images/NUArt_colored.svg" height="64" alt="日本大学芸術学部">
  </a>
</div>
