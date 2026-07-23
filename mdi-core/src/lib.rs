//! The language-neutral MDI 2.0 syntax core.
//!
//! Rust is the sole executable syntax authority for an MDI document.  It
//! parses CommonMark, GFM, YAML front matter, and MDI into one portable wire
//! tree; language bindings only adapt that tree to their host APIs.

use serde::{Serialize, Serializer, ser::SerializeStruct};
use std::fs;
use std::io::{Cursor, Seek, Write};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
#[cfg(not(feature = "wasm"))]
use time::{OffsetDateTime, format_description::well_known::Rfc3339};
use unicode_segmentation::UnicodeSegmentation;
use zip::{CompressionMethod, ZipWriter, write::SimpleFileOptions};

mod docx;
mod publication_profile;
pub use publication_profile::{
    ChromiumPrintPage, ChromiumPrintPageNumbers, ChromiumPrintProfile, Margins, PageNumbers,
    PageSizeDimensions, ResolvedEpub, ResolvedExportProfile, ResolvedLayout, ResolvedPagination,
    ResolvedText, ResolvedTypesetting, apply_pdf_profile, apply_pdf_profile_json, page_dimensions,
    page_size_catalog_json, prepare_chromium_print_profile, prepare_chromium_print_profile_json,
    prepare_chromium_print_profile_resolved, resolve_export_profile, resolve_export_profile_json,
};

/// MDI syntax version implemented by this crate.
pub const MDI_SPEC_VERSION: &str = "2.0";

/// Version of the language-neutral wire format returned by the bindings.
///
/// This version changes only for incompatible wire-schema changes.
pub const MDI_IR_VERSION: &str = "1.0";

/// A binding-friendly parse envelope.
///
/// Capabilities let a binding verify the features represented in this parse
/// result before it adapts the portable tree to a host-language API.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParseOutput {
    pub ir_version: &'static str,
    pub syntax_version: &'static str,
    pub capabilities: ParserCapabilities,
    pub document: Document,
    pub diagnostics: Vec<Diagnostic>,
}

/// Parser features represented in a [`ParseOutput`].
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParserCapabilities {
    pub mdi: bool,
    pub common_mark: bool,
    pub gfm: bool,
    pub front_matter: bool,
    pub source_spans: bool,
}

/// A recoverable parser message returned as part of the stable wire contract.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Diagnostic {
    pub severity: DiagnosticSeverity,
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub span: Option<SourceSpan>,
}

/// Severity of a parser diagnostic.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum DiagnosticSeverity {
    Warning,
    Error,
}

/// Half-open UTF-8 byte range in the original source.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceSpan {
    pub start_byte: u32,
    pub end_byte: u32,
}

/// The complete language-neutral document tree.  `children` uses mdast's
/// stable tagged JSON shape (with MDI nodes injected by this crate); every
/// source-backed node is annotated with a UTF-8 byte `span`.
#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Document {
    pub span: SourceSpan,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub frontmatter: Option<Frontmatter>,
    pub children: Vec<serde_json::Value>,
}

/// Ordered YAML front matter, retaining both recognized and unknown fields.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Frontmatter {
    pub span: SourceSpan,
    pub raw: String,
    pub entries: Vec<FrontmatterEntry>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontmatterEntry {
    pub key: String,
    pub value: serde_json::Value,
}

/// Transitional MDI-only document used by the compatibility helper
/// [`parse_mdi_syntax`].  New callers must use [`parse_document`].
#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MdiSyntaxDocument {
    pub blocks: Vec<MdiBlock>,
}

/// A block-level MDI construct or ordinary source line in the compatibility
/// helper.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum MdiBlock {
    Paragraph {
        inlines: Vec<Inline>,
        indent: Option<u32>,
        bottom: Option<u32>,
    },
    Blank,
    Pagebreak {
        variant: Option<PagebreakVariant>,
    },
}

/// A page-break side.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum PagebreakVariant {
    Left,
    Right,
}

/// A language-neutral MDI inline AST.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Inline {
    Text(String),
    Ruby {
        base: String,
        ruby: RubyReading,
    },
    Tcy(String),
    Break,
    Em {
        mark: String,
        children: Vec<Inline>,
    },
    NoBreak(Vec<Inline>),
    Warichu(Vec<Inline>),
    Kern {
        amount: String,
        children: Vec<Inline>,
    },
}

/// Keep the public wire nodes flat (`{ type, value }`, `{ type, children }`,
/// and so on) without forcing the Rust implementation to use struct variants
/// internally. This shape maps naturally to discriminated unions in every
/// host language.
impl Serialize for Inline {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match self {
            Self::Text(value) => {
                let mut node = serializer.serialize_struct("Inline", 2)?;
                node.serialize_field("type", "text")?;
                node.serialize_field("value", value)?;
                node.end()
            }
            Self::Ruby { base, ruby } => {
                let mut node = serializer.serialize_struct("Inline", 3)?;
                node.serialize_field("type", "ruby")?;
                node.serialize_field("base", base)?;
                node.serialize_field("ruby", ruby)?;
                node.end()
            }
            Self::Tcy(value) => {
                let mut node = serializer.serialize_struct("Inline", 2)?;
                node.serialize_field("type", "tcy")?;
                node.serialize_field("value", value)?;
                node.end()
            }
            Self::Break => {
                let mut node = serializer.serialize_struct("Inline", 1)?;
                node.serialize_field("type", "break")?;
                node.end()
            }
            Self::Em { mark, children } => {
                let mut node = serializer.serialize_struct("Inline", 3)?;
                node.serialize_field("type", "em")?;
                node.serialize_field("mark", mark)?;
                node.serialize_field("children", children)?;
                node.end()
            }
            Self::NoBreak(children) => {
                let mut node = serializer.serialize_struct("Inline", 2)?;
                node.serialize_field("type", "noBreak")?;
                node.serialize_field("children", children)?;
                node.end()
            }
            Self::Warichu(children) => {
                let mut node = serializer.serialize_struct("Inline", 2)?;
                node.serialize_field("type", "warichu")?;
                node.serialize_field("children", children)?;
                node.end()
            }
            Self::Kern { amount, children } => {
                let mut node = serializer.serialize_struct("Inline", 3)?;
                node.serialize_field("type", "kern")?;
                node.serialize_field("amount", amount)?;
                node.serialize_field("children", children)?;
                node.end()
            }
        }
    }
}

/// The reading attached to a ruby base.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "type", content = "value", rename_all = "camelCase")]
pub enum RubyReading {
    Group(String),
    Split(Vec<String>),
}

/// Parse only MDI syntax for legacy callers.  This is intentionally not the
/// public whole-document entry point; use [`parse_document`] instead.
pub fn parse_mdi_syntax(source: &str) -> MdiSyntaxDocument {
    let mut blocks = Vec::new();
    let mut pending: Option<PendingBlock> = None;

    for line in source.lines() {
        if is_blank_marker(line) {
            flush_pending(&mut blocks, &mut pending);
            blocks.push(MdiBlock::Blank);
            continue;
        }
        if let Some(pagebreak) = pagebreak(line) {
            flush_pending(&mut blocks, &mut pending);
            blocks.push(MdiBlock::Pagebreak { variant: pagebreak });
            continue;
        }
        if let Some(marker) = pending_block(line) {
            if pending.is_some() {
                flush_pending(&mut blocks, &mut pending);
                blocks.push(paragraph(line, None));
            } else {
                pending = Some(marker);
            }
            continue;
        }

        blocks.push(paragraph(line, pending.take()));
    }
    flush_pending(&mut blocks, &mut pending);
    MdiSyntaxDocument { blocks }
}

/// Parse a complete `.mdi` document.  CommonMark and all GFM constructs are
/// parsed by `markdown-rs`; MDI is then lowered into the same tagged tree in
/// Rust.  The host never tokenizes Markdown or MDI.
pub fn parse_document(source: &str) -> Document {
    let prepared = prepare_block_markers(source);
    let mut constructs = markdown::Constructs::gfm();
    constructs.frontmatter = true;
    let options = markdown::ParseOptions {
        constructs,
        ..markdown::ParseOptions::default()
    };
    let tree = markdown::to_mdast(&prepared.markdown, &options)
        .expect("MDI does not enable MDX, so Markdown parsing cannot fail");
    let mut root = serde_json::to_value(tree).expect("markdown AST is serializable");
    let frontmatter = extract_frontmatter(&root, source);
    annotate_and_lower(&mut root, source, false);
    lower_markdown_inside_mdi(&mut root, source);
    inject_block_markers(&mut root, &prepared.markers);
    let children = root
        .get_mut("children")
        .and_then(serde_json::Value::as_array_mut)
        .map(|children| {
            children
                .drain(..)
                .filter(|child| {
                    child.get("type").and_then(serde_json::Value::as_str) != Some("yaml")
                })
                .collect()
        })
        .unwrap_or_default();
    Document {
        span: SourceSpan {
            start_byte: 0,
            end_byte: source.len() as u32,
        },
        frontmatter,
        children,
    }
}

/// Restore a bracket macro which Markdown would otherwise split at emphasis,
/// links, or other inline delimiters.  The macro owns its balanced boundary;
/// its payload is then parsed as Markdown and recursively lowered by Rust.
fn lower_markdown_inside_mdi(node: &mut serde_json::Value, source: &str) {
    let Some(object) = node.as_object_mut() else {
        return;
    };
    if object.get("type").and_then(serde_json::Value::as_str) == Some("paragraph") {
        let span = object.get("span").cloned();
        if let Some(raw) = span
            .as_ref()
            .and_then(|span| source_from_span(span, source))
        {
            let raw = raw.trim_end_matches(['\r', '\n']);
            if let Some(children) =
                markdown_paragraph_children(raw, span.as_ref().expect("span exists"))
            {
                object.insert("children".to_owned(), serde_json::Value::Array(children));
                return;
            }
        }
    }
    if let Some(children) = object
        .get_mut("children")
        .and_then(serde_json::Value::as_array_mut)
    {
        for child in children {
            lower_markdown_inside_mdi(child, source);
        }
    }
}

fn markdown_paragraph_children(
    raw: &str,
    span: &serde_json::Value,
) -> Option<Vec<serde_json::Value>> {
    let paragraph_start = span.get("startByte")?.as_u64()? as usize;
    let mut output = Vec::new();
    let mut index = 0;
    let mut plain_start = 0;
    let mut found = false;
    while index < raw.len() {
        let rest = &raw[index..];
        if rest.starts_with("[[")
            && let Some(end) = close_macro(rest)
            && let Some(mut macro_node) =
                markdown_macro_children(&rest[..end + 2], paragraph_start + index)
        {
            output.append(&mut markdown_fragment_children(
                &raw[plain_start..index],
                paragraph_start + plain_start,
            ));
            output.append(&mut macro_node);
            index += end + 2;
            plain_start = index;
            found = true;
            continue;
        }
        index += rest.chars().next()?.len_utf8();
    }
    if !found {
        return None;
    }
    output.append(&mut markdown_fragment_children(
        &raw[plain_start..],
        paragraph_start + plain_start,
    ));
    Some(output)
}

fn markdown_fragment_children(source: &str, start_byte: usize) -> Vec<serde_json::Value> {
    if source.is_empty() {
        return Vec::new();
    }
    if let Some((text, identifier)) = trailing_footnote_reference(source) {
        let mut children = markdown_fragment_children(text, start_byte);
        children.push(serde_json::json!({
            "type": "footnoteReference",
            "identifier": identifier,
            "label": identifier,
            "span": SourceSpan { start_byte: (start_byte + text.len()) as u32, end_byte: (start_byte + source.len()) as u32 },
        }));
        return children;
    }
    let leading = source
        .chars()
        .take_while(|character| character.is_whitespace())
        .collect::<String>();
    let trailing = source
        .chars()
        .rev()
        .take_while(|character| character.is_whitespace())
        .collect::<String>()
        .chars()
        .rev()
        .collect::<String>();
    let tree = markdown::to_mdast(source, &markdown_options())
        .expect("MDI fragment parsing cannot fail when MDX is disabled");
    let mut tree = serde_json::to_value(tree).expect("Markdown fragment AST is serializable");
    annotate_and_lower(&mut tree, source, false);
    shift_spans(&mut tree, start_byte);
    let mut children = tree
        .get_mut("children")
        .and_then(serde_json::Value::as_array_mut)
        .and_then(|children| children.first_mut())
        .and_then(|paragraph| paragraph.get("children"))
        .and_then(serde_json::Value::as_array)
        .cloned()
        .unwrap_or_default();
    if !leading.is_empty()
        && !children
            .first()
            .and_then(|child| child.get("value"))
            .and_then(serde_json::Value::as_str)
            .is_some_and(|value| value.starts_with(&leading))
    {
        children.insert(
            0,
            serde_json::json!({ "type": "text", "value": leading, "span": SourceSpan { start_byte: start_byte as u32, end_byte: (start_byte + leading.len()) as u32 } }),
        );
    }
    if !trailing.is_empty()
        && !children
            .last()
            .and_then(|child| child.get("value"))
            .and_then(serde_json::Value::as_str)
            .is_some_and(|value| value.ends_with(&trailing))
    {
        children.push(serde_json::json!({ "type": "text", "value": trailing, "span": SourceSpan { start_byte: (start_byte + source.len() - trailing.len()) as u32, end_byte: (start_byte + source.len()) as u32 } }));
    }
    children
}

fn trailing_footnote_reference(source: &str) -> Option<(&str, &str)> {
    let (text, suffix) = source.rsplit_once("[^")?;
    let identifier = suffix.strip_suffix(']')?;
    (!identifier.is_empty() && !identifier.chars().any(char::is_whitespace))
        .then_some((text, identifier))
}

fn markdown_options() -> markdown::ParseOptions {
    let mut constructs = markdown::Constructs::gfm();
    constructs.frontmatter = false;
    markdown::ParseOptions {
        constructs,
        ..markdown::ParseOptions::default()
    }
}

fn source_from_span<'a>(span: &serde_json::Value, source: &'a str) -> Option<&'a str> {
    source.get(span.get("startByte")?.as_u64()? as usize..span.get("endByte")?.as_u64()? as usize)
}

/// Map byte boundaries in Markdown's decoded text value back to the raw text
/// range. Markdown commonly removes a backslash before punctuation; accepting
/// only that loss keeps this mapping deliberately conservative.
fn decoded_byte_offsets(decoded: &str, raw: &str) -> Option<Vec<(usize, usize)>> {
    let mut offsets = vec![(0, 0)];
    let mut raw_index = 0;
    for (decoded_index, character) in decoded.char_indices() {
        let expected_end = decoded_index + character.len_utf8();
        if raw[raw_index..].starts_with('\\') {
            let after_slash = raw_index + '\\'.len_utf8();
            if raw[after_slash..].starts_with(character) {
                raw_index = after_slash;
            }
        }
        if !raw[raw_index..].starts_with(character) {
            return None;
        }
        raw_index += character.len_utf8();
        offsets.push((expected_end, raw_index));
    }
    (raw_index == raw.len()).then_some(offsets)
}

fn source_offset(offsets: &[(usize, usize)], decoded_offset: usize) -> Option<usize> {
    offsets
        .binary_search_by_key(&decoded_offset, |(decoded, _)| *decoded)
        .ok()
        .map(|index| offsets[index].1)
}

/// Shift a tree parsed from a source fragment back into the parent document.
/// `markdown-rs` reports fragment-local UTF-8 byte offsets.
fn shift_spans(node: &mut serde_json::Value, amount: usize) {
    let Some(object) = node.as_object_mut() else {
        return;
    };
    if let Some(span) = object
        .get_mut("span")
        .and_then(serde_json::Value::as_object_mut)
    {
        for key in ["startByte", "endByte"] {
            if let Some(offset) = span.get(key).and_then(serde_json::Value::as_u64) {
                span.insert(key.to_owned(), serde_json::json!(offset + amount as u64));
            }
        }
    }
    if let Some(children) = object
        .get_mut("children")
        .and_then(serde_json::Value::as_array_mut)
    {
        for child in children {
            shift_spans(child, amount);
        }
    }
}

fn markdown_macro_children(raw: &str, start_byte: usize) -> Option<Vec<serde_json::Value>> {
    if !raw.starts_with("[[") {
        return None;
    }
    let end = close_macro(raw)?;
    if end + 2 != raw.len() {
        return None;
    }
    let body = &raw[2..end];
    let (name, payload) = body.split_once(':')?;
    let (type_name, extra, content, content_offset) = match name {
        "no-break" if !payload.is_empty() => (
            "noBreak",
            serde_json::Map::new(),
            payload,
            2 + name.len() + 1,
        ),
        "warichu" => (
            "warichu",
            serde_json::Map::new(),
            payload,
            2 + name.len() + 1,
        ),
        "kern" => {
            let (amount, content) = payload.split_once(':')?;
            if !valid_kern(amount) {
                return None;
            }
            let mut extra = serde_json::Map::new();
            extra.insert("amount".to_owned(), serde_json::json!(unescape_mdi(amount)));
            (
                "kern",
                extra,
                content,
                2 + name.len() + 1 + amount.len() + 1,
            )
        }
        "em" => {
            let (mark, content) = bare_index(payload, ':')
                .and_then(|index| {
                    let mark = unescape_mdi(&payload[..index]);
                    (mark.graphemes(true).count() == 1
                        && !mark.chars().any(|c| c.is_whitespace() || c.is_control()))
                    .then_some((mark, &payload[index + 1..]))
                })
                .unwrap_or_else(|| ("﹅".to_owned(), payload));
            let mut extra = serde_json::Map::new();
            extra.insert("mark".to_owned(), serde_json::json!(mark));
            let content_offset = raw.len() - 2 - content.len();
            ("em", extra, content, content_offset)
        }
        _ => return None,
    };
    let mut constructs = markdown::Constructs::gfm();
    let options = markdown::ParseOptions {
        constructs: {
            constructs.frontmatter = false;
            constructs
        },
        ..markdown::ParseOptions::default()
    };
    let tree = markdown::to_mdast(content, &options).ok()?;
    let mut value = serde_json::to_value(tree).ok()?;
    annotate_and_lower(&mut value, content, false);
    shift_spans(&mut value, start_byte + content_offset);
    let children = value
        .get_mut("children")?
        .as_array_mut()?
        .first_mut()?
        .get_mut("children")?
        .as_array()?
        .clone();
    let mut node = extra;
    node.insert("type".to_owned(), serde_json::json!(type_name));
    node.insert("children".to_owned(), serde_json::Value::Array(children));
    node.insert(
        "span".to_owned(),
        serde_json::json!(SourceSpan {
            start_byte: start_byte as u32,
            end_byte: (start_byte + raw.len()) as u32,
        }),
    );
    Some(vec![serde_json::Value::Object(node)])
}

#[derive(Clone)]
enum PreparedBlockMarker {
    Blank(SourceSpan),
    Pagebreak(SourceSpan, Option<PagebreakVariant>),
    Indent(SourceSpan, bool, u32),
}

struct PreparedSource {
    markdown: String,
    markers: Vec<PreparedBlockMarker>,
}

/// Hide standalone MDI flow markers from the Markdown tokenizer without
/// moving a single byte.  This lets Markdown form the surrounding paragraphs
/// correctly and preserves every AST offset.  Fenced code and blockquotes are
/// deliberately excluded by the normative literal-context rule.
fn prepare_block_markers(source: &str) -> PreparedSource {
    let mut markdown = String::with_capacity(source.len());
    let mut markers = Vec::new();
    let mut offset = 0;
    let mut fenced = false;
    for line in source.split_inclusive('\n') {
        let without_lf = line.strip_suffix('\n').unwrap_or(line);
        let content = without_lf.strip_suffix('\r').unwrap_or(without_lf);
        let trimmed_start = content.trim_start();
        let is_fence = trimmed_start.starts_with("```") || trimmed_start.starts_with("~~~");
        if is_fence {
            fenced = !fenced;
        }
        let span = SourceSpan {
            start_byte: offset as u32,
            end_byte: (offset + content.len()) as u32,
        };
        let marker = if !fenced && !trimmed_start.starts_with('>') && content == trimmed_start {
            if is_blank_marker(content) {
                Some(PreparedBlockMarker::Blank(span))
            } else if let Some(variant) = pagebreak(content) {
                Some(PreparedBlockMarker::Pagebreak(span, variant))
            } else {
                pending_block(content).map(|marker| match marker {
                    PendingBlock::Indent { amount, .. } => {
                        PreparedBlockMarker::Indent(span, true, amount)
                    }
                    PendingBlock::Bottom { amount, .. } => {
                        PreparedBlockMarker::Indent(span, false, amount)
                    }
                })
            }
        } else {
            None
        };
        if let Some(marker) = marker {
            markers.push(marker);
            markdown.push_str(&" ".repeat(content.len()));
            markdown.push_str(&line[content.len()..]);
        } else {
            markdown.push_str(line);
        }
        offset += line.len();
    }
    PreparedSource { markdown, markers }
}

fn inject_block_markers(root: &mut serde_json::Value, markers: &[PreparedBlockMarker]) {
    let Some(children) = root
        .get_mut("children")
        .and_then(serde_json::Value::as_array_mut)
    else {
        return;
    };
    let mut output = Vec::with_capacity(children.len() + markers.len());
    let mut marker_index = 0;
    let mut pending: Option<(SourceSpan, bool, u32)> = None;
    for mut child in children.drain(..) {
        let start = child
            .pointer("/span/startByte")
            .and_then(serde_json::Value::as_u64)
            .unwrap_or(u64::MAX) as u32;
        while let Some(marker) = markers.get(marker_index) {
            if marker_span(marker).end_byte > start {
                break;
            }
            marker_index += 1;
            match marker.clone() {
                PreparedBlockMarker::Blank(span) => {
                    flush_pending_literal(&mut output, &mut pending);
                    output.push(serde_json::json!({ "type": "blank", "span": span }));
                }
                PreparedBlockMarker::Pagebreak(span, variant) => {
                    flush_pending_literal(&mut output, &mut pending);
                    output.push(serde_json::json!({ "type": "pagebreak", "variant": variant, "span": span }));
                }
                PreparedBlockMarker::Indent(span, is_indent, amount) => {
                    if pending.is_some() {
                        flush_pending_literal(&mut output, &mut pending);
                    }
                    pending = Some((span, is_indent, amount));
                }
            }
        }
        if let Some((_span, is_indent, amount)) = pending.take() {
            if child.get("type").and_then(serde_json::Value::as_str) == Some("paragraph") {
                child.as_object_mut().expect("node is object").insert(
                    if is_indent { "indent" } else { "bottom" }.to_owned(),
                    serde_json::json!(amount),
                );
            } else {
                flush_pending_literal(&mut output, &mut Some((_span, is_indent, amount)));
            }
        }
        output.push(child);
    }
    while let Some(marker) = markers.get(marker_index) {
        marker_index += 1;
        match marker.clone() {
            PreparedBlockMarker::Blank(span) => {
                flush_pending_literal(&mut output, &mut pending);
                output.push(serde_json::json!({ "type": "blank", "span": span }));
            }
            PreparedBlockMarker::Pagebreak(span, variant) => {
                flush_pending_literal(&mut output, &mut pending);
                output.push(
                    serde_json::json!({ "type": "pagebreak", "variant": variant, "span": span }),
                );
            }
            PreparedBlockMarker::Indent(span, is_indent, amount) => {
                if pending.is_some() {
                    flush_pending_literal(&mut output, &mut pending);
                }
                pending = Some((span, is_indent, amount));
            }
        }
    }
    flush_pending_literal(&mut output, &mut pending);
    *children = output;
}

