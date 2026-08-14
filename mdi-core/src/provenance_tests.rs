use super::{parse_document_for_mdast, parse_document_without_provenance, parse_mdast_json};
use crate::text_projection::{
    get_mdi_text_blocks, provenance_query_visits, reset_provenance_query_visits,
};
use serde_json::{Value, json};
use std::hint::black_box;
use std::time::{Duration, Instant};
use unicode_segmentation::UnicodeSegmentation;

#[derive(Clone, Copy)]
struct Selector {
    node_type: &'static str,
    value_field: Option<(&'static str, &'static str)>,
    occurrence: usize,
}

impl Selector {
    const fn first(node_type: &'static str) -> Self {
        Self {
            node_type,
            value_field: None,
            occurrence: 0,
        }
    }

    const fn value(node_type: &'static str, field: &'static str, value: &'static str) -> Self {
        Self {
            node_type,
            value_field: Some((field, value)),
            occurrence: 0,
        }
    }

    const fn nth(node_type: &'static str, occurrence: usize) -> Self {
        Self {
            node_type,
            value_field: None,
            occurrence,
        }
    }
}

struct AcceptanceCase {
    name: &'static str,
    source: &'static str,
    selector: Selector,
    role: &'static str,
    status: &'static str,
    targets: Value,
}

fn matching_nodes<'a>(value: &'a Value, selector: Selector, matches: &mut Vec<&'a Value>) {
    if value.get("type").and_then(Value::as_str) == Some(selector.node_type)
        && selector.value_field.is_none_or(|(field, expected)| {
            value.get(field).and_then(Value::as_str) == Some(expected)
        })
    {
        matches.push(value);
    }
    if let Some(children) = value.get("children").and_then(Value::as_array) {
        for child in children {
            matching_nodes(child, selector, matches);
        }
    }
}

fn selected_node(document: &super::Document, selector: Selector) -> &Value {
    let mut matches = Vec::new();
    for child in &document.children {
        matching_nodes(child, selector, &mut matches);
    }
    matches
        .get(selector.occurrence)
        .copied()
        .unwrap_or_else(|| {
            panic!(
                "missing occurrence {} of node type {:?}",
                selector.occurrence, selector.node_type
            )
        })
}

fn block_target(block: u32, start: u32, end: u32) -> Value {
    json!({
        "blockIndex": block,
        "channel": "blockText",
        "range": {"start": format!("{block}:{start}"), "end": format!("{block}:{end}")},
    })
}

fn annotation_target(block: u32, annotation: u32, start: u32, end: u32) -> Value {
    json!({
        "blockIndex": block,
        "channel": "annotation",
        "annotationIndex": annotation,
        "range": {"start": format!("{block}:{start}"), "end": format!("{block}:{end}")},
    })
}

