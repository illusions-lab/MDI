use mdi_core::{
    ParseOptions, get_mdi_text_blocks, parse_output, parse_output_with_options, render_html,
    render_text, serialize_mdi,
};
use serde_json::Value;

fn comments(node: &Value) -> Vec<Value> {
    let mut result = Vec::new();
    if node["type"] == "comment" {
        result.push(node.clone());
    }
    if let Some(children) = node["children"].as_array() {
        for child in children {
            result.extend(comments(child));
        }
    }
    result
}

#[test]
fn comments_are_opt_in_and_source_preserved() {
    for source in [
        "前<!-- 編集 -->後",
        "<!-- -->",
        "<!---->",
        "前<!--\n雪☃\\&amp;\n-->後",
        "前<!--a--><!--b-->後",
        "[[em:前<!-- ]] [[em:x]] -->後]]",
    ] {
        let full = parse_output_with_options(
            source,
            ParseOptions {
                include_comments: true,
            },
        );
        let value = serde_json::to_value(&full.document).unwrap();
        assert!(!comments(&value).is_empty(), "{source}: {value}");
        assert_eq!(full.ir_version, "1.1");
        for comment in comments(&value) {
            let start = comment["span"]["startByte"].as_u64().unwrap() as usize;
            let end = comment["span"]["endByte"].as_u64().unwrap() as usize;
            assert_eq!(
                &source[start + 4..end - 3],
                comment["value"].as_str().unwrap()
            );
        }
        let default = parse_output(source);
        assert_eq!(default.ir_version, "1.0");
        assert!(comments(&serde_json::to_value(default.document).unwrap()).is_empty());
        let canonical = serialize_mdi(source);
        let roundtrip = parse_output_with_options(
            &canonical,
            ParseOptions {
                include_comments: true,
            },
        );
        let original = comments(&value)
            .iter()
            .map(|node| node["value"].clone())
            .collect::<Vec<_>>();
        let reparsed = comments(&serde_json::to_value(roundtrip.document).unwrap())
            .iter()
            .map(|node| node["value"].clone())
            .collect::<Vec<_>>();
        assert_eq!(original, reparsed, "{source}: {canonical}");
    }
}

#[test]
fn publication_and_projection_omit_comments() {
    let source = "前<!--UNIQUE_SENTINEL-->後";
    assert_eq!(render_text(source), "前後\n");
    assert!(!render_html(source).contains("UNIQUE_SENTINEL"));
    let projection = get_mdi_text_blocks(source);
    assert_eq!(projection.blocks[0].text, "前後");
    assert!(
        !serde_json::to_string(&projection)
            .unwrap()
            .contains("UNIQUE_SENTINEL")
    );
}

#[test]
fn protected_contexts_remain_literal() {
    for source in [
        r"\<!-- literal -->",
        "`<!-- literal -->`",
        "```\n<!-- literal -->\n```",
        "{<!--literal-->|reading}",
        "《《<!--literal-->》》",
        "[label](a<!--literal-->)",
        "---\ntitle: '<!--literal-->'\n---\n正文",
    ] {
        let full = parse_output_with_options(
            source,
            ParseOptions {
                include_comments: true,
            },
        );
        assert!(
            comments(&serde_json::to_value(full.document).unwrap()).is_empty(),
            "{source}"
        );
    }
}

#[test]
fn unterminated_comments_warn_without_swallowing_text() {
    let output = parse_output("前<!--未閉合\n\n後続");
    assert!(
        output
            .diagnostics
            .iter()
            .any(|diagnostic| diagnostic.code == "mdi.comment.unterminated")
    );
    assert!(render_text("前<!--未閉合\n\n後続").contains("後続"));
}

#[test]
fn comments_keep_body_and_block_boundaries() {
    for (source, expected) in [
        ("<!--secret-->\n本文", "本文\n"),
        ("前\n<!--secret-->\n後", "前\n後\n"),
        ("前\n\n<!--secret-->\n\n後", "前\n後\n"),
        ("- 前<!--secret-->後", "前後\n\n"),
        ("> 前<!--secret-->後", "前後\n\n"),
        ("前<!--\n---\n[[blank]]\nsecret\n-->後", "前後\n"),
        ("*前<!--secret-->後*", "前後\n"),
        ("[前<!--secret-->後](https://example.com)", "前後\n"),
        ("前 &amp; <!--secret-->後", "前 & 後\n"),
        ("|前<!--a|b-->後|\n|---|", "前後\t\n"),
        ("[[em:<!--secret-->後]]", "後\n"),
    ] {
        assert_eq!(render_text(source), expected, "{source}");
        let full = parse_output_with_options(
            source,
            ParseOptions {
                include_comments: true,
            },
        );
        assert_eq!(
            comments(&serde_json::to_value(full.document).unwrap()).len(),
            1,
            "{source}"
        );
    }
}

