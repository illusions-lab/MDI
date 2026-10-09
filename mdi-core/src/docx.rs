use crate::image_assets::{PreparedImages, emu};
use crate::{Document, ResolvedExportProfile, children, escape_xml, page_dimensions};
use serde_json::Value;
use std::collections::HashMap;
use std::io::{Seek, Write};
use zip::{CompressionMethod, ZipWriter, write::SimpleFileOptions};

const WORD_NS: &str = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const REL_NS: &str = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

pub(crate) fn write<W: Write + Seek>(
    document: &Document,
    profile: &ResolvedExportProfile,
    zip: &mut ZipWriter<W>,
    images: Option<&PreparedImages>,
) -> Result<(), String> {
    let (natural_width, natural_height) = page_dimensions(&profile.pagination.page_size)
        .ok_or_else(|| format!("Unsupported page size: {}", profile.pagination.page_size))?;
    let (width_mm, height_mm) = if profile.pagination.landscape {
        (natural_height, natural_width)
    } else {
        (natural_width, natural_height)
    };
    assert_page_size(&profile.pagination.page_size, width_mm, height_mm)?;

    let definitions = document
        .children
        .iter()
        .filter(|node| node.get("type").and_then(Value::as_str) == Some("footnoteDefinition"))
        .collect::<Vec<_>>();
    let footnote_ids = definitions
        .iter()
        .enumerate()
        .filter_map(|(index, definition)| {
            definition
                .get("identifier")
                .and_then(Value::as_str)
                .map(|identifier| (identifier.to_owned(), index + 1))
        })
        .collect::<HashMap<_, _>>();
    let mut context = Context {
        footnote_ids,
        hyperlinks: Vec::new(),
        next_warichu_id: 0,
        images,
        in_footnote: false,
        document_images: Vec::new(),
        footnote_images: Vec::new(),
        next_doc_pr: 1,
    };
    let content = document
        .children
        .iter()
        .filter(|node| node.get("type").and_then(Value::as_str) != Some("footnoteDefinition"))
        .map(|node| block_xml(node, profile, &mut context))
        .collect::<String>();

    let body_font_half_points = (profile.typesetting.font_size * 2.0).round() as i64;
    let line_twips = line_spacing_twips(profile, width_mm, height_mm);
    let primary = if profile.typesetting.writing_mode == "vertical" {
        height_mm - profile.pagination.margins.top - profile.pagination.margins.bottom
    } else {
        width_mm - profile.pagination.margins.left - profile.pagination.margins.right
    };
    let character_pitch_points = primary / profile.pagination.characters_per_line / 25.4 * 72.0;
    let character_space = ((character_pitch_points - profile.typesetting.font_size) * 4096.0)
        .round()
        .max(0.0) as i64;
    let font = docx_font_family(&profile.typesetting.font_family)?;

    let page_number_part = page_number_part(profile, body_font_half_points);
    let mut relationship_id = context.hyperlinks.len() + 1;
    let header_relationship = page_number_part
        .as_ref()
        .filter(|part| part.header)
        .map(|_| {
            let id = format!("rId{relationship_id}");
            relationship_id += 1;
            id
        });
    let footer_relationship = page_number_part
        .as_ref()
        .filter(|part| !part.header)
        .map(|_| {
            let id = format!("rId{relationship_id}");
            relationship_id += 1;
            id
        });
    let styles_relationship = format!("rId{relationship_id}");
    relationship_id += 1;
    let settings_relationship = format!("rId{relationship_id}");
    relationship_id += 1;
    let footnotes_relationship = if definitions.is_empty() {
        None
    } else {
        Some(format!("rId{relationship_id}"))
    };

    let mut section = String::new();
    if let Some(id) = &header_relationship {
        section.push_str(&format!(
            "<w:headerReference w:type=\"default\" r:id=\"{}\"/>",
            escape_xml(id)
        ));
    }
    if let Some(id) = &footer_relationship {
        section.push_str(&format!(
            "<w:footerReference w:type=\"default\" r:id=\"{}\"/>",
            escape_xml(id)
        ));
    }
    section.push_str(&format!(
        "<w:pgSz w:w=\"{}\" w:h=\"{}\"/><w:pgMar w:top=\"{}\" w:right=\"{}\" w:bottom=\"{}\" w:left=\"{}\" w:header=\"720\" w:footer=\"720\" w:gutter=\"0\"/>",
        mm_to_twips(width_mm),
        mm_to_twips(height_mm),
        mm_to_twips(profile.pagination.margins.top),
        mm_to_twips(profile.pagination.margins.right),
        mm_to_twips(profile.pagination.margins.bottom),
        mm_to_twips(profile.pagination.margins.left),
    ));
    if profile.pagination.page_numbers.enabled {
        section.push_str("<w:pgNumType w:start=\"1\"/>");
    }
    if profile.typesetting.writing_mode == "vertical" {
        section.push_str("<w:textDirection w:val=\"tbRl\"/>");
    }
    if profile.pagination.grid_mode == "strict" {
        section.push_str(&format!(
            "<w:docGrid w:type=\"linesAndChars\"{} w:linePitch=\"{line_twips}\"/>",
            if character_space == 0 {
                String::new()
            } else {
                format!(" w:charSpace=\"{character_space}\"")
            }
        ));
    }

    let drawing_ns = if images.is_some_and(|images| !images.is_empty()) {
        " xmlns:wp=\"http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing\" xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\" xmlns:pic=\"http://schemas.openxmlformats.org/drawingml/2006/picture\""
    } else {
        ""
    };
    let document_xml = format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><w:document xmlns:w=\"{WORD_NS}\" xmlns:r=\"{REL_NS}\"{drawing_ns}><w:body>{content}<w:sectPr>{section}</w:sectPr></w:body></w:document>"
    );
    let styles_xml = styles_xml(profile, &font, body_font_half_points, line_twips);
    let settings_xml = if profile.layout.margin_mode == "mirror" {
        format!(
            "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><w:settings xmlns:w=\"{WORD_NS}\"><w:mirrorMargins/><w:evenAndOddHeaders w:val=\"false\"/></w:settings>"
        )
    } else {
        format!(
            "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><w:settings xmlns:w=\"{WORD_NS}\"/>"
        )
    };

    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
    file(
        zip,
        "[Content_Types].xml",
        &content_types(
            !definitions.is_empty(),
            header_relationship.is_some(),
            footer_relationship.is_some(),
            images,
        ),
        options,
    )?;
    file(
        zip,
        "_rels/.rels",
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/><Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties\" Target=\"docProps/core.xml\"/></Relationships>",
        options,
    )?;
    file(
        zip,
        "docProps/core.xml",
        &core_properties(document, profile),
        options,
    )?;
    file(zip, "word/document.xml", &document_xml, options)?;
    file(zip, "word/styles.xml", &styles_xml, options)?;
    file(zip, "word/settings.xml", &settings_xml, options)?;
    file(
        zip,
        "word/_rels/document.xml.rels",
        &document_relationships(
            &context,
            header_relationship.as_deref(),
            footer_relationship.as_deref(),
            &styles_relationship,
            &settings_relationship,
            footnotes_relationship.as_deref(),
        ),
        options,
    )?;
    if let Some(part) = page_number_part {
        file(
            zip,
            if part.header {
                "word/header1.xml"
            } else {
                "word/footer1.xml"
            },
            &part.xml,
            options,
        )?;
    }
    if !definitions.is_empty() {
        context.in_footnote = true;
        let footnotes = footnotes_xml(&definitions, &mut context, drawing_ns);
        context.in_footnote = false;
        file(zip, "word/footnotes.xml", &footnotes, options)?;
        if !context.footnote_images.is_empty() {
            file(
                zip,
                "word/_rels/footnotes.xml.rels",
                &image_relationships(&context.footnote_images),
                options,
            )?;
        }
    }
    if let Some(images) = images {
        for (index, image) in images.iter() {
            file_bytes(
                zip,
                &format!("word/media/{}", image.filename(index)),
                &image.bytes,
                options,
            )?;
        }
    }
    Ok(())
}

