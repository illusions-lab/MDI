use crate::{
    Diagnostic, DiagnosticSeverity, Document, MDI_IR_VERSION, MDI_SPEC_VERSION, ParserCapabilities,
    SourceSpan, diagnostics, parse_document,
};
use serde::Serialize;
use std::fmt;
use unicode_segmentation::UnicodeSegmentation;

pub(crate) enum PlainInline<'a> {
    Value(&'a str),
    Break,
    Skip,
    Children,
}

/// The single plaintext rule table used by both `render_text` and the mapped
/// block projection. Source-map construction is layered on top of this value.
pub(crate) fn plain_inline(node: &serde_json::Value) -> PlainInline<'_> {
    match node_type(node) {
        "text" | "inlineCode" | "code" | "html" | "tcy" => PlainInline::Value(
            node.get("value")
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default(),
        ),
        "ruby" => PlainInline::Value(
            node.get("base")
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default(),
        ),
        "image" => PlainInline::Value(
            node.get("alt")
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default(),
        ),
        "break" => PlainInline::Break,
        "footnoteReference" => PlainInline::Skip,
        _ if node.get("children").is_some() => PlainInline::Children,
        _ => node
            .get("value")
            .and_then(serde_json::Value::as_str)
            .map_or(PlainInline::Skip, PlainInline::Value),
    }
}

pub const MDI_TEXT_PROJECTION_VERSION: &str = "1.0";

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MdiTextBlocksResult {
    pub projection_version: &'static str,
    pub position_encoding: &'static str,
    pub ir_version: &'static str,
    pub syntax_version: &'static str,
    pub capabilities: ParserCapabilities,
    pub blocks: Vec<MdiTextBlock>,
    pub document: Document,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MdiTextBlock {
    pub index: u32,
    pub kind: MdiTextBlockKind,
    pub text: String,
    pub range: MdiTextRange,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub span: Option<SourceSpan>,
    pub source_map: MdiTextSourceMap,
    pub annotations: Vec<MdiTextAnnotation>,
    pub node: serde_json::Value,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum MdiTextBlockKind {
    Heading,
    Paragraph,
    ListItem,
    Blockquote,
    Code,
    Table,
    Footnote,
    Html,
    Other,
}

/// A one-based block/Unicode-grapheme position, serialized as `3:18`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MdiTextPosition {
    pub block: u32,
    pub character: u32,
}

impl Serialize for MdiTextPosition {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&format!("{}:{}", self.block, self.character))
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct MdiTextRange {
    pub start: MdiTextPosition,
    pub end: MdiTextPosition,
}

#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize)]
pub struct MdiTextSourceMap {
    pub runs: Vec<MdiTextSourceRun>,
    pub synthetic: Vec<MdiTextRange>,
    pub unmapped: Vec<MdiTextRange>,
}

/// Annotation text uses the containing block number and its own one-based
/// character offsets. This keeps the run format identical in both channels.
pub type MdiAnnotationSourceMap = MdiTextSourceMap;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MdiTextSourceRun {
    pub range: MdiTextRange,
    pub source_boundaries: Vec<u32>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MdiTextAnnotation {
    pub kind: &'static str,
    pub text: String,
    pub anchor: MdiTextRange,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub span: Option<SourceSpan>,
    pub source_map: MdiAnnotationSourceMap,
}

/// Result of resolving one half-open UTF-8 source span back to canonical text.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MdiSourceSpanTextResolution {
    pub projection_version: &'static str,
    pub source_span: SourceSpan,
    pub coverage: MdiSourceSpanCoverage,
    pub matches: Vec<MdiSourceSpanTextMatch>,
}

/// How much of a non-empty source span belongs to mapped graphemes.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum MdiSourceSpanCoverage {
    Complete,
    Partial,
    None,
}

/// Relationship between a canonical match's forward source coverage and the
/// requested source span.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum MdiSourceSpanRelation {
    Exact,
    Overlap,
}

/// A maximal adjacent canonical range in either block text or one annotation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum MdiSourceSpanTextMatch {
    BlockText {
        block_index: u32,
        range: MdiTextRange,
        relation: MdiSourceSpanRelation,
    },
    Annotation {
        block_index: u32,
        annotation_index: u32,
        range: MdiTextRange,
        relation: MdiSourceSpanRelation,
    },
}

/// Validation error returned by [`resolve_mdi_source_span`].
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MdiSourceSpanResolutionError {
    Reversed,
    OutOfBounds,
    NotUtf8Boundary,
}

impl fmt::Display for MdiSourceSpanResolutionError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Self::Reversed => "source span startByte must not exceed endByte",
            Self::OutOfBounds => "source span falls outside the UTF-8 source length",
            Self::NotUtf8Boundary => "source span endpoints must be UTF-8 code-point boundaries",
        })
    }
}

impl std::error::Error for MdiSourceSpanResolutionError {}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum UnitMap {
    Mapped(SourceSpan),
    Synthetic,
    Unmapped,
}

struct AnnotationDraft {
    text: String,
    anchor_start: usize,
    anchor_end: usize,
    span: Option<SourceSpan>,
    units: Vec<UnitMap>,
}

struct BlockDraft {
    kind: MdiTextBlockKind,
    text: String,
    units: Vec<UnitMap>,
    unit_texts: Vec<String>,
    annotations: Vec<AnnotationDraft>,
    span: Option<SourceSpan>,
    node: serde_json::Value,
    mapping_warning: bool,
    source_cursor: u32,
    source_end: u32,
}

impl BlockDraft {
    fn new(kind: MdiTextBlockKind, node: &serde_json::Value) -> Self {
        let span = node_span(node);
        Self {
            kind,
            text: String::new(),
            units: Vec::new(),
            unit_texts: Vec::new(),
            annotations: Vec::new(),
            span,
            node: node.clone(),
            mapping_warning: false,
            source_cursor: span.map_or(0, |span| span.start_byte),
            source_end: span.map_or(0, |span| span.end_byte),
        }
    }

    fn grapheme_len(&self) -> usize {
        self.text.graphemes(true).count()
    }

    fn append_synthetic(&mut self, value: &str) {
        self.text.push_str(value);
        for grapheme in value.graphemes(true) {
            self.unit_texts.push(grapheme.to_owned());
            self.units.push(UnitMap::Synthetic);
        }
    }

    fn append_unmapped(&mut self, value: &str) {
        if value.is_empty() {
            return;
        }
        self.text.push_str(value);
        for grapheme in value.graphemes(true) {
            self.unit_texts.push(grapheme.to_owned());
            self.units.push(UnitMap::Unmapped);
        }
        self.mapping_warning = true;
    }

    fn append_mapped(&mut self, value: &str, spans: Option<Vec<SourceSpan>>) {
        if value.is_empty() {
            return;
        }
        let count = value.graphemes(true).count();
        match spans {
            Some(spans) if spans.len() == count => {
                self.text.push_str(value);
                for (grapheme, span) in value.graphemes(true).zip(spans) {
                    self.unit_texts.push(grapheme.to_owned());
                    self.units.push(UnitMap::Mapped(span));
                }
            }
            _ => self.append_unmapped(value),
        }
    }
}

