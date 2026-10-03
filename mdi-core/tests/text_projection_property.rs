use mdi_core::{MdiTextBlock, get_mdi_text_blocks, get_mdi_text_blocks_json};
use proptest::prelude::*;
use unicode_segmentation::UnicodeSegmentation;

fn assert_total_partition(block: &MdiTextBlock, source: &str) {
    let graphemes = block.text.graphemes(true).count();
    assert_eq!(block.index, block.range.start.block);
    assert_eq!(block.index, block.range.end.block);
    assert_eq!(block.range.start.character, 1);
    assert_eq!(block.range.end.character as usize, graphemes + 1);

    let mut coverage = vec![0_u8; graphemes];
    for run in &block.source_map.runs {
        let start = run.range.start.character as usize - 1;
        let end = run.range.end.character as usize - 1;
        assert!(start <= end && end <= graphemes);
        assert_eq!(run.source_boundaries.len(), end - start + 1);
        for boundary in &run.source_boundaries {
            assert!((*boundary as usize) <= source.len());
            assert!(source.is_char_boundary(*boundary as usize));
        }
        for pair in run.source_boundaries.windows(2) {
            assert!(pair[0] <= pair[1]);
        }
        for item in &mut coverage[start..end] {
            *item += 1;
        }
    }
    for range in block
        .source_map
        .synthetic
        .iter()
        .chain(&block.source_map.unmapped)
    {
        let start = range.start.character as usize - 1;
        let end = range.end.character as usize - 1;
        assert!(start <= end && end <= graphemes);
        for item in &mut coverage[start..end] {
            *item += 1;
        }
    }
    assert!(coverage.iter().all(|count| *count == 1));
}

proptest! {
    #![proptest_config(ProptestConfig {
        cases: 96,
        failure_persistence: None,
        ..ProptestConfig::default()
    })]

    #[test]
    fn arbitrary_unicode_is_total_deterministic_and_well_formed(
        characters in prop::collection::vec(any::<char>(), 0..160),
    ) {
        let source: String = characters.into_iter().collect();
        let first = get_mdi_text_blocks(&source);
        let second = get_mdi_text_blocks(&source);
        prop_assert_eq!(&first, &second);
        prop_assert_eq!(first.document.span.start_byte, 0);
        prop_assert_eq!(first.document.span.end_byte as usize, source.len());
        prop_assert_eq!(get_mdi_text_blocks_json(&source), get_mdi_text_blocks_json(&source));
        for (index, block) in first.blocks.iter().enumerate() {
            prop_assert_eq!(block.index as usize, index + 1);
            assert_total_partition(block, &source);
        }
    }

    #[test]
    fn generated_supported_inline_corpus_has_no_unmapped_text(
        pieces in prop::collection::vec(
            prop_oneof![
                Just("日本語"),
                Just("e\u{301}"),
                Just("👩🏽‍💻"),
                Just("{東京|とうきょう}"),
                Just("{東京|とう.きょう}"),
                Just("^12^"),
                Just("**strong**"),
                Just("[label](https://example.test)"),
                Just("![alt](image.png)"),
                Just("`code`"),
                Just(r"\*"),
                Just("&amp;"),
                Just("[[no-break:禁則]]"),
                Just("[[warichu:割注]]"),
                Just("[[kern:-0.1em:詰め]]"),
                Just("[[em:傍点]]"),
                Just("before[[br]]after"),
            ],
            1..48,
        ),
    ) {
        let source = pieces.join(" ");
        let result = get_mdi_text_blocks(&source);
        prop_assert!(!result.blocks.is_empty());
        for block in &result.blocks {
            assert_total_partition(block, &source);
            prop_assert!(block.source_map.unmapped.is_empty(), "{block:#?}");
        }
    }
}
