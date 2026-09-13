//! Rust-owned editorial comment recognition and public-tree filtering.
use crate::{Diagnostic, DiagnosticSeverity, SourceSpan};
use serde_json::{Value, json};

#[derive(Default)]
pub(crate) struct Comments {
    pub spans: Vec<SourceSpan>,
    pub diagnostics: Vec<Diagnostic>,
}

impl Comments {
    pub fn scan(source: &str) -> Self {
        let mut result = Self::default();
        if !source.contains("<!--") {
            return result;
        }
        let options = crate::markdown_options();
        let mut protected = Vec::new();
        // Protect only a complete leading YAML fence, before querying the
        // Markdown code/URL contexts. This avoids markdown-rs's known late
        // frontmatter state-machine panic, including in Wasm.
        let mut protected_source = std::borrow::Cow::Borrowed(source);
        if source.starts_with("---\n") || source.starts_with("---\r\n") {
            let mut end = source.find('\n').expect("opening line") + 1;
            for line in source[end..].split_inclusive('\n') {
                end += line.len();
                if line.trim_end() == "---" {
                    protected.push(SourceSpan {
                        start_byte: 0,
                        end_byte: end as u32,
                    });
                    let mut bytes = source.as_bytes().to_vec();
                    for byte in &mut bytes[..end] {
                        if !matches!(*byte, b'\n' | b'\r') {
                            *byte = b' ';
                        }
                    }
                    protected_source =
                        std::borrow::Cow::Owned(String::from_utf8(bytes).expect("masked YAML"));
                    break;
                }
            }
        }
        if let Ok(tree) = markdown::to_mdast(protected_source.as_ref(), &options) {
            protect(
                &serde_json::to_value(tree).expect("serializable markdown"),
                source,
                &mut protected,
            );
        }
        protected.sort_unstable_by_key(|span| span.start_byte);
        let mut protected_index = 0;
        let mut closers = source
            .match_indices("-->")
            .map(|(index, _)| index)
            .peekable();
        let mut index = 0;
        while index < source.len() {
            while protected
                .get(protected_index)
                .is_some_and(|span| span.end_byte as usize <= index)
            {
                protected_index += 1;
            }
            if let Some(span) = protected.get(protected_index)
                && span.start_byte as usize <= index
            {
                index = span.end_byte as usize;
                continue;
            }
            let rest = &source[index..];
            if rest.starts_with('\\') {
                index += 1 + rest.chars().nth(1).map_or(0, char::len_utf8);
                continue;
            }
            // These MDI parameters are explicitly plain text, even when
            // markdown-rs would split them into HTML or emphasis tokens.
            if let Some((_, consumed)) = crate::ruby(rest).or_else(|| crate::boten(rest)) {
                index += consumed;
                continue;
            }
            if rest.starts_with("<!--") {
                while closers.peek().is_some_and(|end| *end < index + 4) {
                    closers.next();
                }
                if let Some(end) = closers.next() {
                    result.spans.push(SourceSpan {
                        start_byte: index as u32,
                        end_byte: (end + 3) as u32,
                    });
                    index = end + 3;
                    continue;
                }
                result.diagnostics.push(Diagnostic {
                    severity: DiagnosticSeverity::Warning,
                    code: "mdi.comment.unterminated".into(),
                    message: "Unterminated comment remains literal text and may appear in exports."
                        .into(),
                    span: Some(SourceSpan {
                        start_byte: index as u32,
                        end_byte: (index + 4) as u32,
                    }),
                });
                index += 4;
                continue;
            }
            index += rest.chars().next().expect("in bounds").len_utf8();
        }
        result
    }

    pub fn literal_document(&self, masked: &str, source: &str) -> crate::Document {
        let mut document = crate::literal_fallback_document(masked);
        let mut root = json!({"children": document.children});
        self.restore(&mut root, source);
        document.children = root["children"].as_array().expect("root children").clone();
        document
    }

