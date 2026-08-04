use mdi_core::{
    MdiTextBlock, MdiTextBlockKind, MdiTextRange, MdiTextSourceMap, SourceSpan,
    get_mdi_text_blocks, get_mdi_text_blocks_json,
};
use unicode_segmentation::UnicodeSegmentation;

fn range_indices(
    range: &MdiTextRange,
    block: u32,
    unit_count: usize,
    context: &str,
) -> (usize, usize) {
    assert_eq!(range.start.block, block, "wrong start block in {context}");
    assert_eq!(range.end.block, block, "wrong end block in {context}");
    assert!(
        range.start.character >= 1,
        "zero start position in {context}"
    );
    assert!(
        range.end.character >= range.start.character,
        "reversed range in {context}"
    );
    let start = range.start.character as usize - 1;
    let end = range.end.character as usize - 1;
    assert!(
        end <= unit_count,
        "out-of-bounds range in {context}: {start}..{end}/{unit_count}"
    );
    (start, end)
}

fn assert_source_map_partition(
    map: &MdiTextSourceMap,
    block: u32,
    unit_count: usize,
    source: &str,
    document_span: SourceSpan,
    context: &str,
) {
    let mut coverage = vec![0_u8; unit_count];

    for (run_index, run) in map.runs.iter().enumerate() {
        let run_context = format!("{context} run {run_index}");
        let (start, end) = range_indices(&run.range, block, unit_count, &run_context);
        assert!(start < end, "empty source run in {run_context}");
        assert_eq!(
            run.source_boundaries.len(),
            end - start + 1,
            "one source span must be supplied for every grapheme in {run_context}"
        );
        for boundary in &run.source_boundaries {
            let boundary = *boundary as usize;
            assert!(
                boundary <= source.len(),
                "source boundary past EOF in {run_context}"
            );
            assert!(
                source.is_char_boundary(boundary),
                "source boundary splits UTF-8 in {run_context}"
            );
            assert!(
                boundary >= document_span.start_byte as usize
                    && boundary <= document_span.end_byte as usize,
                "source boundary outside document span in {run_context}"
            );
        }
        for pair in run.source_boundaries.windows(2) {
            assert!(
                pair[0] < pair[1],
                "empty or reversed grapheme source span in {run_context}"
            );
        }
        for covered in &mut coverage[start..end] {
            *covered += 1;
        }
    }

    for (kind, ranges) in [("synthetic", &map.synthetic), ("unmapped", &map.unmapped)] {
        for (range_index, range) in ranges.iter().enumerate() {
            let range_context = format!("{context} {kind} range {range_index}");
            let (start, end) = range_indices(range, block, unit_count, &range_context);
            assert!(start < end, "empty {kind} range in {range_context}");
            for covered in &mut coverage[start..end] {
                *covered += 1;
            }
        }
    }

    assert!(
        coverage.iter().all(|count| *count == 1),
        "source-map categories must exactly partition {context}; coverage={coverage:?}"
    );
}

fn assert_span(source: &str, document_span: SourceSpan, span: SourceSpan, context: &str) {
    assert!(
        span.start_byte <= span.end_byte,
        "reversed span in {context}"
    );
    assert!(
        span.start_byte >= document_span.start_byte,
        "span starts before document in {context}"
    );
    assert!(
        span.end_byte <= document_span.end_byte,
        "span ends after document in {context}"
    );
    assert!(
        source.is_char_boundary(span.start_byte as usize),
        "span starts inside UTF-8 in {context}"
    );
    assert!(
        source.is_char_boundary(span.end_byte as usize),
        "span ends inside UTF-8 in {context}"
    );
}