struct Collector<'a> {
    source: &'a str,
    blocks: Vec<MdiTextBlock>,
    diagnostics: Vec<Diagnostic>,
}

/// Parse once and produce the complete IR envelope plus the Rust-owned text
/// projection and its UTF-8 source map.
pub fn get_mdi_text_blocks(source: &str) -> MdiTextBlocksResult {
    let document = parse_document(source);
    let mut collector = Collector {
        source,
        blocks: Vec::new(),
        diagnostics: diagnostics(&document),
    };
    for node in &document.children {
        collector.collect(node, false);
    }
    MdiTextBlocksResult {
        projection_version: MDI_TEXT_PROJECTION_VERSION,
        position_encoding: "unicode-grapheme-cluster-1-based",
        ir_version: MDI_IR_VERSION,
        syntax_version: MDI_SPEC_VERSION,
        capabilities: ParserCapabilities {
            mdi: true,
            common_mark: true,
            gfm: true,
            front_matter: true,
            source_spans: true,
        },
        blocks: collector.blocks,
        document,
        diagnostics: collector.diagnostics,
    }
}

pub fn get_mdi_text_blocks_json(source: &str) -> String {
    serde_json::to_string(&get_mdi_text_blocks(source))
        .expect("serializing the MDI text projection cannot fail")
}

/// Resolve a half-open UTF-8 source span to every mapped canonical grapheme
/// range. Block text and annotation text are independent channels.
pub fn resolve_mdi_source_span(
    source: &str,
    span: SourceSpan,
) -> Result<MdiSourceSpanTextResolution, MdiSourceSpanResolutionError> {
    validate_source_span(source, span)?;
    let projection = get_mdi_text_blocks(source);
    Ok(resolve_mdi_source_span_in_projection(&projection, span))
}

/// Resolve many source spans after parsing and projecting `source` exactly
/// once. Input order is preserved in the returned resolutions.
pub fn resolve_mdi_source_spans(
    source: &str,
    spans: &[SourceSpan],
) -> Result<Vec<MdiSourceSpanTextResolution>, MdiSourceSpanResolutionError> {
    for &span in spans {
        validate_source_span(source, span)?;
    }
    if spans.is_empty() {
        return Ok(Vec::new());
    }
    let projection = get_mdi_text_blocks(source);
    Ok(spans
        .iter()
        .map(|&span| resolve_mdi_source_span_in_projection(&projection, span))
        .collect())
}

fn resolve_mdi_source_span_in_projection(
    projection: &MdiTextBlocksResult,
    span: SourceSpan,
) -> MdiSourceSpanTextResolution {
    if span.start_byte == span.end_byte {
        return MdiSourceSpanTextResolution {
            projection_version: MDI_TEXT_PROJECTION_VERSION,
            source_span: span,
            coverage: MdiSourceSpanCoverage::None,
            matches: Vec::new(),
        };
    }

    let mut matches = Vec::new();
    let mut covered = Vec::new();
    for block in &projection.blocks {
        resolve_source_map_channel(
            block.index,
            None,
            &block.source_map,
            span,
            &mut matches,
            &mut covered,
        );
        for (annotation_index, annotation) in block.annotations.iter().enumerate() {
            resolve_source_map_channel(
                block.index,
                Some(annotation_index as u32),
                &annotation.source_map,
                span,
                &mut matches,
                &mut covered,
            );
        }
    }

    let covered = merged_intervals(covered);
    let coverage = if covered.is_empty() {
        MdiSourceSpanCoverage::None
    } else if covered.len() == 1
        && covered[0].start_byte == span.start_byte
        && covered[0].end_byte == span.end_byte
    {
        MdiSourceSpanCoverage::Complete
    } else {
        MdiSourceSpanCoverage::Partial
    };
    MdiSourceSpanTextResolution {
        projection_version: MDI_TEXT_PROJECTION_VERSION,
        source_span: span,
        coverage,
        matches,
    }
}

/// JSON boundary for language bindings.
pub fn resolve_mdi_source_span_json(
    source: &str,
    span: SourceSpan,
) -> Result<String, MdiSourceSpanResolutionError> {
    let resolution = resolve_mdi_source_span(source, span)?;
    Ok(serde_json::to_string(&resolution)
        .expect("serializing an MDI source-span resolution cannot fail"))
}

/// Batched JSON boundary for language bindings. The source is parsed once for
/// all spans, and the returned array follows input order.
pub fn resolve_mdi_source_spans_json(
    source: &str,
    spans: &[SourceSpan],
) -> Result<String, MdiSourceSpanResolutionError> {
    let resolutions = resolve_mdi_source_spans(source, spans)?;
    Ok(serde_json::to_string(&resolutions)
        .expect("serializing MDI source-span resolutions cannot fail"))
}

fn validate_source_span(
    source: &str,
    span: SourceSpan,
) -> Result<(), MdiSourceSpanResolutionError> {
    if span.start_byte > span.end_byte {
        return Err(MdiSourceSpanResolutionError::Reversed);
    }
    let start = span.start_byte as usize;
    let end = span.end_byte as usize;
    if end > source.len() {
        return Err(MdiSourceSpanResolutionError::OutOfBounds);
    }
    if !source.is_char_boundary(start) || !source.is_char_boundary(end) {
        return Err(MdiSourceSpanResolutionError::NotUtf8Boundary);
    }
    Ok(())
}

fn resolve_source_map_channel(
    block_index: u32,
    annotation_index: Option<u32>,
    map: &MdiTextSourceMap,
    requested: SourceSpan,
    matches: &mut Vec<MdiSourceSpanTextMatch>,
    covered: &mut Vec<SourceSpan>,
) {
    let mut current_start = None;
    let mut current_end = 0;
    let mut current_spans = Vec::new();

    let flush = |start: &mut Option<u32>,
                 end: &mut u32,
                 spans: &mut Vec<SourceSpan>,
                 matches: &mut Vec<MdiSourceSpanTextMatch>| {
        let Some(start_character) = start.take() else {
            return;
        };
        let relation = if intervals_equal_span(spans, requested) {
            MdiSourceSpanRelation::Exact
        } else {
            MdiSourceSpanRelation::Overlap
        };
        let range = MdiTextRange {
            start: MdiTextPosition {
                block: block_index,
                character: start_character,
            },
            end: MdiTextPosition {
                block: block_index,
                character: *end,
            },
        };
        matches.push(match annotation_index {
            Some(annotation_index) => MdiSourceSpanTextMatch::Annotation {
                block_index,
                annotation_index,
                range,
                relation,
            },
            None => MdiSourceSpanTextMatch::BlockText {
                block_index,
                range,
                relation,
            },
        });
        spans.clear();
    };

    for run in &map.runs {
        let run_start = run.range.start.character;
        for (offset, boundaries) in run.source_boundaries.windows(2).enumerate() {
            let character = run_start + offset as u32;
            let unit_span = SourceSpan {
                start_byte: boundaries[0],
                end_byte: boundaries[1],
            };
            if unit_span.start_byte < requested.end_byte
                && requested.start_byte < unit_span.end_byte
            {
                if current_start.is_some() && character != current_end {
                    flush(
                        &mut current_start,
                        &mut current_end,
                        &mut current_spans,
                        matches,
                    );
                }
                current_start.get_or_insert(character);
                current_end = character + 1;
                current_spans.push(unit_span);
                covered.push(SourceSpan {
                    start_byte: unit_span.start_byte.max(requested.start_byte),
                    end_byte: unit_span.end_byte.min(requested.end_byte),
                });
            } else if current_start.is_some() && character == current_end {
                flush(
                    &mut current_start,
                    &mut current_end,
                    &mut current_spans,
                    matches,
                );
            }
        }
    }
    flush(
        &mut current_start,
        &mut current_end,
        &mut current_spans,
        matches,
    );
}