    /// Neutral placeholders keep byte offsets stable while preventing comment
    /// payloads from participating in either Markdown or MDI delimiters.
    pub fn mask<'a>(&self, source: &'a str) -> std::borrow::Cow<'a, str> {
        if self.spans.is_empty() {
            return std::borrow::Cow::Borrowed(source);
        }
        let mut bytes = source.as_bytes().to_vec();
        for span in &self.spans {
            bytes[span.start_byte as usize..span.end_byte as usize].fill(b'x');
        }
        std::borrow::Cow::Owned(String::from_utf8(bytes).expect("whole UTF-8 ranges were replaced"))
    }

    pub fn restore(&self, node: &mut Value, source: &str) {
        if self.spans.is_empty() {
            return;
        }
        if let Some(children) = node.get_mut("children").and_then(Value::as_array_mut) {
            let mut output = Vec::new();
            for mut child in children.drain(..) {
                self.restore(&mut child, source);
                if child["type"] == "text" || child["type"] == "html" {
                    let kind = child["type"].clone();
                    let start = child["span"]["startByte"].as_u64().unwrap_or(0) as usize;
                    let end = child["span"]["endByte"].as_u64().unwrap_or(0) as usize;
                    let first = self
                        .spans
                        .partition_point(|span| span.end_byte as usize <= start);
                    let spans = self.spans[first..]
                        .iter()
                        .take_while(|span| (span.start_byte as usize) < end)
                        .collect::<Vec<_>>();
                    if !spans.is_empty() {
                        let value = child["value"].as_str().unwrap_or_default();
                        let masked = &self.mask_fragment(source, start, end);
                        // Markdown decoding can remove escapes/entities before
                        // a placeholder. Locate the placeholder by its raw run
                        // and use decoded offsets for surrounding text.
                        let mut raw_cursor = 0;
                        let mut value_cursor = 0;
                        for span in spans {
                            let relative = span.start_byte as usize - start;
                            let len = (span.end_byte - span.start_byte) as usize;
                            let prefix = &masked[raw_cursor..relative];
                            let decoded_prefix = if kind == "html" {
                                prefix.to_owned()
                            } else {
                                decode_text(prefix)
                            };
                            let split = value_cursor + decoded_prefix.len();
                            if split > value.len() || split + len > value.len() {
                                continue;
                            }
                            if split > value_cursor {
                                output.push(json!({"type":kind, "value": &value[value_cursor..split], "span": {"startByte":start + raw_cursor,"endByte":span.start_byte}}));
                            }
                            output.push(json!({"type":"comment", "value": &source[span.start_byte as usize + 4..span.end_byte as usize - 3], "span":span}));
                            value_cursor = split + len;
                            raw_cursor = span.end_byte as usize - start;
                        }
                        if value_cursor < value.len() {
                            output.push(json!({"type":kind, "value": &value[value_cursor..], "span":{"startByte":start + raw_cursor,"endByte":end}}));
                        }
                        continue;
                    }
                }
                if child["type"] == "paragraph" {
                    split_block_comments(child, source, &mut output);
                } else {
                    output.push(child);
                }
            }
            *children = output;
        }
    }

    fn mask_fragment(&self, source: &str, start: usize, end: usize) -> String {
        let mut bytes = source.as_bytes()[start..end].to_vec();
        let first = self
            .spans
            .partition_point(|span| span.end_byte as usize <= start);
        for span in self.spans[first..]
            .iter()
            .take_while(|span| (span.start_byte as usize) < end)
        {
            bytes[span.start_byte as usize - start..span.end_byte as usize - start].fill(b'x');
        }
        String::from_utf8(bytes).expect("masked UTF-8")
    }
}

fn decode_text(source: &str) -> String {
    if source.is_empty() {
        return String::new();
    }
    // Decode in an inline context, preserving leading/trailing whitespace.
    let wrapped = format!("x{source}x");
    let tree = markdown::to_mdast(&wrapped, &crate::markdown_options()).expect("inline markdown");
    let value = serde_json::to_value(tree).expect("serializable markdown");
    let text = value["children"][0]["children"]
        .as_array()
        .map(|nodes| {
            nodes
                .iter()
                .filter_map(|node| node["value"].as_str())
                .collect::<String>()
        })
        .unwrap_or_default();
    text.get(1..text.len().saturating_sub(1))
        .unwrap_or(source)
        .to_owned()
}

fn protect(node: &Value, source: &str, spans: &mut Vec<SourceSpan>) {
    let kind = node["type"].as_str().unwrap_or_default();
    if matches!(
        kind,
        "code" | "inlineCode" | "yaml" | "definition" | "image"
    ) {
        if let Some(span) = crate::span_from_position(&node["position"], source) {
            spans.push(span);
        }
        return;
    }
    if let Some(children) = node["children"].as_array() {
        for child in children {
            protect(child, source, spans);
        }
        if kind == "link" {
            if let (Some(span), Some(last)) = (
                crate::span_from_position(&node["position"], source),
                children
                    .last()
                    .and_then(|child| crate::span_from_position(&child["position"], source)),
            ) {
                spans.push(SourceSpan {
                    start_byte: last.end_byte,
                    end_byte: span.end_byte,
                });
            }
        }
    }
}