fn marker_span(marker: &PreparedBlockMarker) -> SourceSpan {
    match marker {
        PreparedBlockMarker::Blank(span)
        | PreparedBlockMarker::Pagebreak(span, _)
        | PreparedBlockMarker::Indent(span, _, _) => *span,
    }
}

fn flush_pending_literal(
    output: &mut Vec<serde_json::Value>,
    pending: &mut Option<(SourceSpan, bool, u32)>,
) {
    let Some((span, is_indent, amount)) = pending.take() else {
        return;
    };
    let value = if is_indent {
        format!("[[indent:{amount}]]")
    } else if amount == 0 {
        "[[bottom]]".to_owned()
    } else {
        format!("[[bottom:{amount}]]")
    };
    output.push(serde_json::json!({ "type": "paragraph", "children": [{ "type": "text", "value": value, "span": span }], "span": span }));
}

fn annotate_and_lower(node: &mut serde_json::Value, source: &str, protected: bool) {
    let Some(object) = node.as_object_mut() else {
        return;
    };
    let node_type = object
        .get("type")
        .and_then(serde_json::Value::as_str)
        .unwrap_or("")
        .to_owned();
    // Code and raw nodes have no `text` children in mdast, but are also
    // protected here for future markdown-rs node changes.  Block quotes are
    // deliberately *not* protected: their ordinary inline MDI remains valid;
    // only flow markers are excluded in `prepare_block_markers`.
    let protected = protected || matches!(node_type.as_str(), "code" | "inlineCode" | "html");
    let span = object
        .remove("position")
        .as_ref()
        .and_then(|position| span_from_position(position, source));
    if let Some(span) = span {
        object.insert("span".to_owned(), serde_json::json!(span));
    }
    if let Some(children) = object
        .get_mut("children")
        .and_then(serde_json::Value::as_array_mut)
    {
        for child in children.iter_mut() {
            annotate_and_lower(child, source, protected);
        }
        let mut flattened = Vec::with_capacity(children.len());
        for child in children.drain(..) {
            if child.get("type").and_then(serde_json::Value::as_str) == Some("mdiFragment")
                && let Some(mut fragment) = child
                    .get("children")
                    .and_then(serde_json::Value::as_array)
                    .cloned()
            {
                flattened.append(&mut fragment);
                continue;
            }
            flattened.push(child);
        }
        *children = flattened;
    }
    if protected || node_type != "text" {
        return;
    }
    let Some(rendered_value) = object.get("value").and_then(serde_json::Value::as_str) else {
        return;
    };
    // Markdown may consume a backslash while decoding a text node.  MDI must
    // still recognize the decoded spelling (notably `\|` inside a GFM table
    // cell), but its spans must refer to the original bytes.  Keep a mapping
    // from decoded byte boundaries back to the source range for that case.
    let source_offsets = span
        .as_ref()
        .and_then(|span| source.get(span.start_byte as usize..span.end_byte as usize))
        .and_then(|raw| decoded_byte_offsets(rendered_value, raw));
    if !looks_like_mdi(rendered_value) {
        return;
    }
    let span = object.get("span").cloned();
    let parsed = parse_inline_parts(rendered_value);
    if let Some((Inline::Text(value), _, _)) = parsed.first()
        && parsed.len() == 1
        && value == rendered_value
    {
        return;
    }
    let replacement: Vec<serde_json::Value> = parsed
        .into_iter()
        .map(|(inline, start, end)| {
            let mut value = serde_json::to_value(inline).expect("MDI inline is serializable");
            if let (Some(token_span), Some(object)) = (&span, value.as_object_mut()) {
                let start_byte = token_span
                    .get("startByte")
                    .and_then(serde_json::Value::as_u64);
                if let Some(start_byte) = start_byte {
                    let start = source_offsets
                        .as_ref()
                        .and_then(|offsets| source_offset(offsets, start))
                        .unwrap_or(start);
                    let end = source_offsets
                        .as_ref()
                        .and_then(|offsets| source_offset(offsets, end))
                        .unwrap_or(end);
                    object.insert(
                        "span".to_owned(),
                        serde_json::json!(SourceSpan {
                            start_byte: (start_byte as usize + start) as u32,
                            end_byte: (start_byte as usize + end) as u32,
                        }),
                    );
                }
            }
            value
        })
        .collect();
    *node = serde_json::json!({ "type": "mdiFragment", "children": replacement, "span": span });
}

fn looks_like_mdi(value: &str) -> bool {
    value.contains(['{', '^', '《', '[', '\\'])
}

fn span_from_position(value: &serde_json::Value, source: &str) -> Option<SourceSpan> {
    let start = value.pointer("/start/offset")?.as_u64()? as usize;
    let end = value.pointer("/end/offset")?.as_u64()? as usize;
    Some(SourceSpan {
        start_byte: character_offset_to_byte(source, start) as u32,
        end_byte: character_offset_to_byte(source, end) as u32,
    })
}

fn character_offset_to_byte(source: &str, offset: usize) -> usize {
    // `markdown-rs` stores this field as a UTF-8 byte offset.
    offset.min(source.len())
}

fn extract_frontmatter(root: &serde_json::Value, source: &str) -> Option<Frontmatter> {
    let yaml = root.get("children")?.as_array()?.first()?;
    if yaml.get("type")?.as_str()? != "yaml" {
        return None;
    }
    let raw = yaml.get("value")?.as_str()?.to_owned();
    let span = yaml
        .get("position")
        .and_then(|value| span_from_position(value, source))?;
    let entries = match serde_yaml::from_str::<serde_yaml::Value>(&raw) {
        Ok(serde_yaml::Value::Mapping(mapping)) => mapping
            .into_iter()
            .filter_map(|(key, value)| {
                let key = key.as_str()?.to_owned();
                let value = serde_json::to_value(value).ok()?;
                Some(FrontmatterEntry { key, value })
            })
            .collect(),
        _ => Vec::new(),
    };
    Some(Frontmatter { span, raw, entries })
}

fn diagnostics(document: &Document) -> Vec<Diagnostic> {
    let Some(frontmatter) = document.frontmatter.as_ref() else {
        return Vec::new();
    };
    let declared = frontmatter.entries.iter().find(|entry| entry.key == "mdi");
    let Some(declared) = declared.and_then(|entry| entry.value.as_str()) else {
        return Vec::new();
    };
    if declared > MDI_SPEC_VERSION {
        vec![Diagnostic {
            severity: DiagnosticSeverity::Warning,
            code: "mdi.version.unsupported".to_owned(),
            message: format!("MDI {declared} is newer than the supported {MDI_SPEC_VERSION}"),
            span: Some(frontmatter.span),
        }]
    } else {
        Vec::new()
    }
}

/// Parse the complete CommonMark, GFM, front-matter, and MDI document and
/// return the versioned wire envelope used by language bindings.
pub fn parse_output(source: &str) -> ParseOutput {
    let document = parse_document(source);
    ParseOutput {
        ir_version: MDI_IR_VERSION,
        syntax_version: MDI_SPEC_VERSION,
        capabilities: ParserCapabilities {
            mdi: true,
            common_mark: true,
            gfm: true,
            front_matter: true,
            source_spans: true,
        },
        diagnostics: diagnostics(&document),
        document,
    }
}

/// Serialize [`parse_output`] for FFI boundaries.
///
/// JSON is the first portable contract because it behaves identically through
/// WebAssembly, N-API, PyO3, and a C ABI. Native bindings may later provide
/// zero-copy views without changing this wire representation.
pub fn parse_json(source: &str) -> String {
    serde_json::to_string(&parse_output(source))
        .expect("serializing the MDI parse output cannot fail")
}

/// Stable C ABI used by native language bindings.
///
/// Every operation accepts UTF-8 bytes and returns owned bytes. Callers must
/// release both buffers in an [`MdiFfiResult`] with [`mdi_free_buffer`]. The
/// JSON returned by `mdi_parse_json` is the same versioned wire contract used
/// by the JavaScript and future Python bindings.
#[allow(unsafe_code)]
pub mod ffi {
    use super::{
        TextFormat, parse_json, render_docx, render_epub, render_html, render_text,
        render_text_format, serialize_mdi,
    };
    use std::slice;

    #[repr(C)]
    #[derive(Debug, Clone, Copy)]
    pub struct MdiFfiBuffer {
        pub data: *mut u8,
        pub len: usize,
    }

    #[repr(C)]
    #[derive(Debug, Clone, Copy)]
    pub struct MdiFfiResult {
        pub value: MdiFfiBuffer,
        pub error: MdiFfiBuffer,
    }

    fn empty_buffer() -> MdiFfiBuffer {
        MdiFfiBuffer {
            data: std::ptr::null_mut(),
            len: 0,
        }
    }

    fn buffer(value: Vec<u8>) -> MdiFfiBuffer {
        if value.is_empty() {
            return empty_buffer();
        }
        let mut value = value.into_boxed_slice();
        let result = MdiFfiBuffer {
            data: value.as_mut_ptr(),
            len: value.len(),
        };
        std::mem::forget(value);
        result
    }

    fn success(value: Vec<u8>) -> MdiFfiResult {
        MdiFfiResult {
            value: buffer(value),
            error: empty_buffer(),
        }
    }

    fn failure(message: impl Into<String>) -> MdiFfiResult {
        MdiFfiResult {
            value: empty_buffer(),
            error: buffer(message.into().into_bytes()),
        }
    }

    fn utf8_argument<'a>(data: *const u8, len: usize, name: &str) -> Result<&'a str, String> {
        if data.is_null() && len != 0 {
            return Err(format!("{name} pointer is null"));
        }
        let bytes = if len == 0 {
            &[]
        } else {
            unsafe { slice::from_raw_parts(data, len) }
        };
        std::str::from_utf8(bytes).map_err(|_| format!("{name} must be valid UTF-8"))
    }

    fn source<'a>(data: *const u8, len: usize) -> Result<&'a str, String> {
        utf8_argument(data, len, "MDI source")
    }

    fn string_result(
        data: *const u8,
        len: usize,
        operation: impl FnOnce(&str) -> String,
    ) -> MdiFfiResult {
        match source(data, len) {
            Ok(source) => success(operation(source).into_bytes()),
            Err(error) => failure(error),
        }
    }

    #[unsafe(no_mangle)]
    pub extern "C" fn mdi_parse_json(data: *const u8, len: usize) -> MdiFfiResult {
        string_result(data, len, parse_json)
    }
    #[unsafe(no_mangle)]
    pub extern "C" fn mdi_render_html(data: *const u8, len: usize) -> MdiFfiResult {
        string_result(data, len, render_html)
    }
    #[unsafe(no_mangle)]
    pub extern "C" fn mdi_serialize_mdi(data: *const u8, len: usize) -> MdiFfiResult {
        string_result(data, len, serialize_mdi)
    }
    #[unsafe(no_mangle)]
    pub extern "C" fn mdi_render_text(data: *const u8, len: usize) -> MdiFfiResult {
        string_result(data, len, render_text)
    }
    #[unsafe(no_mangle)]
    pub extern "C" fn mdi_render_text_format(
        data: *const u8,
        len: usize,
        format_data: *const u8,
        format_len: usize,
        indent_data: *const u8,
        indent_len: usize,
    ) -> MdiFfiResult {
        let result = source(data, len).and_then(|source| {
            let format = utf8_argument(format_data, format_len, "MDI text format")?;
            let indent_prefix = utf8_argument(indent_data, indent_len, "MDI text indent prefix")?;
            let format = TextFormat::parse(format)
                .ok_or_else(|| format!("Unsupported text format: {format}"))?;
            Ok(render_text_format(source, format, indent_prefix))
        });
        match result {
            Ok(value) => success(value.into_bytes()),
            Err(error) => failure(error),
        }
    }

    fn binary_result(
        data: *const u8,
        len: usize,
        operation: impl FnOnce(&str) -> Result<Vec<u8>, String>,
    ) -> MdiFfiResult {
        match source(data, len).and_then(operation) {
            Ok(value) => success(value),
            Err(error) => failure(error),
        }
    }

    #[unsafe(no_mangle)]
    pub extern "C" fn mdi_render_epub(data: *const u8, len: usize) -> MdiFfiResult {
        binary_result(data, len, render_epub)
    }
    #[unsafe(no_mangle)]
    pub extern "C" fn mdi_render_docx(data: *const u8, len: usize) -> MdiFfiResult {
        binary_result(data, len, render_docx)
    }

    /// Releases a buffer returned by this module.
    ///
    /// # Safety
    ///
    /// `buffer` must have been returned by one of this module's functions and
    /// each non-empty buffer must be passed here at most once.
    #[unsafe(no_mangle)]
    pub unsafe extern "C" fn mdi_free_buffer(buffer: MdiFfiBuffer) {
        if !buffer.data.is_null() && buffer.len != 0 {
            unsafe {
                drop(Vec::from_raw_parts(buffer.data, buffer.len, buffer.len));
            }
        }
    }
}

/// Render a complete source document to a standalone HTML document directly
/// from the Rust-owned IR.  This is intentionally source-oriented for FFI:
/// bindings pass UTF-8 source once and never reconstruct MDI syntax in a host
/// renderer.
pub fn render_html(source: &str) -> String {
    render_html_document(&parse_document(source))
}

/// Render a previously parsed document to standalone HTML.
pub fn render_html_document(document: &Document) -> String {
    let frontmatter = document.frontmatter.as_ref();
    let field = |key: &str| {
        frontmatter
            .and_then(|frontmatter| frontmatter.entries.iter().find(|entry| entry.key == key))
            .and_then(|entry| entry.value.as_str())
    };
    let lang = field("lang").unwrap_or("ja");
    let title = field("title")
        .map(|title| format!("<title>{}</title>", escape_html(title)))
        .unwrap_or_default();
    let vertical = matches!(field("writing-mode"), Some("vertical"));
    let writing_mode = if vertical {
        " style=\"writing-mode: vertical-rl;\""
    } else {
        ""
    };
    let mut body = String::new();
    let mut footnotes = Vec::new();
    for child in &document.children {
        if child.get("type").and_then(serde_json::Value::as_str) == Some("footnoteDefinition") {
            footnotes.push(child);
        } else {
            render_html_node(child, &mut body);
        }
    }
    if !footnotes.is_empty() {
        body.push_str("<section data-footnotes=\"\" class=\"footnotes\"><h2 class=\"sr-only\" id=\"footnote-label\">Footnotes</h2><ol>");
        for (index, footnote) in footnotes.into_iter().enumerate() {
            let identifier = footnote
                .get("identifier")
                .and_then(serde_json::Value::as_str)
                .map(str::to_owned)
                .unwrap_or_else(|| format!("{}", index + 1));
            body.push_str("<li id=\"user-content-fn-");
            body.push_str(&escape_html(&identifier));
            body.push_str("\">");
            render_html_children(footnote, &mut body);
            body.push_str(" <a href=\"#user-content-fnref-");
            body.push_str(&escape_html(&identifier));
            body.push_str("\" data-footnote-backref=\"\" aria-label=\"Back to reference\" class=\"data-footnote-backref\">↩</a>");
            body.push_str("</li>");
        }
        body.push_str("</ol></section>");
    }
    format!(
        "<!DOCTYPE html><html lang=\"{}\"{}><head><meta charset=\"utf-8\">{}<style>{}</style></head><body>{}</body></html>",
        escape_html(lang),
        writing_mode,
        title,
        MDI_STYLESHEET,
        body
    )
}

/// Parse and serialize source to canonical MDI/Markdown spelling in Rust.
pub fn serialize_mdi(source: &str) -> String {
    serialize_mdi_document(&parse_document(source))
}

/// Serialize a parsed document without invoking a host Markdown serializer.
pub fn serialize_mdi_document(document: &Document) -> String {
    let mut output = String::new();
    if let Some(frontmatter) = &document.frontmatter {
        output.push_str("---\n");
        output.push_str(frontmatter.raw.trim_end_matches(['\r', '\n']));
        output.push_str("\n---\n\n");
    }
    for (index, node) in document.children.iter().enumerate() {
        if index > 0 && !output.ends_with("\n\n") {
            output.push('\n');
        }
        serialize_block(node, &mut output, "");
    }
    output
}

/// Render source to deterministic plain text from the Rust IR. Typography
/// annotations are represented by their readable base text; page and blank
/// paragraph boundaries remain visible as newlines.
pub fn render_text(source: &str) -> String {
    render_text_document(&parse_document(source))
}

/// Render a parsed document to plain text.
pub fn render_text_document(document: &Document) -> String {
    let mut output = String::new();
    for node in &document.children {
        render_text_node(node, &mut output);
        if !output.ends_with('\n') {
            output.push('\n');
        }
    }
    output
}

/// Text export conventions supported by the portable core.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TextFormat {
    Plain,
    Ruby,
    Narou,
    Kakuyomu,
    Aozora,
    Note,
}

impl TextFormat {
    /// Parse the stable binding names used by the CLI and JavaScript API.
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "txt" => Some(Self::Plain),
            "txt-ruby" => Some(Self::Ruby),
            "narou" => Some(Self::Narou),
            "kakuyomu" => Some(Self::Kakuyomu),
            "aozora" => Some(Self::Aozora),
            "note" => Some(Self::Note),
            _ => None,
        }
    }
}

/// Render a publication-platform text variant from Rust IR. `indent_prefix`
/// is supplied by the host's already-resolved export profile.
pub fn render_text_format(source: &str, format: TextFormat, indent_prefix: &str) -> String {
    let document = parse_document(source);
    if matches!(format, TextFormat::Note) {
        return render_note_document(&document, indent_prefix);
    }
    let mut heading_depths = document
        .children
        .iter()
        .filter(|node| node.get("type").and_then(serde_json::Value::as_str) == Some("heading"))
        .filter_map(|node| node.get("depth").and_then(serde_json::Value::as_u64))
        .collect::<Vec<_>>();
    heading_depths.sort_unstable();
    heading_depths.dedup();
    let definitions: Vec<&serde_json::Value> = document
        .children
        .iter()
        .filter(|node| {
            node.get("type").and_then(serde_json::Value::as_str) == Some("footnoteDefinition")
        })
        .collect();
    let mut blocks = Vec::new();
    for node in &document.children {
        text_format_block(
            node,
            format,
            indent_prefix,
            &definitions,
            &heading_depths,
            &mut blocks,
        );
    }
    if !matches!(format, TextFormat::Plain | TextFormat::Ruby) && !definitions.is_empty() {
        blocks.push(String::new());
        blocks.push("Footnotes".to_owned());
        for (index, definition) in definitions.iter().enumerate() {
            let text = children(definition)
                .iter()
                .filter(|child| {
                    child.get("type").and_then(serde_json::Value::as_str) == Some("paragraph")
                })
                .map(|paragraph| text_format_inline_children(paragraph, format, &definitions))
                .collect::<Vec<_>>()
                .join(" ");
            blocks.push(format!("{}. {text}", index + 1));
        }
    }
    if matches!(format, TextFormat::Aozora) && heading_depths.len() > 3 {
        blocks.push(String::new());
        blocks.push("※小見出しよりもさらに下位の見出しには、注記しませんでした。".to_owned());
    }
    let output = blocks.join("\n");
    if matches!(format, TextFormat::Aozora) {
        output.replace('\n', "\r\n")
    } else {
        output
    }
}

