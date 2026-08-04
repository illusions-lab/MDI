use std::time::{Duration, Instant};

use mdi_core::{
    MdiTextBlock, MdiTextBlockKind, MdiTextRange, get_mdi_text_blocks, get_mdi_text_blocks_json,
};
use serde_json::{Value, json};
use unicode_segmentation::UnicodeSegmentation;

fn range_tuple(range: &MdiTextRange) -> (u32, u32, u32, u32) {
    (
        range.start.block,
        range.start.character,
        range.end.block,
        range.end.character,
    )
}

fn kind_name(kind: MdiTextBlockKind) -> &'static str {
    match kind {
        MdiTextBlockKind::Heading => "heading",
        MdiTextBlockKind::Paragraph => "paragraph",
        MdiTextBlockKind::ListItem => "listItem",
        MdiTextBlockKind::Blockquote => "blockquote",
        MdiTextBlockKind::Code => "code",
        MdiTextBlockKind::Table => "table",
        MdiTextBlockKind::Footnote => "footnote",
        MdiTextBlockKind::Html => "html",
        MdiTextBlockKind::Other => "other",
    }
}

/// A deliberately small golden wire view. It freezes the public naming,
/// indexing, grapheme ranges, synthetic separators, annotation anchors, and
/// diagnostics without copying the parser's complete IR into this test.
fn stable_projection(source: &str) -> Value {
    let result = get_mdi_text_blocks(source);
    json!({
        "projectionVersion": result.projection_version,
        "positionEncoding": result.position_encoding,
        "irVersion": result.ir_version,
        "syntaxVersion": result.syntax_version,
        "documentSpan": [result.document.span.start_byte, result.document.span.end_byte],
        "blocks": result.blocks.iter().map(|block| json!({
            "index": block.index,
            "kind": kind_name(block.kind),
            "nodeType": block.node.get("type").and_then(Value::as_str),
            "text": block.text,
            "range": range_tuple(&block.range),
            "synthetic": block.source_map.synthetic.iter().map(range_tuple).collect::<Vec<_>>(),
            "unmapped": block.source_map.unmapped.iter().map(range_tuple).collect::<Vec<_>>(),
            "annotations": block.annotations.iter().map(|annotation| json!({
                "kind": annotation.kind,
                "text": annotation.text,
                "anchor": range_tuple(&annotation.anchor),
                "unmapped": annotation.source_map.unmapped.iter().map(range_tuple).collect::<Vec<_>>(),
            })).collect::<Vec<_>>(),
        })).collect::<Vec<_>>(),
        "diagnostics": result.diagnostics.iter().map(|diagnostic| {
            json!({
                "severity": format!("{:?}", diagnostic.severity).to_lowercase(),
                "code": diagnostic.code,
            })
        }).collect::<Vec<_>>(),
    })
}

fn block_summaries(source: &str) -> Vec<(MdiTextBlockKind, String)> {
    get_mdi_text_blocks(source)
        .blocks
        .into_iter()
        .map(|block| (block.kind, block.text))
        .collect()
}

fn source_span_for_character<'a>(
    block: &MdiTextBlock,
    source: &'a str,
    character: u32,
) -> Option<(u32, u32, &'a str)> {
    for run in &block.source_map.runs {
        let start = run.range.start.character;
        let end = run.range.end.character;
        if (start..end).contains(&character) {
            let index = (character - start) as usize;
            let source_start = run.source_boundaries[index];
            let source_end = run.source_boundaries[index + 1];
            return Some((
                source_start,
                source_end,
                &source[source_start as usize..source_end as usize],
            ));
        }
    }
    None
}