struct Context<'a> {
    footnote_ids: HashMap<String, usize>,
    hyperlinks: Vec<String>,
    next_warichu_id: usize,
    images: Option<&'a PreparedImages>,
    in_footnote: bool,
    document_images: Vec<ImageRelationship>,
    footnote_images: Vec<ImageRelationship>,
    next_doc_pr: usize,
}

struct ImageRelationship {
    id: String,
    target: String,
}

fn block_xml(node: &Value, profile: &ResolvedExportProfile, context: &mut Context<'_>) -> String {
    match node.get("type").and_then(Value::as_str).unwrap_or_default() {
        "heading" => {
            let depth = node
                .get("depth")
                .and_then(Value::as_u64)
                .unwrap_or(1)
                .clamp(1, 9);
            paragraph_xml(
                children(node),
                profile,
                context,
                Some(&format!("Heading{depth}")),
                None,
            )
        }
        "paragraph" => paragraph_xml(children(node), profile, context, None, node.get("indent")),
        "list" => children(node)
            .iter()
            .flat_map(children)
            .filter(|child| child.get("type").and_then(Value::as_str) == Some("paragraph"))
            .map(|paragraph| {
                let mut nodes = vec![Value::String("• ".to_owned())];
                nodes.extend_from_slice(children(paragraph));
                paragraph_xml(&nodes, profile, context, Some("ListParagraph"), None)
            })
            .collect(),
        "blockquote" => children(node)
            .iter()
            .map(|child| {
                if child.get("type").and_then(Value::as_str) == Some("paragraph") {
                    paragraph_xml(children(child), profile, context, Some("MdiQuote"), None)
                } else {
                    block_xml(child, profile, context)
                }
            })
            .collect(),
        "code" => {
            let value = node.get("value").and_then(Value::as_str).unwrap_or_default();
            let runs = value
                .split('\n')
                .enumerate()
                .map(|(index, line)| {
                    run_xml(
                        line,
                        &RunProperties {
                            font: Some("Courier New".to_owned()),
                            break_before: index != 0,
                            ..RunProperties::default()
                        },
                    )
                })
                .collect::<String>();
            format!("<w:p><w:pPr><w:pStyle w:val=\"MdiCode\"/></w:pPr>{runs}</w:p>")
        }
        "thematicBreak" => "<w:p><w:pPr><w:pStyle w:val=\"MdiThematicBreak\"/><w:jc w:val=\"center\"/></w:pPr><w:r><w:t>— — —</w:t></w:r></w:p>".to_owned(),
        "table" => table_xml(node, profile, context),
        "pagebreak" => "<w:p><w:r><w:br w:type=\"page\"/></w:r></w:p>".to_owned(),
        "blank" => "<w:p/>".to_owned(),
        "html" => format!(
            "<w:p>{}</w:p>",
            run_xml(
                node.get("value").and_then(Value::as_str).unwrap_or_default(),
                &RunProperties::default(),
            )
        ),
        _ => String::new(),
    }
}