fn render_note_document(document: &Document, indent_prefix: &str) -> String {
    let definitions: Vec<&serde_json::Value> = document
        .children
        .iter()
        .filter(|node| {
            node.get("type").and_then(serde_json::Value::as_str) == Some("footnoteDefinition")
        })
        .collect();
    let mut blocks = document
        .children
        .iter()
        .filter_map(|node| {
            note_format_block(node, indent_prefix, &definitions, NoteInlineContext::Body)
        })
        .collect::<Vec<_>>();
    if !definitions.is_empty() {
        let mut footnotes = vec!["注".to_owned()];
        for (index, definition) in definitions.iter().enumerate() {
            let value = children(definition)
                .iter()
                .filter_map(|child| {
                    note_format_block(child, "", &definitions, NoteInlineContext::Body)
                })
                .collect::<Vec<_>>()
                .join(" ");
            footnotes.push(format!("{}. {value}", index + 1));
        }
        blocks.push("---".to_owned());
        blocks.push(footnotes.join("\n"));
    }
    blocks.join("\n\n")
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum NoteInlineContext {
    Body,
    Heading,
    Quote,
}

fn note_format_block(
    node: &serde_json::Value,
    indent_prefix: &str,
    definitions: &[&serde_json::Value],
    context: NoteInlineContext,
) -> Option<String> {
    let kind = node
        .get("type")
        .and_then(serde_json::Value::as_str)
        .unwrap_or_default();
    match kind {
        "footnoteDefinition" | "definition" => None,
        "paragraph" => {
            let indent = node
                .get("indent")
                .and_then(serde_json::Value::as_u64)
                .map(|amount| "　".repeat(amount as usize))
                .unwrap_or_default();
            Some(format!(
                "{indent_prefix}{indent}{}",
                note_inline_children(node, definitions, context)
            ))
        }
        "heading" => {
            let marker = if node
                .get("depth")
                .and_then(serde_json::Value::as_u64)
                .unwrap_or(1)
                == 1
            {
                "##"
            } else {
                "###"
            };
            Some(format!(
                "{marker} {}",
                note_inline_children(node, definitions, NoteInlineContext::Heading)
            ))
        }
        "list" => Some(note_format_list(node, 0, definitions, context)),
        "blockquote" => {
            let value = children(node)
                .iter()
                .filter_map(|child| {
                    note_format_block(child, "", definitions, NoteInlineContext::Quote)
                })
                .collect::<Vec<_>>()
                .join("\n\n");
            Some(
                value
                    .lines()
                    .map(|line| format!("> {line}"))
                    .collect::<Vec<_>>()
                    .join("\n"),
            )
        }
        "code" => Some(note_code_block(
            node.get("value")
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default(),
            node.get("lang").and_then(serde_json::Value::as_str),
        )),
        "math" => Some(format!(
            "$$\n{}\n$$",
            node.get("value")
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default()
        )),
        "table" => Some(
            children(node)
                .iter()
                .map(|row| {
                    children(row)
                        .iter()
                        .map(|cell| note_inline_children(cell, definitions, context))
                        .collect::<Vec<_>>()
                        .join("\t")
                })
                .collect::<Vec<_>>()
                .join("\n"),
        ),
        "thematicBreak" => Some("---".to_owned()),
        // note has no pagination paste syntax.  A visual divider preserves the
        // source boundary but does not claim to retain pagination semantics.
        "pagebreak" => Some("---".to_owned()),
        "blank" => Some(String::new()),
        "html" => Some(note_code_block(
            node.get("value")
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default(),
            Some("html"),
        )),
        _ if !children(node).is_empty() => Some(note_inline_children(node, definitions, context)),
        _ => None,
    }
}

fn note_format_list(
    node: &serde_json::Value,
    depth: usize,
    definitions: &[&serde_json::Value],
    context: NoteInlineContext,
) -> String {
    // note's editor supports five list levels, but its documented hierarchy
    // controls are Tab/Shift+Tab (or their shortcuts), not space indentation.
    // Indentation here is therefore a readable visual fallback, clamped at
    // five levels rather than a claim that paste will create nested list nodes.
    let indentation = "  ".repeat(depth.min(4));
    let continuation = "  ".repeat((depth + 1).min(5));
    let ordered = node
        .get("ordered")
        .and_then(serde_json::Value::as_bool)
        .unwrap_or(false);
    let start = node
        .get("start")
        .and_then(serde_json::Value::as_u64)
        .unwrap_or(1);
    let mut lines = Vec::new();
    for (index, item) in children(node).iter().enumerate() {
        let marker = if ordered {
            format!("{}.", start + index as u64)
        } else {
            "-".to_owned()
        };
        let checked = match item.get("checked").and_then(serde_json::Value::as_bool) {
            Some(true) => "[x] ",
            Some(false) => "[ ] ",
            None => "",
        };
        let mut item_started = false;
        for child in children(item) {
            if child.get("type").and_then(serde_json::Value::as_str) == Some("paragraph")
                && !item_started
            {
                lines.push(format!(
                    "{indentation}{marker} {checked}{}",
                    note_inline_children(child, definitions, context)
                ));
                item_started = true;
                continue;
            }
            if child.get("type").and_then(serde_json::Value::as_str) == Some("list") {
                if !item_started {
                    lines.push(format!("{indentation}{marker} {checked}"));
                    item_started = true;
                }
                lines.push(note_format_list(child, depth + 1, definitions, context));
                continue;
            }
            if let Some(value) = note_format_block(child, "", definitions, context) {
                if !item_started {
                    lines.push(format!("{indentation}{marker} {checked}"));
                    item_started = true;
                }
                lines.extend(value.lines().map(|line| format!("{continuation}{line}")));
            }
        }
        if !item_started {
            lines.push(format!("{indentation}{marker} {checked}"));
        }
    }
    lines.join("\n")
}

fn note_inline_children(
    node: &serde_json::Value,
    definitions: &[&serde_json::Value],
    context: NoteInlineContext,
) -> String {
    children(node)
        .iter()
        .map(|child| note_inline(child, definitions, context))
        .collect()
}

fn note_inline(
    node: &serde_json::Value,
    definitions: &[&serde_json::Value],
    context: NoteInlineContext,
) -> String {
    let kind = node
        .get("type")
        .and_then(serde_json::Value::as_str)
        .unwrap_or_default();
    match kind {
        "text" => note_text_literal(
            node.get("value")
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default(),
        ),
        // note documents fenced code blocks, not inline-code Markdown.  Keep
        // the code readable without emitting a marker the editor may not own.
        "inlineCode" => note_text_literal(
            node.get("value")
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default(),
        ),
        "inlineMath" => {
            let value = node
                .get("value")
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default();
            if matches!(context, NoteInlineContext::Body) {
                format!("$${{{value}}}$$")
            } else {
                note_text_literal(value)
            }
        }
        "tcy" => note_text_literal(
            node.get("value")
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default(),
        ),
        "break" => "\n".to_owned(),
        "ruby" => {
            let base = node
                .get("base")
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default();
            let reading = node
                .pointer("/ruby/value")
                .map(|value| match value {
                    serde_json::Value::Array(parts) => parts
                        .iter()
                        .filter_map(serde_json::Value::as_str)
                        .collect::<String>(),
                    serde_json::Value::String(value) => value.to_owned(),
                    _ => String::new(),
                })
                .unwrap_or_default();
            text_format_platform_ruby(base, &reading, TextFormat::Note)
        }
        "strong" => {
            let value = note_inline_children(node, definitions, context);
            if matches!(context, NoteInlineContext::Heading) {
                value
            } else {
                // note activates this input shortcut after a following
                // half-width space is entered.
                format!("**{value}** ")
            }
        }
        "delete" => {
            let value = note_inline_children(node, definitions, context);
            if matches!(context, NoteInlineContext::Heading) {
                value
            } else {
                // note activates this input shortcut after a following
                // half-width space is entered.
                format!("~~{value}~~ ")
            }
        }
        "link" => {
            let label = note_inline_children(node, definitions, context);
            let url = node
                .get("url")
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default();
            let title_value = node
                .get("title")
                .and_then(serde_json::Value::as_str)
                .filter(|title| !title.is_empty() && !title.contains(['\r', '\n']));
            if title_value.is_none() && label == note_text_literal(url) {
                return note_text_literal(url);
            }
            let title = title_value
                .map(|title| format!(" — {title}"))
                .unwrap_or_default();
            if url.is_empty() {
                format!("{label}{title}")
            } else {
                format!("{label} ({}){title}", note_text_literal(url))
            }
        }
        "image" => {
            let alt = note_text_literal(
                node.get("alt")
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or_default(),
            );
            let url = node
                .get("url")
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default();
            if url.is_empty() {
                format!("画像: {alt}")
            } else {
                format!("画像: {alt} ({})", note_text_literal(url))
            }
        }
        "html" => note_text_literal(
            node.get("value")
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default(),
        ),
        "footnoteReference" => {
            let identifier = node
                .get("identifier")
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default();
            let index = definitions
                .iter()
                .position(|definition| {
                    definition
                        .get("identifier")
                        .and_then(serde_json::Value::as_str)
                        == Some(identifier)
                })
                .map(|index| index + 1)
                .unwrap_or(0);
            format!("［注{index}］")
        }
        // note has no paste syntax for these MDI presentation annotations or
        // Markdown emphasis, so retain their readable content.
        "emphasis" | "em" | "warichu" | "kern" | "noBreak" => {
            note_inline_children(node, definitions, context)
        }
        _ => note_inline_children(node, definitions, context),
    }
}

fn note_code_block(value: &str, language: Option<&str>) -> String {
    let longest_run = longest_backtick_run(value);
    let fence = "`".repeat(longest_run.saturating_add(1).max(3));
    let language = language
        .filter(|language| !language.is_empty() && !language.contains(['`', '\r', '\n', ' ', '\t']))
        // note documents Mermaid only with an exact triple-backtick fence.
        // If the body forces a longer fence, keep the code readable without
        // falsely labelling it as a Mermaid contract.
        .filter(|language| *language != "mermaid" || longest_run < 3)
        .unwrap_or_default();
    let trailing_newline = if value.ends_with('\n') { "" } else { "\n" };
    format!("{fence}{language}\n{value}{trailing_newline}{fence}")
}

fn longest_backtick_run(value: &str) -> usize {
    value
        .split(|character| character != '`')
        .map(str::len)
        .max()
        .unwrap_or(0)
}

fn note_text_literal(value: &str) -> String {
    // note does not document a backslash escape for editor shortcuts or ruby.
    // Inventing one would visibly corrupt ordinary punctuation.  Preserve
    // literal text and document that delimiter collisions cannot be represented
    // losslessly by this plain-text profile.
    value.to_owned()
}

fn text_format_block(
    node: &serde_json::Value,
    format: TextFormat,
    prefix: &str,
    definitions: &[&serde_json::Value],
    heading_depths: &[u64],
    output: &mut Vec<String>,
) {
    let kind = node
        .get("type")
        .and_then(serde_json::Value::as_str)
        .unwrap_or_default();
    match kind {
        "footnoteDefinition" | "definition" => {}
        "paragraph" => {
            let value = text_format_inline_children(node, format, definitions);
            let block_prefix = text_format_block_prefix(node, format);
            output.push(format!("{prefix}{block_prefix}{value}"));
        }
        "heading" => {
            let value = text_format_inline_children(node, format, definitions);
            if matches!(format, TextFormat::Aozora) {
                let depth = node
                    .get("depth")
                    .and_then(serde_json::Value::as_u64)
                    .unwrap_or(3);
                if let Some(size) = aozora_heading_size(depth, heading_depths) {
                    let reference = text_format_plain_inline_children(node);
                    if aozora_needs_range_annotation(node) {
                        output.push(format!("［＃{size}見出し］{value}［＃{size}見出し終わり］"));
                    } else {
                        output.push(format!("{value}［＃「{reference}」は{size}見出し］"));
                    }
                } else {
                    output.push(value);
                }
            } else {
                output.push(value);
            }
        }
        "list" => {
            for (index, item) in children(node).iter().enumerate() {
                for child in children(item) {
                    if child.get("type").and_then(serde_json::Value::as_str) == Some("paragraph") {
                        let bullet = if node
                            .get("ordered")
                            .and_then(serde_json::Value::as_bool)
                            .unwrap_or(false)
                        {
                            format!("{}. ", index + 1)
                        } else {
                            "- ".to_owned()
                        };
                        output.push(format!(
                            "{prefix}{bullet}{}",
                            text_format_inline_children(child, format, definitions)
                        ));
                    } else {
                        text_format_block(
                            child,
                            format,
                            prefix,
                            definitions,
                            heading_depths,
                            output,
                        );
                    }
                }
            }
        }
        "blockquote" => {
            for child in children(node) {
                text_format_block(child, format, prefix, definitions, heading_depths, output);
            }
        }
        "code" => output.extend(
            node.get("value")
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default()
                .lines()
                .map(|line| text_format_literal(line, format)),
        ),
        "table" => {
            for row in children(node) {
                output.push(
                    children(row)
                        .iter()
                        .map(|cell| text_format_inline_children(cell, format, definitions))
                        .collect::<Vec<_>>()
                        .join("\t"),
                );
            }
        }
        "thematicBreak" => output.push("――――――".to_owned()),
        "blank" => output.push(String::new()),
        "pagebreak" => {
            if matches!(format, TextFormat::Aozora) {
                let annotation = match node.get("variant").and_then(serde_json::Value::as_str) {
                    Some("left") => "［＃改丁］",
                    Some("right") => "［＃改見開き］",
                    _ => "［＃改ページ］",
                };
                output.push(annotation.to_owned());
            } else {
                output.push(String::new());
            }
        }
        _ => {}
    }
}

fn aozora_heading_size(depth: u64, heading_depths: &[u64]) -> Option<&'static str> {
    let index = heading_depths
        .iter()
        .position(|candidate| *candidate == depth)?;
    match heading_depths.len() {
        1 => Some("中"),
        2 => ["大", "中"].get(index).copied(),
        _ => ["大", "中", "小"].get(index).copied(),
    }
}

fn text_format_block_prefix(node: &serde_json::Value, format: TextFormat) -> String {
    let indent = node
        .get("indent")
        .and_then(serde_json::Value::as_u64)
        .filter(|amount| *amount > 0);
    let bottom = node.get("bottom").and_then(serde_json::Value::as_u64);
    if matches!(format, TextFormat::Aozora) {
        if let Some(amount) = bottom {
            return if amount == 0 {
                "［＃地付き］".to_owned()
            } else {
                format!("［＃地から{}字上げ］", fullwidth_digits(amount))
            };
        }
        return indent
            .map(|amount| format!("［＃{}字下げ］", fullwidth_digits(amount)))
            .unwrap_or_default();
    }
    indent
        .map(|amount| "　".repeat(amount as usize))
        .unwrap_or_default()
}

fn fullwidth_digits(value: u64) -> String {
    value
        .to_string()
        .replace('0', "０")
        .replace('1', "１")
        .replace('2', "２")
        .replace('3', "３")
        .replace('4', "４")
        .replace('5', "５")
        .replace('6', "６")
        .replace('7', "７")
        .replace('8', "８")
        .replace('9', "９")
}

fn text_format_inline_children(
    node: &serde_json::Value,
    format: TextFormat,
    definitions: &[&serde_json::Value],
) -> String {
    children(node)
        .iter()
        .map(|node| text_format_inline(node, format, definitions))
        .collect()
}
fn text_format_inline(
    node: &serde_json::Value,
    format: TextFormat,
    definitions: &[&serde_json::Value],
) -> String {
    match node
        .get("type")
        .and_then(serde_json::Value::as_str)
        .unwrap_or_default()
    {
        "text" | "inlineCode" => text_format_literal(
            node.get("value")
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default(),
            format,
        ),
        "tcy" => {
            let value = text_format_literal(
                node.get("value")
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or_default(),
                format,
            );
            if matches!(format, TextFormat::Aozora) {
                format!("{value}［＃「{value}」は縦中横］")
            } else {
                value
            }
        }
        "break" => "\n".to_owned(),
        "ruby" => {
            let base = node
                .get("base")
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default();
            let reading = node
                .pointer("/ruby/value")
                .map(|value| match value {
                    serde_json::Value::Array(parts) => parts
                        .iter()
                        .filter_map(serde_json::Value::as_str)
                        .collect::<Vec<_>>()
                        .join(if matches!(format, TextFormat::Ruby) {
                            "."
                        } else {
                            ""
                        }),
                    serde_json::Value::String(value) => value.to_owned(),
                    _ => String::new(),
                })
                .unwrap_or_default();
            match format {
                TextFormat::Plain => base.to_owned(),
                TextFormat::Ruby => format!("{{{base}|{reading}}}"),
                _ => text_format_platform_ruby(base, &reading, format),
            }
        }
        "em" => {
            let value = text_format_inline_children(node, format, definitions);
            match format {
                TextFormat::Aozora if !value.is_empty() && !value.contains('\n') => {
                    let name = aozora_boten_name(
                        node.get("mark")
                            .and_then(serde_json::Value::as_str)
                            .unwrap_or("﹅"),
                    );
                    format!("［＃{name}］{value}［＃{name}終わり］")
                }
                TextFormat::Kakuyomu
                    if !value.is_empty()
                        && !value.contains('\n')
                        && !value.contains('《')
                        && !node_contains_type(node, "ruby") =>
                {
                    format!("《《{value}》》")
                }
                TextFormat::Narou
                    if !value.is_empty()
                        && !value.contains('\n')
                        && !node_contains_type(node, "ruby") =>
                {
                    value
                        .graphemes(true)
                        .map(|character| {
                            text_format_platform_ruby(character, "・", TextFormat::Narou)
                        })
                        .collect()
                }
                _ => value,
            }
        }
        "image" => node
            .get("alt")
            .and_then(serde_json::Value::as_str)
            .filter(|alt| !alt.is_empty())
            .map(|alt| format!("[画像: {}]", text_format_literal(alt, format)))
            .unwrap_or_else(|| "[画像]".to_owned()),
        "warichu" => {
            let value = text_format_inline_children(node, format, definitions);
            if matches!(format, TextFormat::Aozora) && !value.is_empty() && !value.contains('\n') {
                format!("［＃割り注］{value}［＃割り注終わり］")
            } else {
                value
            }
        }
        "footnoteReference" => {
            if matches!(format, TextFormat::Plain | TextFormat::Ruby) {
                String::new()
            } else {
                let identifier = node
                    .get("identifier")
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or_default();
                let index = definitions
                    .iter()
                    .position(|definition| {
                        definition
                            .get("identifier")
                            .and_then(serde_json::Value::as_str)
                            == Some(identifier)
                    })
                    .map(|index| index + 1)
                    .unwrap_or(0);
                if matches!(format, TextFormat::Aozora) {
                    format!("（注{index}）")
                } else {
                    format!("［注{index}］")
                }
            }
        }
        _ => text_format_inline_children(node, format, definitions),
    }
}

fn text_format_platform_ruby(base: &str, reading: &str, format: TextFormat) -> String {
    let valid = match format {
        TextFormat::Narou => {
            (1..=10).contains(&base.graphemes(true).count())
                && (1..=10).contains(&reading.graphemes(true).count())
                && !base.chars().any(narou_ruby_problem_character)
                && !reading.chars().any(narou_ruby_problem_character)
        }
        TextFormat::Kakuyomu => {
            (1..=20).contains(&base.graphemes(true).count())
                && (1..=50).contains(&reading.graphemes(true).count())
                && !base.contains(['\r', '\n'])
                && !reading.contains(['\r', '\n'])
                && !base.contains(['《', '》'])
                && !reading.contains(['《', '》'])
        }
        TextFormat::Aozora => {
            !base.is_empty()
                && !reading.is_empty()
                && !base.contains(['\r', '\n'])
                && !reading.contains(['\r', '\n'])
                && !base.chars().any(aozora_reserved_character)
                && !reading.chars().any(aozora_reserved_character)
        }
        TextFormat::Note => {
            !base.is_empty()
                && !reading.is_empty()
                && !base.contains(['\r', '\n', '《', '》', '|', '｜'])
                && !reading.contains(['\r', '\n', '《', '》'])
        }
        TextFormat::Plain | TextFormat::Ruby => false,
    };
    if valid {
        format!("｜{base}《{reading}》")
    } else if matches!(format, TextFormat::Note) {
        note_text_literal(base)
    } else {
        text_format_literal(base, format)
    }
}

fn narou_ruby_problem_character(character: char) -> bool {
    matches!(character, '&' | '"' | '<' | '>')
}

fn aozora_boten_name(mark: &str) -> &'static str {
    match mark {
        "﹆" => "白ゴマ傍点",
        "●" => "丸傍点",
        "○" => "白丸傍点",
        "▲" => "黒三角傍点",
        "△" => "白三角傍点",
        "◎" => "二重丸傍点",
        "×" => "ばつ傍点",
        _ => "傍点",
    }
}

fn node_contains_type(node: &serde_json::Value, expected: &str) -> bool {
    node.get("type").and_then(serde_json::Value::as_str) == Some(expected)
        || children(node)
            .iter()
            .any(|child| node_contains_type(child, expected))
}

fn text_format_plain_inline_children(node: &serde_json::Value) -> String {
    children(node)
        .iter()
        .map(text_format_plain_inline)
        .collect()
}

fn text_format_plain_inline(node: &serde_json::Value) -> String {
    match node
        .get("type")
        .and_then(serde_json::Value::as_str)
        .unwrap_or_default()
    {
        "text" | "inlineCode" | "tcy" => node
            .get("value")
            .and_then(serde_json::Value::as_str)
            .unwrap_or_default()
            .to_owned(),
        "ruby" => node
            .get("base")
            .and_then(serde_json::Value::as_str)
            .unwrap_or_default()
            .to_owned(),
        "break" => "\n".to_owned(),
        "image" => node
            .get("alt")
            .and_then(serde_json::Value::as_str)
            .unwrap_or_default()
            .to_owned(),
        _ => text_format_plain_inline_children(node),
    }
}

fn aozora_needs_range_annotation(node: &serde_json::Value) -> bool {
    node_contains_type(node, "em")
        || text_format_plain_inline_children(node)
            .chars()
            .any(aozora_reserved_character)
}

fn aozora_reserved_character(character: char) -> bool {
    matches!(
        character,
        '《' | '》' | '［' | '］' | '〔' | '〕' | '｜' | '＃' | '※'
    )
}

fn text_format_literal(value: &str, format: TextFormat) -> String {
    match format {
        TextFormat::Kakuyomu => value.replace('《', "｜《"),
        TextFormat::Narou => value.replace('（', "｜（").replace('(', "|("),
        TextFormat::Aozora => value
            .chars()
            .map(|character| match character {
                '《' => "※［＃始め二重山括弧、1-1-52］".to_owned(),
                '》' => "※［＃終わり二重山括弧、1-1-53］".to_owned(),
                '［' => "※［＃始め角括弧、1-1-46］".to_owned(),
                '］' => "※［＃終わり角括弧、1-1-47］".to_owned(),
                '〔' => "※［＃始めきっこう（亀甲）括弧、1-1-44］".to_owned(),
                '〕' => "※［＃終わりきっこう（亀甲）括弧、1-1-45］".to_owned(),
                '｜' => "※［＃縦線、1-1-35］".to_owned(),
                '＃' => "※［＃井げた、1-1-84］".to_owned(),
                '※' => "※［＃米印、1-2-8］".to_owned(),
                _ => character.to_string(),
            })
            .collect(),
        TextFormat::Plain | TextFormat::Ruby | TextFormat::Note => value.to_owned(),
    }
}

fn render_text_node(node: &serde_json::Value, out: &mut String) {
    match node
        .get("type")
        .and_then(serde_json::Value::as_str)
        .unwrap_or_default()
    {
        "text" | "inlineCode" | "code" | "html" | "tcy" => out.push_str(
            node.get("value")
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default(),
        ),
        "ruby" => out.push_str(
            node.get("base")
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default(),
        ),
        "image" => out.push_str(
            node.get("alt")
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default(),
        ),
        "break" => out.push('\n'),
        "blank" => out.push('\n'),
        "pagebreak" => out.push_str("\n\x0C\n"),
        "heading" | "paragraph" | "blockquote" | "listItem" | "tableRow" => {
            render_text_children(node, out);
            out.push('\n');
        }
        "tableCell" => {
            render_text_children(node, out);
            out.push('\t');
        }
        _ => render_text_children(node, out),
    }
}

fn render_text_children(node: &serde_json::Value, out: &mut String) {
    for child in children(node) {
        render_text_node(child, out);
    }
}