fn intervals_equal_span(intervals: &[SourceSpan], span: SourceSpan) -> bool {
    let merged = merged_intervals(intervals.to_vec());
    merged.len() == 1 && merged[0] == span
}

fn merged_intervals(mut intervals: Vec<SourceSpan>) -> Vec<SourceSpan> {
    intervals.sort_unstable_by_key(|span| (span.start_byte, span.end_byte));
    let mut merged: Vec<SourceSpan> = Vec::new();
    for interval in intervals {
        if let Some(previous) = merged.last_mut()
            && interval.start_byte <= previous.end_byte
        {
            previous.end_byte = previous.end_byte.max(interval.end_byte);
        } else {
            merged.push(interval);
        }
    }
    merged
}

impl Collector<'_> {
    fn collect(&mut self, node: &serde_json::Value, quoted: bool) {
        let kind = node_type(node);
        match kind {
            "heading" => self.inline_block(MdiTextBlockKind::Heading, node),
            "paragraph" => self.inline_block(
                if quoted {
                    MdiTextBlockKind::Blockquote
                } else {
                    MdiTextBlockKind::Paragraph
                },
                node,
            ),
            "blockquote" => {
                for child in children(node) {
                    self.collect(child, true);
                }
            }
            "list" => {
                for child in children(node) {
                    self.collect(child, quoted);
                }
            }
            "listItem" => self.list_item(node, quoted),
            "code" => self.scalar_block(MdiTextBlockKind::Code, node, "value"),
            "html" => self.scalar_block(MdiTextBlockKind::Html, node, "value"),
            "table" => self.table(node),
            "footnoteDefinition" => self.footnote(node),
            "yaml" | "definition" | "blank" | "pagebreak" | "thematicBreak" => {}
            _ => {
                if node_span(node).is_some() {
                    let mut draft = BlockDraft::new(MdiTextBlockKind::Other, node);
                    self.project_inline(node, &mut draft);
                    self.finish(draft);
                }
            }
        }
    }

    fn inline_block(&mut self, kind: MdiTextBlockKind, node: &serde_json::Value) {
        let mut draft = BlockDraft::new(kind, node);
        self.project_children(node, &mut draft);
        self.finish(draft);
    }

    fn scalar_block(&mut self, kind: MdiTextBlockKind, node: &serde_json::Value, field: &str) {
        let mut draft = BlockDraft::new(kind, node);
        if let Some(value) = node.get(field).and_then(serde_json::Value::as_str) {
            // markdown-rs preserves the source line ending inside fenced code.
            // Projection coordinates use a single `\n` text unit regardless of
            // whether that unit came from LF or CRLF source bytes.
            let normalized;
            let value = if kind == MdiTextBlockKind::Code && value.contains('\r') {
                normalized = value.replace("\r\n", "\n").replace('\r', "\n");
                normalized.as_str()
            } else {
                value
            };
            let spans = if kind == MdiTextBlockKind::Code {
                self.map_code_block(value, &mut draft)
            } else {
                self.map_value_in_block(value, &mut draft)
            };
            draft.append_mapped(value, spans);
        }
        self.finish(draft);
    }

    fn list_item(&mut self, node: &serde_json::Value, quoted: bool) {
        let paragraphs: Vec<_> = children(node)
            .filter(|child| node_type(child) == "paragraph")
            .collect();
        if !paragraphs.is_empty() {
            let mut draft = BlockDraft::new(MdiTextBlockKind::ListItem, node);
            for (index, paragraph) in paragraphs.into_iter().enumerate() {
                if index > 0 {
                    draft.append_synthetic("\n\n");
                }
                self.project_children(paragraph, &mut draft);
            }
            self.finish(draft);
        }
        for child in children(node) {
            if node_type(child) != "paragraph" {
                self.collect(child, quoted);
            }
        }
    }

    fn footnote(&mut self, node: &serde_json::Value) {
        let mut draft = BlockDraft::new(MdiTextBlockKind::Footnote, node);
        for (index, child) in children(node).enumerate() {
            if index > 0 {
                draft.append_synthetic("\n\n");
            }
            if node_type(child) == "paragraph" {
                self.project_children(child, &mut draft);
            } else {
                self.project_inline(child, &mut draft);
            }
        }
        self.finish(draft);
    }

    fn table(&mut self, node: &serde_json::Value) {
        let mut draft = BlockDraft::new(MdiTextBlockKind::Table, node);
        for (row_index, row) in children(node).enumerate() {
            if row_index > 0 {
                draft.append_synthetic("\n");
            }
            for (cell_index, cell) in children(row).enumerate() {
                if cell_index > 0 {
                    draft.append_synthetic("\t");
                }
                self.project_children(cell, &mut draft);
            }
        }
        self.finish(draft);
    }

    fn project_children(&mut self, node: &serde_json::Value, draft: &mut BlockDraft) {
        for child in children(node) {
            self.project_inline(child, draft);
        }
    }

    fn project_inline(&mut self, node: &serde_json::Value, draft: &mut BlockDraft) {
        match plain_inline(node) {
            PlainInline::Value(value) => {
                if node_type(node) == "ruby" {
                    self.project_ruby(node, draft);
                    return;
                }
                let spans = match node_type(node) {
                    "tcy" => self.map_delimited_in_block(value, &mut *draft, '^', '^'),
                    "image" => self.map_image_in_block(value, draft),
                    "inlineCode" => self.map_inline_code_in_block(value, draft),
                    _ => self.map_value_from_node(value, node, draft),
                };
                draft.append_mapped(value, spans);
            }
            PlainInline::Break => {
                let spans = self.map_break_in_block(draft);
                draft.append_mapped("\n", spans);
            }
            PlainInline::Skip => {}
            PlainInline::Children => {
                self.project_children(node, draft);
                self.advance_after_container(node, draft);
            }
        }
    }

    fn project_ruby(&mut self, node: &serde_json::Value, draft: &mut BlockDraft) {
        let base = node
            .get("base")
            .and_then(serde_json::Value::as_str)
            .unwrap_or_default();
        let base_start = draft.grapheme_len();
        let reading_value = node
            .pointer("/ruby/value")
            .map(|value| match value {
                serde_json::Value::String(value) => value.clone(),
                serde_json::Value::Array(values) => values
                    .iter()
                    .filter_map(serde_json::Value::as_str)
                    .collect::<String>(),
                _ => String::new(),
            })
            .unwrap_or_default();
        let parts = find_ruby_parts(
            base,
            &reading_value,
            self.source,
            draft.source_cursor,
            draft.source_end,
        );
        if let Some(parts) = &parts {
            draft.source_cursor = parts.token_end;
        }
        let base_spans = parts
            .as_ref()
            .and_then(|parts| map_decoded(base, parts.base, parts.base_start));
        draft.append_mapped(base, base_spans);
        let base_end = draft.grapheme_len();

        let ruby = node.get("ruby");
        let ruby_type = ruby
            .and_then(|value| value.get("type"))
            .and_then(serde_json::Value::as_str)
            .unwrap_or("group");
        if ruby_type == "split" {
            let readings = ruby
                .and_then(|value| value.get("value"))
                .and_then(serde_json::Value::as_array);
            if let Some(readings) = readings {
                let raw_parts = parts.as_ref().map(|value| split_raw_reading(value));
                for (index, reading) in readings
                    .iter()
                    .filter_map(serde_json::Value::as_str)
                    .enumerate()
                {
                    let raw = raw_parts.as_ref().and_then(|parts| parts.get(index));
                    let units = annotation_units(reading, raw.copied());
                    draft.annotations.push(AnnotationDraft {
                        text: reading.to_owned(),
                        anchor_start: base_start + index,
                        anchor_end: base_start + index + 1,
                        span: raw.map(|part| SourceSpan {
                            start_byte: part.1,
                            end_byte: part.1 + part.0.len() as u32,
                        }),
                        units,
                    });
                }
                return;
            }
        }

        let reading = ruby
            .and_then(|value| value.get("value"))
            .and_then(serde_json::Value::as_str)
            .unwrap_or_default();
        if reading.is_empty() {
            return;
        }
        let raw = parts
            .as_ref()
            .map(|parts| (parts.reading, parts.reading_start));
        let had_split_syntax = parts
            .as_ref()
            .is_some_and(|parts| split_unescaped_offsets(parts.reading, '.').len() > 1);
        if had_split_syntax {
            self.diagnostics.push(Diagnostic {
                severity: DiagnosticSeverity::Warning,
                code: "mdi.textProjection.rubySplitMismatch".to_owned(),
                message: "split ruby component count does not match the base grapheme count; the reading was anchored to the complete base".to_owned(),
                span: parts.as_ref().map(|parts| SourceSpan {
                    start_byte: parts.token_start,
                    end_byte: parts.token_end,
                }),
            });
        }
        draft.annotations.push(AnnotationDraft {
            text: reading.to_owned(),
            anchor_start: base_start,
            anchor_end: base_end,
            span: raw.map(|(raw, start)| SourceSpan {
                start_byte: start,
                end_byte: start + raw.len() as u32,
            }),
            units: annotation_ruby_units(reading, raw),
        });
    }

    fn finish(&mut self, draft: BlockDraft) {
        if draft.text.is_empty() {
            return;
        }
        let index = self.blocks.len() as u32 + 1;
        let grapheme_count = draft.text.graphemes(true).count();
        let units = normalize_units(&draft.text, &draft.unit_texts, &draft.units);
        let mapping_warning = draft.mapping_warning
            || units.contains(&UnitMap::Unmapped)
            || draft
                .annotations
                .iter()
                .any(|annotation| annotation.units.contains(&UnitMap::Unmapped));
        if mapping_warning {
            self.diagnostics.push(Diagnostic {
                severity: DiagnosticSeverity::Warning,
                code: "mdi.textProjection.unmapped".to_owned(),
                message: format!(
                    "text block {index} contains text that could not be mapped precisely"
                ),
                span: draft.span,
            });
        }
        let annotations = draft
            .annotations
            .into_iter()
            .map(|annotation| MdiTextAnnotation {
                kind: "rubyReading",
                text: annotation.text,
                anchor: text_range(index, annotation.anchor_start, annotation.anchor_end),
                span: annotation.span,
                source_map: source_map(index, &annotation.units),
            })
            .collect();
        self.blocks.push(MdiTextBlock {
            index,
            kind: draft.kind,
            text: draft.text,
            range: text_range(index, 0, grapheme_count),
            span: draft.span,
            source_map: source_map(index, &units),
            annotations,
            node: draft.node,
        });
    }

    fn map_value_in_block(&self, value: &str, draft: &mut BlockDraft) -> Option<Vec<SourceSpan>> {
        let mapped = find_mapped_value(value, self.source, draft.source_cursor, draft.source_end)?;
        draft.source_cursor = mapped.consumed_end;
        Some(mapped.spans)
    }

    fn map_value_from_node(
        &self,
        value: &str,
        node: &serde_json::Value,
        draft: &mut BlockDraft,
    ) -> Option<Vec<SourceSpan>> {
        if let Some(span) = node_span(node) {
            let mut suggested = span.start_byte;
            if suggested > draft.source_cursor
                && self.source.as_bytes().get(suggested as usize - 1) == Some(&b'\\')
            {
                suggested -= 1;
            }
            if suggested >= draft.source_cursor && suggested <= draft.source_end {
                draft.source_cursor = suggested;
            }
        }
        self.map_value_in_block(value, draft)
    }

    fn map_delimited_in_block(
        &self,
        value: &str,
        draft: &mut BlockDraft,
        open: char,
        close: char,
    ) -> Option<Vec<SourceSpan>> {
        let needle = format!("{open}{value}{close}");
        let raw = self
            .source
            .get(draft.source_cursor as usize..draft.source_end as usize)?;
        let offset = raw.find(&needle)?;
        let token_start = draft.source_cursor + offset as u32;
        draft.source_cursor = token_start + needle.len() as u32;
        map_direct(value, token_start + open.len_utf8() as u32)
    }

    fn map_image_in_block(&self, value: &str, draft: &mut BlockDraft) -> Option<Vec<SourceSpan>> {
        let raw = self
            .source
            .get(draft.source_cursor as usize..draft.source_end as usize)?;
        let image_start = raw.find("![")?;
        let alt_start = image_start + 2;
        let alt_end = first_unescaped(&raw[alt_start..], ']')? + alt_start;
        let mapped = map_decoded(
            value,
            &raw[alt_start..alt_end],
            draft.source_cursor + alt_start as u32,
        )?;
        let consumed = raw[alt_end..]
            .find(')')
            .map_or(alt_end + 1, |end| alt_end + end + 1);
        draft.source_cursor += consumed as u32;
        Some(mapped)
    }

    fn map_inline_code_in_block(
        &self,
        value: &str,
        draft: &mut BlockDraft,
    ) -> Option<Vec<SourceSpan>> {
        let raw = self
            .source
            .get(draft.source_cursor as usize..draft.source_end as usize)?;
        for (offset, _) in raw.match_indices('`') {
            let opening = raw[offset..]
                .chars()
                .take_while(|character| *character == '`')
                .count();
            let delimiter = "`".repeat(opening);
            let inner_start = offset + opening;
            let Some(close_offset) = raw[inner_start..].find(&delimiter) else {
                continue;
            };
            let inner_end = inner_start + close_offset;
            let inner = &raw[inner_start..inner_end];
            let mut normalized = String::new();
            let mut spans = Vec::new();
            for (grapheme_offset, grapheme) in inner.grapheme_indices(true) {
                normalized.push_str(if grapheme == "\n" || grapheme == "\r\n" {
                    " "
                } else {
                    grapheme
                });
                spans.push(SourceSpan {
                    start_byte: draft.source_cursor + inner_start as u32 + grapheme_offset as u32,
                    end_byte: draft.source_cursor
                        + inner_start as u32
                        + grapheme_offset as u32
                        + grapheme.len() as u32,
                });
            }
            if normalized.starts_with(' ')
                && normalized.ends_with(' ')
                && normalized.chars().any(|character| character != ' ')
            {
                normalized.remove(0);
                normalized.pop();
                spans.remove(0);
                spans.pop();
            }
            if normalized == value {
                draft.source_cursor += (inner_end + opening) as u32;
                return Some(spans);
            }
        }
        None
    }

    fn map_code_block(&self, value: &str, draft: &mut BlockDraft) -> Option<Vec<SourceSpan>> {
        let raw = self
            .source
            .get(draft.source_cursor as usize..draft.source_end as usize)?;
        let trimmed = raw.trim_start_matches([' ', '\t']);
        let fenced = trimmed.starts_with("```") || trimmed.starts_with("~~~");
        if fenced {
            let opening_end = raw.find('\n')? + 1;
            draft.source_cursor += opening_end as u32;
        }
        self.map_value_in_block(value, draft)
    }

    fn advance_after_container(&self, node: &serde_json::Value, draft: &mut BlockDraft) {
        let Some(raw) = self
            .source
            .get(draft.source_cursor as usize..draft.source_end as usize)
        else {
            return;
        };
        let consumed = match node_type(node) {
            "link" => raw.find(']').map(|label_end| {
                let after_label = label_end + 1;
                if raw[after_label..].starts_with('(') {
                    raw[after_label + 1..]
                        .find(')')
                        .map_or(after_label, |end| after_label + end + 2)
                } else if raw[after_label..].starts_with('[') {
                    raw[after_label + 1..]
                        .find(']')
                        .map_or(after_label, |end| after_label + end + 2)
                } else {
                    after_label
                }
            }),
            "noBreak" | "warichu" | "kern" => raw.find("\x5d\x5d").map(|offset| offset + 2),
            "em" => raw
                .find("\x5d\x5d")
                .map(|offset| offset + 2)
                .or_else(|| raw.find("》》").map(|offset| offset + "》》".len())),
            "emphasis" | "strong" | "delete" => {
                let width = if node_type(node) == "emphasis" { 1 } else { 2 };
                raw.char_indices()
                    .find(|(_, character)| matches!(character, '*' | '_' | '~'))
                    .map(|(offset, character)| offset + character.len_utf8() * width)
            }
            _ => None,
        };
        if let Some(consumed) = consumed {
            draft.source_cursor += consumed as u32;
        }
    }

    fn map_break_in_block(&self, draft: &mut BlockDraft) -> Option<Vec<SourceSpan>> {
        let raw = self
            .source
            .get(draft.source_cursor as usize..draft.source_end as usize)?;
        if let Some(offset) = raw.find("[[br]]") {
            let span = SourceSpan {
                start_byte: draft.source_cursor + offset as u32,
                end_byte: draft.source_cursor + offset as u32 + "[[br]]".len() as u32,
            };
            draft.source_cursor = span.end_byte;
            return Some(vec![span]);
        }
        let newline = raw.find('\n')?;
        let prefix = &raw[..newline];
        let marker_prefix = prefix.strip_suffix('\r').unwrap_or(prefix);
        let marker_start = marker_prefix
            .rfind('\\')
            .unwrap_or_else(|| marker_prefix.trim_end_matches(' ').len());
        let span = SourceSpan {
            start_byte: draft.source_cursor + marker_start as u32,
            end_byte: draft.source_cursor + newline as u32 + 1,
        };
        draft.source_cursor = span.end_byte;
        Some(vec![span])
    }
}

