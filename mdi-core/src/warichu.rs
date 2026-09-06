//! Presentation-only warichu layout. Never write the generated splits into IR.
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use unicode_segmentation::UnicodeSegmentation;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WarichuOptions {
    pub first_capacity: usize,
    #[serde(alias = "capacity")]
    pub continuation_capacity: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WarichuSource {
    pub path: Vec<usize>,
    pub start_utf8: usize,
    pub end_utf8: usize,
    pub group: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WarichuFragment {
    pub lines: [Vec<Value>; 2],
    pub sources: [Vec<WarichuSource>; 2],
    pub html: [String; 2],
    /// Widths in half-em units at the note's font size.
    pub widths: [usize; 2],
    pub overflow: bool,
    pub hard_break_after: bool,
}

struct Unit {
    nodes: Vec<Value>,
    sources: Vec<WarichuSource>,
    is_text: bool,
    text: String,
    width: usize,
    hard_break: bool,
}

fn visible(node: &Value) -> String {
    match node["type"].as_str().unwrap_or_default() {
        "ruby" => node["base"].as_str().unwrap_or_default().to_owned(),
        "image" => node["alt"].as_str().unwrap_or_default().to_owned(),
        _ => node["value"]
            .as_str()
            .map(str::to_owned)
            .unwrap_or_else(|| crate::children(node).iter().map(visible).collect()),
    }
}

fn weight(text: &str) -> usize {
    text.graphemes(true)
        .map(|g| {
            if g.chars()
                .all(|c| c.is_ascii() || ('\u{ff61}'..='\u{ff9f}').contains(&c))
            {
                1
            } else {
                2
            }
        })
        .sum()
}

fn units(nodes: &[Value], wrappers: &[Value], path: &[usize], out: &mut Vec<Unit>) {
    for (index, node) in nodes.iter().enumerate() {
        let mut path = path.to_vec();
        path.push(index);
        let kind = node["type"].as_str().unwrap_or_default();
        if matches!(
            kind,
            "strong" | "emphasis" | "delete" | "em" | "kern" | "link"
        ) {
            let mut parents = wrappers.to_vec();
            parents.push(node.clone());
            units(crate::children(node), &parents, &path, out);
            continue;
        }
        let parts = if kind == "text" {
            node["value"]
                .as_str()
                .unwrap_or_default()
                .chars()
                .map(|g| json!({"type":"text", "value":g.to_string()}))
                .collect::<Vec<_>>()
        } else {
            vec![node.clone()]
        };
        let mut offset = 0;
        for mut part in parts {
            let text = visible(&part);
            let width = weight(&text);
            for wrapper in wrappers.iter().rev() {
                let mut parent = wrapper.clone();
                parent["children"] = json!([part]);
                part = parent;
            }
            out.push(Unit {
                nodes: vec![part],
                sources: vec![WarichuSource {
                    path: path.clone(),
                    start_utf8: offset,
                    end_utf8: offset + text.len(),
                    group: 0,
                }],
                is_text: kind == "text",
                text: text.clone(),
                width,
                hard_break: kind == "break",
            });
            offset += text.len();
        }
    }
}

// Segment the complete adjacent text run, so formatting cannot split a cluster.
fn join_graphemes(input: Vec<Unit>) -> Vec<Unit> {
    let mut result: Vec<Unit> = Vec::new();
    let mut input = input.into_iter().peekable();
    while let Some(unit) = input.next() {
        if !unit.is_text {
            result.push(unit);
            continue;
        }
        let mut run = vec![unit];
        while input.peek().is_some_and(|unit| unit.is_text) {
            run.push(input.next().unwrap());
        }
        let text: String = run.iter().map(|unit| unit.text.as_str()).collect();
        let mut boundaries = text
            .grapheme_indices(true)
            .map(|(offset, _)| offset)
            .peekable();
        let mut offset = 0;
        for unit in run {
            if boundaries.peek() == Some(&offset) {
                boundaries.next();
                result.push(unit);
            } else {
                let previous = result.last_mut().unwrap();
                previous.text.push_str(&unit.text);
                previous.nodes.extend(unit.nodes);
                previous.sources.extend(unit.sources);
            }
            offset += result
                .last()
                .unwrap()
                .text
                .chars()
                .last()
                .unwrap()
                .len_utf8();
        }
    }
    for (group, unit) in result.iter_mut().enumerate() {
        unit.width = weight(&unit.text);
        for source in &mut unit.sources {
            source.group = group;
        }
    }
    result
}

// Conservative Japanese line-head / line-end prohibition, including small kana.
fn legal(left: &Unit, right: &Unit) -> bool {
    let opening = "（〔［｛〈《「『【([{‘“";
    let closing = "、。，．・：；？！ー々ゝゞヽヾ）〕］｝〉》」』】)]},.!?:;’”ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ";
    !left
        .text
        .chars()
        .last()
        .is_some_and(|c| opening.contains(c))
        && !right
            .text
            .chars()
            .next()
            .is_some_and(|c| closing.contains(c))
}

fn emit_run(run: &[Unit], options: &WarichuOptions, out: &mut Vec<WarichuFragment>) {
    let mut start = 0;
    while start < run.len() {
        let capacity = if out.is_empty() {
            options.first_capacity
        } else {
            options.continuation_capacity
        }
        .max(1);
        let mut end = start;
        let mut total = 0;
        while end < run.len()
            && (total + run[end].width <= capacity.saturating_mul(2) || end == start)
        {
            total += run[end].width;
            end += 1;
        }
        // Move an illegal fragment boundary backwards, or forwards if there is
        // no legal boundary within capacity. Text always wins over clipping.
        let target = end;
        while end > start && end < run.len() && !legal(&run[end - 1], &run[end]) {
            end -= 1;
        }
        if end == start {
            end = target;
            while end < run.len() && !legal(&run[end - 1], &run[end]) {
                end += 1;
            }
        }
        total = run[start..end].iter().map(|u| u.width).sum();
        let mut first = 0;
        let mut best = None;
        for split in start + 1..end {
            first += run[split - 1].width;
            if !legal(&run[split - 1], &run[split]) {
                continue;
            }
            let second = total - first;
            let score = (
                first.max(second) > capacity,
                first.abs_diff(second),
                first < second,
            );
            if best.as_ref().is_none_or(|(old, _, _)| score < *old) {
                best = Some((score, split, first));
            }
        }
        let (_, split, first) = best.unwrap_or(((true, total, false), end, total));
        let second = total - first;
        out.push(WarichuFragment {
            lines: [
                run[start..split]
                    .iter()
                    .flat_map(|u| u.nodes.clone())
                    .collect(),
                run[split..end]
                    .iter()
                    .flat_map(|u| u.nodes.clone())
                    .collect(),
            ],
            sources: [
                run[start..split]
                    .iter()
                    .flat_map(|u| u.sources.clone())
                    .collect(),
                run[split..end]
                    .iter()
                    .flat_map(|u| u.sources.clone())
                    .collect(),
            ],
            html: [
                render_units(&run[start..split]),
                render_units(&run[split..end]),
            ],
            widths: [first, second],
            overflow: first.max(second) > capacity,
            hard_break_after: false,
        });
        start = end;
    }
}

/// Split already parsed inline children; capacity is half-em units at 50% type.
/// Ruby, tcy, no-break, and unknown inline containers remain indivisible.
/// An unavailable browser measurement can use 40 (20 note em) as a fallback.
pub fn layout_warichu(nodes: &[Value], capacity: usize) -> Vec<WarichuFragment> {
    layout_warichu_with_options(
        nodes,
        &WarichuOptions {
            first_capacity: capacity,
            continuation_capacity: capacity,
        },
    )
}

pub fn layout_warichu_with_options(
    nodes: &[Value],
    options: &WarichuOptions,
) -> Vec<WarichuFragment> {
    let mut input = Vec::new();
    units(nodes, &[], &[], &mut input);
    let input = join_graphemes(input);
    let mut out = Vec::new();
    let mut start = 0;
    for (index, unit) in input.iter().enumerate() {
        if unit.hard_break {
            let before = out.len();
            emit_run(&input[start..index], options, &mut out);
            if out.len() == before {
                out.push(WarichuFragment {
                    lines: [vec![], vec![]],
                    sources: [vec![], vec![]],
                    html: [String::new(), String::new()],
                    widths: [0, 0],
                    overflow: false,
                    hard_break_after: true,
                });
            } else {
                out.last_mut().unwrap().hard_break_after = true;
            }
            start = index + 1;
        }
    }
    emit_run(&input[start..], options, &mut out);
    out
}

fn render_units(units: &[Unit]) -> String {
    let mut out = String::new();
    for unit in units {
        for node in &unit.nodes {
            crate::render_html_node(node, &mut out);
        }
    }
    // Nested notes already live at note size. Normalize only the renderer's
    // generated outer span; escaped author text cannot match this markup.
    out.replace(
        "<span class=\"mdi-warichu\" style=\"font-size:.5em;line-height:1\"",
        "<span class=\"mdi-warichu\" style=\"font-size:1em;line-height:1\"",
    )
}

pub fn layout_warichu_options_json(nodes: &str, options: &str) -> Result<String, String> {
    let nodes: Vec<Value> = serde_json::from_str(nodes).map_err(|e| e.to_string())?;
    let options: WarichuOptions = serde_json::from_str(options).map_err(|e| e.to_string())?;
    serde_json::to_string(&layout_warichu_with_options(&nodes, &options)).map_err(|e| e.to_string())
}

pub(crate) fn render(nodes: &[Value], out: &mut String) {
    out.push_str("<span class=\"mdi-warichu\" style=\"font-size:.5em;line-height:1\" data-mdi-warichu-source=\"");
    let source = serde_json::to_string(nodes).unwrap();
    out.push_str(
        &source
            .replace('&', "&amp;")
            .replace('"', "&quot;")
            .replace('<', "&lt;")
            .replace('>', "&gt;"),
    );
    out.push_str("\">");
    for fragment in layout_warichu(nodes, 40) {
        out.push_str("<span class=\"mdi-warichu-fragment\" style=\"display:inline-flex;flex-direction:column;vertical-align:middle;text-align:start\"");
        if fragment.overflow {
            out.push_str(" data-mdi-overflow=\"indivisible\"");
        }
        out.push('>');
        for line in fragment.html {
            out.push_str("<span class=\"mdi-warichu-line\" style=\"display:block;white-space:nowrap;min-block-size:1em\">");
            out.push_str(&line);
            out.push_str("</span>");
        }
        out.push_str("</span>");
        if fragment.hard_break_after {
            out.push_str("<br>");
        }
    }
    out.push_str("</span>");
}