fn serialize_block(node: &serde_json::Value, out: &mut String, prefix: &str) {
    let kind = node
        .get("type")
        .and_then(serde_json::Value::as_str)
        .unwrap_or_default();
    match kind {
        "paragraph" => {
            if let Some(amount) = node.get("indent").and_then(serde_json::Value::as_u64) {
                out.push_str(prefix);
                out.push_str(&format!("[[indent:{amount}]]\n"));
            }
            if let Some(amount) = node.get("bottom").and_then(serde_json::Value::as_u64) {
                out.push_str(prefix);
                if amount == 0 {
                    out.push_str("[[bottom]]\n");
                } else {
                    out.push_str(&format!("[[bottom:{amount}]]\n"));
                }
            }
            out.push_str(prefix);
            serialize_inline_children(node, out);
            out.push('\n');
        }
        "heading" => {
            out.push_str(prefix);
            out.push_str(
                &"#".repeat(
                    node.get("depth")
                        .and_then(serde_json::Value::as_u64)
                        .unwrap_or(1) as usize,
                ),
            );
            out.push(' ');
            serialize_inline_children(node, out);
            out.push('\n');
        }
        "blockquote" => {
            let mut content = String::new();
            for child in children(node) {
                serialize_block(child, &mut content, "");
            }
            for line in content.trim_end_matches('\n').lines() {
                out.push_str(prefix);
                out.push_str("> ");
                out.push_str(line);
                out.push('\n');
            }
        }
        "list" => {
            let ordered = node
                .get("ordered")
                .and_then(serde_json::Value::as_bool)
                .unwrap_or(false);
            let start = node
                .get("start")
                .and_then(serde_json::Value::as_u64)
                .unwrap_or(1);
            for (index, item) in children(node).iter().enumerate() {
                out.push_str(prefix);
                if ordered {
                    out.push_str(&format!("{}.", start + index as u64));
                } else {
                    out.push('-');
                }
                out.push(' ');
                if let Some(first) = children(item).first() {
                    serialize_block(first, out, "");
                }
                for child in children(item).iter().skip(1) {
                    serialize_block(child, out, "  ");
                }
            }
        }
        "code" => {
            out.push_str(prefix);
            out.push_str("```");
            if let Some(lang) = node.get("lang").and_then(serde_json::Value::as_str) {
                out.push_str(lang);
            }
            out.push('\n');
            out.push_str(
                node.get("value")
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or_default(),
            );
            out.push_str("\n```\n");
        }
        "thematicBreak" => out.push_str("---\n"),
        "blank" => out.push_str("\\\n"),
        "pagebreak" => {
            out.push_str("[[pagebreak");
            if let Some(variant) = node.get("variant").and_then(serde_json::Value::as_str) {
                out.push(':');
                out.push_str(variant);
            }
            out.push_str("]]\n");
        }
        "table" => serialize_table(node, out),
        "html" => {
            out.push_str(
                node.get("value")
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or_default(),
            );
            out.push('\n');
        }
        _ => {
            serialize_inline(node, out);
            out.push('\n');
        }
    }
}

fn serialize_table(node: &serde_json::Value, out: &mut String) {
    for (row_index, row) in children(node).iter().enumerate() {
        out.push('|');
        for cell in children(row) {
            out.push(' ');
            serialize_inline_children(cell, out);
            out.push_str(" |");
        }
        out.push('\n');
        if row_index == 0 {
            out.push('|');
            for _ in children(row) {
                out.push_str(" --- |");
            }
            out.push('\n');
        }
    }
}

fn serialize_inline_children(node: &serde_json::Value, out: &mut String) {
    for child in children(node) {
        serialize_inline(child, out);
    }
}

fn serialize_inline(node: &serde_json::Value, out: &mut String) {
    let kind = node
        .get("type")
        .and_then(serde_json::Value::as_str)
        .unwrap_or_default();
    match kind {
        "text" | "html" => out.push_str(
            node.get("value")
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default(),
        ),
        "emphasis" => {
            out.push('*');
            serialize_inline_children(node, out);
            out.push('*');
        }
        "strong" => {
            out.push_str("**");
            serialize_inline_children(node, out);
            out.push_str("**");
        }
        "delete" => {
            out.push_str("~~");
            serialize_inline_children(node, out);
            out.push_str("~~");
        }
        "inlineCode" => {
            out.push('`');
            out.push_str(
                node.get("value")
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or_default(),
            );
            out.push('`');
        }
        "link" => {
            out.push('[');
            serialize_inline_children(node, out);
            out.push_str("](");
            out.push_str(
                node.get("url")
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or_default(),
            );
            if let Some(title) = node.get("title").and_then(serde_json::Value::as_str) {
                out.push_str(" \\");
                out.push_str(title);
                out.push('\"');
            }
            out.push(')');
        }
        "image" => {
            out.push_str("![");
            out.push_str(
                node.get("alt")
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or_default(),
            );
            out.push_str("](");
            out.push_str(
                node.get("url")
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or_default(),
            );
            out.push(')');
        }
        "ruby" => {
            out.push('{');
            out.push_str(
                node.get("base")
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or_default(),
            );
            out.push('|');
            if let Some(values) = node
                .pointer("/ruby/value")
                .and_then(serde_json::Value::as_array)
            {
                for (index, value) in values.iter().enumerate() {
                    if index > 0 {
                        out.push('.');
                    }
                    out.push_str(value.as_str().unwrap_or_default());
                }
            } else {
                out.push_str(
                    node.pointer("/ruby/value")
                        .and_then(serde_json::Value::as_str)
                        .unwrap_or_default(),
                );
            }
            out.push('}');
        }
        "tcy" => {
            out.push('^');
            out.push_str(
                node.get("value")
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or_default(),
            );
            out.push('^');
        }
        // Markdown hard breaks and MDI `[[br]]` have the same IR node; the
        // canonical serializer chooses the explicit MDI spelling.
        "break" => out.push_str("[[br]]"),
        "em" => {
            out.push_str("[[em:");
            let mark = node
                .get("mark")
                .and_then(serde_json::Value::as_str)
                .unwrap_or("﹅");
            if mark != "﹅" {
                out.push_str(mark);
                out.push(':');
            }
            serialize_inline_children(node, out);
            out.push_str("]]");
        }
        "noBreak" => {
            out.push_str("[[no-break:");
            serialize_inline_children(node, out);
            out.push_str("]]");
        }
        "warichu" => {
            out.push_str("[[warichu:");
            serialize_inline_children(node, out);
            out.push_str("]]");
        }
        "kern" => {
            out.push_str("[[kern:");
            out.push_str(
                node.get("amount")
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or_default(),
            );
            out.push(':');
            serialize_inline_children(node, out);
            out.push_str("]]");
        }
        "footnoteReference" => {
            out.push_str("[^");
            out.push_str(
                node.get("identifier")
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or_default(),
            );
            out.push(']');
        }
        _ => serialize_inline_children(node, out),
    }
}

pub(crate) fn children(node: &serde_json::Value) -> &[serde_json::Value] {
    node.get("children")
        .and_then(serde_json::Value::as_array)
        .map(Vec::as_slice)
        .unwrap_or(&[])
}

fn document_frontmatter_field<'a>(document: &'a Document, key: &str) -> Option<&'a str> {
    document
        .frontmatter
        .as_ref()
        .and_then(|frontmatter| frontmatter.entries.iter().find(|entry| entry.key == key))
        .and_then(|entry| entry.value.as_str())
}

fn default_profile_for_document(document: &Document) -> Result<ResolvedExportProfile, String> {
    resolve_export_profile(
        &serde_json::Map::new(),
        document_frontmatter_field(document, "writing-mode"),
    )
}

fn resolved_profile_for_document(
    document: &Document,
    profile_json: &str,
    require_layout: bool,
) -> Result<ResolvedExportProfile, String> {
    let value: serde_json::Value = serde_json::from_str(profile_json)
        .map_err(|_| "Export profile must be valid JSON".to_owned())?;
    let profile = value
        .as_object()
        .ok_or_else(|| "Export profile must be a JSON object".to_owned())?;
    if require_layout
        && profile
            .get("layout")
            .and_then(serde_json::Value::as_object)
            .and_then(|layout| layout.get("system"))
            .is_none()
    {
        return Err(
            "Configured exports require layout.system: japanese-publisher or word".to_owned(),
        );
    }
    resolve_export_profile(
        profile,
        document_frontmatter_field(document, "writing-mode"),
    )
}

fn css_value(value: &str) -> String {
    let safe = value
        .chars()
        .filter(|character| !matches!(character, '{' | '}' | '<' | '>' | ';'))
        .collect::<String>();
    if safe.trim().is_empty() {
        "serif".to_owned()
    } else {
        safe
    }
}

/// The base stylesheet is intentionally shipped by the core alongside the
/// semantic HTML. Hosts may add presentation CSS, but not reinterpret nodes.
pub const MDI_STYLESHEET: &str = ".mdi-tcy{text-combine-upright:all}.mdi-nobr{white-space:nowrap}.mdi-warichu{font-size:.6em}.mdi-em{text-emphasis:var(--mdi-em,filled sesame)}.mdi-kern{letter-spacing:var(--mdi-kern)}.mdi-blank{min-block-size:1lh}.mdi-indent{margin-inline-start:calc(var(--mdi-indent)*1em)}.mdi-bottom{text-align:end}.mdi-pagebreak{break-after:page}";

#[derive(Debug, Clone)]
pub struct EpubCover {
    pub data: Vec<u8>,
    pub media_type: String,
}

/// Build a reflowable EPUB 3 archive entirely from Rust's document IR.
pub fn render_epub(source: &str) -> Result<Vec<u8>, String> {
    render_epub_document(&parse_document(source))
}

/// Build an EPUB with the canonical configured-export profile.
pub fn render_epub_with_profile(
    source: &str,
    profile_json: &str,
    cover: Option<&EpubCover>,
) -> Result<Vec<u8>, String> {
    let document = parse_document(source);
    let profile = resolved_profile_for_document(&document, profile_json, false)?;
    render_epub_document_with_profile(&document, &profile, cover)
}

/// Build a reflowable EPUB 3 archive from a parsed document.
pub fn render_epub_document(document: &Document) -> Result<Vec<u8>, String> {
    let profile = default_profile_for_document(document)?;
    render_epub_document_with_profile(document, &profile, None)
}

pub fn render_epub_document_with_profile(
    document: &Document,
    profile: &ResolvedExportProfile,
    cover: Option<&EpubCover>,
) -> Result<Vec<u8>, String> {
    let cursor = Cursor::new(Vec::new());
    let mut zip = ZipWriter::new(cursor);
    write_epub_document_with_profile(document, &mut zip, profile, cover)?;
    zip.finish()
        .map(|cursor| cursor.into_inner())
        .map_err(|error| error.to_string())
}

#[cfg(test)]
fn write_epub_document<W: Write + Seek>(
    document: &Document,
    zip: &mut ZipWriter<W>,
) -> Result<(), String> {
    let profile = default_profile_for_document(document)?;
    write_epub_document_with_profile(document, zip, &profile, None)
}

fn write_epub_document_with_profile<W: Write + Seek>(
    document: &Document,
    zip: &mut ZipWriter<W>,
    profile: &ResolvedExportProfile,
    cover: Option<&EpubCover>,
) -> Result<(), String> {
    let field = |key: &str| {
        document
            .frontmatter
            .as_ref()
            .and_then(|frontmatter| frontmatter.entries.iter().find(|entry| entry.key == key))
            .and_then(|entry| entry.value.as_str())
    };
    let metadata = |key: &str| {
        profile
            .metadata
            .get(key)
            .and_then(serde_json::Value::as_str)
    };
    let title = metadata("title")
        .or_else(|| field("title"))
        .unwrap_or("Untitled");
    let author = metadata("author").or_else(|| field("author"));
    let publisher = metadata("publisher").or_else(|| field("publisher"));
    let date = metadata("date").or_else(|| field("date"));
    let language = metadata("language")
        .or_else(|| field("lang"))
        .unwrap_or("ja");
    let identifier = metadata("identifier")
        .or_else(|| field("identifier"))
        .unwrap_or("urn:mdi:document");
    let vertical = profile.typesetting.writing_mode == "vertical";
    let modified = epub_modified_timestamp()?;
    let chapters = epub_chapters(document, &profile.epub.chapter_split_level);
    let stored = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);
    epub_file(zip, "mimetype", "application/epub+zip", stored)?;
    let compressed = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
    epub_file(
        zip,
        "META-INF/container.xml",
        "<?xml version=\"1.0\"?><container version=\"1.0\" xmlns=\"urn:oasis:names:tc:opendocument:xmlns:container\"><rootfiles><rootfile full-path=\"OEBPS/package.opf\" media-type=\"application/oebps-package+xml\"/></rootfiles></container>",
        compressed,
    )?;
    let writing = if vertical {
        "writing-mode:vertical-rl;-webkit-writing-mode:vertical-rl;text-orientation:mixed;"
    } else {
        ""
    };
    let line_spacing = profile.typesetting.line_spacing.unwrap_or(1.8);
    let fullwidth_indent = if profile.typesetting.fullwidth_space_indent {
        "--mdi-fullwidth-space-indent:1;"
    } else {
        ""
    };
    epub_file(
        zip,
        "OEBPS/style.css",
        &format!(
            "body{{font-family:{};font-size:{}pt;{writing}line-height:{line_spacing};margin:1em}}p{{{fullwidth_indent}text-indent:{}em;margin:.3em 0}}{MDI_STYLESHEET}",
            css_value(&profile.typesetting.font_family),
            profile.typesetting.font_size,
            profile.typesetting.text_indent_em,
        ),
        compressed,
    )?;
    let nav_items = chapters
        .iter()
        .enumerate()
        .map(|(index, chapter)| {
            let chapter_title = if chapter.title.trim().is_empty() {
                format!("Chapter {}", index + 1)
            } else {
                chapter.title.clone()
            };
            format!(
                "<li><a href=\"chapter-{}.xhtml\">{}</a></li>",
                index + 1,
                escape_html(&chapter_title)
            )
        })
        .collect::<String>();
    epub_file(
        zip,
        "OEBPS/nav.xhtml",
        &epub_xhtml(
            "Contents",
            language,
            &format!("<nav epub:type=\"toc\" id=\"toc\"><ol>{nav_items}</ol></nav>"),
        ),
        compressed,
    )?;
    let cover_extension = cover
        .map(|cover| match cover.media_type.as_str() {
            "image/png" => Ok("png"),
            "image/jpeg" => Ok("jpg"),
            _ => Err("EPUB cover must be image/png or image/jpeg".to_owned()),
        })
        .transpose()?;
    if let (Some(cover), Some(extension)) = (cover, cover_extension) {
        zip.start_file(format!("OEBPS/cover.{extension}"), compressed)
            .map_err(|error| error.to_string())?;
        zip.write_all(&cover.data)
            .map_err(|error| error.to_string())?;
        epub_file(
            zip,
            "OEBPS/cover.xhtml",
            &epub_xhtml(
                title,
                language,
                &format!(
                    "<img src=\"cover.{extension}\" alt=\"{}\"/>",
                    escape_html(title)
                ),
            ),
            compressed,
        )?;
    }
    for (index, chapter) in chapters.iter().enumerate() {
        epub_file(
            zip,
            &format!("OEBPS/chapter-{}.xhtml", index + 1),
            &epub_chapter_xhtml(
                if chapter.title.is_empty() {
                    title
                } else {
                    &chapter.title
                },
                language,
                &chapter.html,
            ),
            compressed,
        )?;
    }
    let cover_manifest = match (cover, cover_extension) {
        (Some(cover), Some(extension)) => format!(
            "<item id=\"cover-image\" href=\"cover.{extension}\" media-type=\"{}\" properties=\"cover-image\"/><item id=\"cover\" href=\"cover.xhtml\" media-type=\"application/xhtml+xml\"/>",
            cover.media_type
        ),
        _ => String::new(),
    };
    let chapter_manifest = chapters
        .iter()
        .enumerate()
        .map(|(index, _)| {
            format!(
                "<item id=\"chapter-{}\" href=\"chapter-{}.xhtml\" media-type=\"application/xhtml+xml\"/>",
                index + 1,
                index + 1
            )
        })
        .collect::<String>();
    let manifest = format!(
        "<item id=\"nav\" href=\"nav.xhtml\" media-type=\"application/xhtml+xml\" properties=\"nav\"/><item id=\"css\" href=\"style.css\" media-type=\"text/css\"/>{cover_manifest}{chapter_manifest}"
    );
    let chapter_spine = chapters
        .iter()
        .enumerate()
        .map(|(index, _)| format!("<itemref idref=\"chapter-{}\"/>", index + 1))
        .collect::<String>();
    let spine = format!(
        "{}{chapter_spine}",
        if cover.is_some() {
            "<itemref idref=\"cover\"/>"
        } else {
            ""
        }
    );
    let creator = author
        .map(|author| format!("<dc:creator>{}</dc:creator>", escape_html(author)))
        .unwrap_or_default();
    let publisher = publisher
        .map(|publisher| format!("<dc:publisher>{}</dc:publisher>", escape_html(publisher)))
        .unwrap_or_default();
    let date = date
        .map(|date| format!("<dc:date>{}</dc:date>", escape_html(date)))
        .unwrap_or_default();
    let progression = if vertical {
        " page-progression-direction=\"rtl\""
    } else {
        ""
    };
    epub_file(
        zip,
        "OEBPS/package.opf",
        &format!(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?><package xmlns=\"http://www.idpf.org/2007/opf\" version=\"3.0\" unique-identifier=\"book-id\"><metadata xmlns:dc=\"http://purl.org/dc/elements/1.1/\"><dc:identifier id=\"book-id\">{}</dc:identifier><dc:title>{}</dc:title><dc:language>{}</dc:language>{creator}{publisher}{date}<meta property=\"dcterms:modified\">{modified}</meta></metadata><manifest>{manifest}</manifest><spine{progression}>{spine}</spine></package>",
            escape_html(identifier),
            escape_html(title),
            escape_html(language)
        ),
        compressed,
    )?;
    Ok(())
}

/// Build a baseline DOCX archive directly from Rust IR. It deliberately uses
/// WordprocessingML rather than a host document library, so source syntax and
/// document meaning remain inside the core.
pub fn render_docx(source: &str) -> Result<Vec<u8>, String> {
    render_docx_document(&parse_document(source))
}

/// Build a configured DOCX through the canonical Rust OOXML writer.
pub fn render_docx_with_profile(source: &str, profile_json: &str) -> Result<Vec<u8>, String> {
    let document = parse_document(source);
    let profile = resolved_profile_for_document(&document, profile_json, false)?;
    render_docx_document_with_profile(&document, &profile)
}

/// Build a baseline DOCX archive from a parsed document.
pub fn render_docx_document(document: &Document) -> Result<Vec<u8>, String> {
    let profile = default_profile_for_document(document)?;
    render_docx_document_with_profile(document, &profile)
}

pub fn render_docx_document_with_profile(
    document: &Document,
    profile: &ResolvedExportProfile,
) -> Result<Vec<u8>, String> {
    let cursor = Cursor::new(Vec::new());
    let mut zip = ZipWriter::new(cursor);
    docx::write(document, profile, &mut zip)?;
    zip.finish()
        .map(|cursor| cursor.into_inner())
        .map_err(|error| error.to_string())
}

#[cfg(test)]
fn write_docx_document<W: Write + Seek>(
    document: &Document,
    zip: &mut ZipWriter<W>,
) -> Result<(), String> {
    let profile = default_profile_for_document(document)?;
    docx::write(document, &profile, zip)
}

/// Native configuration for Chromium PDF layout. WebAssembly deliberately
/// cannot expose this operation because it cannot launch a local process.
#[derive(Debug, Clone, Default)]
pub struct PdfOptions {
    pub chromium_path: Option<PathBuf>,
}

/// Render PDF by asking a locally installed Chromium-compatible browser to
/// lay out Rust-generated HTML. Chromium never receives MDI source.
pub fn render_pdf(source: &str, options: &PdfOptions) -> Result<Vec<u8>, String> {
    let chromium = options
        .chromium_path
        .clone()
        .or_else(find_chromium)
        .ok_or_else(|| "Chromium executable not found; set PdfOptions.chromium_path".to_owned())?;
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_nanos();
    let directory = std::env::temp_dir().join(format!("mdi-core-{}-{nonce}", std::process::id()));
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let html_path = directory.join("document.html");
    let pdf_path = directory.join("document.pdf");
    let result = (|| {
        fs::write(&html_path, render_html(source)).map_err(|error| error.to_string())?;
        let output = Command::new(&chromium)
            .arg("--headless=new")
            .arg("--disable-gpu")
            .arg("--no-pdf-header-footer")
            .arg(format!("--print-to-pdf={}", pdf_path.display()))
            .arg(format!("file://{}", html_path.display()))
            .output()
            .map_err(|error| {
                format!(
                    "failed to start Chromium at {}: {error}",
                    chromium.display()
                )
            })?;
        if !output.status.success() {
            return Err(format!(
                "Chromium PDF rendering failed: {}",
                String::from_utf8_lossy(&output.stderr)
            ));
        }
        fs::read(&pdf_path).map_err(|error| error.to_string())
    })();
    let _ = fs::remove_dir_all(&directory);
    result
}

/// Locate common native Chromium installations. Production callers should
/// prefer the explicit `PdfOptions.chromium_path` for deterministic deploys.
pub fn find_chromium() -> Option<PathBuf> {
    let candidates = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
    ];
    candidates
        .iter()
        .map(Path::new)
        .find(|path| path.is_file())
        .map(Path::to_path_buf)
}