fn assert_projection_invariants(source: &str, require_fully_mapped: bool) {
    let result = get_mdi_text_blocks(source);
    let document_span = result.document.span;
    assert_eq!(document_span.start_byte, 0);
    assert_eq!(document_span.end_byte as usize, source.len());

    for (offset, block) in result.blocks.iter().enumerate() {
        let context = format!("block {} ({:?}) for {source:?}", block.index, block.kind);
        assert_eq!(
            block.index as usize,
            offset + 1,
            "non-contiguous block indexes"
        );
        let grapheme_count = block.text.graphemes(true).count();
        assert!(
            grapheme_count > 0,
            "empty text block was emitted in {context}"
        );
        assert_eq!(
            range_indices(&block.range, block.index, grapheme_count, &context),
            (0, grapheme_count),
            "block range must cover the complete text"
        );
        if let Some(span) = block.span {
            assert_span(source, document_span, span, &context);
        }
        assert_source_map_partition(
            &block.source_map,
            block.index,
            grapheme_count,
            source,
            document_span,
            &context,
        );
        if require_fully_mapped {
            assert!(
                block.source_map.unmapped.is_empty(),
                "supported syntax is unmapped: {context}"
            );
        }

        for (annotation_index, annotation) in block.annotations.iter().enumerate() {
            let annotation_context = format!("{context}, annotation {annotation_index}");
            assert_eq!(annotation.kind, "rubyReading");
            let annotation_count = annotation.text.graphemes(true).count();
            assert!(
                annotation_count > 0,
                "empty annotation in {annotation_context}"
            );
            let (anchor_start, anchor_end) = range_indices(
                &annotation.anchor,
                block.index,
                grapheme_count,
                &annotation_context,
            );
            assert!(
                anchor_start < anchor_end,
                "empty annotation anchor in {annotation_context}"
            );
            if let Some(span) = annotation.span {
                assert_span(source, document_span, span, &annotation_context);
            }
            assert_source_map_partition(
                &annotation.source_map,
                block.index,
                annotation_count,
                source,
                document_span,
                &annotation_context,
            );
            if require_fully_mapped {
                assert!(
                    annotation.source_map.unmapped.is_empty(),
                    "supported annotation is unmapped: {annotation_context}"
                );
            }
        }
    }

    for (index, diagnostic) in result.diagnostics.iter().enumerate() {
        if let Some(span) = diagnostic.span {
            assert_span(source, document_span, span, &format!("diagnostic {index}"));
        }
    }
}

fn mapped_slices<'a>(block: &'a MdiTextBlock, source: &'a str) -> Vec<&'a str> {
    block
        .source_map
        .runs
        .iter()
        .flat_map(|run| run.source_boundaries.windows(2))
        .map(|pair| &source[pair[0] as usize..pair[1] as usize])
        .collect()
}

#[test]
fn supported_corpus_has_an_exact_fully_mapped_partition() {
    let corpus = [
        "# 序章\n\n本文 &amp; \\* 終了",
        "**強調** _斜体_ ~~削除~~ [表示](https://example.test) ![代替](image.png) `code`",
        "{東京|とうきょう} {東京|とう.きょう} ^12^ [[br]] [[no-break:禁則]][[warichu:割注]][[kern:-0.1em:詰め]][[em:傍点]]",
        "- first\n\n  second\n  - nested\n\n> quote one\n>\n> quote two",
        "| a | b |\n| - | - |\n| c | d |\n\n```mdi\ncode\nline\n```",
        "body[^n]\n\n[^n]: note one\n\n    note two",
        "---\nmdi: '2.0'\ntitle: hidden\n---\n\nvisible\n\n<div>literal</div>",
        "{東京|とうきょう\n\n[[em:未閉\n\n^1234567^\n\n<custom>literal</custom>",
        "e\u{301} 👩🏽‍💻 ✈️ 🇯🇵 1️⃣ क्ष",
        "# \\#\n\n- \\-\n\n> \\>",
    ];

    for source in corpus {
        assert_projection_invariants(source, true);
    }
}