fn paragraph_xml(
    nodes: &[Value],
    profile: &ResolvedExportProfile,
    context: &mut Context<'_>,
    style: Option<&str>,
    source_indent: Option<&Value>,
) -> String {
    let mut properties = String::new();
    if let Some(style) = style {
        properties.push_str(&format!("<w:pStyle w:val=\"{}\"/>", escape_xml(style)));
    }
    let indent_em = source_indent
        .and_then(Value::as_u64)
        .map(|value| value as f64)
        .unwrap_or(profile.typesetting.text_indent_em);
    if style.is_none() && !profile.typesetting.fullwidth_space_indent && indent_em != 0.0 {
        let first_line = (indent_em * profile.typesetting.font_size * 20.0).round() as i64;
        properties.push_str(&format!("<w:ind w:firstLine=\"{first_line}\"/>"));
    }
    let prefix = if style.is_none() && profile.typesetting.fullwidth_space_indent {
        "　".repeat(profile.typesetting.text_indent_em.round() as usize)
    } else {
        String::new()
    };
    let mut runs = if prefix.is_empty() {
        String::new()
    } else {
        run_xml(&prefix, &RunProperties::default())
    };
    runs.push_str(&inline_xml(
        nodes,
        context,
        &RunProperties::default(),
        (profile.typesetting.font_size * 2.0).round() as i64,
    ));
    format!("<w:p><w:pPr>{properties}</w:pPr>{runs}</w:p>")
}

#[derive(Default, Clone)]
struct RunProperties {
    bold: bool,
    italic: bool,
    strike: bool,
    emphasis_dot: bool,
    font: Option<String>,
    size: Option<i64>,
    spacing: Option<i64>,
    break_before: bool,
    warichu_id: Option<usize>,
}