pub(crate) fn escape_xml(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

struct EpubChapter {
    title: String,
    html: String,
    footnote_ids: Vec<String>,
}
fn epub_chapters(document: &Document, split_level: &str) -> Vec<EpubChapter> {
    let split_depth = match split_level {
        "h1" => Some(1),
        "h2" => Some(2),
        "h3" => Some(3),
        "none" => None,
        _ => Some(1),
    };
    let mut chapters = vec![EpubChapter {
        title: String::new(),
        html: String::new(),
        footnote_ids: Vec::new(),
    }];
    let footnote_definitions = document
        .children
        .iter()
        .filter_map(|node| {
            if node.get("type").and_then(serde_json::Value::as_str) != Some("footnoteDefinition") {
                return None;
            }
            node.get("identifier")
                .and_then(serde_json::Value::as_str)
                .map(|identifier| (identifier, node))
        })
        .collect::<std::collections::HashMap<_, _>>();
    for node in &document.children {
        if node.get("type").and_then(serde_json::Value::as_str) == Some("footnoteDefinition") {
            continue;
        }
        if node.get("type").and_then(serde_json::Value::as_str) == Some("pagebreak") {
            if split_depth.is_some()
                && !chapters
                    .last()
                    .is_some_and(|chapter| chapter.html.is_empty())
            {
                chapters.push(EpubChapter {
                    title: String::new(),
                    html: String::new(),
                    footnote_ids: Vec::new(),
                });
            }
            continue;
        }
        if node.get("type").and_then(serde_json::Value::as_str) == Some("heading")
            && node.get("depth").and_then(serde_json::Value::as_u64) == split_depth
            && !chapters
                .last()
                .is_some_and(|chapter| chapter.html.is_empty())
        {
            chapters.push(EpubChapter {
                title: String::new(),
                html: String::new(),
                footnote_ids: Vec::new(),
            });
        }
        let chapter = chapters.last_mut().expect("one chapter exists");
        if chapter.title.is_empty()
            && node.get("type").and_then(serde_json::Value::as_str) == Some("heading")
        {
            chapter.title = plain_node_text(node);
        }
        collect_footnote_references(node, &mut chapter.footnote_ids);
        render_html_node(node, &mut chapter.html);
    }
    let mut chapters: Vec<_> = chapters
        .into_iter()
        .filter(|chapter| !chapter.html.is_empty())
        .collect();
    for chapter in &mut chapters {
        chapter.footnote_ids.sort();
        chapter.footnote_ids.dedup();
        if chapter.footnote_ids.is_empty() {
            continue;
        }
        chapter.html.push_str(
            "<section data-footnotes=\"\" class=\"footnotes\"><h2 class=\"sr-only\" id=\"footnote-label\">Footnotes</h2><ol>",
        );
        for identifier in &chapter.footnote_ids {
            let Some(definition) = footnote_definitions.get(identifier.as_str()) else {
                continue;
            };
            chapter.html.push_str("<li id=\"user-content-fn-");
            chapter.html.push_str(&escape_html(identifier));
            chapter.html.push_str("\">");
            render_html_children(definition, &mut chapter.html);
            chapter.html.push_str(" <a href=\"#user-content-fnref-");
            chapter.html.push_str(&escape_html(identifier));
            chapter.html.push_str("\" data-footnote-backref=\"\" aria-label=\"Back to reference\" class=\"data-footnote-backref\">↩</a></li>");
        }
        chapter.html.push_str("</ol></section>");
    }
    if chapters.is_empty() {
        vec![EpubChapter {
            title: String::new(),
            html: String::new(),
            footnote_ids: Vec::new(),
        }]
    } else {
        chapters
    }
}

fn collect_footnote_references(node: &serde_json::Value, identifiers: &mut Vec<String>) {
    if node.get("type").and_then(serde_json::Value::as_str) == Some("footnoteReference")
        && let Some(identifier) = node.get("identifier").and_then(serde_json::Value::as_str)
    {
        identifiers.push(identifier.to_owned());
    }
    for child in children(node) {
        collect_footnote_references(child, identifiers);
    }
}
fn plain_node_text(node: &serde_json::Value) -> String {
    let mut text = String::new();
    render_text_children(node, &mut text);
    text
}
fn epub_xhtml(title: &str, language: &str, body: &str) -> String {
    format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?><!DOCTYPE html><html xmlns=\"http://www.w3.org/1999/xhtml\" xmlns:epub=\"http://www.idpf.org/2007/ops\" xml:lang=\"{}\" lang=\"{}\"><head><meta charset=\"UTF-8\"/><title>{}</title><link rel=\"stylesheet\" type=\"text/css\" href=\"style.css\"/></head><body>{}</body></html>",
        escape_html(language),
        escape_html(language),
        escape_html(title),
        body
    )
}

fn epub_chapter_xhtml(title: &str, language: &str, body: &str) -> String {
    epub_xhtml(title, language, &epub_chapter_body(body))
}

fn epub_chapter_body(body: &str) -> String {
    let mut output = body.replace("<br>", "<br/>").replace("<hr>", "<hr/>");
    let mut search_from = 0;
    while let Some(relative_start) = output[search_from..].find("<img src=\"") {
        let start = search_from + relative_start;
        let Some(relative_end) = output[start..].find('>') else {
            break;
        };
        let end = start + relative_end;
        let image = &output[start..=end];
        let Some(attributes) = image.strip_prefix("<img src=\"") else {
            search_from = end + 1;
            continue;
        };
        let Some((source, alt)) = attributes.split_once("\" alt=\"") else {
            search_from = end + 1;
            continue;
        };
        let Some(alt) = alt.strip_suffix("\">") else {
            search_from = end + 1;
            continue;
        };
        let replacement =
            format!("<span class=\"mdi-image-fallback\">Image: {alt} ({source})</span>");
        output.replace_range(start..=end, &replacement);
        search_from = start + replacement.len();
    }
    output
}

#[cfg(not(feature = "wasm"))]
fn epub_modified_timestamp() -> Result<String, String> {
    OffsetDateTime::now_utc()
        .replace_nanosecond(0)
        .map_err(|error| error.to_string())?
        .format(&Rfc3339)
        .map_err(|error| error.to_string())
}

#[cfg(feature = "wasm")]
fn epub_modified_timestamp() -> Result<String, String> {
    let value = js_sys::Date::new_0()
        .to_iso_string()
        .as_string()
        .ok_or_else(|| "JavaScript Date did not return an ISO timestamp".to_owned())?;
    Ok(value
        .find('.')
        .map_or(value.clone(), |fraction| format!("{}Z", &value[..fraction])))
}
fn epub_file<W: Write + Seek>(
    zip: &mut ZipWriter<W>,
    path: &str,
    content: &str,
    options: SimpleFileOptions,
) -> Result<(), String> {
    zip.start_file(path, options)
        .map_err(|error| error.to_string())?;
    zip.write_all(content.as_bytes())
        .map_err(|error| error.to_string())
}

fn render_html_node(node: &serde_json::Value, out: &mut String) {
    let Some(kind) = node.get("type").and_then(serde_json::Value::as_str) else {
        return;
    };
    let children = |out: &mut String| render_html_children(node, out);
    match kind {
        "text" => out.push_str(&escape_html(
            node.get("value")
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default(),
        )),
        "root" => children(out),
        "paragraph" => {
            let class = if node.get("indent").is_some() {
                " class=\"mdi-indent\""
            } else if node.get("bottom").is_some() {
                " class=\"mdi-bottom\""
            } else {
                ""
            };
            let style = if let Some(amount) = node.get("indent").and_then(serde_json::Value::as_u64)
            {
                format!(" style=\"--mdi-indent:{amount};\"")
            } else if let Some(amount) = node.get("bottom").and_then(serde_json::Value::as_u64) {
                format!(" style=\"--mdi-shift:{amount};\"")
            } else {
                String::new()
            };
            out.push_str("<p");
            out.push_str(class);
            out.push_str(&style);
            out.push('>');
            children(out);
            out.push_str("</p>");
        }
        "heading" => {
            let depth = node
                .get("depth")
                .and_then(serde_json::Value::as_u64)
                .filter(|depth| (1..=6).contains(depth))
                .unwrap_or(1);
            out.push_str(&format!("<h{depth}>"));
            children(out);
            out.push_str(&format!("</h{depth}>"));
        }
        "emphasis" => wrapped(out, "em", children),
        "strong" => wrapped(out, "strong", children),
        "delete" => wrapped(out, "del", children),
        "blockquote" => wrapped(out, "blockquote", children),
        "list" => {
            let ordered = node
                .get("ordered")
                .and_then(serde_json::Value::as_bool)
                .unwrap_or(false);
            let tag = if ordered { "ol" } else { "ul" };
            let start = node
                .get("start")
                .and_then(serde_json::Value::as_u64)
                .filter(|start| *start != 1)
                .map(|start| format!(" start=\"{start}\""))
                .unwrap_or_default();
            out.push('<');
            out.push_str(tag);
            out.push_str(&start);
            out.push('>');
            children(out);
            out.push_str("</");
            out.push_str(tag);
            out.push('>');
        }
        "listItem" => wrapped(out, "li", children),
        "thematicBreak" => out.push_str("<hr>"),
        "break" => out.push_str("<br class=\"mdi-break\"/>"),
        "inlineCode" => {
            out.push_str("<code>");
            out.push_str(&escape_html(
                node.get("value")
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or_default(),
            ));
            out.push_str("</code>");
        }
        "code" => {
            out.push_str("<pre><code");
            if let Some(lang) = node.get("lang").and_then(serde_json::Value::as_str) {
                out.push_str(" class=\"language-");
                out.push_str(&escape_html(lang));
                out.push('"');
            }
            out.push('>');
            out.push_str(&escape_html(
                node.get("value")
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or_default(),
            ));
            out.push_str("</code></pre>");
        }
        "link" => {
            out.push_str("<a href=\"");
            out.push_str(&escape_html(
                node.get("url")
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or_default(),
            ));
            out.push('"');
            if let Some(title) = node.get("title").and_then(serde_json::Value::as_str) {
                out.push_str(" title=\"");
                out.push_str(&escape_html(title));
                out.push('"');
            }
            out.push('>');
            children(out);
            out.push_str("</a>");
        }
        "image" => {
            out.push_str("<img src=\"");
            out.push_str(&escape_html(
                node.get("url")
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or_default(),
            ));
            out.push_str("\" alt=\"");
            out.push_str(&escape_html(
                node.get("alt")
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or_default(),
            ));
            out.push_str("\">");
        }
        "table" => wrapped(out, "table", children),
        "tableRow" => wrapped(out, "tr", children),
        "tableCell" => wrapped(out, "td", children),
        "footnoteReference" => {
            let identifier = node
                .get("identifier")
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default();
            let label = node
                .get("label")
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default();
            out.push_str("<sup class=\"footnote-ref\"><a href=\"#user-content-fn-");
            out.push_str(&escape_html(identifier));
            out.push_str("\" id=\"user-content-fnref-");
            out.push_str(&escape_html(identifier));
            out.push_str("\" data-footnote-ref=\"\" aria-describedby=\"footnote-label\">");
            out.push_str(&escape_html(label));
            out.push_str("</a></sup>");
        }
        "footnoteDefinition" | "definition" => {}
        "html" => out.push_str(&escape_html(
            node.get("value")
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default(),
        )),
        "ruby" => render_ruby(node, out),
        "tcy" => {
            out.push_str("<span class=\"mdi-tcy\">");
            out.push_str(&escape_html(
                node.get("value")
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or_default(),
            ));
            out.push_str("</span>");
        }
        "em" => {
            let mark = node
                .get("mark")
                .and_then(serde_json::Value::as_str)
                .unwrap_or("﹅");
            out.push_str("<span class=\"mdi-em\" style=\"--mdi-em:&quot;");
            out.push_str(&escape_css_string(mark));
            out.push_str("&quot;;\">");
            children(out);
            out.push_str("</span>");
        }
        "noBreak" => {
            out.push_str("<span class=\"mdi-nobr\">");
            children(out);
            out.push_str("</span>");
        }
        "warichu" => {
            out.push_str("<span class=\"mdi-warichu\">");
            children(out);
            out.push_str("</span>");
        }
        "kern" => {
            out.push_str("<span class=\"mdi-kern\" style=\"--mdi-kern:");
            out.push_str(&escape_html(
                node.get("amount")
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or_default(),
            ));
            out.push_str(";\">");
            children(out);
            out.push_str("</span>");
        }
        "blank" => out.push_str("<p class=\"mdi-blank\"></p>"),
        "pagebreak" => {
            out.push_str("<div class=\"mdi-pagebreak");
            if let Some(variant) = node.get("variant").and_then(serde_json::Value::as_str) {
                out.push_str(" mdi-pagebreak-");
                out.push_str(&escape_html(variant));
            }
            out.push_str("\" role=\"presentation\"></div>");
        }
        _ => children(out),
    }
}

fn render_html_children(node: &serde_json::Value, out: &mut String) {
    if let Some(children) = node.get("children").and_then(serde_json::Value::as_array) {
        for child in children {
            render_html_node(child, out);
        }
    }
}

fn wrapped(out: &mut String, tag: &str, children: impl FnOnce(&mut String)) {
    out.push('<');
    out.push_str(tag);
    out.push('>');
    children(out);
    out.push_str("</");
    out.push_str(tag);
    out.push('>');
}

fn render_ruby(node: &serde_json::Value, out: &mut String) {
    let base = node
        .get("base")
        .and_then(serde_json::Value::as_str)
        .unwrap_or_default();
    let reading = node.get("ruby").and_then(|ruby| ruby.get("value"));
    out.push_str("<ruby class=\"mdi-ruby\">");
    if let Some(parts) = reading.and_then(serde_json::Value::as_array) {
        for (base, reading) in base.graphemes(true).zip(parts) {
            out.push_str(&escape_html(base));
            render_ruby_reading(reading.as_str().unwrap_or_default(), out);
        }
    } else {
        out.push_str(&escape_html(base));
        render_ruby_reading(
            reading
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default(),
            out,
        );
    }
    out.push_str("</ruby>");
}

fn render_ruby_reading(reading: &str, out: &mut String) {
    out.push_str("<rp>（</rp><rt>");
    out.push_str(&escape_html(reading));
    out.push_str("</rt><rp>）</rp>");
}

fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}
fn escape_css_string(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

/// Parse MDI inline syntax while keeping all other text literal.
pub fn parse_inlines(source: &str) -> Vec<Inline> {
    parse_inline_parts(source)
        .into_iter()
        .map(|(inline, _, _)| inline)
        .collect()
}

/// Parse MDI inline syntax and retain each node's raw byte range relative to
/// `source`.  Escaped text deliberately retains the range of its spelling in
/// the source even when its rendered value is shorter.
fn parse_inline_parts(source: &str) -> Vec<(Inline, usize, usize)> {
    let mut out = Vec::new();
    let mut text = String::new();
    let mut text_start = 0;
    let mut index = 0;

    while index < source.len() {
        let rest = &source[index..];
        if rest.starts_with('\\') {
            let mut chars = rest.chars();
            let slash = chars.next().expect("prefix was checked");
            let Some(next) = chars.next() else {
                text.push(slash);
                index += slash.len_utf8();
                continue;
            };
            if is_escapable(next) {
                text.push(next);
            } else {
                text.push(slash);
                text.push(next);
            }
            index += slash.len_utf8() + next.len_utf8();
            continue;
        }
        if let Some((inline, consumed)) = ruby(rest) {
            push_inline_text(&mut out, &mut text, text_start, index);
            out.push((inline, index, index + consumed));
            index += consumed;
            text_start = index;
            continue;
        }
        if let Some((inline, consumed)) = tcy(rest) {
            push_inline_text(&mut out, &mut text, text_start, index);
            out.push((inline, index, index + consumed));
            index += consumed;
            text_start = index;
            continue;
        }
        if let Some((inline, consumed)) = boten(rest) {
            push_inline_text(&mut out, &mut text, text_start, index);
            out.push((inline, index, index + consumed));
            index += consumed;
            text_start = index;
            continue;
        }
        if let Some((inline, consumed)) = bracket_macro(rest) {
            push_inline_text(&mut out, &mut text, text_start, index);
            out.push((inline, index, index + consumed));
            index += consumed;
            text_start = index;
            continue;
        }
        let character = rest.chars().next().expect("index is in bounds");
        text.push(character);
        index += character.len_utf8();
    }
    push_inline_text(&mut out, &mut text, text_start, index);
    out
}

#[derive(Clone)]
enum PendingBlock {
    Indent { amount: u32, source: String },
    Bottom { amount: u32, source: String },
}

fn paragraph(line: &str, pending: Option<PendingBlock>) -> MdiBlock {
    let (indent, bottom) = match pending {
        Some(PendingBlock::Indent { amount, .. }) => (Some(amount), None),
        Some(PendingBlock::Bottom { amount, .. }) => (None, Some(amount)),
        None => (None, None),
    };
    MdiBlock::Paragraph {
        inlines: parse_inlines(line),
        indent,
        bottom,
    }
}

fn flush_pending(blocks: &mut Vec<MdiBlock>, pending: &mut Option<PendingBlock>) {
    if let Some(marker) = pending.take() {
        // As in the micromark adapter, an alignment macro without a following
        // eligible block remains literal source.
        let source = match marker {
            PendingBlock::Indent { source, .. } | PendingBlock::Bottom { source, .. } => source,
        };
        blocks.push(paragraph(&source, None));
    }
}

fn is_blank_marker(line: &str) -> bool {
    let value = line.trim_end_matches([' ', '\t']);
    value == "\\" || value == "<br>" || value == "<br />" || value == "[[blank]]"
}

fn pagebreak(line: &str) -> Option<Option<PagebreakVariant>> {
    match line.trim() {
        "[[pagebreak]]" => Some(None),
        "[[pagebreak:left]]" => Some(Some(PagebreakVariant::Left)),
        "[[pagebreak:right]]" => Some(Some(PagebreakVariant::Right)),
        _ => None,
    }
}

fn pending_block(line: &str) -> Option<PendingBlock> {
    let value = line.trim();
    if value == "[[bottom]]" {
        return Some(PendingBlock::Bottom {
            amount: 0,
            source: value.to_owned(),
        });
    }
    let (kind, amount) = value
        .strip_prefix("[[")?
        .strip_suffix("]]")?
        .split_once(':')?;
    if amount.is_empty()
        || amount.starts_with('0')
        || !amount.bytes().all(|byte| byte.is_ascii_digit())
    {
        return None;
    }
    let amount = amount.parse().ok()?;
    match kind {
        "indent" => Some(PendingBlock::Indent {
            amount,
            source: value.to_owned(),
        }),
        "bottom" => Some(PendingBlock::Bottom {
            amount,
            source: value.to_owned(),
        }),
        _ => None,
    }
}

fn ruby(value: &str) -> Option<(Inline, usize)> {
    if !value.starts_with('{') {
        return None;
    }
    let end = close_unescaped(value, 1, '}')?;
    let body = &value[1..end];
    let separator = bare_index(body, '|')?;
    let base = unescape_ruby(&body[..separator]);
    let raw_ruby = &body[separator + 1..];
    let ruby = split_ruby(&base, raw_ruby);
    Some((Inline::Ruby { base, ruby }, end + 1))
}

fn split_ruby(base: &str, raw: &str) -> RubyReading {
    let segments = split_unescaped(raw, '.');
    if segments.len() == 1 {
        return RubyReading::Group(unescape_ruby(raw));
    }
    let segments: Vec<String> = segments.into_iter().map(unescape_ruby).collect();
    if segments.len() == base.graphemes(true).count()
        && segments.iter().all(|part| !part.is_empty())
    {
        RubyReading::Split(segments)
    } else {
        RubyReading::Group(segments.concat())
    }
}

fn tcy(value: &str) -> Option<(Inline, usize)> {
    if !value.starts_with('^') {
        return None;
    }
    let closing = value[1..].find('^')? + 1;
    let body = &value[1..closing];
    if body.is_empty()
        || body.chars().count() > 6
        || !body
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '!' || c == '?')
    {
        return None;
    }
    Some((Inline::Tcy(body.to_owned()), closing + 1))
}

fn boten(value: &str) -> Option<(Inline, usize)> {
    let prefix = "《《";
    if !value.starts_with(prefix) {
        return None;
    }
    let end = close_boten_alias(value)?;
    let body = &value[prefix.len()..end];
    if body.is_empty()
        || body.contains('\n')
        || contains_unescaped(body, '《')
        || contains_unescaped(body, '》')
    {
        return None;
    }
    Some((
        Inline::Em {
            mark: "﹅".to_owned(),
            children: vec![Inline::Text(unescape_mdi(body))],
        },
        end + "》》".len(),
    ))
}

/// Find the closing `》》` of the supported boten alias.  As with every other
/// MDI delimiter, an escaped `》` is content and cannot close the alias.
fn close_boten_alias(value: &str) -> Option<usize> {
    let mut index = "《《".len();
    while index < value.len() {
        let rest = &value[index..];
        if rest.starts_with('\\') {
            let next = rest.chars().nth(1)?;
            index += 1 + next.len_utf8();
        } else if rest.starts_with("》》") {
            return Some(index);
        } else {
            index += rest.chars().next()?.len_utf8();
        }
    }
    None
}

fn bracket_macro(value: &str) -> Option<(Inline, usize)> {
    if !value.starts_with("[[") {
        return None;
    }
    if value.starts_with("[[br]]") {
        return Some((Inline::Break, "[[br]]".len()));
    }
    let end = close_macro(value)?;
    let body = &value[2..end];
    let (name, payload) = body.split_once(':')?;
    let children = |content: &str| parse_inlines(content);
    let inline = match name {
        "no-break" if !payload.is_empty() => Inline::NoBreak(children(payload)),
        "warichu" => Inline::Warichu(children(payload)),
        "kern" => {
            let (amount, content) = payload.split_once(':')?;
            if !valid_kern(amount) {
                return None;
            }
            Inline::Kern {
                amount: unescape_mdi(amount),
                children: children(content),
            }
        }
        "em" => {
            let (mark, content) = match bare_index(payload, ':') {
                Some(index) => {
                    let candidate = unescape_mdi(&payload[..index]);
                    if candidate.graphemes(true).count() == 1
                        && !candidate
                            .chars()
                            .any(|c| c.is_whitespace() || c.is_control())
                    {
                        (candidate, &payload[index + 1..])
                    } else {
                        ("﹅".to_owned(), payload)
                    }
                }
                None => ("﹅".to_owned(), payload),
            };
            Inline::Em {
                mark,
                children: children(content),
            }
        }
        _ => return None,
    };
    Some((inline, end + 2))
}

fn close_macro(value: &str) -> Option<usize> {
    let mut index = 2;
    let mut depth = 1;
    while index < value.len() {
        let rest = &value[index..];
        if rest.starts_with('\\') {
            index += rest.chars().nth(1)?.len_utf8() + 1;
        } else if rest.starts_with("[[") {
            depth += 1;
            index += 2;
        } else if rest.starts_with("]]") {
            depth -= 1;
            if depth == 0 {
                return Some(index);
            }
            index += 2;
        } else {
            index += rest.chars().next()?.len_utf8();
        }
    }
    None
}

fn valid_kern(value: &str) -> bool {
    let value = value.strip_suffix("em").unwrap_or("");
    let value = value.strip_prefix(['+', '-']).unwrap_or(value);
    let mut parts = value.split('.');
    let whole = parts.next().unwrap_or("");
    let fraction = parts.next();
    parts.next().is_none()
        && !whole.is_empty()
        && whole.bytes().all(|b| b.is_ascii_digit())
        && fraction.is_none_or(|part| !part.is_empty() && part.bytes().all(|b| b.is_ascii_digit()))
}