fn annotation_units(value: &str, raw: Option<(&str, u32)>) -> Vec<UnitMap> {
    raw.and_then(|(raw, start)| map_decoded(value, raw, start))
        .map(|spans| spans.into_iter().map(UnitMap::Mapped).collect())
        .unwrap_or_else(|| vec![UnitMap::Unmapped; value.graphemes(true).count()])
}

fn annotation_ruby_units(value: &str, raw: Option<(&str, u32)>) -> Vec<UnitMap> {
    let Some((raw, start)) = raw else {
        return vec![UnitMap::Unmapped; value.graphemes(true).count()];
    };
    let mut decoded = String::new();
    let mut spans = Vec::new();
    for (part_start, part_end) in split_unescaped_offsets(raw, '.') {
        let part = &raw[part_start..part_end];
        let part_decoded: String = decoded_atoms(part, start + part_start as u32)
            .iter()
            .map(|atom| atom.text.as_str())
            .collect();
        let Some(mut part_spans) = map_decoded(&part_decoded, part, start + part_start as u32)
        else {
            return vec![UnitMap::Unmapped; value.graphemes(true).count()];
        };
        decoded.push_str(&part_decoded);
        spans.append(&mut part_spans);
    }
    if decoded == value && spans.len() == value.graphemes(true).count() {
        spans.into_iter().map(UnitMap::Mapped).collect()
    } else {
        vec![UnitMap::Unmapped; value.graphemes(true).count()]
    }
}