fn inline_xml(
    nodes: &[Value],
    context: &mut Context<'_>,
    properties: &RunProperties,
    base_size: i64,
) -> String {
    nodes
        .iter()
        .map(|node| {
            if let Some(text) = node.as_str() {
                return run_xml(text, properties);
            }
            match node.get("type").and_then(Value::as_str).unwrap_or_default() {
                "text" => run_xml(
                    node.get("value").and_then(Value::as_str).unwrap_or_default(),
                    properties,
                ),
                "break" => run_xml(
                    "",
                    &RunProperties {
                        break_before: true,
                        ..properties.clone()
                    },
                ),
                "emphasis" => inline_xml(
                    children(node),
                    context,
                    &RunProperties {
                        italic: true,
                        ..properties.clone()
                    },
                    base_size,
                ),
                "strong" => inline_xml(
                    children(node),
                    context,
                    &RunProperties {
                        bold: true,
                        ..properties.clone()
                    },
                    base_size,
                ),
                "delete" => inline_xml(
                    children(node),
                    context,
                    &RunProperties {
                        strike: true,
                        ..properties.clone()
                    },
                    base_size,
                ),
                "inlineCode" => run_xml(
                    node.get("value").and_then(Value::as_str).unwrap_or_default(),
                    &RunProperties {
                        font: Some("Courier New".to_owned()),
                        ..properties.clone()
                    },
                ),
                "html" => run_xml(
                    node.get("value").and_then(Value::as_str).unwrap_or_default(),
                    properties,
                ),
                "image" => {
                    if context.images.is_some() {
                        image_drawing(node, context, properties)
                    } else {
                        let alt = node.get("alt").and_then(Value::as_str).unwrap_or_default();
                        let label = if alt.is_empty() {
                            "[Image]".to_owned()
                        } else {
                            format!("[Image: {alt}]")
                        };
                        run_xml(&label, properties)
                    }
                }
                "link" => {
                    let url = node.get("url").and_then(Value::as_str).unwrap_or_default();
                    let id = hyperlink_id(context, url);
                    format!(
                        "<w:hyperlink r:id=\"{}\">{}</w:hyperlink>",
                        escape_xml(&id),
                        inline_xml(children(node), context, properties, base_size)
                    )
                }
                "footnoteReference" => {
                    let identifier = node
                        .get("identifier")
                        .and_then(Value::as_str)
                        .unwrap_or_default();
                    context
                        .footnote_ids
                        .get(identifier)
                        .map(|id| {
                            format!("<w:r><w:rPr><w:rStyle w:val=\"FootnoteReference\"/></w:rPr><w:footnoteReference w:id=\"{id}\"/></w:r>")
                        })
                        .unwrap_or_default()
                }
                "em" => inline_xml(
                    children(node),
                    context,
                    &RunProperties {
                        emphasis_dot: true,
                        ..properties.clone()
                    },
                    base_size,
                ),
                "ruby" => ruby_xml(node, base_size, properties),
                "tcy" if properties.warichu_id.is_some() => run_xml(
                    node.get("value").and_then(Value::as_str).unwrap_or_default(),
                    properties,
                ),
                "tcy" => format!(
                    "<w:r><w:rPr><w:eastAsianLayout w:combine=\"1\" w:combineBrackets=\"none\"/></w:rPr><w:t>{}</w:t></w:r>",
                    escape_xml(node.get("value").and_then(Value::as_str).unwrap_or_default())
                ),
                "warichu" => {
                    context.next_warichu_id += 1;
                    let id = context.next_warichu_id;
                    inline_xml(
                        children(node),
                        context,
                        &RunProperties {
                            warichu_id: Some(id),
                            ..properties.clone()
                        },
                        base_size,
                    )
                }
                "kern" => {
                    let spacing = node
                        .get("amount")
                        .and_then(Value::as_str)
                        .and_then(|amount| amount.strip_suffix("em"))
                        .and_then(|value| value.parse::<f64>().ok())
                        .map(|value| (value * base_size as f64 * 10.0).round() as i64);
                    inline_xml(
                        children(node),
                        context,
                        &RunProperties {
                            spacing,
                            ..properties.clone()
                        },
                        base_size,
                    )
                }
                _ => inline_xml(children(node), context, properties, base_size),
            }
        })
        .collect()
}

fn run_xml(text: &str, properties: &RunProperties) -> String {
    let mut run_properties = String::new();
    if properties.bold {
        run_properties.push_str("<w:b/>");
    }
    if properties.italic {
        run_properties.push_str("<w:i/>");
    }
    if properties.strike {
        run_properties.push_str("<w:strike/>");
    }
    if properties.emphasis_dot {
        run_properties.push_str("<w:em w:val=\"dot\"/>");
    }
    if let Some(font) = &properties.font {
        run_properties.push_str(&format!(
            "<w:rFonts w:ascii=\"{}\" w:hAnsi=\"{}\" w:eastAsia=\"{}\"/>",
            escape_xml(font),
            escape_xml(font),
            escape_xml(font)
        ));
    }
    if let Some(size) = properties.size {
        run_properties.push_str(&format!(
            "<w:sz w:val=\"{size}\"/><w:szCs w:val=\"{size}\"/>"
        ));
    }
    if let Some(spacing) = properties.spacing.filter(|spacing| *spacing != 0) {
        run_properties.push_str(&format!("<w:spacing w:val=\"{spacing}\"/>"));
    }
    if let Some(id) = properties.warichu_id {
        run_properties.push_str(&format!(
            "<w:eastAsianLayout w:id=\"{id}\" w:combine=\"1\" w:combineBrackets=\"none\"/>"
        ));
    }
    let properties_xml = if run_properties.is_empty() {
        String::new()
    } else {
        format!("<w:rPr>{run_properties}</w:rPr>")
    };
    let line_break = if properties.break_before {
        "<w:br/>"
    } else {
        ""
    };
    format!(
        "<w:r>{properties_xml}{line_break}<w:t xml:space=\"preserve\">{}</w:t></w:r>",
        escape_xml(text)
    )
}

