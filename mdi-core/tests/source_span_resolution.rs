use mdi_core::{
    MdiSourceSpanCoverage, MdiSourceSpanRelation, MdiSourceSpanResolutionError,
    MdiSourceSpanTextMatch, SourceSpan, get_mdi_text_blocks, resolve_mdi_source_span,
    resolve_mdi_source_span_json,
};

fn span(start_byte: u32, end_byte: u32) -> SourceSpan {
    SourceSpan {
        start_byte,
        end_byte,
    }
}

fn byte_offset(source: &str, needle: &str) -> u32 {
    source.find(needle).unwrap() as u32
}

#[test]
fn resolves_ascii_cjk_combining_and_emoji_graphemes() {
    for (source, needle, expected_range) in [
        ("abc", "b", (2, 3)),
        ("甲乙丙", "乙", (2, 3)),
        ("e\u{301}x", "e\u{301}", (1, 2)),
        ("👩🏽‍💻!", "👩🏽‍💻", (1, 2)),
    ] {
        let start = byte_offset(source, needle);
        let resolution = resolve_mdi_source_span(
            source,
            span(start, start + u32::try_from(needle.len()).unwrap()),
        )
        .unwrap();
        assert_eq!(resolution.coverage, MdiSourceSpanCoverage::Complete);
        assert_eq!(resolution.matches.len(), 1);
        let MdiSourceSpanTextMatch::BlockText {
            range, relation, ..
        } = &resolution.matches[0]
        else {
            panic!("expected block text");
        };
        assert_eq!((range.start.character, range.end.character), expected_range);
        assert_eq!(*relation, MdiSourceSpanRelation::Exact);
    }
}

#[test]
fn a_code_point_subspan_of_a_grapheme_is_complete_but_overlapping() {
    let source = "e\u{301}";
    let resolution = resolve_mdi_source_span(source, span(0, 1)).unwrap();
    assert_eq!(resolution.coverage, MdiSourceSpanCoverage::Complete);
    assert!(matches!(
        resolution.matches.as_slice(),
        [MdiSourceSpanTextMatch::BlockText {
            relation: MdiSourceSpanRelation::Overlap,
            ..
        }]
    ));
}

#[test]
fn resolves_ruby_base_and_annotation_as_ordered_independent_channels() {
    let source = "前{東京|とうきょう}後";
    let token_start = byte_offset(source, "{");
    let token_end = byte_offset(source, "}") + 1;
    let resolution = resolve_mdi_source_span(source, span(token_start, token_end)).unwrap();

    assert_eq!(resolution.coverage, MdiSourceSpanCoverage::Partial);
    assert_eq!(resolution.matches.len(), 2);
    assert!(matches!(
        &resolution.matches[0],
        MdiSourceSpanTextMatch::BlockText {
            block_index: 1,
            relation: MdiSourceSpanRelation::Overlap,
            range,
        } if range.start.character == 2 && range.end.character == 4
    ));
    assert!(matches!(
        &resolution.matches[1],
        MdiSourceSpanTextMatch::Annotation {
            block_index: 1,
            annotation_index: 0,
            relation: MdiSourceSpanRelation::Overlap,
            range,
        } if range.start.character == 1 && range.end.character == 6
    ));
}

#[test]
fn merges_adjacent_hits_across_source_map_runs() {
    let source = "a*b*c";
    let resolution = resolve_mdi_source_span(source, span(0, source.len() as u32)).unwrap();
    assert_eq!(resolution.matches.len(), 1);
    assert!(matches!(
        &resolution.matches[0],
        MdiSourceSpanTextMatch::BlockText { range, .. }
            if range.start.character == 1 && range.end.character == 4
    ));
    assert_eq!(resolution.coverage, MdiSourceSpanCoverage::Partial);
}

#[test]
fn reports_complete_partial_and_none_without_inventing_structural_ranges() {
    let complete = resolve_mdi_source_span("abc", span(0, 3)).unwrap();
    assert_eq!(complete.coverage, MdiSourceSpanCoverage::Complete);

    let multi_block = "a\n\nb";
    let partial = resolve_mdi_source_span(multi_block, span(0, 4)).unwrap();
    assert_eq!(partial.coverage, MdiSourceSpanCoverage::Partial);
    assert_eq!(partial.matches.len(), 2);

    let none = resolve_mdi_source_span("---", span(0, 3)).unwrap();
    assert_eq!(none.coverage, MdiSourceSpanCoverage::None);
    assert!(none.matches.is_empty());

    let empty = resolve_mdi_source_span("東京", span(3, 3)).unwrap();
    assert_eq!(empty.coverage, MdiSourceSpanCoverage::None);
    assert!(empty.matches.is_empty());
}