fn close_unescaped(value: &str, start: usize, needle: char) -> Option<usize> {
    let mut escaped = false;
    for (index, character) in value[start..].char_indices() {
        if escaped {
            escaped = false;
            continue;
        }
        if character == '\\' {
            escaped = true;
            continue;
        }
        if character == needle {
            return Some(start + index);
        }
        if character == '\n' {
            return None;
        }
    }
    None
}

fn bare_index(value: &str, needle: char) -> Option<usize> {
    let mut escaped = false;
    for (index, character) in value.char_indices() {
        if escaped {
            escaped = false;
            continue;
        }
        if character == '\\' {
            escaped = true;
            continue;
        }
        if character == needle {
            return Some(index);
        }
    }
    None
}

fn contains_unescaped(value: &str, needle: char) -> bool {
    bare_index(value, needle).is_some()
}

fn split_unescaped(value: &str, separator: char) -> Vec<&str> {
    let mut parts = Vec::new();
    let mut start = 0;
    let mut escaped = false;
    for (index, character) in value.char_indices() {
        if escaped {
            escaped = false;
            continue;
        }
        if character == '\\' {
            escaped = true;
            continue;
        }
        if character == separator {
            parts.push(&value[start..index]);
            start = index + character.len_utf8();
        }
    }
    parts.push(&value[start..]);
    parts
}

/// SYNTAX.md §13's delimiter set, plus `\\` itself — CommonMark treats
/// backslash as ordinary escapable ASCII punctuation, and JS's
/// `unescapeMdi`/`unescapeRubyText` follow suit (`\\` -> `\`), so the Rust
/// core must too or `\\` is left as two literal characters instead of one.
const ESCAPABLE_MDI: &str = "{}|^[]:《》\\";
const ESCAPABLE_RUBY: &str = "{}|^[]:《》\\.";

fn unescape_mdi(value: &str) -> String {
    unescape(value, ESCAPABLE_MDI)
}

fn unescape_ruby(value: &str) -> String {
    unescape(value, ESCAPABLE_RUBY)
}

fn unescape(value: &str, allowed: &str) -> String {
    let mut out = String::new();
    let mut chars = value.chars();
    while let Some(character) = chars.next() {
        if character == '\\' {
            if let Some(next) = chars.next() {
                if allowed.contains(next) {
                    out.push(next);
                } else {
                    out.push(character);
                    out.push(next);
                }
            } else {
                out.push(character);
            }
        } else {
            out.push(character);
        }
    }
    out
}

fn is_escapable(character: char) -> bool {
    ESCAPABLE_MDI.contains(character)
}

fn push_inline_text(
    out: &mut Vec<(Inline, usize, usize)>,
    text: &mut String,
    start: usize,
    end: usize,
) {
    if !text.is_empty() {
        out.push((Inline::Text(std::mem::take(text)), start, end));
    }
}

/// A single `[[indent:N]]` / `[[bottom]]` / `[[pagebreak…]]` token's source,
/// classified the same way as `mdast-util-mdi`'s `parseBlockMacro` (from
/// which this was ported): trims the token source once, then matches the
/// fixed pagebreak/bottom spellings before falling back to the generic
/// `name:digits` form. Kept separate from `pending_block`/`pagebreak`
/// above, which classify whole *lines* mid-scan rather than one already
/// isolated token.
#[cfg_attr(not(feature = "wasm"), allow(dead_code))]
enum BlockMacroClass {
    Indent(u32),
    Bottom(u32),
    Pagebreak(Option<PagebreakVariant>),
    Literal,
}

#[cfg_attr(not(feature = "wasm"), allow(dead_code))]
fn classify_block_macro(source: &str) -> BlockMacroClass {
    let value = source.trim();
    match value {
        "[[pagebreak:right]]" => return BlockMacroClass::Pagebreak(Some(PagebreakVariant::Right)),
        "[[pagebreak:left]]" => return BlockMacroClass::Pagebreak(Some(PagebreakVariant::Left)),
        "[[pagebreak]]" => return BlockMacroClass::Pagebreak(None),
        "[[bottom]]" => return BlockMacroClass::Bottom(0),
        _ => {}
    }
    if let Some((kind, amount)) = value
        .strip_prefix("[[")
        .and_then(|rest| rest.strip_suffix("]]"))
        .and_then(|inner| inner.split_once(':'))
    {
        let valid_amount = !amount.is_empty()
            && !amount.starts_with('0')
            && amount.bytes().all(|b| b.is_ascii_digit());
        if valid_amount && let Ok(amount) = amount.parse::<u32>() {
            match kind {
                "indent" => return BlockMacroClass::Indent(amount),
                "bottom" => return BlockMacroClass::Bottom(amount),
                _ => {}
            }
        }
    }
    BlockMacroClass::Literal
}

/// wasm-bindgen bindings for the complete JavaScript interface and legacy
/// semantic helpers retained for compatibility tests.
#[cfg(feature = "wasm")]
mod wasm {
    use super::{
        BlockMacroClass, EpubCover, PagebreakVariant, RubyReading, TextFormat,
        apply_pdf_profile_json, classify_block_macro, page_size_catalog_json, parse_json,
        prepare_chromium_print_profile_json, render_docx, render_docx_with_profile, render_epub,
        render_epub_with_profile, render_html, render_text, render_text_format,
        resolve_export_profile_json, serialize_mdi, split_ruby, unescape_mdi, unescape_ruby,
    };
    use wasm_bindgen::prelude::*;

    /// Parse with Rust and return the versioned MDI IR as JSON.
    ///
    /// The JavaScript package parses this string and performs no syntax work.
    #[wasm_bindgen(js_name = parseMdiSyntaxJson)]
    pub fn wasm_parse_mdi_syntax_json(source: &str) -> String {
        parse_json(source)
    }

    /// Render source through the Rust parser and Rust HTML renderer.
    #[wasm_bindgen(js_name = renderHtml)]
    pub fn wasm_render_html(source: &str) -> String {
        render_html(source)
    }

    /// Validate and resolve the language-neutral configured-export profile.
    #[wasm_bindgen(js_name = resolveExportProfileJson)]
    pub fn wasm_resolve_export_profile_json(
        profile_json: &str,
        source_writing_mode: Option<String>,
        require_layout: bool,
    ) -> Result<String, JsValue> {
        resolve_export_profile_json(profile_json, source_writing_mode.as_deref(), require_layout)
            .map_err(|message| JsValue::from_str(&message))
    }

    #[wasm_bindgen(js_name = pageSizeCatalogJson)]
    pub fn wasm_page_size_catalog_json() -> Result<String, JsValue> {
        page_size_catalog_json().map_err(|message| JsValue::from_str(&message))
    }

    /// Apply canonical Rust-owned print CSS to HTML using a resolved profile.
    #[wasm_bindgen(js_name = applyPdfProfileJson)]
    pub fn wasm_apply_pdf_profile_json(html: &str, profile_json: &str) -> Result<String, JsValue> {
        apply_pdf_profile_json(html, profile_json).map_err(|message| JsValue::from_str(&message))
    }

    /// Resolve and prepare all browser-independent Chromium print data.
    #[wasm_bindgen(js_name = prepareChromiumPrintProfileJson)]
    pub fn wasm_prepare_chromium_print_profile_json(
        html: &str,
        profile_json: &str,
        source_writing_mode: Option<String>,
    ) -> Result<String, JsValue> {
        prepare_chromium_print_profile_json(html, profile_json, source_writing_mode.as_deref())
            .map_err(|message| JsValue::from_str(&message))
    }

    /// Normalize source through the Rust parser and canonical serializer.
    #[wasm_bindgen(js_name = serializeMdi)]
    pub fn wasm_serialize_mdi(source: &str) -> String {
        serialize_mdi(source)
    }

    /// Render plain text directly from the Rust IR.
    #[wasm_bindgen(js_name = renderText)]
    pub fn wasm_render_text(source: &str) -> String {
        render_text(source)
    }

    /// Render a named text export convention through the Rust core.
    #[wasm_bindgen(js_name = renderTextFormat)]
    pub fn wasm_render_text_format(
        source: &str,
        format: &str,
        indent_prefix: &str,
    ) -> Result<String, JsValue> {
        let format = TextFormat::parse(format)
            .ok_or_else(|| JsValue::from_str("Unsupported text format"))?;
        Ok(render_text_format(source, format, indent_prefix))
    }

    /// Build a baseline EPUB 3 archive entirely in Rust.
    #[wasm_bindgen(js_name = renderEpub)]
    pub fn wasm_render_epub(source: &str) -> Result<Box<[u8]>, JsValue> {
        render_epub(source)
            .map(Vec::into_boxed_slice)
            .map_err(|message| JsValue::from_str(&message))
    }

    /// Build a configured EPUB through the same Rust path used by native bindings.
    #[wasm_bindgen(js_name = renderEpubWithProfile)]
    pub fn wasm_render_epub_with_profile(
        source: &str,
        profile_json: &str,
        cover_data: &[u8],
        cover_media_type: Option<String>,
    ) -> Result<Box<[u8]>, JsValue> {
        let cover = cover_media_type.map(|media_type| EpubCover {
            data: cover_data.to_vec(),
            media_type,
        });
        render_epub_with_profile(source, profile_json, cover.as_ref())
            .map(Vec::into_boxed_slice)
            .map_err(|message| JsValue::from_str(&message))
    }

    /// Build a baseline DOCX archive entirely in Rust.
    #[wasm_bindgen(js_name = renderDocx)]
    pub fn wasm_render_docx(source: &str) -> Result<Box<[u8]>, JsValue> {
        render_docx(source)
            .map(Vec::into_boxed_slice)
            .map_err(|message| JsValue::from_str(&message))
    }

    /// Build a configured DOCX through the canonical Rust OOXML writer.
    #[wasm_bindgen(js_name = renderDocxWithProfile)]
    pub fn wasm_render_docx_with_profile(
        source: &str,
        profile_json: &str,
    ) -> Result<Box<[u8]>, JsValue> {
        render_docx_with_profile(source, profile_json)
            .map(Vec::into_boxed_slice)
            .map_err(|message| JsValue::from_str(&message))
    }

    #[wasm_bindgen(js_name = unescapeMdi)]
    pub fn wasm_unescape_mdi(value: &str) -> String {
        unescape_mdi(value)
    }

    #[wasm_bindgen(js_name = unescapeRubyText)]
    pub fn wasm_unescape_ruby(value: &str) -> String {
        unescape_ruby(value)
    }

    /// Mirrors `resolveRuby(base, rawRuby): string | string[]`.
    #[wasm_bindgen(js_name = resolveRuby)]
    pub fn wasm_resolve_ruby(base: &str, raw_ruby: &str) -> JsValue {
        match split_ruby(base, raw_ruby) {
            RubyReading::Group(value) => JsValue::from_str(&value),
            RubyReading::Split(parts) => {
                let array = js_sys::Array::new();
                for part in parts {
                    array.push(&JsValue::from_str(&part));
                }
                array.into()
            }
        }
    }

    #[wasm_bindgen(js_name = blockMacroKind)]
    pub fn wasm_block_macro_kind(source: &str) -> String {
        match classify_block_macro(source) {
            BlockMacroClass::Indent(_) => "indent",
            BlockMacroClass::Bottom(_) => "bottom",
            BlockMacroClass::Pagebreak(_) => "pagebreak",
            BlockMacroClass::Literal => "literal",
        }
        .to_owned()
    }

    /// -1 when the token has no amount (pagebreak / literal).
    #[wasm_bindgen(js_name = blockMacroAmount)]
    pub fn wasm_block_macro_amount(source: &str) -> i32 {
        match classify_block_macro(source) {
            BlockMacroClass::Indent(amount) | BlockMacroClass::Bottom(amount) => amount as i32,
            BlockMacroClass::Pagebreak(_) | BlockMacroClass::Literal => -1,
        }
    }

    /// `"left"` / `"right"` / `""` (no variant, including non-pagebreak kinds).
    #[wasm_bindgen(js_name = blockMacroVariant)]
    pub fn wasm_block_macro_variant(source: &str) -> String {
        match classify_block_macro(source) {
            BlockMacroClass::Pagebreak(Some(PagebreakVariant::Left)) => "left",
            BlockMacroClass::Pagebreak(Some(PagebreakVariant::Right)) => "right",
            _ => "",
        }
        .to_owned()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Error, Read, SeekFrom};
    use zip::ZipArchive;

    struct FailAfterWrites {
        inner: Cursor<Vec<u8>>,
        remaining: usize,
    }

    impl Write for FailAfterWrites {
        fn write(&mut self, buffer: &[u8]) -> std::io::Result<usize> {
            if self.remaining == 0 {
                return Err(Error::other("injected archive write failure"));
            }
            self.remaining -= 1;
            self.inner.write(buffer)
        }

        fn flush(&mut self) -> std::io::Result<()> {
            self.inner.flush()
        }
    }

    impl Seek for FailAfterWrites {
        fn seek(&mut self, position: SeekFrom) -> std::io::Result<u64> {
            self.inner.seek(position)
        }
    }

    fn assert_valid_spans(value: &serde_json::Value, source: &str) {
        let Some(object) = value.as_object() else {
            return;
        };
        if let Some(span) = object.get("span") {
            let start = span
                .get("startByte")
                .and_then(serde_json::Value::as_u64)
                .expect("span has startByte") as usize;
            let end = span
                .get("endByte")
                .and_then(serde_json::Value::as_u64)
                .expect("span has endByte") as usize;
            assert!(start <= end, "span start must not exceed end: {span}");
            assert!(
                end <= source.len(),
                "span must be inside its source: {span}"
            );
            assert!(
                source.is_char_boundary(start),
                "span start is a UTF-8 boundary: node={object:?}; source={source:?}"
            );
            let remainder = &source[start..];
            assert!(
                source.is_char_boundary(end),
                "span end is a UTF-8 boundary: node={object:?}; remainder={:?}",
                remainder
            );
        }
        if let Some(children) = object.get("children").and_then(serde_json::Value::as_array) {
            for child in children {
                assert_valid_spans(child, source);
            }
        }
    }

    fn generated_source(mut state: u64) -> String {
        // A deterministic adversarial corpus: every fragment is individually
        // valid UTF-8, while their arbitrary adjacency exercises delimiter,
        // Markdown, front-matter, and MDI recovery boundaries.
        if state == 0 {
            return "---\nmdi: '3.0'\ntitle: adversarial\n---\n\n{東京|とうきょう}".to_owned();
        }
        const FRAGMENTS: &[&str] = &[
            "東京",
            "𠮟る",
            "👨‍👩‍👧",
            " ",
            "\\n",
            "\\\\",
            "{",
            "}",
            "|",
            ".",
            "^12^",
            "^_^",
            "{東京|とう.きょう}",
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
            "<script>x</script>",
            "\\{",
            "\\[",
        ];
        let mut source = String::new();
        for _ in 0..32 {
            state ^= state << 13;
            state ^= state >> 7;
            state ^= state << 17;
            source.push_str(FRAGMENTS[(state as usize) % FRAGMENTS.len()]);
        }
        source
    }

    #[test]
    fn parses_ruby_and_split_ruby() {
        assert_eq!(
            parse_inlines("{東京|とう.きょう}"),
            vec![Inline::Ruby {
                base: "東京".into(),
                ruby: RubyReading::Split(vec!["とう".into(), "きょう".into()]),
            }]
        );
        assert_eq!(
            parse_inlines("{東京|.きょう}"),
            vec![Inline::Ruby {
                base: "東京".into(),
                ruby: RubyReading::Group("きょう".into()),
            }]
        );
    }

    #[test]
    fn parses_nested_macros_and_escapes() {
        assert_eq!(
            parse_inlines("[[em:●:a[[no-break:b]]]]"),
            vec![Inline::Em {
                mark: "●".into(),
                children: vec![
                    Inline::Text("a".into()),
                    Inline::NoBreak(vec![Inline::Text("b".into())])
                ],
            }]
        );
    }

    #[test]
    fn parses_tcy_and_boten() {
        assert_eq!(
            parse_inlines("第^12^話《《重要》》"),
            vec![
                Inline::Text("第".into()),
                Inline::Tcy("12".into()),
                Inline::Text("話".into()),
                Inline::Em {
                    mark: "﹅".into(),
                    children: vec![Inline::Text("重要".into())]
                },
            ]
        );
    }

    #[test]
    fn recognises_block_macros() {
        assert_eq!(
            parse_mdi_syntax("[[indent:2]]\n本文\n[[pagebreak:left]]\n\\"),
            MdiSyntaxDocument {
                blocks: vec![
                    MdiBlock::Paragraph {
                        inlines: vec![Inline::Text("本文".into())],
                        indent: Some(2),
                        bottom: None
                    },
                    MdiBlock::Pagebreak {
                        variant: Some(PagebreakVariant::Left)
                    },
                    MdiBlock::Blank,
                ]
            }
        );
    }

    #[test]
    fn keeps_invalid_syntax_literal() {
        assert_eq!(
            parse_inlines("{plain} ^_^ [[kern:wide:text]] [[no-break:]]"),
            vec![Inline::Text(
                "{plain} ^_^ [[kern:wide:text]] [[no-break:]]".into()
            )]
        );
    }

    #[test]
    fn recovers_from_malformed_inline_syntax_at_delimiter_boundaries() {
        // A malformed construct must stay literal without preventing a later,
        // adjacent construct from being recognized.  These cases cover every
        // inline delimiter family, including a delimiter at end of input.
        for (source, expected) in [
            ("{東京|とうきょう", "{東京|とうきょう"),
            ("{東京|とうきょう ^12^", "{東京|とうきょう 12"),
            ("^1234567^ ^12^", "^1234567^ 12"),
            ("[[no-break:]][[em:強調]]", "[[no-break:]]強調"),
            ("[[kern:wide:字]][[warichu:注]]", "[[kern:wide:字]]注"),
            ("[[em:未閉", "[[em:未閉"),
            ("《《未閉", "《《未閉"),
            ("{", "{"),
            ("^", "^"),
            ("[[", "[["),
        ] {
            let rendered = render_text(source);
            assert_eq!(rendered.trim_end(), expected, "source: {source:?}");
            assert!(
                parse_output(source).diagnostics.is_empty(),
                "source: {source:?}"
            );
        }
    }

    #[test]
    fn honors_escaped_alias_delimiters_without_consuming_them_as_closers() {
        // Escaped delimiters never participate in matching.  In particular,
        // the first `》` below is content; the following pair closes the alias.
        assert_eq!(
            parse_inlines("《《a\\》》》"),
            vec![Inline::Em {
                mark: "﹅".into(),
                children: vec![Inline::Text("a》".into())],
            }]
        );

        // Without a non-escaped closing pair, the complete alias remains
        // literal instead of partially consuming its escaped content.
        assert_eq!(
            parse_inlines("《《a\\》》"),
            vec![Inline::Text("《《a》》".into())]
        );
    }

    #[test]
    fn applies_mdi_escapes_once_before_recognition() {
        assert_eq!(
            parse_inlines(r"\{東京\|とうきょう\} \^12\^ \[\[br\]\] \《《文字\》》"),
            vec![Inline::Text(
                "{東京|とうきょう} ^12^ [[br]] 《《文字》》".into()
            )]
        );
    }

    #[test]
    fn unescapes_backslash_itself_but_leaves_non_escapable_pairs_alone() {
        assert_eq!(
            parse_inlines(r"\\ \n \a \0 \-"),
            vec![Inline::Text(r"\ \n \a \0 \-".into())]
        );
    }

    #[test]
    fn treats_boten_alias_content_as_plain_text() {
        assert_eq!(
            parse_inlines(r"《《a\《b》》"),
            vec![Inline::Em {
                mark: "﹅".into(),
                children: vec![Inline::Text("a《b".into())]
            }]
        );
        assert_eq!(
            parse_inlines("《《雪》考》"),
            vec![Inline::Text("《《雪》考》".into())]
        );
    }

    #[test]
    fn falls_back_to_default_boten_mark_for_invalid_mark_parameter() {
        assert_eq!(
            parse_inlines("[[em:ab:cd]]"),
            vec![Inline::Em {
                mark: "﹅".into(),
                children: vec![Inline::Text("ab:cd".into())]
            }]
        );
    }

    #[test]
    fn counts_extended_graphemes_for_split_ruby() {
        assert_eq!(
            parse_inlines("{𠮟る|しか.る}"),
            vec![Inline::Ruby {
                base: "𠮟る".into(),
                ruby: RubyReading::Split(vec!["しか".into(), "る".into()])
            }]
        );
        assert_eq!(
            parse_inlines("{👨‍👩‍👧|かぞく}"),
            vec![Inline::Ruby {
                base: "👨‍👩‍👧".into(),
                ruby: RubyReading::Group("かぞく".into())
            }]
        );
    }

    #[test]
    fn leaves_unattached_or_stacked_block_macros_literal() {
        assert_eq!(
            parse_mdi_syntax("[[indent:2]]"),
            MdiSyntaxDocument {
                blocks: vec![MdiBlock::Paragraph {
                    inlines: vec![Inline::Text("[[indent:2]]".into())],
                    indent: None,
                    bottom: None
                }]
            }
        );
        assert_eq!(
            parse_mdi_syntax("[[indent:2]]\n[[bottom]]\n本文"),
            MdiSyntaxDocument {
                blocks: vec![
                    MdiBlock::Paragraph {
                        inlines: vec![Inline::Text("[[indent:2]]".into())],
                        indent: None,
                        bottom: None
                    },
                    MdiBlock::Paragraph {
                        inlines: vec![Inline::Text("[[bottom]]".into())],
                        indent: None,
                        bottom: None
                    },
                    MdiBlock::Paragraph {
                        inlines: vec![Inline::Text("本文".into())],
                        indent: None,
                        bottom: None
                    }
                ]
            }
        );
    }

    #[test]
    fn serializes_the_versioned_binding_contract() {
        let value: serde_json::Value =
            serde_json::from_str(&parse_json("[[indent:2]]\n第^12^話\n[[pagebreak:right]]"))
                .expect("parse output is valid JSON");

        assert_eq!(value["irVersion"], "1.0");
        assert_eq!(value["syntaxVersion"], "2.0");
        assert_eq!(value["capabilities"]["mdi"], true);
        assert_eq!(value["capabilities"]["commonMark"], true);
        assert_eq!(value["capabilities"]["gfm"], true);
        assert_eq!(value["capabilities"]["frontMatter"], true);
        assert_eq!(value["capabilities"]["sourceSpans"], true);
        assert_eq!(value["diagnostics"], serde_json::json!([]));
        assert_eq!(value["document"]["children"][0]["type"], "paragraph");
        assert_eq!(
            value["document"]["children"][0]["children"][1]["type"],
            "tcy"
        );
        assert_eq!(value["document"]["span"]["endByte"], 43);
    }