fn normalize_units(text: &str, unit_texts: &[String], units: &[UnitMap]) -> Vec<UnitMap> {
    if unit_texts.len() == units.len()
        && unit_texts
            .iter()
            .map(String::as_str)
            .eq(text.graphemes(true))
    {
        return units.to_vec();
    }
    let mut pieces = Vec::with_capacity(unit_texts.len());
    let mut offset = 0;
    for (unit_text, unit) in unit_texts.iter().zip(units) {
        let end = offset + unit_text.len();
        pieces.push((offset, end, *unit));
        offset = end;
    }
    if offset != text.len() {
        return vec![UnitMap::Unmapped; text.graphemes(true).count()];
    }
    text.grapheme_indices(true)
        .map(|(start, grapheme)| {
            let end = start + grapheme.len();
            let overlapping: Vec<_> = pieces
                .iter()
                .filter(|(piece_start, piece_end, _)| *piece_start < end && *piece_end > start)
                .map(|(_, _, unit)| *unit)
                .collect();
            if overlapping
                .iter()
                .all(|unit| matches!(unit, UnitMap::Mapped(_)))
            {
                let first = match overlapping.first() {
                    Some(UnitMap::Mapped(span)) => *span,
                    _ => return UnitMap::Unmapped,
                };
                let last = match overlapping.last() {
                    Some(UnitMap::Mapped(span)) => *span,
                    _ => return UnitMap::Unmapped,
                };
                UnitMap::Mapped(SourceSpan {
                    start_byte: first.start_byte,
                    end_byte: last.end_byte,
                })
            } else if overlapping
                .iter()
                .all(|unit| matches!(unit, UnitMap::Synthetic))
            {
                UnitMap::Synthetic
            } else {
                UnitMap::Unmapped
            }
        })
        .collect()
}