fn ruby_xml(node: &Value, base_size: i64, properties: &RunProperties) -> String {
    let group = properties.warichu_id.map(|id| format!("<w:rPr><w:eastAsianLayout w:id=\"{id}\" w:combine=\"1\" w:combineBrackets=\"none\"/></w:rPr>")).unwrap_or_default();
    let base = node.get("base").and_then(Value::as_str).unwrap_or_default();
    let ruby = node.get("ruby").and_then(|ruby| ruby.get("value"));
    let reading = match ruby {
        Some(Value::String(value)) => value.clone(),
        Some(Value::Array(values)) => values
            .iter()
            .filter_map(Value::as_str)
            .collect::<Vec<_>>()
            .join("."),
        _ => String::new(),
    };
    let ruby_size = (base_size as f64 / 2.0).round().max(10.0) as i64;
    let raise = if base_size == 24 {
        18
    } else {
        (base_size as f64 * 0.8).round().max(18.0) as i64
    };
    format!(
        "<w:r>{group}<w:ruby><w:rubyPr><w:rubyAlign w:val=\"center\"/><w:hps w:val=\"{ruby_size}\"/><w:hpsRaise w:val=\"{raise}\"/><w:hpsBaseText w:val=\"{base_size}\"/><w:lid w:val=\"ja-JP\"/></w:rubyPr><w:rt><w:r><w:t>{}</w:t></w:r></w:rt><w:rubyBase><w:r><w:t>{}</w:t></w:r></w:rubyBase></w:ruby></w:r>",
        escape_xml(&reading),
        escape_xml(base)
    )
}

fn table_xml(node: &Value, profile: &ResolvedExportProfile, context: &mut Context<'_>) -> String {
    let vertical = profile.typesetting.writing_mode == "vertical";
    let rows = children(node);
    let columns = rows
        .iter()
        .map(|row| children(row).len())
        .max()
        .unwrap_or(1)
        .max(1);
    let (natural_width, natural_height) =
        page_dimensions(&profile.pagination.page_size).unwrap_or((210.0, 297.0));
    let width = if profile.pagination.landscape {
        natural_height
    } else {
        natural_width
    };
    let usable =
        mm_to_twips(width - profile.pagination.margins.left - profile.pagination.margins.right);
    let column_width = usable / columns as i64;
    let borders = "<w:tblBorders><w:top w:val=\"single\" w:sz=\"4\" w:color=\"000000\"/><w:left w:val=\"single\" w:sz=\"4\" w:color=\"000000\"/><w:bottom w:val=\"single\" w:sz=\"4\" w:color=\"000000\"/><w:right w:val=\"single\" w:sz=\"4\" w:color=\"000000\"/><w:insideH w:val=\"single\" w:sz=\"4\" w:color=\"000000\"/><w:insideV w:val=\"single\" w:sz=\"4\" w:color=\"000000\"/></w:tblBorders>";
    let direction = if vertical { "<w:bidiVisual/>" } else { "" };
    let cell_direction = if vertical {
        "<w:textDirection w:val=\"tbRl\"/>"
    } else {
        ""
    };
    let grid = (0..columns)
        .map(|_| format!("<w:gridCol w:w=\"{column_width}\"/>"))
        .collect::<String>();
    let rows_xml = rows
        .iter()
        .enumerate()
        .map(|(row_index, row)| {
            let cells = children(row)
                .iter()
                .map(|cell| {
                    let content = inline_xml(
                        children(cell),
                        context,
                        &RunProperties {
                            bold: row_index == 0,
                            ..RunProperties::default()
                        },
                        (profile.typesetting.font_size * 2.0).round() as i64,
                    );
                    format!("<w:tc><w:tcPr><w:tcW w:w=\"{column_width}\" w:type=\"dxa\"/>{cell_direction}</w:tcPr><w:p>{content}</w:p></w:tc>")
                })
                .collect::<String>();
            format!("<w:tr>{cells}</w:tr>")
        })
        .collect::<String>();
    format!(
        "<w:tbl><w:tblPr>{direction}<w:tblW w:w=\"{usable}\" w:type=\"dxa\"/>{borders}<w:tblLayout w:type=\"fixed\"/></w:tblPr><w:tblGrid>{grid}</w:tblGrid>{rows_xml}</w:tbl>"
    )
}

struct PageNumberPart {
    header: bool,
    xml: String,
}

fn page_number_part(profile: &ResolvedExportProfile, size: i64) -> Option<PageNumberPart> {
    let page = &profile.pagination.page_numbers;
    if !page.enabled {
        return None;
    }
    let alignment = if page.position.ends_with("left") {
        "left"
    } else if page.position.ends_with("right") {
        "right"
    } else {
        "center"
    };
    let field = |name: &str| {
        format!(
            "<w:r><w:rPr><w:sz w:val=\"{size}\"/></w:rPr><w:fldChar w:fldCharType=\"begin\"/></w:r><w:r><w:instrText xml:space=\"preserve\"> {name} </w:instrText></w:r><w:r><w:fldChar w:fldCharType=\"end\"/></w:r>"
        )
    };
    let value = match page.format.as_str() {
        "dash" => format!(
            "<w:r><w:t>— </w:t></w:r>{}<w:r><w:t> —</w:t></w:r>",
            field("PAGE")
        ),
        "fraction" => format!(
            "{}<w:r><w:t> / </w:t></w:r>{}",
            field("PAGE"),
            field("NUMPAGES")
        ),
        _ => field("PAGE"),
    };
    let header = page.position.starts_with("top-");
    let tag = if header { "hdr" } else { "ftr" };
    Some(PageNumberPart {
        header,
        xml: format!(
            "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><w:{tag} xmlns:w=\"{WORD_NS}\"><w:p><w:pPr><w:jc w:val=\"{alignment}\"/></w:pPr>{value}</w:p></w:{tag}>"
        ),
    })
}