#[test]
fn golden_selected_schema_covers_kitchen_sink_markdown_malformed_unicode_and_nesting() {
    let cases = [
        (
            "kitchen sink",
            "# 序章\n\n本文{東京|とうきょう} ^12^ 前[[br]]次\n\n| A | B |\n| - | - |\n| C | D |",
            json!({
                "projectionVersion": "1.0",
                "positionEncoding": "unicode-grapheme-cluster-1-based",
                "irVersion": "1.0",
                "syntaxVersion": "2.0",
                "documentSpan": [0, 89],
                "blocks": [
                    {
                        "index": 1, "kind": "heading", "nodeType": "heading",
                        "text": "序章", "range": [1, 1, 1, 3],
                        "synthetic": [], "unmapped": [], "annotations": [],
                    },
                    {
                        "index": 2, "kind": "paragraph", "nodeType": "paragraph",
                        "text": "本文東京 12 前\n次", "range": [2, 1, 2, 12],
                        "synthetic": [], "unmapped": [],
                        "annotations": [{
                            "kind": "rubyReading", "text": "とうきょう",
                            "anchor": [2, 3, 2, 5], "unmapped": [],
                        }],
                    },
                    {
                        "index": 3, "kind": "table", "nodeType": "table",
                        "text": "A\tB\nC\tD", "range": [3, 1, 3, 8],
                        "synthetic": [[3, 2, 3, 3], [3, 4, 3, 5], [3, 6, 3, 7]],
                        "unmapped": [], "annotations": [],
                    },
                ],
                "diagnostics": [],
            }),
        ),
        (
            "Markdown heavy",
            r"**bold** _em_ ~~gone~~ [label](https://example.test/rust) ![alt](rust.png) `code` \* &amp;",
            json!({
                "projectionVersion": "1.0",
                "positionEncoding": "unicode-grapheme-cluster-1-based",
                "irVersion": "1.0", "syntaxVersion": "2.0", "documentSpan": [0, 90],
                "blocks": [{
                    "index": 1, "kind": "paragraph", "nodeType": "paragraph",
                    "text": "bold em gone label alt code * &", "range": [1, 1, 1, 32],
                    "synthetic": [], "unmapped": [], "annotations": [],
                }],
                "diagnostics": [],
            }),
        ),
        (
            "malformed recovery",
            "{未閉|よみ\n\n[[em:未閉\n\n<custom>literal</custom>",
            json!({
                "projectionVersion": "1.0",
                "positionEncoding": "unicode-grapheme-cluster-1-based",
                "irVersion": "1.0", "syntaxVersion": "2.0", "documentSpan": [0, 53],
                "blocks": [
                    {
                        "index": 1, "kind": "paragraph", "nodeType": "paragraph",
                        "text": "{未閉|よみ", "range": [1, 1, 1, 7],
                        "synthetic": [], "unmapped": [], "annotations": [],
                    },
                    {
                        "index": 2, "kind": "paragraph", "nodeType": "paragraph",
                        "text": "[[em:未閉", "range": [2, 1, 2, 8],
                        "synthetic": [], "unmapped": [], "annotations": [],
                    },
                    {
                        "index": 3, "kind": "paragraph", "nodeType": "paragraph",
                        "text": "<custom>literal</custom>", "range": [3, 1, 3, 25],
                        "synthetic": [], "unmapped": [], "annotations": [],
                    },
                ],
                "diagnostics": [],
            }),
        ),
        (
            "Unicode stress",
            "e\u{301} é 👩🏽‍💻 ✈️ 🇯🇵 1️⃣ क्‍ष",
            json!({
                "projectionVersion": "1.0",
                "positionEncoding": "unicode-grapheme-cluster-1-based",
                "irVersion": "1.0", "syntaxVersion": "2.0", "documentSpan": [0, 59],
                "blocks": [{
                    "index": 1, "kind": "paragraph", "nodeType": "paragraph",
                    "text": "e\u{301} é 👩🏽‍💻 ✈️ 🇯🇵 1️⃣ क्‍ष", "range": [1, 1, 1, 14],
                    "synthetic": [], "unmapped": [], "annotations": [],
                }],
                "diagnostics": [],
            }),
        ),
        (
            "nested blocks",
            "> quote one\n>\n> - quoted item\n>   - quoted nested\n>\n> quote two\n\n- first\n\n  second\n\n  > inside quote\n\n  - nested item",
            json!({
                "projectionVersion": "1.0",
                "positionEncoding": "unicode-grapheme-cluster-1-based",
                "irVersion": "1.0", "syntaxVersion": "2.0", "documentSpan": [0, 117],
                "blocks": [
                    {"index": 1, "kind": "blockquote", "nodeType": "paragraph", "text": "quote one", "range": [1, 1, 1, 10], "synthetic": [], "unmapped": [], "annotations": []},
                    {"index": 2, "kind": "listItem", "nodeType": "listItem", "text": "quoted item", "range": [2, 1, 2, 12], "synthetic": [], "unmapped": [], "annotations": []},
                    {"index": 3, "kind": "listItem", "nodeType": "listItem", "text": "quoted nested", "range": [3, 1, 3, 14], "synthetic": [], "unmapped": [], "annotations": []},
                    {"index": 4, "kind": "blockquote", "nodeType": "paragraph", "text": "quote two", "range": [4, 1, 4, 10], "synthetic": [], "unmapped": [], "annotations": []},
                    {"index": 5, "kind": "listItem", "nodeType": "listItem", "text": "first\n\nsecond", "range": [5, 1, 5, 14], "synthetic": [[5, 6, 5, 8]], "unmapped": [], "annotations": []},
                    {"index": 6, "kind": "blockquote", "nodeType": "paragraph", "text": "inside quote", "range": [6, 1, 6, 13], "synthetic": [], "unmapped": [], "annotations": []},
                    {"index": 7, "kind": "listItem", "nodeType": "listItem", "text": "nested item", "range": [7, 1, 7, 12], "synthetic": [], "unmapped": [], "annotations": []},
                ],
                "diagnostics": [],
            }),
        ),
    ];

    for (name, source, expected) in cases {
        assert_eq!(stable_projection(source), expected, "{name}");
    }
}

