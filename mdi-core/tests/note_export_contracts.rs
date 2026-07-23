//! Contract tests for note's text-editor paste format.
//!
//! The platform-owned references are:
//! - Markdown shortcuts: https://www.help-note.com/hc/ja/articles/4410617032217
//! - Ruby notation: https://www.help-note.com/hc/ja/articles/4406430353817
//! - Math notation: https://www.help-note.com/hc/ja/articles/4410665086873
//! - Editor capabilities: https://www.help-note.com/hc/ja/articles/360012426133
//!
//! UI-only features such as alignment, image upload/captions, quote sources,
//! files, and embeds have no faithful plain-text representation and are not
//! claimed by this exporter.

use mdi_core::{TextFormat, render_text_format};

fn render(source: &str) -> String {
    render_text_format(source, TextFormat::Note, "")
}

#[test]
fn note_is_a_stable_core_text_format_name() {
    assert_eq!(TextFormat::parse("note"), Some(TextFormat::Note));
}

#[test]
fn note_emits_documented_heading_style_and_ruby_input_sequences() {
    let source = concat!(
        "# **大見出し**\n\n",
        "## 小見出し\n\n",
        "#### 深い見出し\n\n",
        "**太字**、~~取消~~、*斜体*、",
        "{東京|とう.きょう}、**{記事|き.じ}**"
    );
    assert_eq!(
        render(source),
        concat!(
            "## 大見出し\n\n",
            "### 小見出し\n\n",
            "### 深い見出し\n\n",
            "**太字** 、~~取消~~ 、斜体、",
            "｜東京《とうきょう》、**｜記事《きじ》** "
        )
    );
}

#[test]
fn note_keeps_lists_readable_with_visual_nesting_clamped_to_note_depth() {
    let source = concat!(
        "> 引用一[[br]]引用二\n\n",
        "1. 親一\n",
        "   - 子一\n",
        "     - 孫一\n",
        "2. 親二\n\n",
        "- 箇条一\n",
        "- 箇条二"
    );
    assert_eq!(
        render(source),
        concat!(
            "> 引用一\n",
            "> 引用二\n\n",
            "1. 親一\n",
            "  - 子一\n",
            "    - 孫一\n",
            "2. 親二\n\n",
            "- 箇条一\n",
            "- 箇条二"
        )
    );
}

#[test]
fn note_preserves_code_language_mermaid_and_safe_fences() {
    let source = concat!(
        "```rust\n",
        "let value = `code`;\n",
        "```\n\n",
        "```mermaid\n",
        "graph TD\n",
        "  A --> B\n",
        "```\n\n",
        "````text\n",
        "literal ``` fence\n",
        "````\n\n",
        "````mermaid\n",
        "graph TD\n",
        "  A[```] --> B\n",
        "````"
    );
    assert_eq!(
        render(source),
        concat!(
            "```rust\n",
            "let value = `code`;\n",
            "```\n\n",
            "```mermaid\n",
            "graph TD\n",
            "  A --> B\n",
            "```\n\n",
            "````text\n",
            "literal ``` fence\n",
            "````\n\n",
            "````\n",
            "graph TD\n",
            "  A[```] --> B\n",
            "````"
        )
    );
}

#[test]
fn note_keeps_links_images_tables_and_footnotes_readable_without_data_loss() {
    let source = concat!(
        "[公式](https://note.com/info \"note\") ",
        "![代替テキスト](https://example.test/image.png)\n\n",
        "https://www.youtube.com/watch?v=example\n\n",
        "| 名前 | 値 |\n",
        "| --- | --- |\n",
        "| 東京 | 12 |\n\n",
        "本文[^n]\n\n",
        "[^n]: 注の本文"
    );
    assert_eq!(
        render(source),
        concat!(
            "公式 (https://note.com/info) — note ",
            "画像: 代替テキスト (https://example.test/image.png)\n\n",
            "https://www.youtube.com/watch?v=example\n\n",
            "名前\t値\n",
            "東京\t12\n\n",
            "本文［注1］\n\n",
            "---\n\n",
            "注\n",
            "1. 注の本文"
        )
    );
}

#[test]
fn note_maps_dividers_and_degrades_mdi_only_presentation_syntax() {
    let source = concat!(
        "[[indent:2]]\n",
        "[[em:強調]][[warichu:割注]][[no-break:離さない]]",
        "[[kern:1em:字間]] ^12^\n\n",
        "[[bottom]]\n",
        "右寄せ意図\n\n",
        "[[pagebreak]]\n\n",
        "---"
    );
    // The first `---` is only a readable visual boundary for MDI pagebreak;
    // note has no plain-text pagination contract.  The second is the source
    // thematic break, which note officially supports as a divider.
    // Likewise, `bottom` keeps its text but cannot carry note's UI-only
    // right-alignment state through a plain-text paste.
    assert_eq!(
        render(source),
        concat!(
            "　　強調割注離さない字間 12\n\n",
            "右寄せ意図\n\n",
            "---\n\n",
            "---"
        )
    );
}

#[test]
fn note_preserves_literals_without_inventing_an_unsupported_escape_syntax() {
    let source = concat!(
        r"\*\*literal bold\*\* and \~\~literal delete\~\~",
        "\n\n",
        "literal |parent《reading》 and ｜親《よみ》\n\n",
        "inline $${x * y}$$ remains\n\n",
        "$$\n",
        "x * y\n",
        "$$"
    );
    assert_eq!(
        render(source),
        concat!(
            "**literal bold** and ~~literal delete~~",
            "\n\n",
            "literal |parent《reading》 and ｜親《よみ》",
            "\n\n",
            "inline $${x * y}$$ remains\n\n",
            "$$\n",
            "x * y\n",
            "$$"
        )
    );
}

#[test]
fn note_degrades_inline_code_and_readably_wraps_raw_html() {
    assert_eq!(
        render("`` value with ` tick ``\n\n<section>raw</section>"),
        concat!(
            "value with ` tick\n\n",
            "```html\n",
            "<section>raw</section>\n",
            "```"
        )
    );
}

#[test]
fn note_degrades_unrepresentable_ruby_to_readable_base_text() {
    assert_eq!(render("{親文字|よ《み}"), "親文字");
    assert_eq!(render("{親|}"), "親");
}