#[test]
fn maps_decoded_and_generated_characters_to_the_right_channels() {
    let source = r"&amp; \* {東京|とうきょう} 前[[br]]次";
    let result = get_mdi_text_blocks(source);
    let block = &result.blocks[0];
    assert_eq!(block.text, "& * 東京 前\n次");
    let slices = mapped_slices(block, source);
    assert!(slices.contains(&"&amp;"));
    assert!(slices.contains(&r"\*"));
    assert!(slices.contains(&"[[br]]"));
    assert!(!slices.iter().any(|slice| slice.contains("とうきょう")));

    let table = get_mdi_text_blocks("| a | b |\n| - | - |\n| c | d |");
    let table = &table.blocks[0];
    assert_eq!(table.kind, MdiTextBlockKind::Table);
    assert_eq!(table.text, "a\tb\nc\td");
    assert_eq!(
        table
            .source_map
            .synthetic
            .iter()
            .map(|range| (range.start.character, range.end.character))
            .collect::<Vec<_>>(),
        vec![(2, 3), (4, 5), (6, 7)]
    );
}

#[test]
fn lf_and_crlf_keep_text_coordinates_but_use_real_byte_widths() {
    let lf = "alpha  \nbeta\n\n```\nx\ny\n```";
    let crlf = lf.replace('\n', "\r\n");
    let lf_result = get_mdi_text_blocks(lf);
    let crlf_result = get_mdi_text_blocks(&crlf);

    assert_eq!(lf_result.blocks.len(), crlf_result.blocks.len());
    for (lf_block, crlf_block) in lf_result.blocks.iter().zip(&crlf_result.blocks) {
        assert_eq!(lf_block.index, crlf_block.index);
        assert_eq!(lf_block.kind, crlf_block.kind);
        assert_eq!(lf_block.text, crlf_block.text);
        assert_eq!(lf_block.range, crlf_block.range);
        assert_eq!(lf_block.annotations, crlf_block.annotations);
    }
    assert_eq!(lf_result.blocks[0].text, "alpha\nbeta");
    assert_eq!(lf_result.blocks[1].text, "x\ny");

    let lf_newlines: Vec<_> = mapped_slices(&lf_result.blocks[0], lf)
        .into_iter()
        .filter(|slice| slice.ends_with('\n'))
        .collect();
    let crlf_newlines: Vec<_> = mapped_slices(&crlf_result.blocks[0], &crlf)
        .into_iter()
        .filter(|slice| slice.ends_with('\n'))
        .collect();
    assert_eq!(lf_newlines, vec!["  \n"]);
    assert_eq!(crlf_newlines, vec!["  \r\n"]);

    let lf_code_newline = mapped_slices(&lf_result.blocks[1], lf)
        .into_iter()
        .find(|slice| slice.ends_with('\n'))
        .expect("mapped LF in code");
    let crlf_code_newline = mapped_slices(&crlf_result.blocks[1], &crlf)
        .into_iter()
        .find(|slice| slice.ends_with('\n'))
        .expect("mapped CRLF in code");
    assert_eq!(lf_code_newline, "\n");
    assert_eq!(crlf_code_newline, "\r\n");
    assert_eq!(crlf_code_newline.len(), lf_code_newline.len() + 1);

    assert_projection_invariants(lf, true);
    assert_projection_invariants(&crlf, true);
}

#[test]
fn unicode_grapheme_matrix_uses_one_based_extended_grapheme_positions() {
    let cases = [
        ("é", 1, "NFC"),
        ("e\u{301}", 1, "NFD"),
        ("a\u{301}\u{327}", 1, "multiple combining marks"),
        ("✈️", 1, "variation selector"),
        ("🇯🇵", 1, "regional-indicator flag"),
        ("👍🏽", 1, "emoji modifier"),
        ("👩🏽‍💻", 1, "ZWJ emoji"),
        ("1️⃣", 1, "keycap"),
        ("क्ष", 1, "Indic conjunct"),
        ("日👩🏽‍💻e\u{301}", 3, "mixed graphemes"),
        ("e*\u{301}*", 1, "grapheme crossing Markdown nodes"),
    ];

    for (source, expected_count, label) in cases {
        let result = get_mdi_text_blocks(source);
        assert_eq!(result.blocks.len(), 1, "{label}");
        let block = &result.blocks[0];
        assert_eq!(
            block.text.graphemes(true).count(),
            expected_count,
            "{label}"
        );
        assert_eq!(block.range.start.character, 1, "{label}");
        assert_eq!(
            block.range.end.character,
            expected_count as u32 + 1,
            "{label}"
        );
        assert_projection_invariants(source, true);
    }
}