#[test]
fn complex_containers_emit_each_searchable_leaf_once_in_source_order() {
    let source = concat!(
        "# top\n\n",
        "> quote one\n>\n> quote two\n>\n> - quoted item\n>   - quoted nested\n\n",
        "- first\n\n  second\n\n  > inside quote\n\n  - nested item\n\n",
        "| h1 | h2 |\n| -- | -- |\n| c1 | c2 |\n\n",
        "```rust\ncode line\n```\n\n",
        "<section>literal html</section>\n\n",
        "body[^note]\n\n",
        "[^note]: footnote one\n\n    footnote two",
    );
    assert_eq!(
        block_summaries(source),
        vec![
            (MdiTextBlockKind::Heading, "top".to_owned()),
            (MdiTextBlockKind::Blockquote, "quote one".to_owned()),
            (MdiTextBlockKind::Blockquote, "quote two".to_owned()),
            (MdiTextBlockKind::ListItem, "quoted item".to_owned()),
            (MdiTextBlockKind::ListItem, "quoted nested".to_owned()),
            (MdiTextBlockKind::ListItem, "first\n\nsecond".to_owned()),
            (MdiTextBlockKind::Blockquote, "inside quote".to_owned()),
            (MdiTextBlockKind::ListItem, "nested item".to_owned()),
            (MdiTextBlockKind::Table, "h1\th2\nc1\tc2".to_owned()),
            (MdiTextBlockKind::Code, "code line".to_owned()),
            (
                MdiTextBlockKind::Html,
                "<section>literal html</section>".to_owned(),
            ),
            (MdiTextBlockKind::Paragraph, "body".to_owned()),
            (
                MdiTextBlockKind::Footnote,
                "footnote one\n\nfootnote two".to_owned(),
            ),
        ]
    );

    let result = get_mdi_text_blocks(source);
    assert_eq!(
        result
            .blocks
            .iter()
            .map(|block| block.index)
            .collect::<Vec<_>>(),
        (1..=result.blocks.len() as u32).collect::<Vec<_>>()
    );
    for needle in [
        "quote one",
        "quoted item",
        "first",
        "inside quote",
        "footnote one",
    ] {
        assert_eq!(
            result
                .blocks
                .iter()
                .filter(|block| block.text.contains(needle))
                .count(),
            1,
            "{needle:?} was duplicated or omitted",
        );
    }
}

#[test]
fn synthetic_separators_have_exact_ranges_and_never_claim_source_bytes() {
    let source = concat!(
        "- one\n\n  two\n\n",
        "| a | b |\n| - | - |\n| c | d |\n\n",
        "body[^n]\n\n[^n]: alpha\n\n    beta",
    );
    let result = get_mdi_text_blocks(source);
    let list = &result.blocks[0];
    let table = &result.blocks[1];
    let footnote = &result.blocks[3];

    assert_eq!(list.text, "one\n\ntwo");
    assert_eq!(
        list.source_map
            .synthetic
            .iter()
            .map(range_tuple)
            .collect::<Vec<_>>(),
        vec![(1, 4, 1, 6)]
    );
    assert_eq!(table.text, "a\tb\nc\td");
    assert_eq!(
        table
            .source_map
            .synthetic
            .iter()
            .map(range_tuple)
            .collect::<Vec<_>>(),
        vec![(2, 2, 2, 3), (2, 4, 2, 5), (2, 6, 2, 7)]
    );
    assert_eq!(footnote.text, "alpha\n\nbeta");
    assert_eq!(
        footnote
            .source_map
            .synthetic
            .iter()
            .map(range_tuple)
            .collect::<Vec<_>>(),
        vec![(4, 6, 4, 8)]
    );

    for block in [list, table, footnote] {
        for synthetic in &block.source_map.synthetic {
            for character in synthetic.start.character..synthetic.end.character {
                assert_eq!(source_span_for_character(block, source, character), None);
            }
        }
    }
}