#[test]
fn explicit_ir_does_not_enable_publication_comments() {
    use std::io::{Cursor, Read};
    let source = "<!--UNIQUE_COMMENT_SENTINEL-->\n\n前<!--UNIQUE_COMMENT_SENTINEL-->後";
    let document = parse_output_with_options(
        source,
        ParseOptions {
            include_comments: true,
        },
    )
    .document;
    assert!(!mdi_core::render_html_document(&document).contains("UNIQUE_COMMENT_SENTINEL"));
    assert_eq!(
        mdi_core::render_text_document(&document),
        render_text(source)
    );
    for bytes in [
        mdi_core::render_epub_document(&document).unwrap(),
        mdi_core::render_docx_document(&document).unwrap(),
    ] {
        let mut zip = zip::ZipArchive::new(Cursor::new(bytes)).unwrap();
        for index in 0..zip.len() {
            let mut entry = zip.by_index(index).unwrap();
            let mut contents = String::new();
            if entry.read_to_string(&mut contents).is_ok() {
                assert!(
                    !contents.contains("UNIQUE_COMMENT_SENTINEL"),
                    "{}",
                    entry.name()
                );
            }
        }
    }
}

#[test]
fn comment_bytes_have_no_body_coordinates() {
    let source = "前<!--secret-->後";
    let projection = get_mdi_text_blocks(source);
    assert_eq!(projection.blocks[0].source_map.runs.len(), 2);
    assert_eq!(
        projection.blocks[0].source_map.runs[0].source_boundaries,
        [0, 3]
    );
    assert_eq!(
        projection.blocks[0].source_map.runs[1].source_boundaries,
        [16, 19]
    );
    assert_eq!(
        projection.document.children[0]["children"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
}

#[test]
fn shared_comment_fixtures() {
    let fixtures: Vec<Value> =
        serde_json::from_str(include_str!("fixtures/comments/cases.json")).unwrap();
    for fixture in fixtures {
        let source = fixture["source"].as_str().unwrap();
        let output = parse_output_with_options(
            source,
            ParseOptions {
                include_comments: true,
            },
        );
        let nodes = comments(&serde_json::to_value(output.document).unwrap());
        assert_eq!(
            nodes
                .iter()
                .map(|node| node["value"].clone())
                .collect::<Vec<_>>(),
            fixture["values"].as_array().unwrap().clone(),
            "{}",
            fixture["name"]
        );
    }
}

#[test]
fn nested_multiline_comments_keep_exact_payloads() {
    for source in [
        "> 前<!--\n秘密\n-->後",
        "> <!--\n> 秘密\n> -->",
        "- 前<!--\n秘密\n-->後",
        "[[em:前<!--\n秘密\n-->後]]",
    ] {
        let before = comments(
            &serde_json::to_value(
                parse_output_with_options(
                    source,
                    ParseOptions {
                        include_comments: true,
                    },
                )
                .document,
            )
            .unwrap(),
        );
        let canonical = serialize_mdi(source);
        let after = comments(
            &serde_json::to_value(
                parse_output_with_options(
                    &canonical,
                    ParseOptions {
                        include_comments: true,
                    },
                )
                .document,
            )
            .unwrap(),
        );
        assert_eq!(
            before.iter().map(|node| &node["value"]).collect::<Vec<_>>(),
            after.iter().map(|node| &node["value"]).collect::<Vec<_>>(),
            "{source} => {canonical}"
        );
    }
}

#[test]
fn nested_atomic_layout_omits_comment_payloads() {
    let nodes = vec![serde_json::json!({"type":"noBreak", "children":[
        {"type":"text","value":"a"},
        {"type":"comment","value":"LAYOUT_PRIVATE_SENTINEL"},
        {"type":"text","value":"b"}
    ]})];
    let result = mdi_core::layout_warichu(&nodes, 10);
    let serialized = serde_json::to_string(&result).unwrap();
    assert!(!serialized.contains("LAYOUT_PRIVATE_SENTINEL"));
    assert!(!serialized.contains("\"comment\""));
    assert_eq!(result[0].sources[0][0].path, vec![0]);
}

#[test]
fn repeated_unterminated_openers_keep_all_body_text() {
    let source = format!("{}body after openers", "<!-- ".repeat(10_000));
    let output = parse_output_with_options(
        &source,
        ParseOptions {
            include_comments: true,
        },
    );
    assert_eq!(
        output
            .diagnostics
            .iter()
            .filter(|diagnostic| diagnostic.code == "mdi.comment.unterminated")
            .count(),
        10_000
    );
    assert!(comments(&serde_json::to_value(output.document).unwrap()).is_empty());
    assert!(mdi_core::render_text(&source).ends_with("body after openers\n"));
}