fn positions(range: &MdiTextRange) -> (u32, u32, u32, u32) {
    (
        range.start.block,
        range.start.character,
        range.end.block,
        range.end.character,
    )
}

#[test]
fn ruby_group_split_and_mismatch_anchors_are_stable() {
    let group = get_mdi_text_blocks("前{東京|とうきょう}後");
    assert_eq!(group.blocks[0].text, "前東京後");
    let annotation = &group.blocks[0].annotations[0];
    assert_eq!(annotation.text, "とうきょう");
    assert_eq!(positions(&annotation.anchor), (1, 2, 1, 4));

    let split = get_mdi_text_blocks("{東京|とう.きょう}");
    assert_eq!(split.blocks[0].annotations.len(), 2);
    assert_eq!(split.blocks[0].annotations[0].text, "とう");
    assert_eq!(
        positions(&split.blocks[0].annotations[0].anchor),
        (1, 1, 1, 2)
    );
    assert_eq!(split.blocks[0].annotations[1].text, "きょう");
    assert_eq!(
        positions(&split.blocks[0].annotations[1].anchor),
        (1, 2, 1, 3)
    );

    for source in ["{東京|とう.}", "{東京|と.う.き}"] {
        let result = get_mdi_text_blocks(source);
        assert_eq!(result.blocks[0].annotations.len(), 1, "{source}");
        assert_eq!(
            positions(&result.blocks[0].annotations[0].anchor),
            (1, 1, 1, 3)
        );
        let warnings: Vec<_> = result
            .diagnostics
            .iter()
            .filter(|diagnostic| diagnostic.code == "mdi.textProjection.rubySplitMismatch")
            .collect();
        assert_eq!(warnings.len(), 1, "{source}");
        assert_eq!(
            warnings[0].span,
            Some(SourceSpan {
                start_byte: 0,
                end_byte: source.len() as u32
            })
        );
        assert_projection_invariants(source, true);
    }
}

#[test]
fn ruby_escapes_survive_the_document_parser_and_map_complete_escape_tokens() {
    let escaped = r"{A\|B|えー.ぱいぷ.びー} {点|てん\.読み} {A|えー\|びー}";
    let escaped_result = get_mdi_text_blocks(escaped);
    assert_eq!(escaped_result.blocks[0].text, "A|B 点 A");
    let escaped_annotations = &escaped_result.blocks[0].annotations;
    assert_eq!(
        escaped_annotations
            .iter()
            .map(|annotation| annotation.text.as_str())
            .collect::<Vec<_>>(),
        vec!["えー", "ぱいぷ", "びー", "てん.読み", "えー|びー"]
    );
    assert_eq!(positions(&escaped_annotations[0].anchor), (1, 1, 1, 2));
    assert_eq!(positions(&escaped_annotations[1].anchor), (1, 2, 1, 3));
    assert_eq!(positions(&escaped_annotations[2].anchor), (1, 3, 1, 4));
    assert_eq!(positions(&escaped_annotations[3].anchor), (1, 5, 1, 6));
    assert_eq!(positions(&escaped_annotations[4].anchor), (1, 7, 1, 8));
    let reading_slices: Vec<_> = escaped_annotations[3]
        .source_map
        .runs
        .iter()
        .flat_map(|run| run.source_boundaries.windows(2))
        .map(|pair| &escaped[pair[0] as usize..pair[1] as usize])
        .collect();
    assert!(
        reading_slices.contains(&r"\."),
        "escaped dot must map to the complete token"
    );
    assert_projection_invariants(escaped, true);
}