    #[test]
    fn parses_commonmark_gfm_frontmatter_and_utf8_byte_spans() {
        let document = parse_document(
            "---\ntitle: 雪\nwriting-mode: vertical\n---\n\n# 見出し\n\n- [x] {東京|とう.きょう}\n\n| a | b |\n| - | - |\n| 1 | 2 |\n",
        );
        assert_eq!(
            document.frontmatter.as_ref().unwrap().entries[0].key,
            "title"
        );
        assert_eq!(document.children[0]["type"], "heading");
        assert_eq!(document.children[1]["type"], "list");
        assert_eq!(document.children[2]["type"], "table");
        assert_eq!(document.children[0]["span"]["startByte"], 43);
    }

    #[test]
    fn keeps_mdi_looking_text_literal_in_code_and_blockquotes() {
        let document = parse_document("> \\n\n`^12^`\n\n```mdi\n{東京|とうきょう}\n```\n");
        assert_eq!(document.children[0]["type"], "blockquote");
        assert!(document.children.iter().any(|node| node["type"] == "code"));
    }

    #[test]
    fn lowers_root_flow_markers_without_a_host_markdown_parser() {
        let document = parse_document("[[indent:2]]\n本文\n[[pagebreak:right]]\n\\\n");
        assert_eq!(document.children[0]["type"], "paragraph");
        assert_eq!(document.children[0]["indent"], 2);
        assert_eq!(document.children[1]["type"], "pagebreak");
        assert_eq!(document.children[1]["variant"], "right");
        assert_eq!(document.children[2]["type"], "blank");
    }

    #[test]
    fn lets_a_bracket_macro_own_markdown_inline_boundaries() {
        let document = parse_document("[[em:**重要**]]");
        let em = &document.children[0]["children"][0];
        assert_eq!(em["type"], "em");
        assert_eq!(em["mark"], "﹅");
        assert_eq!(em["children"][0]["type"], "strong");
        assert_eq!(em["children"][0]["children"][0]["value"], "重要");
    }

    #[test]
    fn preserves_markdown_and_mdi_boundaries_when_a_macro_is_mixed_with_text() {
        assert!(
            markdown_paragraph_children(
                "前 [[em:**重要**]] 後",
                &serde_json::json!({"startByte": 0, "endByte": 26})
            )
            .is_some()
        );
        let document = parse_document("前 [[em:**重要**]] 後");
        let children = &document.children[0]["children"];
        assert_eq!(children[0]["value"], "前");
        assert_eq!(children[1]["value"], " ");
        assert_eq!(children[2]["type"], "em");
        assert_eq!(children[2]["children"][0]["type"], "strong");
        assert_eq!(children[3]["value"], " ");
        assert_eq!(children[4]["value"], "後");
        assert_eq!(children[2]["span"]["startByte"], 4);
        assert_eq!(children[2]["span"]["endByte"], 21);
        assert_eq!(children[2]["children"][0]["span"]["startByte"], 9);
        assert_eq!(children[2]["children"][0]["span"]["endByte"], 19);
    }

    #[test]
    fn recursively_lowers_mdi_inside_a_macro_markdown_payload() {
        let document = parse_document("[[em:{東京|とう.きょう}[[no-break:^12^]]]]");
        let children = &document.children[0]["children"][0]["children"];
        assert_eq!(children[0]["type"], "ruby");
        assert_eq!(children[1]["type"], "noBreak");
        assert_eq!(children[1]["children"][0]["type"], "tcy");
    }

    #[test]
    fn keeps_utf8_spans_correct_when_mdi_is_followed_by_a_footnote() {
        let document =
            parse_document("# 題\n\n{東京|とうきょう}と[[em:強調]]。[^n]\n\n[^n]: 注の本文");
        let paragraph = &document.children[1];
        assert_eq!(paragraph["span"]["startByte"], 7);
        assert_eq!(paragraph["children"][0]["type"], "ruby");
        assert_eq!(paragraph["children"][0]["base"], "東京");
        assert_eq!(paragraph["children"][0]["span"]["startByte"], 7);
        assert_eq!(paragraph["children"][0]["span"]["endByte"], 31);
        assert_eq!(paragraph["children"][2]["type"], "em");
        assert_eq!(paragraph["children"][2]["span"]["startByte"], 34);
        assert_eq!(paragraph["children"][2]["span"]["endByte"], 47);
        assert_eq!(paragraph["children"][4]["type"], "footnoteReference");
        assert_eq!(paragraph["children"][4]["identifier"], "n");
    }

    #[test]
    fn renders_a_standalone_html_document_from_rust_ir() {
        let html = render_html(
            "---\ntitle: 雪女\nlang: ja\nwriting-mode: vertical\n---\n\n# 題\n\n{東京|とうきょう} ^12^",
        );
        assert!(html.starts_with("<!DOCTYPE html>"));
        assert!(html.contains("<html lang=\"ja\" style=\"writing-mode: vertical-rl;\">"));
        assert!(html.contains("<title>雪女</title>"));
        assert!(html.contains("<h1>題</h1>"));
        assert!(html.contains("<ruby class=\"mdi-ruby\">東京<rp>（</rp><rt>とうきょう</rt>"));
        assert!(html.contains("<span class=\"mdi-tcy\">12</span>"));
    }

    #[test]
    fn renders_every_documented_mdi_construct_in_vertical_html() {
        let vertical = "---\ntitle: 構文\nlang: ja\nwriting-mode: vertical\n---\n\n";
        for (name, source, expected) in [
            (
                "front matter",
                "# 見出し",
                "<html lang=\"ja\" style=\"writing-mode: vertical-rl;\">",
            ),
            (
                "group ruby",
                "{東京|とうきょう}",
                "<ruby class=\"mdi-ruby\">東京",
            ),
            (
                "split ruby",
                "{東京|とう.きょう}",
                "<ruby class=\"mdi-ruby\"",
            ),
            ("tate-chu-yoko", "^12^", "<span class=\"mdi-tcy\">12</span>"),
            ("default boten", "[[em:傍点]]", "class=\"mdi-em\""),
            ("custom boten", "[[em:※:任意]]", "--mdi-em:&quot;※&quot;"),
            ("no-break", "[[no-break:改行禁止]]", "class=\"mdi-nobr\""),
            (
                "explicit line break",
                "前[[br]]次",
                "<br class=\"mdi-break\"/>",
            ),
            ("blank backslash", "\\", "<p class=\"mdi-blank\"></p>"),
            ("blank br", "<br>", "<p class=\"mdi-blank\"></p>"),
            ("blank br slash", "<br />", "<p class=\"mdi-blank\"></p>"),
            (
                "blank legacy macro",
                "[[blank]]",
                "<p class=\"mdi-blank\"></p>",
            ),
            ("warichu", "[[warichu:割注]]", "class=\"mdi-warichu\""),
            ("kerning", "[[kern:-0.1em:詰め]]", "--mdi-kern:-0.1em"),
            ("indent", "[[indent:2]]\n字下げ", "class=\"mdi-indent\""),
            (
                "bottom alignment",
                "[[bottom]]\n地付き",
                "class=\"mdi-bottom\"",
            ),
            ("bottom shift", "[[bottom:2]]\n地付き", "--mdi-shift:2"),
            ("page break", "[[pagebreak]]", "class=\"mdi-pagebreak\""),
            (
                "recto page break",
                "[[pagebreak:right]]",
                "class=\"mdi-pagebreak mdi-pagebreak-right\"",
            ),
            (
                "verso page break",
                "[[pagebreak:left]]",
                "class=\"mdi-pagebreak mdi-pagebreak-left\"",
            ),
            ("footnote", "脚注[^n]\n\n[^n]: 注", "data-footnotes"),
            (
                "escaped delimiters",
                "\\{ \\} \\| \\^ \\[ \\: \\《 \\》",
                "{ } | ^ [ : 《 》",
            ),
        ] {
            let html = render_html(&format!("{vertical}{source}"));
            assert!(
                html.contains(expected),
                "missing {name}: {expected}; rendered {html}"
            );
        }
        assert!(render_html(&format!("{vertical}\\")).contains(".mdi-blank{min-block-size:1lh}"));
    }

    #[test]
    fn renders_footnote_definitions_in_html() {
        let html = render_html("本文[^n]\n\n[^n]: 注の本文");
        assert!(html.contains("data-footnotes"));
        assert!(html.contains("id=\"user-content-fn-n\""));
        assert!(html.contains("注の本文"));
    }

    #[test]
    fn escapes_raw_html_in_the_rust_renderer() {
        let html = render_html("<script>alert(1)</script>");
        assert!(html.contains("&lt;script&gt;alert(1)&lt;/script&gt;"));
        assert!(!html.contains("<script>alert(1)</script>"));
    }

    #[test]
    fn serializes_mdi_from_rust_ir() {
        let source = "---\ntitle: 雪\n---\n\n# 題\n\n{東京|とう.きょう} [[em:**重要**]]";
        assert_eq!(
            serialize_mdi(source),
            "---\ntitle: 雪\n---\n\n# 題\n\n{東京|とう.きょう} [[em:**重要**]]\n"
        );
    }

    #[test]
    fn renders_plain_text_from_rust_ir() {
        assert_eq!(
            render_text("# 題\n\n{東京|とうきょう} ^12^"),
            "題\n東京 12\n"
        );
    }

    #[test]
    fn renders_platform_text_formats_from_rust_ir() {
        let source = "# 題\n\n{東京|とう.きょう}[[em:強調]]。[^n]\n\n[^n]: 注";
        assert_eq!(
            render_text_format(source, TextFormat::Plain, ""),
            "題\n東京強調。"
        );
        assert_eq!(
            render_text_format(source, TextFormat::Ruby, ""),
            "題\n{東京|とう.きょう}強調。"
        );
        assert_eq!(
            render_text_format(source, TextFormat::Kakuyomu, ""),
            "題\n｜東京《とうきょう》《《強調》》。［注1］\n\nFootnotes\n1. 注"
        );
        assert!(
            render_text_format(source, TextFormat::Aozora, "").contains("［＃「題」は中見出し］")
        );
    }

    #[test]
    fn note_renderer_defensively_degrades_partial_and_future_ir() {
        let document = Document {
            span: SourceSpan::default(),
            frontmatter: None,
            children: vec![
                serde_json::json!({"type":"math", "value":"x < y"}),
                serde_json::json!({
                    "type":"paragraph",
                    "children":[
                        {"type":"inlineMath", "value":"x < y"},
                        {"type":"text", "value":" "},
                        {"type":"html", "value":"<i>raw</i>"},
                        {"type":"text", "value":" "},
                        {"type":"link", "url":"https://example.test/a>b", "children":[{"type":"text", "value":"link"}]},
                        {"type":"text", "value":" "},
                        {"type":"image", "url":"", "alt":"alt"},
                        {"type":"footnoteReference", "identifier":"missing"}
                    ]
                }),
                serde_json::json!({
                    "type":"heading",
                    "depth":1,
                    "children":[
                        {"type":"strong", "children":[{"type":"text", "value":"heading"}]},
                        {"type":"text", "value":" "},
                        {"type":"inlineMath", "value":"x < y"}
                    ]
                }),
                serde_json::json!({
                    "type":"blockquote",
                    "children":[{
                        "type":"paragraph",
                        "children":[{"type":"inlineMath", "value":"quoted"}]
                    }]
                }),
                serde_json::json!({
                    "type":"list",
                    "ordered":false,
                    "children":[{"type":"listItem", "checked":true, "children":[]}]
                }),
                serde_json::json!({
                    "type":"unknown",
                    "children":[{"type":"text", "value":"readable"}]
                }),
                serde_json::json!({"type":"unknown"}),
                serde_json::json!({"type":"blank"}),
            ],
        };
        let rendered = render_note_document(&document, "");
        assert!(rendered.contains("$$\nx < y\n$$"));
        assert!(rendered.contains("$${x < y}$$"));
        assert!(rendered.contains("<i>raw</i>"));
        assert!(rendered.contains("link (https://example.test/a>b)"));
        assert!(rendered.contains("画像: alt［注0］"));
        assert!(rendered.contains("## heading x < y"));
        assert!(rendered.contains("> quoted"));
        assert!(rendered.contains("- [x] "));
        assert!(rendered.contains("readable"));
    }

    #[test]
    fn renders_and_serializes_every_public_inline_and_block_variant() {
        let source = "---\ntitle: Variants\n---\n\n[[bottom]]\n本文\n\n## 中見出し\n\n### 小見出し\n\n> 引用\n\n1. 一\n2. 二\n\n- 箇条\n  - 巢狀\n\n```rust\nlet x = 1;\n```\n\n---\n\n| 見出し | 値 |\n| --- | --- |\n| [リンク](https://example.test \"題\") | ![画像](image.png) |\n\n~~削除~~ `code` [[br]][[warichu:割書]][[kern:1em:字]][[em:●:傍点]]\n";

        let html = render_html(source);
        for expected in [
            "<h2>中見出し</h2>",
            "<h3>小見出し</h3>",
            "<blockquote><p>引用</p>",
            "<ol>",
            "<ul>",
            "<pre><code class=\"language-rust\">",
            "<hr>",
            "<table>",
            "<a href=\"https://example.test\" title=\"題\">リンク</a>",
            "<img src=\"image.png\" alt=\"画像\">",
            "<del>削除</del>",
            "<code>code</code>",
            "<br class=\"mdi-break\"/>",
            "mdi-warichu",
            "mdi-kern",
            "--mdi-em:&quot;●&quot;",
        ] {
            assert!(html.contains(expected), "HTML contains {expected}");
        }

        let canonical = serialize_mdi(source);
        for expected in [
            "[[bottom]]",
            "## 中見出し",
            "> 引用",
            "1. 一",
            "- 箇条",
            "```rust",
            "| 見出し | 値 |",
            "[リンク](https://example.test \\題\")",
            "![画像](image.png)",
            "~~削除~~",
            "`code`",
            "[[br]]",
            "[[warichu:割書]]",
            "[[kern:1em:字]]",
            "[[em:●:傍点]]",
        ] {
            assert!(
                canonical.contains(expected),
                "canonical MDI contains {expected}"
            );
        }

        let plain = render_text(source);
        assert!(plain.contains("画像"));
        assert!(plain.contains("巢狀"));

        for (name, format) in [
            ("txt", TextFormat::Plain),
            ("txt-ruby", TextFormat::Ruby),
            ("narou", TextFormat::Narou),
            ("kakuyomu", TextFormat::Kakuyomu),
            ("aozora", TextFormat::Aozora),
            ("note", TextFormat::Note),
        ] {
            assert_eq!(TextFormat::parse(name), Some(format));
            assert!(!render_text_format(source, format, "　").is_empty());
        }
        assert_eq!(TextFormat::parse("unknown"), None);
    }

    #[test]
    fn packages_an_epub_from_rust_ir() {
        let bytes = render_epub("---\ntitle: Test\nwriting-mode: vertical\n---\n\n# One\n\ntext\n\n[[pagebreak]]\n\n# Two\n\nmore").unwrap();
        let mut zip = ZipArchive::new(Cursor::new(bytes)).unwrap();
        let mut mimetype = String::new();
        zip.by_name("mimetype")
            .unwrap()
            .read_to_string(&mut mimetype)
            .unwrap();
        assert_eq!(mimetype, "application/epub+zip");
        let mut opf = String::new();
        zip.by_name("OEBPS/package.opf")
            .unwrap()
            .read_to_string(&mut opf)
            .unwrap();
        assert!(opf.contains("<dc:title>Test</dc:title>"));
        assert!(opf.contains("<meta property=\"dcterms:modified\">"));
        assert!(opf.contains("page-progression-direction=\"rtl\""));
        assert!(opf.contains("chapter-2.xhtml"));
    }

    #[test]
    fn packages_epub_xhtml_with_nonempty_navigation_and_readable_image_fallbacks() {
        let bytes = render_epub(
            "---\ntitle: Test\n---\n\nopening\n\n[[pagebreak]]\n\n![remote](https://example.com/image.png)",
        )
        .unwrap();
        let mut zip = ZipArchive::new(Cursor::new(bytes)).unwrap();

        let mut navigation = String::new();
        zip.by_name("OEBPS/nav.xhtml")
            .unwrap()
            .read_to_string(&mut navigation)
            .unwrap();
        assert!(navigation.contains(">Chapter 1</a>"));
        assert!(navigation.contains(">Chapter 2</a>"));
        assert!(!navigation.contains("></a>"));

        let mut opf = String::new();
        zip.by_name("OEBPS/package.opf")
            .unwrap()
            .read_to_string(&mut opf)
            .unwrap();
        assert!(opf.contains(
            "id=\"chapter-2\" href=\"chapter-2.xhtml\" media-type=\"application/xhtml+xml\"/"
        ));
        assert!(!opf.contains("remote-resources"));

        let mut chapter = String::new();
        zip.by_name("OEBPS/chapter-2.xhtml")
            .unwrap()
            .read_to_string(&mut chapter)
            .unwrap();
        assert!(chapter.contains(
            "<span class=\"mdi-image-fallback\">Image: remote (https://example.com/image.png)</span>"
        ));
        assert!(!chapter.contains("<img"));
    }