pub(crate) fn filter_nodes(nodes: &mut Vec<Value>) {
    let removed_comments = nodes.iter().any(|node| node["type"] == "comment");
    nodes.retain(|node| node["type"] != "comment");
    for node in nodes.iter_mut() {
        if let Some(children) = node.get_mut("children").and_then(Value::as_array_mut) {
            filter_nodes(children);
        }
    }
    if !removed_comments {
        return;
    }
    let mut merged: Vec<Value> = Vec::with_capacity(nodes.len());
    for node in nodes.drain(..) {
        if node["type"] == "text"
            && let Some(previous) = merged.last_mut()
            && previous["type"] == "text"
        {
            previous["value"] = json!(format!(
                "{}{}",
                previous["value"].as_str().unwrap_or_default(),
                node["value"].as_str().unwrap_or_default()
            ));
            previous["span"]["endByte"] = node["span"]["endByte"].clone();
            if let Some(targets) = previous
                .pointer_mut("/mdiProvenance/targets")
                .and_then(Value::as_array_mut)
                && let Some(next) = node
                    .pointer("/mdiProvenance/targets")
                    .and_then(Value::as_array)
            {
                targets.extend(next.iter().cloned());
            }
        } else {
            merged.push(node);
        }
    }
    *nodes = merged;
}

fn is_block_comment(node: &Value, source: &str) -> bool {
    if node["type"] != "comment" {
        return false;
    }
    let start = node["span"]["startByte"].as_u64().unwrap_or(0) as usize;
    let end = node["span"]["endByte"].as_u64().unwrap_or(0) as usize;
    let before = source[..start].rsplit('\n').next().unwrap_or_default();
    let after = source[end..].split('\n').next().unwrap_or_default();
    before.trim_matches([' ', '\t', '>']).is_empty() && after.trim().is_empty()
}

fn split_block_comments(mut paragraph: Value, source: &str, output: &mut Vec<Value>) {
    let Some(children) = paragraph.get_mut("children").and_then(Value::as_array_mut) else {
        output.push(paragraph);
        return;
    };
    let only_comments = children.iter().all(|node| node["type"] == "comment");
    if !only_comments && !children.iter().any(|node| is_block_comment(node, source)) {
        output.push(paragraph);
        return;
    }
    let nodes = std::mem::take(children);
    let mut pending = Vec::new();
    for mut child in nodes {
        if child["type"] == "comment" && (only_comments || is_block_comment(&child, source)) {
            flush_paragraph(&paragraph, &mut pending, output);
            output.push(child);
        } else {
            if pending.is_empty() && child["type"] == "text" {
                let text = child["value"].as_str().unwrap_or_default();
                let trimmed = text.trim_start_matches(['\n', '\r']);
                let removed = text.len() - trimmed.len();
                let value = trimmed.to_owned();
                child["span"]["startByte"] =
                    json!(child["span"]["startByte"].as_u64().unwrap_or(0) + removed as u64);
                child["value"] = json!(value);
            }
            pending.push(child);
        }
    }
    flush_paragraph(&paragraph, &mut pending, output);
}

fn flush_paragraph(template: &Value, pending: &mut Vec<Value>, output: &mut Vec<Value>) {
    if let Some(last) = pending.last_mut()
        && last["type"] == "text"
    {
        let text = last["value"].as_str().unwrap_or_default();
        let trimmed = text.trim_end_matches(['\n', '\r']);
        let removed = text.len() - trimmed.len();
        let value = trimmed.to_owned();
        last["span"]["endByte"] =
            json!(last["span"]["endByte"].as_u64().unwrap_or(0) - removed as u64);
        last["value"] = json!(value);
    }
    pending.retain(|node| !(node["type"] == "text" && node["value"] == ""));
    if pending.is_empty() {
        return;
    }
    let mut paragraph = template.clone();
    paragraph["span"]["startByte"] = pending.first().unwrap()["span"]["startByte"].clone();
    paragraph["span"]["endByte"] = pending.last().unwrap()["span"]["endByte"].clone();
    paragraph["children"] = json!(std::mem::take(pending));
    output.push(paragraph);
}
