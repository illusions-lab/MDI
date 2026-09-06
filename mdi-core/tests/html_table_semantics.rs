#[test]
fn gfm_header_cells_keep_accessible_html_semantics() {
    let html = mdi_core::render_html("| 列A | 列B |\n| --- | --- |\n| 表一 | 表二 |");
    assert_eq!(html.matches("<th scope=\"col\">").count(), 2, "{html}");
    assert_eq!(html.matches("<td>").count(), 2, "{html}");
    assert!(html.contains("<thead><tr><th scope=\"col\">列A</th>"));
    assert!(html.contains("<tbody><tr><td>表一</td>"));
}