#[test]
fn provenance_acceptance_matrix_has_exact_roles_statuses_and_targets() {
    let cases = vec![
        AcceptanceCase {
            name: "nested list container",
            source: "- outer\n  - inner\n",
            selector: Selector::nth("listItem", 1),
            role: "container",
            status: "sourceBacked",
            targets: json!([]),
        },
        AcceptanceCase {
            name: "nested list text",
            source: "- outer\n  - inner\n",
            selector: Selector::value("text", "value", "inner"),
            role: "textBearing",
            status: "sourceBacked",
            targets: json!([block_target(2, 1, 6)]),
        },
        AcceptanceCase {
            name: "blockquote container",
            source: "> quote\n",
            selector: Selector::first("blockquote"),
            role: "container",
            status: "sourceBacked",
            targets: json!([]),
        },
        AcceptanceCase {
            name: "blockquote text",
            source: "> quote\n",
            selector: Selector::value("text", "value", "quote"),
            role: "textBearing",
            status: "sourceBacked",
            targets: json!([block_target(1, 1, 6)]),
        },
        AcceptanceCase {
            name: "table cell container",
            source: "| a | b |\n| - | - |\n| c | d |\n",
            selector: Selector::nth("tableCell", 3),
            role: "container",
            status: "sourceBacked",
            targets: json!([]),
        },
        AcceptanceCase {
            name: "table cell text",
            source: "| a | b |\n| - | - |\n| c | d |\n",
            selector: Selector::value("text", "value", "d"),
            role: "textBearing",
            status: "sourceBacked",
            targets: json!([block_target(1, 7, 8)]),
        },
        AcceptanceCase {
            name: "ruby base and reading",
            source: "{東京|とうきょう}",
            selector: Selector::first("ruby"),
            role: "textBearing",
            status: "sourceBacked",
            targets: json!([block_target(1, 1, 3), annotation_target(1, 0, 1, 6),]),
        },
        AcceptanceCase {
            name: "html",
            source: "<i>x</i>\n",
            selector: Selector::first("html"),
            role: "textBearing",
            status: "sourceBacked",
            targets: json!([block_target(1, 1, 4)]),
        },
        AcceptanceCase {
            name: "blank",
            source: "\\\n",
            selector: Selector::first("blank"),
            role: "container",
            status: "sourceBacked",
            targets: json!([]),
        },
        AcceptanceCase {
            name: "pagebreak",
            source: "[[pagebreak:right]]\n",
            selector: Selector::first("pagebreak"),
            role: "container",
            status: "sourceBacked",
            targets: json!([]),
        },
        AcceptanceCase {
            name: "indent paragraph",
            source: "[[indent:2]]\nindented\n",
            selector: Selector::first("paragraph"),
            role: "container",
            status: "sourceBacked",
            targets: json!([]),
        },
        AcceptanceCase {
            name: "bottom paragraph",
            source: "[[bottom:3]]\nbottom\n",
            selector: Selector::first("paragraph"),
            role: "container",
            status: "sourceBacked",
            targets: json!([]),
        },
        AcceptanceCase {
            name: "explicit break",
            source: "a[[br]]b\n",
            selector: Selector::first("break"),
            role: "textBearing",
            status: "sourceBacked",
            targets: json!([block_target(1, 2, 3)]),
        },
        AcceptanceCase {
            name: "image alt text",
            source: "![alt](image.png)\n",
            selector: Selector::value("image", "alt", "alt"),
            role: "textBearing",
            status: "sourceBacked",
            targets: json!([block_target(1, 1, 4)]),
        },
        AcceptanceCase {
            name: "empty image alt",
            source: "![](image.png)\n",
            selector: Selector::value("image", "alt", ""),
            role: "textBearing",
            status: "unmapped",
            targets: json!([]),
        },
        AcceptanceCase {
            name: "malformed literal fallback",
            source: "[[em:open\n",
            selector: Selector::value("text", "value", "[[em:open"),
            role: "textBearing",
            status: "sourceBacked",
            targets: json!([block_target(1, 1, 10)]),
        },
    ];

    for case in cases {
        let document = parse_document_for_mdast(case.source);
        let node = selected_node(&document, case.selector);
        let provenance = node
            .get("mdiProvenance")
            .unwrap_or_else(|| panic!("{}: selected node lacks provenance: {node:#}", case.name));
        assert_eq!(
            provenance["construct"]["type"], case.selector.node_type,
            "{}: construct type",
            case.name
        );
        assert_eq!(provenance["role"], case.role, "{}: role", case.name);
        assert_eq!(provenance["status"], case.status, "{}: status", case.name);
        assert_eq!(
            provenance["targets"], case.targets,
            "{}: targets",
            case.name
        );
        assert!(
            provenance["construct"]["path"].as_str().is_some(),
            "{}: parse-local path",
            case.name
        );
    }
}

#[test]
fn frontmatter_provenance_is_rust_owned_and_has_no_projection_targets() {
    let output: Value = serde_json::from_str(&parse_mdast_json("---\ntitle: Test\n---\n\nbody\n"))
        .expect("mdast envelope");
    let provenance = &output["document"]["frontmatter"]["mdiProvenance"];
    assert_eq!(
        provenance["construct"],
        json!({"path": "frontmatter", "type": "yaml"})
    );
    assert_eq!(provenance["role"], "container");
    assert_eq!(provenance["status"], "sourceBacked");
    assert_eq!(provenance["span"], json!({"startByte": 0, "endByte": 19}));
    assert_eq!(provenance["targets"], json!([]));
}