fn source_map(block: u32, units: &[UnitMap]) -> MdiTextSourceMap {
    let mut map = MdiTextSourceMap::default();
    let mut index = 0;
    while index < units.len() {
        match units[index] {
            UnitMap::Mapped(first) => {
                let start = index;
                let mut boundaries = vec![first.start_byte, first.end_byte];
                index += 1;
                while let Some(UnitMap::Mapped(next)) = units.get(index).copied() {
                    if boundaries.last().copied() != Some(next.start_byte) {
                        break;
                    }
                    boundaries.push(next.end_byte);
                    index += 1;
                }
                map.runs.push(MdiTextSourceRun {
                    range: text_range(block, start, index),
                    source_boundaries: boundaries,
                });
            }
            UnitMap::Synthetic => {
                let start = index;
                while matches!(units.get(index), Some(UnitMap::Synthetic)) {
                    index += 1;
                }
                map.synthetic.push(text_range(block, start, index));
            }
            UnitMap::Unmapped => {
                let start = index;
                while matches!(units.get(index), Some(UnitMap::Unmapped)) {
                    index += 1;
                }
                map.unmapped.push(text_range(block, start, index));
            }
        }
    }
    map
}

fn text_range(block: u32, start: usize, end: usize) -> MdiTextRange {
    MdiTextRange {
        start: MdiTextPosition {
            block,
            character: start as u32 + 1,
        },
        end: MdiTextPosition {
            block,
            character: end as u32 + 1,
        },
    }
}

fn node_type(node: &serde_json::Value) -> &str {
    node.get("type")
        .and_then(serde_json::Value::as_str)
        .unwrap_or_default()
}

fn children(node: &serde_json::Value) -> impl Iterator<Item = &serde_json::Value> {
    node.get("children")
        .and_then(serde_json::Value::as_array)
        .into_iter()
        .flatten()
}

fn node_span(node: &serde_json::Value) -> Option<SourceSpan> {
    Some(SourceSpan {
        start_byte: node.pointer("/span/startByte")?.as_u64()? as u32,
        end_byte: node.pointer("/span/endByte")?.as_u64()? as u32,
    })
}

struct MappedValue {
    spans: Vec<SourceSpan>,
    consumed_end: u32,
}

fn find_mapped_value(value: &str, source: &str, start: u32, end: u32) -> Option<MappedValue> {
    if value.contains('\n') {
        let mut spans = Vec::new();
        let mut cursor = start;
        let lines: Vec<_> = value.split('\n').collect();
        for (index, line) in lines.iter().enumerate() {
            if !line.is_empty() {
                let mapped = find_mapped_value(line, source, cursor, end)?;
                cursor = mapped.consumed_end;
                spans.extend(mapped.spans);
            }
            if index + 1 < lines.len() {
                let remaining = source.get(cursor as usize..end as usize)?;
                let newline = remaining.find('\n')?;
                let newline_end = cursor + newline as u32 + 1;
                let newline_start = if newline > 0 && remaining.as_bytes()[newline - 1] == b'\r' {
                    newline_end - 2
                } else {
                    newline_end - 1
                };
                spans.push(SourceSpan {
                    start_byte: newline_start,
                    end_byte: newline_end,
                });
                cursor = newline_end;
            }
        }
        return Some(MappedValue {
            spans,
            consumed_end: cursor,
        });
    }
    let raw = source.get(start as usize..end as usize)?;
    let direct_offset = raw
        .find(value)
        .filter(|offset| direct_match_is_source_literal(raw, *offset, value));
    if direct_offset == Some(0) {
        return Some(MappedValue {
            spans: map_direct(value, start)?,
            consumed_end: start + value.len() as u32,
        });
    }
    for (candidate, _) in raw.char_indices() {
        if direct_offset.is_some_and(|offset| candidate > offset) {
            break;
        }
        if let Some((spans, consumed)) =
            map_decoded_prefix(value, &raw[candidate..], start + candidate as u32)
        {
            return Some(MappedValue {
                spans,
                consumed_end: start + candidate as u32 + consumed as u32,
            });
        }
    }
    None
}

fn map_decoded_prefix(value: &str, raw: &str, start: u32) -> Option<(Vec<SourceSpan>, usize)> {
    let atoms = decoded_atoms(raw, start);
    let mut decoded = String::new();
    for atom in atoms {
        decoded.push_str(&atom.text);
        if decoded == value {
            let consumed = atom.span.end_byte.checked_sub(start)? as usize;
            return map_decoded(value, &raw[..consumed], start).map(|spans| (spans, consumed));
        }
        if !value.starts_with(&decoded) {
            return None;
        }
    }
    None
}

fn direct_match_is_source_literal(raw: &str, offset: usize, value: &str) -> bool {
    if offset > 0 && raw.as_bytes()[offset - 1] == b'\\' {
        return false;
    }
    let candidate = &raw[offset..];
    if candidate.starts_with('&')
        && let Some(end) = candidate.find(';')
        && decode_reference(&candidate[1..end]).as_deref() == Some(value)
        && end + 1 != value.len()
    {
        return false;
    }
    true
}

fn map_direct(value: &str, start: u32) -> Option<Vec<SourceSpan>> {
    Some(
        value
            .grapheme_indices(true)
            .map(|(offset, grapheme)| SourceSpan {
                start_byte: start + offset as u32,
                end_byte: start + offset as u32 + grapheme.len() as u32,
            })
            .collect(),
    )
}

struct Atom {
    text: String,
    span: SourceSpan,
}

fn map_decoded(value: &str, raw: &str, start: u32) -> Option<Vec<SourceSpan>> {
    if value == raw {
        return map_direct(value, start);
    }
    let atoms = decoded_atoms(raw, start);
    let decoded: String = atoms.iter().map(|atom| atom.text.as_str()).collect();
    if decoded != value {
        return None;
    }
    let mut atom_ranges = Vec::with_capacity(atoms.len());
    let mut decoded_offset = 0;
    for atom in &atoms {
        let end = decoded_offset + atom.text.len();
        atom_ranges.push((decoded_offset, end, atom.span));
        decoded_offset = end;
    }
    let mut result = Vec::new();
    for (offset, grapheme) in value.grapheme_indices(true) {
        let end = offset + grapheme.len();
        let overlapping: Vec<_> = atom_ranges
            .iter()
            .filter(|(atom_start, atom_end, _)| *atom_start < end && *atom_end > offset)
            .collect();
        let first = overlapping.first()?.2;
        let last = overlapping.last()?.2;
        result.push(SourceSpan {
            start_byte: first.start_byte,
            end_byte: last.end_byte,
        });
    }
    Some(result)
}