fn styles_xml(profile: &ResolvedExportProfile, font: &str, size: i64, line_twips: i64) -> String {
    let strict = profile.pagination.grid_mode == "strict";
    let headings = (1..=9)
        .map(|depth| {
            let heading_size = if strict {
                size
            } else {
                (size as f64
                    * [1.8, 1.55, 1.35, 1.2, 1.1, 1.0, 1.0, 1.0, 1.0][depth - 1])
                    .round() as i64
            };
            format!("<w:style w:type=\"paragraph\" w:styleId=\"Heading{depth}\"><w:name w:val=\"heading {depth}\"/><w:basedOn w:val=\"Normal\"/><w:next w:val=\"Normal\"/><w:uiPriority w:val=\"{depth}\"/><w:qFormat/><w:pPr><w:keepNext/><w:keepLines/><w:outlineLvl w:val=\"{}\"/></w:pPr><w:rPr><w:b/><w:color w:val=\"000000\"/><w:sz w:val=\"{heading_size}\"/><w:szCs w:val=\"{heading_size}\"/></w:rPr></w:style>", depth - 1)
        })
        .collect::<String>();
    format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><w:styles xmlns:w=\"{WORD_NS}\"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii=\"{}\" w:hAnsi=\"{}\" w:eastAsia=\"{}\"/><w:color w:val=\"000000\"/><w:sz w:val=\"{size}\"/><w:szCs w:val=\"{size}\"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:line=\"{line_twips}\" w:after=\"{}\"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type=\"paragraph\" w:default=\"1\" w:styleId=\"Normal\"><w:name w:val=\"Normal\"/></w:style>{headings}<w:style w:type=\"paragraph\" w:styleId=\"ListParagraph\"><w:name w:val=\"List Paragraph\"/><w:basedOn w:val=\"Normal\"/></w:style><w:style w:type=\"paragraph\" w:styleId=\"MdiQuote\"><w:name w:val=\"MDI Quote\"/><w:basedOn w:val=\"Normal\"/><w:pPr><w:ind w:left=\"720\" w:right=\"360\"/></w:pPr><w:rPr><w:i/></w:rPr></w:style><w:style w:type=\"paragraph\" w:styleId=\"MdiCode\"><w:name w:val=\"MDI Code Block\"/><w:basedOn w:val=\"Normal\"/></w:style><w:style w:type=\"paragraph\" w:styleId=\"MdiThematicBreak\"><w:name w:val=\"MDI Thematic Break\"/><w:basedOn w:val=\"Normal\"/></w:style><w:style w:type=\"paragraph\" w:styleId=\"FootnoteText\"><w:name w:val=\"footnote text\"/><w:basedOn w:val=\"Normal\"/></w:style><w:style w:type=\"character\" w:styleId=\"FootnoteReference\"><w:name w:val=\"footnote reference\"/><w:rPr><w:vertAlign w:val=\"superscript\"/></w:rPr></w:style></w:styles>",
        escape_xml(font),
        escape_xml(font),
        escape_xml(font),
        if strict { 0 } else { 120 }
    )
}

fn footnotes_xml(definitions: &[&Value], context: &mut Context<'_>, drawing_ns: &str) -> String {
    let mut xml = format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><w:footnotes xmlns:w=\"{WORD_NS}\" xmlns:r=\"{REL_NS}\"{drawing_ns}><w:footnote w:type=\"separator\" w:id=\"-1\"><w:p><w:r><w:separator/></w:r></w:p></w:footnote><w:footnote w:type=\"continuationSeparator\" w:id=\"0\"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>"
    );
    for (index, definition) in definitions.iter().enumerate() {
        let content = children(definition)
            .iter()
            .filter(|child| child.get("type").and_then(Value::as_str) == Some("paragraph"))
            .map(|paragraph| {
                inline_xml(children(paragraph), context, &RunProperties::default(), 20)
            })
            .collect::<String>();
        xml.push_str(&format!("<w:footnote w:id=\"{}\"><w:p><w:pPr><w:pStyle w:val=\"FootnoteText\"/></w:pPr><w:r><w:rPr><w:rStyle w:val=\"FootnoteReference\"/></w:rPr><w:footnoteRef/></w:r>{content}</w:p></w:footnote>", index + 1));
    }
    xml.push_str("</w:footnotes>");
    xml
}

