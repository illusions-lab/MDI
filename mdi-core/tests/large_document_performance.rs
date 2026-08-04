//! Large-document throughput and integrity checks.
//!
//! These are intentionally ignored in the ordinary test suite.  Run them with
//! `cargo test --release --test large_document_performance -- --ignored
//! --nocapture --test-threads=1`.  CI runs every case in its own matrix job and
//! publishes the JSON lines printed below as a combined, commit-addressed
//! artifact.  Throughput remains a report rather than a microbenchmark gate,
//! because hosted runners have variable CPU shares.

use std::hint::black_box;
use std::time::Instant;

use mdi_core::{parse_document, serialize_mdi_document};

const HUNDRED_THOUSAND: usize = 100_000;
const MILLION: usize = 1_000_000;
const TEN_MILLION: usize = 10_000_000;
const HUNDRED_MILLION: usize = 100_000_000;

/// Generate a book-like Japanese MDI source with an exact Unicode scalar
/// count.  It has headings, paragraphs, ruby, emphasis, and tate-chu-yoko so
/// this exercises more than a repeated plain-text fast path.
fn book_source(characters: usize) -> String {
    const CHAPTER: &str = "# 第一章\n\n吾輩は{猫|ねこ}である。[[em:名前]]はまだない。第^12^話。\n\n";
    const PARAGRAPH: &str = "東京の空は青く、{言葉|ことば}は静かに続く。\n\n";

    let mut source = String::with_capacity(characters.saturating_mul(3));
    let chapter_characters = CHAPTER.chars().count();
    let paragraph_characters = PARAGRAPH.chars().count();
    let mut used_characters = 0;

    let mut paragraphs = 0;
    while used_characters + paragraph_characters <= characters {
        // Keep headings frequent enough to exercise block lowering as well as
        // inline syntax, without scanning the source to find the next split.
        if paragraphs % 64 == 0
            && used_characters + chapter_characters + paragraph_characters <= characters
        {
            source.push_str(CHAPTER);
            used_characters += chapter_characters;
        }
        source.push_str(PARAGRAPH);
        used_characters += paragraph_characters;
        paragraphs += 1;
    }

    // Japanese publishing work commonly budgets by characters.  Pad with a
    // plain CJK scalar so the public cases are exactly 100k, 1M, 10M, and 100M
    // characters even when a structured unit does not divide them evenly.
    source.extend(std::iter::repeat_n('字', characters - used_characters));
    assert_eq!(source.chars().count(), characters);
    source
}

fn run_case(characters: usize) {
    let source = book_source(characters);
    let source_bytes = source.len();

    let parse_started = Instant::now();
    let document = parse_document(black_box(&source));
    let parse_elapsed = parse_started.elapsed();

    assert_eq!(document.span.start_byte, 0);
    assert_eq!(document.span.end_byte as usize, source_bytes);
    assert!(!document.children.is_empty(), "large source was truncated");

    let serialize_started = Instant::now();
    let canonical = serialize_mdi_document(black_box(&document));
    let serialize_elapsed = serialize_started.elapsed();

    assert!(!canonical.is_empty(), "canonical serialization was truncated");
    // The 100M case is intentionally large.  Release the parsed tree before
    // parsing its canonical form so round-trip validation does not retain two
    // complete document trees at once.
    drop(document);
    let reparsed = parse_document(black_box(&canonical));
    assert_eq!(reparsed.span.end_byte as usize, canonical.len());
    assert!(!reparsed.children.is_empty(), "canonical document was truncated");

    // Keep the result machine-readable for the workflow artifact.  Throughput
    // is reported instead of enforced: hosted runners have variable CPU shares.
    println!(
        "PERF_RESULT {{\"characters\":{characters},\"source_bytes\":{source_bytes},\"canonical_bytes\":{},\"parse_ms\":{},\"serialize_ms\":{},\"parse_chars_per_second\":{:.2},\"serialize_chars_per_second\":{:.2}}}",
        canonical.len(),
        parse_elapsed.as_millis(),
        serialize_elapsed.as_millis(),
        characters as f64 / parse_elapsed.as_secs_f64(),
        characters as f64 / serialize_elapsed.as_secs_f64(),
    );
}

#[test]
#[ignore = "run in the Large document performance CI job"]
fn hundred_thousand_character_book() {
    run_case(HUNDRED_THOUSAND);
}

#[test]
#[ignore = "run in the Large document performance CI job"]
fn million_character_book() {
    run_case(MILLION);
}

#[test]
#[ignore = "run in the Large document performance CI job"]
fn ten_million_character_book() {
    run_case(TEN_MILLION);
}

#[test]
#[ignore = "run in the Large document performance CI job"]
fn hundred_million_character_book() {
    run_case(HUNDRED_MILLION);
}