#[test]
fn multiple_ruby_annotations_keep_independent_source_order_anchors() {
    let multiple = "{東|とう}と{京|きょう}";
    let multiple_result = get_mdi_text_blocks(multiple);
    assert_eq!(multiple_result.blocks[0].text, "東と京");
    assert_eq!(multiple_result.blocks[0].annotations.len(), 2);
    assert_eq!(
        positions(&multiple_result.blocks[0].annotations[0].anchor),
        (1, 1, 1, 2)
    );
    assert_eq!(
        positions(&multiple_result.blocks[0].annotations[1].anchor),
        (1, 3, 1, 4)
    );
    assert_projection_invariants(multiple, true);
}

fn generated_source(mut state: u64) -> String {
    const FRAGMENTS: &[&str] = &[
        "東京",
        "👩🏽‍💻",
        "e\u{301}",
        " ",
        "\t",
        "\r",
        "\n",
        "\\",
        "{",
        "}",
        "|",
        ".",
        "^12^",
        "^_^",
        "{東京|とう.きょう}",
        "{A\\|B|a.b.c}",
        "[[br]]",
        "[[em:強調]]",
        "[[no-break:^12^]]",
        "[[kern:wide:x]]",
        "[[indent:2]]",
        "[[pagebreak:left]]",
        "《《傍点》》",
        "**strong**",
        "`^12^`",
        "[^n]",
        "\n\n",
        "| a | b |\n| - | - |\n| 1 | 2 |\n",
        "[link](https://example.test/?a=1&b=2)",
        "![alt](image.png)",
        "<script>x</script>",
        "&amp;",
        "&#x1f469;",
        "\\{",
        "\\[",
        "---\nmdi: '3.0'\ntitle: adversarial\n---\n",
    ];
    let mut source = String::new();
    for _ in 0..24 {
        state ^= state << 13;
        state ^= state >> 7;
        state ^= state << 17;
        source.push_str(FRAGMENTS[(state as usize) % FRAGMENTS.len()]);
    }
    source
}

#[test]
fn parser_recovery_never_panics_on_known_adversarial_combinations() {
    let mut panic_seeds = Vec::new();
    for seed in [10_u64, 14, 83] {
        let source = generated_source(seed);
        match std::panic::catch_unwind(|| get_mdi_text_blocks(&source)) {
            Ok(result) => {
                assert_eq!(
                    result
                        .diagnostics
                        .first()
                        .map(|diagnostic| diagnostic.code.as_str()),
                    Some("mdi.parser.recovered"),
                    "seed {seed} must take the pre-parser recovery path used by Wasm"
                );
                assert_eq!(result.blocks.len(), 1, "seed {seed}");
                assert_eq!(result.blocks[0].text, source, "seed {seed}");
            }
            Err(_) => panic_seeds.push((seed, source)),
        }
    }
    assert!(
        panic_seeds.is_empty(),
        "projection panicked for deterministic regression cases: {panic_seeds:#?}"
    );
}

#[test]
fn deterministic_adversarial_corpus_serializes_stably() {
    for seed in 0..96_u64 {
        if [10, 14, 83].contains(&seed) {
            continue;
        }
        let source = generated_source(seed);
        let result = std::panic::catch_unwind(|| get_mdi_text_blocks(&source))
            .unwrap_or_else(|_| panic!("projection panicked for seed {seed}: {source:?}"));
        let second = get_mdi_text_blocks(&source);
        assert_eq!(result, second, "non-deterministic result for seed {seed}");

        let json = std::panic::catch_unwind(|| get_mdi_text_blocks_json(&source))
            .unwrap_or_else(|_| panic!("JSON projection panicked for seed {seed}: {source:?}"));
        assert_eq!(
            json,
            get_mdi_text_blocks_json(&source),
            "non-deterministic JSON for seed {seed}"
        );
        let decoded: serde_json::Value = serde_json::from_str(&json)
            .unwrap_or_else(|error| panic!("invalid JSON for seed {seed}: {error}"));
        assert_eq!(decoded["projectionVersion"], "1.0");
        assert_eq!(
            decoded["positionEncoding"],
            "unicode-grapheme-cluster-1-based"
        );

        assert_projection_invariants(&source, false);
    }
}