fn hyperlink_id(context: &mut Context<'_>, url: &str) -> String {
    if let Some(index) = context.hyperlinks.iter().position(|value| value == url) {
        return format!("rId{}", index + 1);
    }
    context.hyperlinks.push(url.to_owned());
    format!("rId{}", context.hyperlinks.len())
}

fn document_relationships(
    context: &Context<'_>,
    header_id: Option<&str>,
    footer_id: Option<&str>,
    styles_id: &str,
    settings_id: &str,
    footnotes_id: Option<&str>,
) -> String {
    let mut relationships = context
        .hyperlinks
        .iter()
        .enumerate()
        .map(|(index, url)| {
            format!("<Relationship Id=\"rId{}\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink\" Target=\"{}\" TargetMode=\"External\"/>", index + 1, escape_xml(url))
        })
        .collect::<String>();
    if let Some(id) = header_id {
        relationships.push_str(&format!("<Relationship Id=\"{}\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/header\" Target=\"header1.xml\"/>", escape_xml(id)));
    }
    if let Some(id) = footer_id {
        relationships.push_str(&format!("<Relationship Id=\"{}\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer\" Target=\"footer1.xml\"/>", escape_xml(id)));
    }
    relationships.push_str(&format!("<Relationship Id=\"{}\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/><Relationship Id=\"{}\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings\" Target=\"settings.xml\"/>", escape_xml(styles_id), escape_xml(settings_id)));
    if let Some(id) = footnotes_id {
        relationships.push_str(&format!("<Relationship Id=\"{}\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes\" Target=\"footnotes.xml\"/>", escape_xml(id)));
    }
    relationships.push_str(&image_relationship_elements(&context.document_images));
    format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">{relationships}</Relationships>"
    )
}

fn content_types(
    footnotes: bool,
    header: bool,
    footer: bool,
    images: Option<&PreparedImages>,
) -> String {
    let mut overrides = "<Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/><Override PartName=\"/word/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml\"/><Override PartName=\"/word/settings.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml\"/><Override PartName=\"/docProps/core.xml\" ContentType=\"application/vnd.openxmlformats-package.core-properties+xml\"/>".to_owned();
    if footnotes {
        overrides.push_str("<Override PartName=\"/word/footnotes.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml\"/>");
    }
    if header {
        overrides.push_str("<Override PartName=\"/word/header1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml\"/>");
    }
    if footer {
        overrides.push_str("<Override PartName=\"/word/footer1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml\"/>");
    }
    let mut image_defaults = String::new();
    if let Some(images) = images {
        let mut seen = std::collections::BTreeSet::new();
        for (_, image) in images.iter() {
            if seen.insert(image.extension.clone()) {
                image_defaults.push_str(&format!(
                    "<Default Extension=\"{}\" ContentType=\"{}\"/>",
                    escape_xml(&image.extension),
                    escape_xml(&image.media_type)
                ));
            }
        }
    }
    format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/>{image_defaults}{overrides}</Types>"
    )
}

fn image_relationships(images: &[ImageRelationship]) -> String {
    format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">{}</Relationships>",
        image_relationship_elements(images)
    )
}

fn image_relationship_elements(images: &[ImageRelationship]) -> String {
    images
        .iter()
        .map(|image| {
            format!(
                "<Relationship Id=\"{}\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/image\" Target=\"{}\"/>",
                escape_xml(&image.id),
                escape_xml(&image.target)
            )
        })
        .collect()
}