fn decoded_atoms(raw: &str, start: u32) -> Vec<Atom> {
    let mut atoms = Vec::new();
    let mut index = 0;
    while index < raw.len() {
        let rest = &raw[index..];
        if rest.starts_with('\\')
            && let Some(next) = rest.chars().nth(1)
            && (next.is_ascii_punctuation() || "{}|^[]:《》\\.".contains(next))
        {
            let len = 1 + next.len_utf8();
            atoms.push(Atom {
                text: next.to_string(),
                span: SourceSpan {
                    start_byte: start + index as u32,
                    end_byte: start + (index + len) as u32,
                },
            });
            index += len;
            continue;
        }
        if rest.starts_with('&')
            && let Some(end) = rest.find(';')
            && let Some(decoded) = decode_reference(&rest[1..end])
        {
            atoms.push(Atom {
                text: decoded,
                span: SourceSpan {
                    start_byte: start + index as u32,
                    end_byte: start + (index + end + 1) as u32,
                },
            });
            index += end + 1;
            continue;
        }
        let character = rest.chars().next().expect("non-empty remainder");
        let len = character.len_utf8();
        atoms.push(Atom {
            text: character.to_string(),
            span: SourceSpan {
                start_byte: start + index as u32,
                end_byte: start + (index + len) as u32,
            },
        });
        index += len;
    }
    atoms
}

fn decode_reference(body: &str) -> Option<String> {
    if let Some(hex) = body.strip_prefix("#x").or_else(|| body.strip_prefix("#X")) {
        return (!hex.is_empty() && hex.chars().all(|character| character.is_ascii_hexdigit()))
            .then(|| markdown::decode_numeric(hex, 16));
    }
    if let Some(decimal) = body.strip_prefix('#') {
        return (!decimal.is_empty()
            && decimal.chars().all(|character| character.is_ascii_digit()))
        .then(|| markdown::decode_numeric(decimal, 10));
    }
    markdown::decode_named(body, true)
}

struct RubyParts<'a> {
    token_start: u32,
    base: &'a str,
    base_start: u32,
    reading: &'a str,
    reading_start: u32,
    token_end: u32,
}

fn find_ruby_parts<'a>(
    base: &str,
    reading: &str,
    source: &'a str,
    start: u32,
    end: u32,
) -> Option<RubyParts<'a>> {
    let raw = source.get(start as usize..end as usize)?;
    for (offset, _) in raw.match_indices('{') {
        let candidate = &raw[offset..];
        let Some(close) = first_unescaped(&candidate[1..], '}').map(|close| close + 1) else {
            continue;
        };
        let body = &candidate[1..close];
        let Some(separator) = first_unescaped(body, '|') else {
            continue;
        };
        let raw_base = &body[..separator];
        let raw_reading = &body[separator + 1..];
        let decoded_base: String = decoded_atoms(raw_base, 0)
            .into_iter()
            .map(|atom| atom.text)
            .collect();
        let decoded_reading: String = split_unescaped_offsets(raw_reading, '.')
            .into_iter()
            .flat_map(|(part_start, part_end)| {
                decoded_atoms(&raw_reading[part_start..part_end], 0)
                    .into_iter()
                    .map(|atom| atom.text)
            })
            .collect();
        if decoded_base == base && decoded_reading == reading {
            let token_start = start + offset as u32;
            return Some(RubyParts {
                token_start,
                base: raw_base,
                base_start: token_start + 1,
                reading: raw_reading,
                reading_start: token_start + 1 + separator as u32 + 1,
                token_end: token_start + close as u32 + 1,
            });
        }
    }
    None
}

fn split_raw_reading<'a>(parts: &'a RubyParts<'a>) -> Vec<(&'a str, u32)> {
    split_unescaped_offsets(parts.reading, '.')
        .into_iter()
        .map(|(start, end)| {
            (
                &parts.reading[start..end],
                parts.reading_start + start as u32,
            )
        })
        .collect()
}

fn first_unescaped(value: &str, needle: char) -> Option<usize> {
    let mut escaped = false;
    for (index, character) in value.char_indices() {
        if escaped {
            escaped = false;
        } else if character == '\\' {
            escaped = true;
        } else if character == needle {
            return Some(index);
        }
    }
    None
}

