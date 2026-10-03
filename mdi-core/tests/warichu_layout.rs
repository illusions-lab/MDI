use mdi_core::{parse_document, render_html, serialize_mdi};

#[test]
fn warichu_html_is_two_lines_without_changing_authored_source() {
    let source = "本文[[warichu:一二三四五]]続き";
    let before = serialize_mdi(source);
    let document = parse_document(source);
    let html = render_html(source);
    assert!(html.contains("<span class=\"mdi-warichu-line\" style=\"display:block;white-space:nowrap;min-block-size:1em\">一二三</span><span class=\"mdi-warichu-line\" style=\"display:block;white-space:nowrap;min-block-size:1em\">四五</span>"), "{html}");
    assert_eq!(parse_document(source), document);
    assert_eq!(serialize_mdi(source), before);
    assert!(!before.contains("[[br]]"));
}

fn note(source: &str, capacity: usize) -> Vec<mdi_core::WarichuFragment> {
    let doc = parse_document(&format!("[[warichu:{source}]]"));
    mdi_core::layout_warichu(
        doc.children[0]["children"][0]["children"]
            .as_array()
            .unwrap(),
        capacity,
    )
}
fn text(nodes: &[serde_json::Value]) -> String {
    nodes
        .iter()
        .map(|n| {
            n["value"]
                .as_str()
                .or(n["base"].as_str())
                .map(str::to_owned)
                .unwrap_or_else(|| {
                    n["children"]
                        .as_array()
                        .map(|c| text(c))
                        .unwrap_or_default()
                })
        })
        .collect()
}

#[test]
fn balanced_unicode_and_mixed_widths() {
    for (source, expected) in [
        ("一二三四", [4, 4]),
        ("一二三四五", [6, 4]),
        ("AB一二", [4, 2]),
        ("👨‍👩‍👧‍👦か\u{3099}一", [4, 2]),
    ] {
        let fragments = note(source, 40);
        assert_eq!(fragments.len(), 1, "{source}");
        assert_eq!(fragments[0].widths, expected, "{source}");
        assert_eq!(
            fragments
                .iter()
                .flat_map(|f| f.lines.iter())
                .map(|l| text(l))
                .collect::<String>(),
            source
        );
    }
}

#[test]
fn kinsoku_and_indivisible_inline_semantics() {
    let f = note("一二、三四", 40);
    assert_eq!(text(&f[0].lines[0]), "一二、");
    let f = note("一二（三四）五", 40);
    assert!(!text(&f[0].lines[0]).ends_with('（'));
    assert!(!text(&f[0].lines[1]).starts_with('）'));
    for source in ["{東京|とうきょう}", "[[no-break:一二三四五]]", "^1234^"] {
        let f = note(source, 1);
        assert_eq!(f.len(), 1, "{source}");
        assert!(f[0].overflow, "{source}");
        assert_eq!(f[0].lines[0].len(), 1);
        assert!(f[0].lines[1].is_empty());
    }
}

#[test]
fn long_notes_keep_order_and_hard_boundaries() {
    let source = "一二三四五六七八九十".repeat(20);
    let f = note(&source, 8);
    assert!(f.len() > 1);
    assert!(f.iter().all(|p| !p.overflow && p.widths[0] >= p.widths[1]));
    assert_eq!(
        f.iter()
            .flat_map(|p| p.lines.iter())
            .map(|l| text(l))
            .collect::<String>(),
        source
    );
    let f = note("一二[[br]][[br]]三四", 40);
    assert_eq!(f.len(), 3);
    assert!(f[0].hard_break_after && f[1].hard_break_after);
    assert!(!f[2].hard_break_after);
    assert!(serialize_mdi("[[warichu:一二[[br]]三四]]").contains("[[br]]"));
}

#[test]
fn docx_uses_native_combination_across_formatted_runs() {
    use std::io::Read;
    let bytes = mdi_core::render_docx("[[warichu:一**二**三]]外[[warichu:四五]]").unwrap();
    let mut archive = zip::ZipArchive::new(std::io::Cursor::new(bytes)).unwrap();
    let mut xml = String::new();
    archive
        .by_name("word/document.xml")
        .unwrap()
        .read_to_string(&mut xml)
        .unwrap();
    assert_eq!(xml.matches("w:combine=\"1\"").count(), 4, "{xml}");
    assert_eq!(xml.matches("w:id=\"1\" w:combine").count(), 3);
    assert_eq!(xml.matches("w:id=\"2\" w:combine").count(), 1);
    assert!(!xml.contains("<w:sz w:val=\"14\""));
}

#[test]
fn docx_native_note_keeps_ruby_and_tcy_in_its_group() {
    use std::io::Read;
    let bytes = mdi_core::render_docx("[[warichu:{東京|とうきょう}^12^]]").unwrap();
    let mut archive = zip::ZipArchive::new(std::io::Cursor::new(bytes)).unwrap();
    let mut xml = String::new();
    archive
        .by_name("word/document.xml")
        .unwrap()
        .read_to_string(&mut xml)
        .unwrap();
    assert_eq!(xml.matches("w:id=\"1\" w:combine").count(), 2, "{xml}");
    assert!(xml.contains("<w:ruby>"));
    assert!(xml.contains("とうきょう"));
    assert!(xml.contains(">12</w:t>"));
}

#[test]
fn formatting_boundary_does_not_split_a_grapheme() {
    let nodes = serde_json::json!([
        {"type":"text","value":"か"},
        {"type":"strong","children":[{"type":"text","value":"\u{3099}"}]}
    ]);
    let fragments = mdi_core::layout_warichu(nodes.as_array().unwrap(), 1);
    assert_eq!(fragments.len(), 1);
    assert_eq!(text(&fragments[0].lines[0]), "か\u{3099}");
    assert_eq!(fragments[0].widths, [2, 0]);
}

