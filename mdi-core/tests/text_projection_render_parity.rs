use mdi_core::{get_mdi_text_blocks, render_text};

#[test]
fn render_text_and_projection_share_every_inline_plaintext_rule() {
    let cases = [
        ("plain", "plain"),
        ("{東京|とうきょう}", "東京"),
        ("{東京|とう.きょう}", "東京"),
        ("^12^", "12"),
        ("**strong**", "strong"),
        ("*emphasis*", "emphasis"),
        ("~~deleted~~", "deleted"),
        ("[[em:傍点]]", "傍点"),
        ("[[no-break:禁則]]", "禁則"),
        ("[[warichu:割注]]", "割注"),
        ("[[kern:-0.1em:詰め]]", "詰め"),
        ("[label](https://example.test/url)", "label"),
        ("![alternative](image.png)", "alternative"),
        ("`inline code`", "inline code"),
        ("before[[br]]after", "before\nafter"),
        (
            "reference[^note]\n\n[^note]: definition",
            "reference\ndefinition",
        ),
        (r"\* &amp;", "* &"),
        ("{broken", "{broken"),
    ];

    for (source, expected) in cases {
        let projection = get_mdi_text_blocks(source);
        let projected = projection
            .blocks
            .iter()
            .map(|block| block.text.as_str())
            .collect::<Vec<_>>()
            .join("\n");
        assert_eq!(projected, expected, "projection differs for {source:?}");
        assert_eq!(
            render_text(source).trim_end_matches('\n'),
            expected,
            "render_text differs for {source:?}"
        );
    }
}

#[test]
fn footnote_reference_never_leaks_its_identifier_into_body_text() {
    let result = get_mdi_text_blocks("body[^private-id]\n\n[^private-id]: searchable note");
    assert_eq!(result.blocks[0].text, "body");
    assert_eq!(result.blocks[1].text, "searchable note");
    assert!(
        result
            .blocks
            .iter()
            .all(|block| !block.text.contains("private-id"))
    );
}