fn split_unescaped_offsets(value: &str, separator: char) -> Vec<(usize, usize)> {
    let mut result = Vec::new();
    let mut start = 0;
    let mut escaped = false;
    for (index, character) in value.char_indices() {
        if escaped {
            escaped = false;
        } else if character == '\\' {
            escaped = true;
        } else if character == separator {
            result.push((start, index));
            start = index + character.len_utf8();
        }
    }
    result.push((start, value.len()));
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    fn position(range: &MdiTextRange) -> (u32, u32, u32, u32) {
        (
            range.start.block,
            range.start.character,
            range.end.block,
            range.end.character,
        )
    }

    fn assert_complete_mapping(block: &MdiTextBlock, source: &str) {
        let count = block.text.graphemes(true).count();
        let mut coverage = vec![0_u8; count];
        for run in &block.source_map.runs {
            let start = run.range.start.character as usize - 1;
            let end = run.range.end.character as usize - 1;
            assert_eq!(run.source_boundaries.len(), end - start + 1);
            for boundary in &run.source_boundaries {
                assert!((*boundary as usize) <= source.len());
                assert!(source.is_char_boundary(*boundary as usize));
            }
            for covered in &mut coverage[start..end] {
                *covered += 1;
            }
        }
        for range in &block.source_map.synthetic {
            let start = range.start.character as usize - 1;
            let end = range.end.character as usize - 1;
            for covered in &mut coverage[start..end] {
                *covered += 1;
            }
        }
        assert!(block.source_map.unmapped.is_empty(), "{block:#?}");
        assert!(coverage.iter().all(|covered| *covered == 1), "{block:#?}");
    }

    #[test]
    fn projects_grapheme_positions_and_ruby_channels() {
        let result = get_mdi_text_blocks("# 序章\n\n我喜歡{東京|とうきょう}。\n\ne\u{301} 👩🏽‍💻");
        assert_eq!(result.blocks.len(), 3);
        assert_eq!(result.blocks[0].text, "序章");
        assert_eq!(position(&result.blocks[0].range), (1, 1, 1, 3));
        assert_eq!(result.blocks[1].text, "我喜歡東京。");
        assert_eq!(position(&result.blocks[1].range), (2, 1, 2, 7));
        let annotation = &result.blocks[1].annotations[0];
        assert_eq!(annotation.text, "とうきょう");
        assert_eq!(position(&annotation.anchor), (2, 4, 2, 6));
        assert_eq!(result.blocks[2].text.graphemes(true).count(), 3);
        assert_eq!(position(&result.blocks[2].range), (3, 1, 3, 4));
        assert!(result.diagnostics.is_empty());

        let across_wrapper = get_mdi_text_blocks("e*\u{301}*");
        assert_eq!(across_wrapper.blocks[0].text, "e\u{301}");
        assert_eq!(position(&across_wrapper.blocks[0].range), (1, 1, 1, 2));
        assert!(across_wrapper.blocks[0].source_map.unmapped.is_empty());

        let marker_text = get_mdi_text_blocks("# \\#\n\n- \\-\n\n> \\>");
        assert_eq!(
            marker_text
                .blocks
                .iter()
                .map(|block| block.source_map.runs[0].source_boundaries[0])
                .collect::<Vec<_>>(),
            vec![2, 8, 14]
        );
    }

    #[test]
    fn maps_entities_escapes_and_mdi_delimiters_to_complete_source_tokens() {
        let source = r"&amp; \* {東京|とうきょう} ^12^ 前[[br]]次";
        let result = get_mdi_text_blocks(source);
        let block = &result.blocks[0];
        assert_eq!(block.text, "& * 東京 12 前\n次");
        assert!(block.source_map.unmapped.is_empty(), "{block:#?}");
        assert!(block.source_map.synthetic.is_empty());

        let spans: Vec<_> = block
            .source_map
            .runs
            .iter()
            .flat_map(|run| run.source_boundaries.windows(2))
            .map(|pair| &source[pair[0] as usize..pair[1] as usize])
            .collect();
        assert!(spans.contains(&"&amp;"));
        assert!(spans.contains(&r"\*"));
        assert!(spans.contains(&"[[br]]"));
        assert!(!spans.contains(&"とうきょう"));
        assert!(result.diagnostics.is_empty());
    }

    #[test]
    fn gives_each_split_ruby_reading_its_base_grapheme_anchor() {
        let result = get_mdi_text_blocks("{東京|とう.きょう}");
        let annotations = &result.blocks[0].annotations;
        assert_eq!(annotations.len(), 2);
        assert_eq!(annotations[0].text, "とう");
        assert_eq!(position(&annotations[0].anchor), (1, 1, 1, 2));
        assert_eq!(annotations[1].text, "きょう");
        assert_eq!(position(&annotations[1].anchor), (1, 2, 1, 3));
        assert!(
            annotations
                .iter()
                .all(|annotation| annotation.source_map.unmapped.is_empty())
        );
    }

    #[test]
    fn mismatched_split_ruby_degrades_to_a_mapped_group_warning() {
        let result = get_mdi_text_blocks("{東京|とう.きょ.う}");
        let annotation = &result.blocks[0].annotations[0];
        assert_eq!(annotation.text, "とうきょう");
        assert_eq!(position(&annotation.anchor), (1, 1, 1, 3));
        assert!(annotation.source_map.unmapped.is_empty());
        assert!(
            result
                .diagnostics
                .iter()
                .any(|diagnostic| diagnostic.code == "mdi.textProjection.rubySplitMismatch")
        );
    }

    #[test]
    fn collects_leaf_blocks_without_parent_text_duplication() {
        let source = "- first\n\n  second\n  - nested\n\n> quote one\n>\n> quote two\n\n| a | b |\n| - | - |\n| c | d |\n\n```mdi\ncode\nline\n```\n\nbody[^n]\n\n[^n]: note\n\n---";
        let result = get_mdi_text_blocks(source);
        let summaries: Vec<_> = result
            .blocks
            .iter()
            .map(|block| (block.kind, block.text.as_str()))
            .collect();
        assert_eq!(
            summaries,
            vec![
                (MdiTextBlockKind::ListItem, "first\n\nsecond"),
                (MdiTextBlockKind::ListItem, "nested"),
                (MdiTextBlockKind::Blockquote, "quote one"),
                (MdiTextBlockKind::Blockquote, "quote two"),
                (MdiTextBlockKind::Table, "a\tb\nc\td"),
                (MdiTextBlockKind::Code, "code\nline"),
                (MdiTextBlockKind::Paragraph, "body"),
                (MdiTextBlockKind::Footnote, "note"),
            ]
        );
        assert_eq!(result.blocks[0].source_map.synthetic.len(), 1);
        assert_eq!(result.blocks[4].source_map.synthetic.len(), 3);
        assert!(
            result
                .blocks
                .iter()
                .all(|block| block.source_map.unmapped.is_empty())
        );

        let fenced = get_mdi_text_blocks("```rust\nrust\n```");
        assert_eq!(fenced.blocks[0].text, "rust");
        assert_eq!(fenced.blocks[0].source_map.runs[0].source_boundaries[0], 8);
    }

    #[test]
    fn projection_json_is_deterministic_and_keeps_the_parse_envelope() {
        let source = "---\nmdi: '2.0'\ntitle: x\n---\n\n# heading\n\ntext";
        let first = get_mdi_text_blocks_json(source);
        assert_eq!(first, get_mdi_text_blocks_json(source));
        let value: serde_json::Value = serde_json::from_str(&first).unwrap();
        assert_eq!(value["projectionVersion"], "1.0");
        assert_eq!(
            value["positionEncoding"],
            "unicode-grapheme-cluster-1-based"
        );
        assert_eq!(value["irVersion"], MDI_IR_VERSION);
        assert_eq!(value["document"]["frontmatter"]["entries"][0]["key"], "mdi");
    }

    #[test]
    fn supported_inline_and_wrapped_markdown_is_fully_mapped() {
        let source = "**強調** [label](https://example.test) ![代替](image.png) `code` \\* &amp; [[no-break:禁則]][[warichu:割注]][[kern:-0.1em:詰め]][[em:傍点]]\n\n> first\n> continued\n\n- item\n  continued";
        let result = get_mdi_text_blocks(source);
        assert_eq!(
            result
                .blocks
                .iter()
                .map(|block| block.text.as_str())
                .collect::<Vec<_>>(),
            vec![
                "強調 label 代替 code * & 禁則割注詰め傍点",
                "first\ncontinued",
                "item\ncontinued",
            ]
        );
        for block in &result.blocks {
            assert_complete_mapping(block, source);
        }
    }

    #[test]
    fn malformed_literals_remain_searchable_and_precisely_mapped() {
        for source in [
            "{東京|とうきょう",
            "[[em:未閉",
            "《《未閉",
            "^1234567^ ^12^",
            "<custom>literal</custom>",
        ] {
            let result = get_mdi_text_blocks(source);
            assert!(!result.blocks.is_empty(), "{source:?}");
            for block in &result.blocks {
                assert_complete_mapping(block, source);
            }
        }
        let frontmatter = get_mdi_text_blocks("---\ntitle: hidden\n---\n\nvisible");
        assert_eq!(frontmatter.blocks.len(), 1);
        assert_eq!(frontmatter.blocks[0].text, "visible");
    }
}