fn image_drawing(node: &Value, context: &mut Context<'_>, properties: &RunProperties) -> String {
    let url = node.get("url").and_then(Value::as_str).unwrap_or_default();
    let alt = node.get("alt").and_then(Value::as_str).unwrap_or_default();
    let placed = context.images.and_then(|images| {
        let image = images.get(url)?;
        let index = images.index_of(url).unwrap_or(0);
        Some((
            image.display_width_px,
            image.display_height_px,
            format!("media/{}", image.filename(index)),
        ))
    });
    let Some((width, height, target)) = placed else {
        let label = if alt.is_empty() {
            "[Image]".to_owned()
        } else {
            format!("[Image: {alt}]")
        };
        return run_xml(&label, properties);
    };
    let relationship_id = image_relationship_id(context, &target);
    let doc_pr = context.next_doc_pr;
    context.next_doc_pr += 1;
    let mut run_properties = String::new();
    if let Some(id) = properties.warichu_id {
        run_properties.push_str(&format!(
            "<w:eastAsianLayout w:id=\"{id}\" w:combine=\"1\" w:combineBrackets=\"none\"/>"
        ));
    }
    let properties_xml = if run_properties.is_empty() {
        String::new()
    } else {
        format!("<w:rPr>{run_properties}</w:rPr>")
    };
    let cx = emu(width);
    let cy = emu(height);
    format!(
        "<w:r>{properties_xml}<w:drawing><wp:inline distT=\"0\" distB=\"0\" distL=\"0\" distR=\"0\"><wp:extent cx=\"{cx}\" cy=\"{cy}\"/><wp:effectExtent l=\"0\" t=\"0\" r=\"0\" b=\"0\"/><wp:docPr id=\"{doc_pr}\" name=\"Picture {doc_pr}\" descr=\"{}\"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect=\"1\"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri=\"http://schemas.openxmlformats.org/drawingml/2006/picture\"><pic:pic><pic:nvPicPr><pic:cNvPr id=\"{doc_pr}\" name=\"Picture {doc_pr}\"/><pic:cNvPicPr><a:picLocks noChangeAspect=\"1\"/></pic:cNvPicPr></pic:nvPicPr><pic:blipFill><a:blip r:embed=\"{}\"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x=\"0\" y=\"0\"/><a:ext cx=\"{cx}\" cy=\"{cy}\"/></a:xfrm><a:prstGeom prst=\"rect\"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>",
        escape_xml(alt),
        escape_xml(&relationship_id)
    )
}

fn image_relationship_id(context: &mut Context<'_>, target: &str) -> String {
    let relationships = if context.in_footnote {
        &mut context.footnote_images
    } else {
        &mut context.document_images
    };
    if let Some(existing) = relationships.iter().find(|image| image.target == target) {
        return existing.id.clone();
    }
    let id = if context.in_footnote {
        format!("rFnImg{}", relationships.len() + 1)
    } else {
        format!("rImg{}", relationships.len() + 1)
    };
    relationships.push(ImageRelationship {
        id: id.clone(),
        target: target.to_owned(),
    });
    id
}

fn core_properties(document: &Document, profile: &ResolvedExportProfile) -> String {
    let field = |key: &str| {
        profile
            .metadata
            .get(key)
            .and_then(Value::as_str)
            .or_else(|| {
                document.frontmatter.as_ref().and_then(|frontmatter| {
                    frontmatter
                        .entries
                        .iter()
                        .find(|entry| entry.key == key)
                        .and_then(|entry| entry.value.as_str())
                })
            })
    };
    let title = field("title").unwrap_or("Untitled");
    let creator = field("author")
        .map(|author| format!("<dc:creator>{}</dc:creator>", escape_xml(author)))
        .unwrap_or_default();
    format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><cp:coreProperties xmlns:cp=\"http://schemas.openxmlformats.org/package/2006/metadata/core-properties\" xmlns:dc=\"http://purl.org/dc/elements/1.1/\"><dc:title>{}</dc:title>{creator}</cp:coreProperties>",
        escape_xml(title)
    )
}

fn line_spacing_twips(profile: &ResolvedExportProfile, width_mm: f64, height_mm: f64) -> i64 {
    let cross = if profile.typesetting.writing_mode == "vertical" {
        width_mm - profile.pagination.margins.left - profile.pagination.margins.right
    } else {
        height_mm - profile.pagination.margins.top - profile.pagination.margins.bottom
    };
    profile.typesetting.line_spacing.map_or_else(
        || (cross / profile.pagination.lines_per_page / 25.4 * 1440.0).round() as i64,
        |spacing| (profile.typesetting.font_size * 20.0 * spacing).round() as i64,
    )
}

fn docx_font_family(value: &str) -> Result<String, String> {
    let first = value
        .split(',')
        .next()
        .unwrap_or_default()
        .trim()
        .trim_matches(['"', '\'']);
    let first = if first.is_empty() { "serif" } else { first };
    if first.chars().count() > 31 {
        return Err("DOCX fontFamily's first typeface must be at most 31 characters".to_owned());
    }
    Ok(first.to_owned())
}

fn assert_page_size(page_size: &str, width_mm: f64, height_mm: f64) -> Result<(), String> {
    if mm_to_twips(width_mm) <= 31_680 && mm_to_twips(height_mm) <= 31_680 {
        return Ok(());
    }
    Err(format!(
        "DOCX page size {page_size} exceeds Word's 22-inch maximum page dimension"
    ))
}

fn mm_to_twips(value: f64) -> i64 {
    (value / 25.4 * 1440.0).round() as i64
}

fn file_bytes<W: Write + Seek>(
    zip: &mut ZipWriter<W>,
    path: &str,
    content: &[u8],
    options: SimpleFileOptions,
) -> Result<(), String> {
    zip.start_file(path, options)
        .map_err(|error| error.to_string())?;
    zip.write_all(content).map_err(|error| error.to_string())
}

fn file<W: Write + Seek>(
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