#[test]
fn options_preserve_source_coordinates_and_use_continuation_capacity() {
    let nodes = serde_json::json!([{"type":"text","value":"一二三四五六七八九十"}]);
    let result = mdi_core::layout_warichu_with_options(
        nodes.as_array().unwrap(),
        &mdi_core::WarichuOptions {
            first_capacity: 2,
            continuation_capacity: 8,
        },
    );
    assert_eq!(result.len(), 2);
    assert_eq!(result[0].widths, [2, 2]);
    assert_eq!(result[1].widths, [8, 8]);
    let sources: Vec<_> = result
        .iter()
        .flat_map(|f| f.sources.iter().flatten())
        .collect();
    for (i, source) in sources.iter().enumerate() {
        assert_eq!(source.path, [0]);
        assert_eq!(source.start_utf8, i * 3);
        assert_eq!(source.end_utf8, (i + 1) * 3);
        assert_eq!(source.group, i);
    }
    assert_eq!(result[0].html, ["一", "二"]);
}

#[test]
fn cross_format_sources_share_a_grapheme_group() {
    let nodes = serde_json::json!([{"type":"text","value":"か"},{"type":"strong","children":[{"type":"text","value":"\u{3099}"}]}]);
    let result = mdi_core::layout_warichu(nodes.as_array().unwrap(), 1);
    let sources = &result[0].sources[0];
    assert_eq!(sources.len(), 2);
    assert_eq!(sources[0].group, sources[1].group);
    assert_eq!(sources[1].path, [1, 0]);
    assert_eq!(sources[1].end_utf8, 3);
    assert!(result[0].overflow);
}

#[test]
#[allow(unsafe_code)]
fn json_and_c_layout_interfaces_report_invalid_options() {
    assert!(mdi_core::layout_warichu_options_json("[]", "{}").is_err());
    assert!(
        mdi_core::layout_warichu_options_json(
            "{}",
            "{\"firstCapacity\":1,\"continuationCapacity\":2}"
        )
        .is_err()
    );
    let nodes = b"[]";
    let options = b"{\"firstCapacity\":1,\"continuationCapacity\":2}";
    let result = mdi_core::ffi::mdi_layout_warichu_json(
        nodes.as_ptr(),
        nodes.len(),
        options.as_ptr(),
        options.len(),
    );
    assert_eq!(result.error.len, 0);
    assert_eq!(result.value.len, 2);
    unsafe {
        mdi_core::ffi::mdi_free_buffer(result.value);
        mdi_core::ffi::mdi_free_buffer(result.error);
    }
}

#[test]
fn regional_indicators_across_formatting_follow_global_segmentation() {
    let nodes = serde_json::json!([{"type":"text","value":"🇯"},{"type":"strong","children":[{"type":"text","value":"🇵🇺🇸"}]}]);
    let result = mdi_core::layout_warichu(nodes.as_array().unwrap(), 2);
    assert_eq!(result.len(), 1);
    assert_eq!(text(&result[0].lines[0]), "🇯🇵");
    assert_eq!(text(&result[0].lines[1]), "🇺🇸");
}

#[test]
fn portable_html_keeps_two_lines_without_a_stylesheet() {
    let html = render_html("[[warichu:一二]]");
    assert!(html.contains("style=\"font-size:.5em;line-height:1\""));
    assert!(html.contains(
        "style=\"display:inline-flex;flex-direction:column;vertical-align:middle;text-align:start\""
    ));
}

#[test]
fn nested_notes_keep_half_body_size_instead_of_halving_repeatedly() {
    let html = render_html("[[warichu:外[[warichu:内注]]外]]");
    assert_eq!(
        html.matches("style=\"font-size:.5em;line-height:1\"")
            .count(),
        1
    );
    assert_eq!(
        html.matches("style=\"font-size:1em;line-height:1\"")
            .count(),
        1
    );
}

#[test]
fn docx_hard_breaks_stay_inside_the_native_note_group() {
    use std::io::Read;
    let bytes = mdi_core::render_docx("[[warichu:一[[br]][[br]]**二**]]").unwrap();
    let mut archive = zip::ZipArchive::new(std::io::Cursor::new(bytes)).unwrap();
    let mut xml = String::new();
    archive
        .by_name("word/document.xml")
        .unwrap()
        .read_to_string(&mut xml)
        .unwrap();
    assert_eq!(xml.matches("<w:br/>").count(), 2);
    assert_eq!(xml.matches("w:id=\"1\" w:combine").count(), 4);
    assert!(xml.contains("<w:b/>"));
}

#[test]
fn formatted_no_break_inside_warichu_is_structured_and_indivisible() {
    let source = "前[[warichu:一[[no-break:二**三**四]][[warichu:内注]]**e**́五六七八九十]]後";
    let document = parse_document(source);
    let children = document.children[0]["children"][1]["children"]
        .as_array()
        .unwrap();
    assert_eq!(children[1]["type"], "noBreak");
    assert_eq!(children[1]["children"][1]["type"], "strong");
    assert_eq!(text(children[1]["children"].as_array().unwrap()), "二三四");
    let fragments = mdi_core::layout_warichu(children, 2);
    assert!(
        fragments
            .iter()
            .any(|f| f.overflow && text(&f.lines[0]) == "二三四")
    );
    assert_eq!(serialize_mdi(&serialize_mdi(source)), serialize_mdi(source));
}