fn repeated_projection_source(paragraphs: usize) -> String {
    let mut source = String::with_capacity(paragraphs * 32);
    for index in 0..paragraphs {
        source.push_str(&format!("unit-{index} {{東|とう}} ![a](x)\n\n"));
    }
    source
}

fn projection_unit_count(source: &str) -> usize {
    let projection = get_mdi_text_blocks(source);
    projection
        .blocks
        .iter()
        .map(|block| {
            block.text.graphemes(true).count()
                + block
                    .annotations
                    .iter()
                    .map(|annotation| annotation.text.graphemes(true).count())
                    .sum::<usize>()
        })
        .sum()
}

#[test]
fn provenance_interval_queries_visit_only_a_linear_number_of_candidates() {
    fn measured(paragraphs: usize) -> (usize, usize) {
        let source = repeated_projection_source(paragraphs);
        let units = projection_unit_count(&source);
        reset_provenance_query_visits();
        black_box(parse_document_for_mdast(black_box(&source)));
        (units, provenance_query_visits())
    }

    let (small_units, small_visits) = measured(200);
    let (large_units, large_visits) = measured(400);
    assert!(
        small_visits > 0,
        "query instrumentation did not record visits"
    );
    assert!(
        small_visits <= small_units * 4,
        "candidate visits must be bounded by projection units and actual matches: visits={small_visits}, units={small_units}"
    );
    assert!(
        large_visits <= large_units * 4,
        "candidate visits must be bounded by projection units and actual matches: visits={large_visits}, units={large_units}"
    );
    assert!(
        large_visits <= small_visits * 3,
        "doubling the tree approached quadratic candidate scanning: {small_visits} -> {large_visits}"
    );
}

fn bounded_nested_list(items: usize) -> String {
    let mut source = String::with_capacity(items * 32);
    for index in 0..items {
        let depth = index % 4;
        source.push_str(&"  ".repeat(depth));
        source.push_str("- item ");
        source.push_str(&index.to_string());
        source.push_str(" {東|とう}\n");
    }
    source
}

fn median_duration(mut samples: Vec<Duration>) -> Duration {
    samples.sort_unstable();
    samples[samples.len() / 2]
}

#[test]
#[ignore = "release-only provenance scaling benchmark"]
fn release_nested_list_scaling_is_not_near_quadratic() {
    let mut normal = Vec::new();
    let mut mdast = Vec::new();
    let mut projection = Vec::new();
    for size in [800, 1600, 3200] {
        let source = bounded_nested_list(size);
        let measure = |operation: &mut dyn FnMut()| {
            median_duration(
                (0..3)
                    .map(|_| {
                        let started = Instant::now();
                        operation();
                        started.elapsed()
                    })
                    .collect(),
            )
        };
        let normal_elapsed = measure(&mut || {
            black_box(parse_document_without_provenance(black_box(&source)));
        });
        let mdast_elapsed = measure(&mut || {
            black_box(parse_document_for_mdast(black_box(&source)));
        });
        let projection_elapsed = measure(&mut || {
            black_box(get_mdi_text_blocks(black_box(&source)));
        });
        eprintln!(
            "nested-list {size}: normal={normal_elapsed:?} mdast={mdast_elapsed:?} projection={projection_elapsed:?}"
        );
        normal.push(normal_elapsed);
        mdast.push(mdast_elapsed);
        projection.push(projection_elapsed);
    }

    for (label, timings) in [
        ("normal parse", normal),
        ("mdast parse", mdast),
        ("projection", projection),
    ] {
        for pair in timings.windows(2) {
            // A true quadratic doubling is approximately 4x. Allow ordinary
            // runner noise, but fail well before that shape is reached.
            let allowed = pair[0].mul_f64(3.25) + Duration::from_millis(10);
            assert!(
                pair[1] <= allowed,
                "{label} approached quadratic growth: {:?} -> {:?} (limit {:?})",
                pair[0],
                pair[1],
                allowed
            );
        }
    }
}