#[test]
fn repeated_visible_text_maps_to_content_not_wrappers_urls_or_fence_info() {
    let source = concat!(
        "# \\#\n\n",
        "[rust](https://example.test/rust) rust\n\n",
        "![rust](rust.png) rust\n\n",
        "```rust\nrust\n```",
    );
    let result = get_mdi_text_blocks(source);
    assert_eq!(
        result
            .blocks
            .iter()
            .map(|block| block.text.as_str())
            .collect::<Vec<_>>(),
        vec!["#", "rust rust", "rust rust", "rust"]
    );

    let heading = source_span_for_character(&result.blocks[0], source, 1).unwrap();
    assert_eq!(heading.2, r"\#");

    let link_label = source.find("[rust]").unwrap() as u32 + 1;
    let link_first = source_span_for_character(&result.blocks[1], source, 1).unwrap();
    assert_eq!(link_first.0, link_label);
    let plain_after_link = source.find(") rust").unwrap() as u32 + 2;
    let link_plain_first = source_span_for_character(&result.blocks[1], source, 6).unwrap();
    assert_eq!(link_plain_first.0, plain_after_link);

    let image_label = source.find("![rust]").unwrap() as u32 + 2;
    let image_first = source_span_for_character(&result.blocks[2], source, 1).unwrap();
    assert_eq!(image_first.0, image_label);
    let plain_after_image = source.find(") rust\n\n```").unwrap() as u32 + 2;
    let image_plain_first = source_span_for_character(&result.blocks[2], source, 6).unwrap();
    assert_eq!(image_plain_first.0, plain_after_image);

    let code_content = source.rfind("\nrust\n```").unwrap() as u32 + 1;
    let code_first = source_span_for_character(&result.blocks[3], source, 1).unwrap();
    assert_eq!(code_first.0, code_content);
    assert_ne!(code_first.0, source.find("```rust").unwrap() as u32 + 3);
}

#[test]
fn empty_document_markup_and_normal_whitespace_emit_no_blocks_but_code_whitespace_is_literal() {
    for source in [
        "",
        " ",
        "\t",
        "\n\n",
        "   \n\t\n",
        "---",
        "***",
        "---\ntitle: hidden\n---",
        "[[pagebreak]]",
    ] {
        assert!(
            get_mdi_text_blocks(source).blocks.is_empty(),
            "unexpected block for {source:?}",
        );
    }

    let code = get_mdi_text_blocks("```text\n \t\n\n```");
    assert_eq!(code.blocks.len(), 1);
    assert_eq!(code.blocks[0].kind, MdiTextBlockKind::Code);
    assert_eq!(code.blocks[0].text, " \t\n");
    assert!(code.blocks[0].source_map.synthetic.is_empty());
    assert!(code.blocks[0].source_map.unmapped.is_empty());

    let significant_unicode_space = get_mdi_text_blocks("　");
    assert_eq!(significant_unicode_space.blocks[0].text, "　");
}

#[test]
fn large_and_deep_supported_documents_avoid_catastrophic_slowdowns() {
    const BLOCKS: usize = 2_000;
    let mut source = String::new();
    for index in 0..BLOCKS {
        source.push_str(&format!("paragraph {index} {{東京|とうきょう}} 👩🏽‍💻\n\n"));
    }
    source.push_str(&(0..128).map(|_| "> ").collect::<String>());
    source.push_str("deep leaf\n\n");
    source.push_str("| h0 | h1 | h2 | h3 | h4 | h5 | h6 | h7 |\n");
    source.push_str("| -- | -- | -- | -- | -- | -- | -- | -- |\n");
    for row in 0..200 {
        source.push_str(&format!(
            "| {row}-0 | {row}-1 | {row}-2 | {row}-3 | {row}-4 | {row}-5 | {row}-6 | {row}-7 |\n"
        ));
    }

    let started = Instant::now();
    let result = get_mdi_text_blocks(&source);
    let elapsed = started.elapsed();
    assert!(
        elapsed < Duration::from_secs(30),
        "projection took {elapsed:?}; likely catastrophic complexity regression",
    );
    assert_eq!(result.blocks.len(), BLOCKS + 2);
    assert_eq!(result.blocks[0].text, "paragraph 0 東京 👩🏽‍💻");
    assert_eq!(result.blocks[BLOCKS - 1].text, "paragraph 1999 東京 👩🏽‍💻");
    assert_eq!(result.blocks[BLOCKS].text, "deep leaf");
    assert_eq!(result.blocks[BLOCKS].kind, MdiTextBlockKind::Blockquote);
    assert_eq!(result.blocks[BLOCKS + 1].kind, MdiTextBlockKind::Table);
    assert_eq!(result.blocks[BLOCKS + 1].text.lines().count(), 201);
    assert_eq!(
        result.blocks[BLOCKS + 1]
            .text
            .graphemes(true)
            .filter(|value| *value == "\t")
            .count(),
        201 * 7,
    );

    // Include serialization in the scale contract because JSON is the binding
    // boundary and can regress independently from projection construction.
    let json = get_mdi_text_blocks_json(&source);
    assert!(json.starts_with(r#"{"projectionVersion":"1.0""#));
    assert!(json.contains("deep leaf"));
}