    #[test]
    fn packages_configured_epub_metadata_cover_chapters_and_local_footnotes() {
        let cover = EpubCover {
            data: vec![0x89, 0x50, 0x4e, 0x47],
            media_type: "image/png".to_owned(),
        };
        let bytes = render_epub_with_profile(
            "# One\n\nnote[^n]\n\n[[pagebreak]]\n\n## Two\n\nmore\n\n[^n]: text",
            r#"{
                "layout":{"system":"japanese-publisher"},
                "metadata":{"title":"Book","author":"Writer","publisher":"Press","identifier":"urn:test","language":"en","date":"2026-07-23"},
                "typesetting":{"writingMode":"vertical","fontFamily":"Noto Serif JP","fontSize":11,"lineSpacing":1.5,"textIndentEm":2,"fullwidthSpaceIndent":true},
                "pagination":{"gridMode":"typographic"},
                "epub":{"chapterSplitLevel":"h2"}
            }"#,
            Some(&cover),
        )
        .unwrap();
        let mut zip = ZipArchive::new(Cursor::new(bytes)).unwrap();
        let mut opf = String::new();
        zip.by_name("OEBPS/package.opf")
            .unwrap()
            .read_to_string(&mut opf)
            .unwrap();
        assert!(opf.contains("<dc:title>Book</dc:title>"));
        assert!(opf.contains("<dc:creator>Writer</dc:creator>"));
        assert!(opf.contains("<dc:publisher>Press</dc:publisher>"));
        assert!(opf.contains("<dc:date>2026-07-23</dc:date>"));
        assert!(opf.contains("cover-image"));
        assert!(opf.contains("page-progression-direction=\"rtl\""));
        let mut css = String::new();
        zip.by_name("OEBPS/style.css")
            .unwrap()
            .read_to_string(&mut css)
            .unwrap();
        assert!(css.contains("font-family:Noto Serif JP"));
        assert!(css.contains("font-size:11pt"));
        assert!(css.contains("line-height:1.5"));
        let mut chapter = String::new();
        zip.by_name("OEBPS/chapter-1.xhtml")
            .unwrap()
            .read_to_string(&mut chapter)
            .unwrap();
        assert!(chapter.contains("href=\"#user-content-fn-n\""));
        assert!(chapter.contains("id=\"user-content-fn-n\""));
        assert!(chapter.contains("href=\"#user-content-fnref-n\""));
        assert!(zip.by_name("OEBPS/chapter-2.xhtml").is_ok());
        assert!(zip.by_name("OEBPS/cover.png").is_ok());
    }

    #[test]
    fn packages_a_docx_from_rust_ir() {
        let bytes = render_docx("---\ntitle: Test\n---\n\n# 題\n\n{東京|とうきょう}").unwrap();
        let mut zip = ZipArchive::new(Cursor::new(bytes)).unwrap();
        let mut document = String::new();
        zip.by_name("word/document.xml")
            .unwrap()
            .read_to_string(&mut document)
            .unwrap();
        assert!(document.contains("題"));
        assert!(document.contains("東京"));
        let mut core = String::new();
        zip.by_name("docProps/core.xml")
            .unwrap()
            .read_to_string(&mut core)
            .unwrap();
        assert!(core.contains("<dc:title>Test</dc:title>"));
    }

    #[test]
    fn packages_configured_docx_geometry_typography_content_and_book_settings() {
        let bytes = render_docx_with_profile(
            "# {第一章|だいいっしょう}\n\n本文[^n]\n\n- 一\n- 二\n\n|項目|値|\n|-|-|\n|契約|有効|\n\n[link](https://example.com) ^12^ [[em:圏点]]\n\n[^n]: 脚注",
            r#"{
                "layout":{"system":"japanese-publisher","marginMode":"mirror","bindingSide":"right","gutter":3},
                "metadata":{"title":"契約","author":"MDI"},
                "typesetting":{"writingMode":"vertical","fontFamily":"Yu Mincho","fontSize":10.5,"fullwidthSpaceIndent":true},
                "pagination":{"pageSize":"A4","landscape":true,"charactersPerLine":40,"linesPerPage":30,"gridMode":"strict","pageNumbers":{"enabled":true,"format":"fraction","position":"top-right"}}
            }"#,
        )
        .unwrap();
        let mut zip = ZipArchive::new(Cursor::new(bytes)).unwrap();
        let mut document = String::new();
        zip.by_name("word/document.xml")
            .unwrap()
            .read_to_string(&mut document)
            .unwrap();
        assert!(document.contains("<w:ruby>"));
        assert!(document.contains("<w:lid w:val=\"ja-JP\"/>"));
        assert!(document.contains("<w:eastAsianLayout"));
        assert!(document.contains("<w:em w:val=\"dot\"/>"));
        assert!(document.contains("<w:tbl>"));
        assert!(document.contains("<w:footnoteReference w:id=\"1\"/>"));
        assert!(document.contains("<w:textDirection w:val=\"tbRl\"/>"));
        assert!(document.contains("<w:docGrid w:type=\"linesAndChars\""));
        assert!(document.contains("<w:pgSz w:w=\"16838\" w:h=\"11906\"/>"));
        assert!(document.contains("<w:hyperlink r:id=\"rId1\">"));

        let mut settings = String::new();
        zip.by_name("word/settings.xml")
            .unwrap()
            .read_to_string(&mut settings)
            .unwrap();
        assert!(settings.contains("<w:mirrorMargins/>"));
        assert!(!settings.contains("rtlGutter"));

        let mut header = String::new();
        zip.by_name("word/header1.xml")
            .unwrap()
            .read_to_string(&mut header)
            .unwrap();
        assert!(header.contains("NUMPAGES"));
        assert!(header.contains("<w:jc w:val=\"right\"/>"));
        assert!(zip.by_name("word/footnotes.xml").is_ok());
    }

    #[test]
    fn configured_docx_rejects_word_limits_and_uses_typographic_spacing() {
        let oversized = render_docx_with_profile(
            "text",
            r#"{"layout":{"system":"word"},"pagination":{"pageSize":"A0"}}"#,
        )
        .unwrap_err();
        assert!(oversized.contains("22-inch maximum"));
        let long_font = render_docx_with_profile(
            "text",
            r#"{"layout":{"system":"word"},"typesetting":{"fontFamily":"12345678901234567890123456789012"}}"#,
        )
        .unwrap_err();
        assert!(long_font.contains("at most 31 characters"));

        let bytes = render_docx_with_profile(
            "text",
            r#"{"layout":{"system":"word"},"typesetting":{"lineSpacing":1.5},"pagination":{"gridMode":"typographic","pageNumbers":{"enabled":false}}}"#,
        )
        .unwrap();
        let mut zip = ZipArchive::new(Cursor::new(bytes)).unwrap();
        let mut document = String::new();
        zip.by_name("word/document.xml")
            .unwrap()
            .read_to_string(&mut document)
            .unwrap();
        assert!(!document.contains("<w:docGrid"));
        assert!(!document.contains("headerReference"));
        assert!(!document.contains("footerReference"));
    }

    #[test]
    fn configured_docx_renders_every_supported_block_and_inline_style() {
        let source = r#"# Heading

> Quote with *italic*, **bold**, and `inline code`.
>
> ```text
> quoted code
> ```

```rust
let first = 1;
let second = 2;
```

---

First line [[br]] second line with ~~strike~~, <span>raw</span>, ![cover](cover.png), ![](empty.png),
[[warichu:small print]], [[kern:0.1em:spaced]], and {東京|とう.きょう}.

[same link](https://example.com) and [same target](https://example.com)
"#;
        let bytes = render_docx_with_profile(
            source,
            r#"{
                "layout":{"system":"japanese-publisher"},
                "typesetting":{"writingMode":"horizontal","fontSize":12},
                "pagination":{"charactersPerLine":10,"linesPerPage":10,"gridMode":"strict","pageNumbers":{"enabled":true,"format":"simple","position":"bottom-left"}}
            }"#,
        )
        .unwrap();
        let mut zip = ZipArchive::new(Cursor::new(bytes)).unwrap();
        let mut document = String::new();
        zip.by_name("word/document.xml")
            .unwrap()
            .read_to_string(&mut document)
            .unwrap();
        for marker in [
            "MdiQuote",
            "MdiCode",
            "MdiThematicBreak",
            "<w:i/>",
            "<w:b/>",
            "<w:strike/>",
            "Courier New",
            "<w:br/>",
            "[Image: cover]",
            "[Image]",
            "<w:spacing w:val=\"24\"/>",
            "<w:ruby>",
            "w:charSpace=",
        ] {
            assert!(document.contains(marker), "missing DOCX marker: {marker}");
        }
        assert_eq!(document.matches("<w:hyperlink r:id=\"rId1\">").count(), 2);

        let mut footer = String::new();
        zip.by_name("word/footer1.xml")
            .unwrap()
            .read_to_string(&mut footer)
            .unwrap();
        assert!(footer.contains("<w:jc w:val=\"left\"/>"));
        assert!(footer.contains("> PAGE <"));
    }

    #[test]
    fn renders_pdf_with_an_available_native_chromium() {
        let Some(chromium_path) = find_chromium() else {
            return;
        };
        let pdf = render_pdf(
            "# 題\n\n{東京|とうきょう}",
            &PdfOptions {
                chromium_path: Some(chromium_path),
            },
        )
        .unwrap();
        assert!(pdf.starts_with(b"%PDF-"));
    }

    #[test]
    fn adversarial_utf8_corpus_never_escapes_source_spans_or_the_wire_contract() {
        for seed in 0..256 {
            let source = generated_source(seed);
            let output = parse_output(&source);
            assert_eq!(output.document.span.start_byte, 0);
            assert_eq!(output.document.span.end_byte as usize, source.len());
            for child in &output.document.children {
                assert_valid_spans(child, &source);
            }
            for diagnostic in &output.diagnostics {
                let span = diagnostic
                    .span
                    .expect("parser diagnostics have source spans");
                assert!(span.start_byte <= span.end_byte);
                assert!((span.end_byte as usize) <= source.len());
            }

            let wire: serde_json::Value = serde_json::from_str(&parse_json(&source))
                .expect("every UTF-8 input has a serializable wire result");
            assert_eq!(wire["irVersion"], MDI_IR_VERSION);
            assert_eq!(wire["syntaxVersion"], MDI_SPEC_VERSION);
            assert_valid_spans(&wire["document"], &source);

            // Rendering and canonicalization are total functions over parser
            // output: malformed delimiters may become literal text, never a
            // host-visible failure.
            assert!(!render_html_document(&output.document).is_empty());
            let canonical = serialize_mdi_document(&output.document);
            let reparsed = parse_document(&canonical);
            for child in &reparsed.children {
                assert_valid_spans(child, &canonical);
            }
            let _ = render_text_document(&reparsed);
        }
    }

    #[test]
    fn canonical_serialization_is_idempotent_for_the_supported_syntax_matrix() {
        let cases = [
            "",
            "plain\n",
            "---\ntitle: 雪\nmdi: '999.0'\n---\n\n# 題\n\n{東京|とう.きょう} [[em:**重要**]]\n",
            "> {東京|とうきょう}\n> \n> - [x] ^12^\n\n[^n]: 注\n\n本文[^n]\n",
            "[[indent:2]]\n本文\n\n[[bottom:3]]\n《《傍点》》\n\n[[pagebreak:right]]\n\n\\\n",
            "| a | b |\n| --- | --- |\n| {東京|とうきょう} | `^12^` |\n",
            "```mdi\n{東京|とうきょう}\n[[em:literal]]\n```\n",
        ];
        for source in cases {
            let first = serialize_mdi(source);
            let second = serialize_mdi(&first);
            assert_eq!(
                second, first,
                "canonical output must stabilize for {source:?}"
            );
            assert_valid_spans(
                &serde_json::to_value(parse_document(&first)).unwrap(),
                &first,
            );
        }
    }

    #[test]
    fn archive_exports_have_required_parts_and_escape_untrusted_metadata() {
        let source = "---\ntitle: 'A & < B \"quoted\"'\nauthor: 'O''Brien & Co.'\nlang: ja\n---\n\n# 題\n\n<unsafe>&\n\n[[pagebreak]]\n\n# 次\n";

        let epub = render_epub(source).unwrap();
        let mut epub = ZipArchive::new(Cursor::new(epub)).unwrap();
        assert_eq!(
            epub.by_name("mimetype").unwrap().compression(),
            CompressionMethod::Stored,
            "EPUB requires its mimetype member to be uncompressed"
        );
        for path in [
            "META-INF/container.xml",
            "OEBPS/package.opf",
            "OEBPS/nav.xhtml",
            "OEBPS/style.css",
            "OEBPS/chapter-1.xhtml",
            "OEBPS/chapter-2.xhtml",
        ] {
            assert!(epub.by_name(path).is_ok(), "EPUB has {path}");
        }
        let mut opf = String::new();
        epub.by_name("OEBPS/package.opf")
            .unwrap()
            .read_to_string(&mut opf)
            .unwrap();
        assert!(opf.contains("A &amp; &lt; B &quot;quoted&quot;"));
        assert!(opf.contains("O'Brien &amp; Co."));

        let docx = render_docx(source).unwrap();
        let mut docx = ZipArchive::new(Cursor::new(docx)).unwrap();
        for path in [
            "[Content_Types].xml",
            "_rels/.rels",
            "docProps/core.xml",
            "word/document.xml",
        ] {
            assert!(docx.by_name(path).is_ok(), "DOCX has {path}");
        }
        let mut core = String::new();
        docx.by_name("docProps/core.xml")
            .unwrap()
            .read_to_string(&mut core)
            .unwrap();
        assert!(core.contains("A &amp; &lt; B &quot;quoted&quot;"));
        let mut document = String::new();
        docx.by_name("word/document.xml")
            .unwrap()
            .read_to_string(&mut document)
            .unwrap();
        assert!(document.contains("&lt;unsafe&gt;"));
        assert!(document.contains("&amp;"));
    }

    #[test]
    fn classifies_every_legacy_block_macro_shape() {
        let amount = |value| match classify_block_macro(value) {
            BlockMacroClass::Indent(amount) | BlockMacroClass::Bottom(amount) => Some(amount),
            BlockMacroClass::Pagebreak(_) | BlockMacroClass::Literal => None,
        };
        assert_eq!(amount(" [[indent:12]] "), Some(12));
        assert_eq!(amount("[[bottom]]"), Some(0));
        assert_eq!(amount("[[bottom:3]]"), Some(3));
        assert_eq!(amount("literal"), None);
        assert!(matches!(
            classify_block_macro("[[pagebreak]]"),
            BlockMacroClass::Pagebreak(None)
        ));
        assert!(matches!(
            classify_block_macro("[[pagebreak:left]]"),
            BlockMacroClass::Pagebreak(Some(PagebreakVariant::Left))
        ));
        assert!(matches!(
            classify_block_macro("[[pagebreak:right]]"),
            BlockMacroClass::Pagebreak(Some(PagebreakVariant::Right))
        ));
        for literal in [
            "text",
            "[[unknown:1]]",
            "[[indent:]]",
            "[[indent:0]]",
            "[[indent:01]]",
            "[[indent:x]]",
            "[[indent:999999999999999999999999999999]]",
        ] {
            assert!(matches!(
                classify_block_macro(literal),
                BlockMacroClass::Literal
            ));
        }
    }

    #[test]
    fn reports_version_diagnostics_and_recovers_from_non_mapping_frontmatter() {
        let newer = parse_output("---\nmdi: '3.0'\n---\n\ntext");
        assert_eq!(newer.diagnostics.len(), 1);
        assert_eq!(newer.diagnostics[0].severity, DiagnosticSeverity::Warning);
        assert_eq!(newer.diagnostics[0].code, "mdi.version.unsupported");
        assert_eq!(
            newer.diagnostics[0].span,
            newer.document.frontmatter.map(|f| f.span)
        );

        for source in [
            "---\nmdi: '2.0'\n---\n",
            "---\nmdi: 3\n---\n",
            "---\n- sequence\n- values\n---\n",
            "---\n[malformed\n---\n",
        ] {
            let output = parse_output(source);
            assert!(output.diagnostics.is_empty());
            assert!(output.document.frontmatter.is_some());
        }
    }

    #[test]
    fn pdf_renderer_reports_spawn_and_nonzero_process_errors() {
        let missing =
            std::env::temp_dir().join(format!("mdi-core-missing-chromium-{}", std::process::id()));
        let error = render_pdf(
            "text",
            &PdfOptions {
                chromium_path: Some(missing),
            },
        )
        .unwrap_err();
        assert!(error.contains("failed to start Chromium"));

        let current_exe = std::env::current_exe().unwrap();
        let error = render_pdf(
            "text",
            &PdfOptions {
                chromium_path: Some(current_exe),
            },
        )
        .unwrap_err();
        assert!(error.contains("Chromium PDF rendering failed"));
    }

    #[test]
    fn defensive_helpers_handle_partial_ir_and_all_literal_fallbacks() {
        let mut scalar = serde_json::json!(null);
        lower_markdown_inside_mdi(&mut scalar, "");
        shift_spans(&mut scalar, 10);
        annotate_and_lower(&mut scalar, "", false);
        inject_block_markers(&mut scalar, &[]);
        assert_valid_spans(&scalar, "");

        let mut paragraph_with_invalid_span = serde_json::json!({
            "type": "paragraph",
            "span": {"startByte": 2, "endByte": 3}
        });
        lower_markdown_inside_mdi(&mut paragraph_with_invalid_span, "");

        let mut text_without_value = serde_json::json!({
            "type": "text",
            "position": {"start": {"offset": 0}, "end": {"offset": 0}}
        });
        annotate_and_lower(&mut text_without_value, "", false);
        let mut text_without_position = serde_json::json!({
            "type": "text",
            "value": "^12^"
        });
        annotate_and_lower(&mut text_without_position, "^12^", false);
        assert_eq!(text_without_position["children"][0]["type"], "tcy");
        let mut text_with_partial_span = serde_json::json!({
            "type": "text",
            "value": "^12^",
            "span": {}
        });
        annotate_and_lower(&mut text_with_partial_span, "^12^", false);
        assert_eq!(text_with_partial_span["children"][0]["type"], "tcy");

        assert!(markdown_macro_children("not-a-macro", 0).is_none());
        assert!(markdown_macro_children("[[em:x]]tail", 0).is_none());

        let span = SourceSpan {
            start_byte: 0,
            end_byte: 10,
        };
        for (is_indent, amount, expected) in [
            (true, 2, "[[indent:2]]"),
            (false, 0, "[[bottom]]"),
            (false, 3, "[[bottom:3]]"),
        ] {
            let mut output = Vec::new();
            let mut pending = Some((span, is_indent, amount));
            flush_pending_literal(&mut output, &mut pending);
            assert_eq!(output[0]["children"][0]["value"], expected);
        }

        assert!(matches!(
            paragraph(
                "text",
                Some(PendingBlock::Bottom {
                    amount: 2,
                    source: "[[bottom:2]]".to_owned()
                })
            ),
            MdiBlock::Paragraph {
                bottom: Some(2),
                ..
            }
        ));
        assert!(pending_block("[[unknown:2]]").is_none());
        assert!(boten("《《》》").is_none());
        assert!(!valid_kern("1.em"));
        assert!(!valid_kern("1.2.3em"));
        assert_eq!(unescape_mdi("trailing\\"), "trailing\\");

        let mut writer = FailAfterWrites {
            inner: Cursor::new(Vec::new()),
            remaining: 1,
        };
        writer.flush().unwrap();

        let mut formatted = Vec::new();
        text_format_block(
            &serde_json::json!({"type": "blank"}),
            TextFormat::Plain,
            "",
            &[],
            &[],
            &mut formatted,
        );
        text_format_block(
            &serde_json::json!({"type": "unknown"}),
            TextFormat::Plain,
            "",
            &[],
            &[],
            &mut formatted,
        );
        assert_eq!(formatted, vec![String::new()]);

        assert_eq!(
            text_format_inline(
                &serde_json::json!({"type":"ruby", "base":"字", "ruby":{"value":"じ"}}),
                TextFormat::Ruby,
                &[]
            ),
            "{字|じ}"
        );
        assert_eq!(
            text_format_inline(
                &serde_json::json!({"type":"ruby", "base":"字", "ruby":{"value":null}}),
                TextFormat::Plain,
                &[]
            ),
            "字"
        );
        assert_eq!(
            text_format_inline(
                &serde_json::json!({"type":"image", "alt":""}),
                TextFormat::Plain,
                &[]
            ),
            "[画像]"
        );

        let mut html = String::new();
        render_html_node(&serde_json::json!({}), &mut html);
        render_html_node(
            &serde_json::json!({"type":"unknown", "children":[{"type":"text", "value":"ok"}]}),
            &mut html,
        );
        render_html_children(&serde_json::json!({"type":"root"}), &mut html);
        assert_eq!(html, "ok");

        let stacked = parse_document("[[indent:2]]\n[[bottom:3]]\ntext");
        assert_eq!(stacked.children[0]["children"][0]["value"], "[[indent:2]]");
        let heading = parse_document("[[indent:2]]\n# heading");
        assert_eq!(heading.children[0]["children"][0]["value"], "[[indent:2]]");
        let trailing = parse_document("[[indent:2]]\n[[bottom:3]]");
        assert_eq!(trailing.children.len(), 2);

        let partial_document = Document {
            span: SourceSpan::default(),
            frontmatter: None,
            children: vec![serde_json::json!({
                "type": "root",
                "children": [{"type":"text", "value":"partial"}]
            })],
        };
        assert!(render_docx_document(&partial_document).is_ok());
    }

    #[test]
    fn epub_handles_empty_documents_and_heading_driven_chapter_splits() {
        let empty = render_epub("").unwrap();
        let mut empty = ZipArchive::new(Cursor::new(empty)).unwrap();
        assert!(empty.by_name("OEBPS/chapter-1.xhtml").is_ok());

        let split = render_epub("intro\n\n# Chapter\n\nbody").unwrap();
        let mut split = ZipArchive::new(Cursor::new(split)).unwrap();
        assert!(split.by_name("OEBPS/chapter-2.xhtml").is_ok());
    }

    #[test]
    fn archive_writers_propagate_failures_from_every_write_stage() {
        let document = parse_document(
            "---\ntitle: Failure matrix\nauthor: Test\n---\n\nintro\n\n# Chapter\n\nbody",
        );

        let mut epub_errors = 0;
        let mut epub_success = false;
        for remaining in 0..256 {
            let writer = FailAfterWrites {
                inner: Cursor::new(Vec::new()),
                remaining,
            };
            let mut zip = ZipWriter::new(writer);
            let result = write_epub_document(&document, &mut zip);
            if result.is_err() {
                epub_errors += 1;
            } else {
                epub_success = true;
            }
            // A deliberately broken writer can leave `ZipWriter` midway
            // through a local header, where its Drop finalizer cannot safely
            // recover. The writer owns only this test's in-memory buffer.
            std::mem::forget(zip);
            if epub_success {
                break;
            }
        }
        assert!(epub_errors > 0);
        assert!(epub_success);

        let mut docx_errors = 0;
        let mut docx_success = false;
        for remaining in 0..256 {
            let writer = FailAfterWrites {
                inner: Cursor::new(Vec::new()),
                remaining,
            };
            let mut zip = ZipWriter::new(writer);
            let result = write_docx_document(&document, &mut zip);
            if result.is_err() {
                docx_errors += 1;
            } else {
                docx_success = true;
            }
            std::mem::forget(zip);
            if docx_success {
                break;
            }
        }
        assert!(docx_errors > 0);
        assert!(docx_success);
    }

    #[allow(unsafe_code)]
    fn ffi_bytes(result: ffi::MdiFfiResult) -> Result<Vec<u8>, String> {
        let value = if result.value.len == 0 {
            Vec::new()
        } else {
            unsafe { std::slice::from_raw_parts(result.value.data, result.value.len).to_vec() }
        };
        let error = if result.error.len == 0 {
            None
        } else {
            Some(unsafe {
                std::str::from_utf8(std::slice::from_raw_parts(
                    result.error.data,
                    result.error.len,
                ))
                .unwrap()
                .to_owned()
            })
        };
        unsafe {
            ffi::mdi_free_buffer(result.value);
            ffi::mdi_free_buffer(result.error);
        }
        error.map_or(Ok(value), Err)
    }

    #[test]
    #[allow(unsafe_code)]
    fn c_abi_returns_owned_versioned_wire_data_for_every_export() {
        let source = "{東京|とうきょう} ^12^";
        let json = String::from_utf8(
            ffi_bytes(ffi::mdi_parse_json(source.as_ptr(), source.len())).unwrap(),
        )
        .unwrap();
        assert!(json.contains("\"irVersion\":\"1.0\""));
        assert!(json.contains("\"type\":\"ruby\""));

        let html = String::from_utf8(
            ffi_bytes(ffi::mdi_render_html(source.as_ptr(), source.len())).unwrap(),
        )
        .unwrap();
        assert!(html.contains("<ruby class=\"mdi-ruby\">東京"));
        assert_eq!(
            String::from_utf8(
                ffi_bytes(ffi::mdi_serialize_mdi(source.as_ptr(), source.len())).unwrap()
            )
            .unwrap(),
            "{東京|とうきょう} ^12^\n"
        );
        assert_eq!(
            String::from_utf8(
                ffi_bytes(ffi::mdi_render_text(source.as_ptr(), source.len())).unwrap()
            )
            .unwrap(),
            "東京 12\n"
        );
        let format = b"note";
        let indent = "　".as_bytes();
        assert_eq!(
            String::from_utf8(
                ffi_bytes(ffi::mdi_render_text_format(
                    source.as_ptr(),
                    source.len(),
                    format.as_ptr(),
                    format.len(),
                    indent.as_ptr(),
                    indent.len(),
                ))
                .unwrap()
            )
            .unwrap(),
            "　｜東京《とうきょう》 12"
        );
        assert!(
            ffi_bytes(ffi::mdi_render_epub(source.as_ptr(), source.len()))
                .unwrap()
                .starts_with(b"PK")
        );
        assert!(
            ffi_bytes(ffi::mdi_render_docx(source.as_ptr(), source.len()))
                .unwrap()
                .starts_with(b"PK")
        );

        assert!(
            ffi_bytes(ffi::mdi_render_text(std::ptr::null(), 0))
                .unwrap()
                .is_empty()
        );
        let invalid_utf8 = [0xff];
        assert_eq!(
            ffi_bytes(ffi::mdi_render_html(
                invalid_utf8.as_ptr(),
                invalid_utf8.len()
            ))
            .unwrap_err(),
            "MDI source must be valid UTF-8"
        );

        assert_eq!(
            ffi_bytes(ffi::mdi_parse_json(std::ptr::null(), 1)).unwrap_err(),
            "MDI source pointer is null"
        );
        assert_eq!(
            ffi_bytes(ffi::mdi_render_epub(std::ptr::null(), 1)).unwrap_err(),
            "MDI source pointer is null"
        );

        let invalid_format = b"invalid";
        assert_eq!(
            ffi_bytes(ffi::mdi_render_text_format(
                source.as_ptr(),
                source.len(),
                invalid_format.as_ptr(),
                invalid_format.len(),
                std::ptr::null(),
                0,
            ))
            .unwrap_err(),
            "Unsupported text format: invalid"
        );
        assert_eq!(
            ffi_bytes(ffi::mdi_render_text_format(
                source.as_ptr(),
                source.len(),
                std::ptr::null(),
                1,
                std::ptr::null(),
                0,
            ))
            .unwrap_err(),
            "MDI text format pointer is null"
        );
        assert_eq!(
            ffi_bytes(ffi::mdi_render_text_format(
                source.as_ptr(),
                source.len(),
                format.as_ptr(),
                format.len(),
                invalid_utf8.as_ptr(),
                invalid_utf8.len(),
            ))
            .unwrap_err(),
            "MDI text indent prefix must be valid UTF-8"
        );
    }
}