#[test]
fn a_projected_structural_token_only_matches_when_owned_by_a_grapheme() {
    let source = "a[[br]]b";
    let start = byte_offset(source, "[[br]]");
    let resolution = resolve_mdi_source_span(source, span(start, start + 6)).unwrap();
    assert_eq!(resolution.coverage, MdiSourceSpanCoverage::Complete);
    assert!(matches!(
        resolution.matches.as_slice(),
        [MdiSourceSpanTextMatch::BlockText {
            relation: MdiSourceSpanRelation::Exact,
            range,
            ..
        }] if range.start.character == 2 && range.end.character == 3
    ));
}

#[test]
fn validates_order_bounds_and_utf8_boundaries() {
    assert_eq!(
        resolve_mdi_source_span("abc", span(2, 1)),
        Err(MdiSourceSpanResolutionError::Reversed)
    );
    assert_eq!(
        resolve_mdi_source_span("abc", span(0, 4)),
        Err(MdiSourceSpanResolutionError::OutOfBounds)
    );
    assert_eq!(
        resolve_mdi_source_span("東京", span(1, 3)),
        Err(MdiSourceSpanResolutionError::NotUtf8Boundary)
    );
}

#[test]
fn json_is_deterministic_and_uses_the_public_wire_shape() {
    let source = "{東京|とうきょう}";
    let source_span = span(0, source.len() as u32);
    let first = resolve_mdi_source_span_json(source, source_span).unwrap();
    assert_eq!(
        first,
        resolve_mdi_source_span_json(source, source_span).unwrap()
    );
    let value: serde_json::Value = serde_json::from_str(&first).unwrap();
    assert_eq!(value["projectionVersion"], "1.0");
    assert_eq!(value["sourceSpan"]["startByte"], 0);
    assert_eq!(value["matches"][0]["kind"], "blockText");
    assert_eq!(value["matches"][1]["kind"], "annotation");
    assert_eq!(value["matches"][1]["annotationIndex"], 0);
}

#[test]
fn syntax_matrix_remains_deterministic_and_never_returns_invalid_ranges() {
    let samples = [
        "{東京|とう.きょう}",
        "^12^ 《《印》》 [[em:x]] [[br]]",
        "| a | b |\n| - | - |\n| c | d |",
        "> - nested **text**",
        "```mdi\n{literal|code}\n```",
        "{malformed|ruby",
        "---\ntitle: hidden\n---",
    ];
    for source in samples {
        let requested = span(0, source.len() as u32);
        let resolution = resolve_mdi_source_span(source, requested).unwrap();
        assert_eq!(resolution.source_span, requested);
        for matched in resolution.matches {
            let range = match matched {
                MdiSourceSpanTextMatch::BlockText { range, .. }
                | MdiSourceSpanTextMatch::Annotation { range, .. } => range,
            };
            assert_eq!(range.start.block, range.end.block);
            assert!(range.start.character < range.end.character);
        }
    }
}

#[test]
fn every_forward_block_grapheme_span_resolves_back_to_that_grapheme() {
    let source =
        "# 題\n\n前{東京|とうきょう} e\u{301} 👩🏽‍💻[[br]]後\n\n| a | b |\n| - | - |\n| c | d |";
    let projection = get_mdi_text_blocks(source);
    for block in projection.blocks {
        for run in block.source_map.runs {
            for (offset, boundaries) in run.source_boundaries.windows(2).enumerate() {
                let character = run.range.start.character + offset as u32;
                let resolution =
                    resolve_mdi_source_span(source, span(boundaries[0], boundaries[1])).unwrap();
                assert!(resolution.matches.iter().any(|matched| matches!(
                    matched,
                    MdiSourceSpanTextMatch::BlockText {
                        block_index,
                        range,
                        ..
                    } if *block_index == block.index
                        && range.start.character == character
                        && range.end.character == character + 1
                )));
            }
        }
    }
}
