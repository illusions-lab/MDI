use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

const PUBLISHING_FONT_FAMILY: &str = "Yu Mincho, Hiragino Mincho ProN, Noto Serif JP, serif";
const PUBLISHING_FONT_SIZE_PT: f64 = 10.5;
const MM_PER_POINT: f64 = 25.4 / 72.0;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedExportProfile {
    pub layout: ResolvedLayout,
    pub metadata: Map<String, Value>,
    pub typesetting: ResolvedTypesetting,
    pub pagination: ResolvedPagination,
    pub epub: ResolvedEpub,
    pub text: ResolvedText,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedLayout {
    pub system: String,
    pub margin_mode: String,
    pub binding_side: String,
    pub gutter: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedTypesetting {
    pub writing_mode: String,
    pub font_family: String,
    pub font_size: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub line_spacing: Option<f64>,
    pub text_indent_em: f64,
    pub fullwidth_space_indent: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedPagination {
    pub page_size: String,
    pub landscape: bool,
    pub characters_per_line: f64,
    pub lines_per_page: f64,
    pub grid_mode: String,
    pub margins: Margins,
    pub page_numbers: PageNumbers,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Margins {
    pub top: f64,
    pub bottom: f64,
    pub left: f64,
    pub right: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageNumbers {
    pub enabled: bool,
    pub format: String,
    pub position: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedEpub {
    pub chapter_split_level: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cover_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedText {
    pub fullwidth_space_indent: bool,
    pub indent_count: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChromiumPrintProfile {
    pub html: String,
    pub profile: ResolvedExportProfile,
    pub page: ChromiumPrintPage,
    pub page_numbers: ChromiumPrintPageNumbers,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChromiumPrintPage {
    pub width_mm: f64,
    pub height_mm: f64,
    pub margins_mm: Margins,
    pub landscape: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChromiumPrintPageNumbers {
    pub enabled: bool,
    pub format: String,
    pub position: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub header_template: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub footer_template: Option<String>,
}

#[derive(Debug)]
struct ModeDefaults {
    font_family: &'static str,
    font_size: f64,
    characters_per_line: f64,
    lines_per_page: f64,
    margins: Margins,
}

pub fn resolve_export_profile_json(
    source: &str,
    source_writing_mode: Option<&str>,
    require_layout: bool,
) -> Result<String, String> {
    let raw: Value =
        serde_json::from_str(source).map_err(|_| "Export profile must be valid JSON".to_owned())?;
    let profile = raw
        .as_object()
        .ok_or_else(|| "Export profile must be a JSON object".to_owned())?;
    if require_layout
        && profile
            .get("layout")
            .and_then(Value::as_object)
            .and_then(|layout| layout.get("system"))
            .is_none()
    {
        return Err(
            "Configured exports require layout.system: japanese-publisher or word".to_owned(),
        );
    }
    serde_json::to_string(&resolve_export_profile(profile, source_writing_mode)?)
        .map_err(|error| error.to_string())
}

pub fn resolve_export_profile(
    profile: &Map<String, Value>,
    source_writing_mode: Option<&str>,
) -> Result<ResolvedExportProfile, String> {
    for (key, value) in profile {
        if !value.is_object() {
            return Err(format!("{key} must be an object"));
        }
    }
    let layout = nested_object(profile, "layout", "layout")?;
    let metadata = nested_object(profile, "metadata", "metadata")?;
    let typesetting = nested_object(profile, "typesetting", "typesetting")?;
    let pagination = nested_object(profile, "pagination", "pagination")?;
    let epub = nested_object(profile, "epub", "epub")?;
    let text = nested_object(profile, "text", "text")?;
    let page_numbers = nested_object(pagination, "pageNumbers", "pagination.pageNumbers")?;
    let margins = nested_object(pagination, "margins", "pagination.margins")?;

    let writing_mode =
        optional_string(typesetting, "writingMode", "writingMode")?.unwrap_or_else(|| {
            if source_writing_mode == Some("vertical") {
                "vertical".to_owned()
            } else {
                "horizontal".to_owned()
            }
        });
    if writing_mode != "vertical" && writing_mode != "horizontal" {
        return Err("writingMode must be vertical or horizontal".to_owned());
    }
    let layout_system = optional_string(layout, "system", "layout.system")?
        .unwrap_or_else(|| "japanese-publisher".to_owned());
    if layout_system != "japanese-publisher" && layout_system != "word" {
        return Err("layout.system must be japanese-publisher or word".to_owned());
    }
    let margin_mode =
        optional_string(layout, "marginMode", "layout.marginMode")?.unwrap_or_else(|| {
            if layout_system == "japanese-publisher" {
                "mirror".to_owned()
            } else {
                "single".to_owned()
            }
        });
    if margin_mode != "single" && margin_mode != "mirror" {
        return Err("layout.marginMode must be single or mirror".to_owned());
    }
    let binding_side = optional_string(layout, "bindingSide", "layout.bindingSide")?
        .unwrap_or_else(|| {
            if layout_system == "japanese-publisher" && writing_mode == "vertical" {
                "right".to_owned()
            } else {
                "left".to_owned()
            }
        });
    if binding_side != "right" && binding_side != "left" {
        return Err("layout.bindingSide must be right or left".to_owned());
    }
    let page_size = optional_string(pagination, "pageSize", "pageSize")?.unwrap_or_else(|| {
        if layout_system == "japanese-publisher" {
            if writing_mode == "vertical" {
                "A4".to_owned()
            } else {
                "Shirokuban".to_owned()
            }
        } else {
            "A4".to_owned()
        }
    });
    let (natural_width, natural_height) =
        page_dimensions(&page_size).ok_or_else(|| format!("Unsupported page size: {page_size}"))?;

    for (key, value) in metadata {
        if !value.is_string() {
            return Err(format!("metadata.{key} must be a string"));
        }
    }
    let font_family = optional_string(typesetting, "fontFamily", "fontFamily")?;
    let font_size = optional_number(typesetting, "fontSize", "fontSize")?;
    let font_size_pt = optional_number(typesetting, "fontSizePt", "fontSizePt")?;
    if font_size.is_some() && font_size_pt.is_some() && font_size != font_size_pt {
        return Err("fontSize and fontSizePt must match when both are set".to_owned());
    }
    let line_spacing = optional_number(typesetting, "lineSpacing", "lineSpacing")?;
    let line_height = optional_number(typesetting, "lineHeight", "lineHeight")?;
    if line_spacing.is_some() && line_height.is_some() && line_spacing != line_height {
        return Err("lineSpacing and lineHeight must match when both are set".to_owned());
    }
    let cover_path = optional_string(epub, "coverPath", "coverPath")?;
    let landscape = optional_bool(pagination, "landscape", "landscape")?.unwrap_or(
        layout_system == "japanese-publisher" && writing_mode == "vertical" && page_size == "A4",
    );
    let mode_defaults = if layout_system == "word" {
        word_defaults(
            &page_size,
            &writing_mode,
            landscape,
            natural_width,
            natural_height,
        )
    } else {
        publisher_defaults(
            &page_size,
            &writing_mode,
            landscape,
            &binding_side,
            natural_width,
            natural_height,
        )
    };
    let chapter_split_level = optional_string(epub, "chapterSplitLevel", "chapterSplitLevel")?
        .unwrap_or_else(|| "h1".to_owned());
    if !["h1", "h2", "h3", "none"].contains(&chapter_split_level.as_str()) {
        return Err("chapterSplitLevel must be h1, h2, h3, or none".to_owned());
    }
    let page_number_format = optional_string(page_numbers, "format", "pageNumbers.format")?
        .unwrap_or_else(|| "simple".to_owned());
    if !["simple", "dash", "fraction"].contains(&page_number_format.as_str()) {
        return Err("Unsupported page number format".to_owned());
    }
    let page_number_position = optional_string(page_numbers, "position", "pageNumbers.position")?
        .unwrap_or_else(|| "bottom-center".to_owned());
    if ![
        "top-left",
        "top-center",
        "top-right",
        "bottom-left",
        "bottom-center",
        "bottom-right",
    ]
    .contains(&page_number_position.as_str())
    {
        return Err("Unsupported page number position".to_owned());
    }

    let page_width = if landscape {
        natural_height
    } else {
        natural_width
    };
    let page_height = if landscape {
        natural_width
    } else {
        natural_height
    };
    let gutter = bounded_number(
        optional_number(layout, "gutter", "layout.gutter")?,
        0.0,
        0.0,
        page_width.min(page_height) / 3.0,
        "layout.gutter",
    )?;
    if layout_system == "word" && gutter != 0.0 {
        return Err("layout.gutter is only available with japanese-publisher layout".to_owned());
    }
    let mut resolved_margins = Margins {
        top: bounded_number(
            optional_number(margins, "top", "top margin")?,
            mode_defaults.margins.top,
            0.0,
            page_height - 1.0,
            "top margin",
        )?,
        bottom: bounded_number(
            optional_number(margins, "bottom", "bottom margin")?,
            mode_defaults.margins.bottom,
            0.0,
            page_height - 1.0,
            "bottom margin",
        )?,
        left: bounded_number(
            optional_number(margins, "left", "left margin")?,
            mode_defaults.margins.left,
            0.0,
            page_width - 1.0,
            "left margin",
        )?,
        right: bounded_number(
            optional_number(margins, "right", "right margin")?,
            mode_defaults.margins.right,
            0.0,
            page_width - 1.0,
            "right margin",
        )?,
    };
    if layout_system == "japanese-publisher" && gutter > 0.0 {
        if binding_side == "right" {
            resolved_margins.right += gutter;
        } else {
            resolved_margins.left += gutter;
        }
    }
    let grid_mode = optional_string(pagination, "gridMode", "gridMode")?.unwrap_or_else(|| {
        if layout_system == "word" {
            "typographic".to_owned()
        } else {
            "strict".to_owned()
        }
    });
    if grid_mode != "strict" && grid_mode != "typographic" {
        return Err("gridMode must be strict or typographic".to_owned());
    }
    if layout_system == "word" && grid_mode == "strict" {
        return Err(
            "layout.system: word uses flowing typography, not a strict manuscript grid".to_owned(),
        );
    }
    let resolved_line_spacing = line_spacing.or(line_height);
    if grid_mode == "strict" && resolved_line_spacing.is_some() {
        return Err("lineSpacing requires pagination.gridMode: typographic; strict grid preserves its physical manuscript cells".to_owned());
    }
    if resolved_margins.left + resolved_margins.right >= page_width {
        return Err("left and right margins must leave printable page width".to_owned());
    }
    if resolved_margins.top + resolved_margins.bottom >= page_height {
        return Err("top and bottom margins must leave printable page height".to_owned());
    }

    Ok(ResolvedExportProfile {
        layout: ResolvedLayout {
            system: layout_system,
            margin_mode,
            binding_side,
            gutter,
        },
        metadata: metadata.clone(),
        typesetting: ResolvedTypesetting {
            writing_mode,
            font_family: font_family
                .filter(|value| !value.trim().is_empty())
                .unwrap_or_else(|| mode_defaults.font_family.to_owned()),
            font_size: bounded_number(
                font_size.or(font_size_pt),
                mode_defaults.font_size,
                4.0,
                72.0,
                "fontSize",
            )?,
            line_spacing: resolved_line_spacing
                .map(|value| bounded_number(Some(value), 0.0, 0.5, 3.0, "lineSpacing"))
                .transpose()?,
            text_indent_em: bounded_number(
                optional_number(typesetting, "textIndentEm", "textIndentEm")?,
                1.0,
                0.0,
                4.0,
                "textIndentEm",
            )?,
            fullwidth_space_indent: optional_bool(
                typesetting,
                "fullwidthSpaceIndent",
                "fullwidthSpaceIndent",
            )?
            .unwrap_or(false),
        },
        pagination: ResolvedPagination {
            page_size,
            landscape,
            characters_per_line: bounded_number(
                optional_number(pagination, "charactersPerLine", "charactersPerLine")?,
                mode_defaults.characters_per_line,
                10.0,
                400.0,
                "charactersPerLine",
            )?,
            lines_per_page: bounded_number(
                optional_number(pagination, "linesPerPage", "linesPerPage")?,
                mode_defaults.lines_per_page,
                10.0,
                400.0,
                "linesPerPage",
            )?,
            grid_mode,
            margins: resolved_margins,
            page_numbers: PageNumbers {
                enabled: optional_bool(page_numbers, "enabled", "pageNumbers.enabled")?
                    .unwrap_or(true),
                format: page_number_format,
                position: page_number_position,
            },
        },
        epub: ResolvedEpub {
            chapter_split_level,
            cover_path,
        },
        text: ResolvedText {
            fullwidth_space_indent: optional_bool(
                text,
                "fullwidthSpaceIndent",
                "text.fullwidthSpaceIndent",
            )?
            .unwrap_or(false),
            indent_count: bounded_number(
                optional_number(text, "indentCount", "text.indentCount")?,
                1.0,
                1.0,
                4.0,
                "text.indentCount",
            )?,
        },
    })
}

/// Resolve a raw export profile and prepare all browser-independent Chromium
/// print data in Rust. Browser bindings only launch the browser and pass these
/// values to its native PDF API.
pub fn prepare_chromium_print_profile(
    html: &str,
    profile: &Map<String, Value>,
    source_writing_mode: Option<&str>,
) -> Result<ChromiumPrintProfile, String> {
    let profile = resolve_export_profile(profile, source_writing_mode)?;
    prepare_chromium_print_profile_resolved(html, profile)
}

pub fn prepare_chromium_print_profile_json(
    html: &str,
    profile_json: &str,
    source_writing_mode: Option<&str>,
) -> Result<String, String> {
    let raw: Value = serde_json::from_str(profile_json)
        .map_err(|_| "Export profile must be valid JSON".to_owned())?;
    let profile = raw
        .as_object()
        .ok_or_else(|| "Export profile must be a JSON object".to_owned())?;
    serde_json::to_string(&prepare_chromium_print_profile(
        html,
        profile,
        source_writing_mode,
    )?)
    .map_err(|error| error.to_string())
}

pub fn prepare_chromium_print_profile_resolved(
    html: &str,
    profile: ResolvedExportProfile,
) -> Result<ChromiumPrintProfile, String> {
    let (natural_width, natural_height) = page_dimensions(&profile.pagination.page_size)
        .ok_or_else(|| format!("Unsupported page size: {}", profile.pagination.page_size))?;
    let (width_mm, height_mm) = if profile.pagination.landscape {
        (natural_height, natural_width)
    } else {
        (natural_width, natural_height)
    };
    let page_numbers = &profile.pagination.page_numbers;
    let template = page_numbers
        .enabled
        .then(|| page_number_template(&page_numbers.format, &page_numbers.position));
    let is_header = page_numbers.position.starts_with("top-");

    Ok(ChromiumPrintProfile {
        html: apply_pdf_profile(html, &profile)?,
        page: ChromiumPrintPage {
            width_mm,
            height_mm,
            margins_mm: profile.pagination.margins,
            landscape: profile.pagination.landscape,
        },
        page_numbers: ChromiumPrintPageNumbers {
            enabled: page_numbers.enabled,
            format: page_numbers.format.clone(),
            position: page_numbers.position.clone(),
            header_template: if is_header { template.clone() } else { None },
            footer_template: if is_header { None } else { template },
        },
        profile,
    })
}

pub fn apply_pdf_profile_json(html: &str, profile_json: &str) -> Result<String, String> {
    let profile: ResolvedExportProfile =
        serde_json::from_str(profile_json).map_err(|error| error.to_string())?;
    apply_pdf_profile(html, &profile)
}

/// Convert a resolved profile into isolated print CSS. This is kept in the
/// language-neutral core so every present and future binding has identical
/// page geometry and Japanese composition behavior.
pub fn apply_pdf_profile(html: &str, profile: &ResolvedExportProfile) -> Result<String, String> {
    let pagination = &profile.pagination;
    let typesetting = &profile.typesetting;
    let (natural_width, natural_height) = page_dimensions(&pagination.page_size)
        .ok_or_else(|| format!("Unsupported page size: {}", pagination.page_size))?;
    let (width, height) = if pagination.landscape {
        (natural_height, natural_width)
    } else {
        (natural_width, natural_height)
    };
    let cross = if typesetting.writing_mode == "vertical" {
        width - pagination.margins.left - pagination.margins.right
    } else {
        height - pagination.margins.top - pagination.margins.bottom
    };
    let font_size = typesetting.font_size / 72.0 * 25.4;
    let strict_grid = pagination.grid_mode == "strict";
    let inline = if typesetting.writing_mode == "vertical" {
        height - pagination.margins.top - pagination.margins.bottom
    } else {
        width - pagination.margins.left - pagination.margins.right
    };
    let character_pitch = inline / pagination.characters_per_line;
    let raw_character_spacing = if strict_grid {
        (inline - font_size * pagination.characters_per_line)
            / (pagination.characters_per_line - 1.0).max(1.0)
    } else {
        0.0
    };
    let character_spacing = if raw_character_spacing.abs() < 1e-9 {
        0.0
    } else {
        raw_character_spacing
    };
    let line_pitch = cross / pagination.lines_per_page;
    let line_height = if strict_grid {
        format!("{line_pitch}mm")
    } else if let Some(line_spacing) = typesetting.line_spacing {
        line_spacing.to_string()
    } else {
        (cross / pagination.lines_per_page / font_size).to_string()
    };
    let fullwidth = if typesetting.fullwidth_space_indent {
        "　".repeat(typesetting.text_indent_em.round() as usize)
    } else {
        String::new()
    };
    let writing_mode = if typesetting.writing_mode == "vertical" {
        "vertical-rl"
    } else {
        "horizontal-tb"
    };
    let indent = if typesetting.fullwidth_space_indent {
        "0".to_owned()
    } else {
        format!("{}em", typesetting.text_indent_em)
    };
    let block_css = if strict_grid {
        format!(
            "p{{margin:0;text-indent:{indent}}}h1,h2,h3,h4,h5,h6{{font-size:1em;line-height:inherit;color:#000;break-after:avoid;margin:0;font-weight:bold}}"
        )
    } else {
        format!(
            "p{{margin:0 0 .75em;text-indent:{indent}}}h1,h2,h3,h4,h5,h6{{color:#000;break-after:avoid;margin:0 0 .75em;line-height:1.25}}p+h1,p+h2,p+h3,p+h4,p+h5,p+h6{{padding-top:.75em}}h1{{font-size:1.6em}}h2{{font-size:1.35em}}h3{{font-size:1.15em}}"
        )
    };
    let css = format!(
        "<style id=\"mdi-export-profile\">{}html{{writing-mode:{writing_mode}!important;background:#fff;color:#000;--mdi-grid-mode:{};--mdi-character-pitch:{character_pitch}mm;--mdi-character-spacing:{character_spacing}mm;--mdi-line-pitch:{line_pitch}mm;--mdi-characters-per-line:{};--mdi-lines-per-page:{}}}html,body{{margin:0;box-sizing:border-box}}body{{font-family:{};font-size:{font_size}mm;line-height:{line_height};letter-spacing:{character_spacing}mm;writing-mode:{writing_mode};text-orientation:mixed;color:#000}}{block_css}a{{color:inherit;text-decoration:none}}.mdi-pagebreak,.mdi-pagebreak-right,.mdi-pagebreak-left{{background:transparent}}</style>",
        page_rules(width, height, profile),
        pagination.grid_mode,
        pagination.characters_per_line,
        pagination.lines_per_page,
        css_value(&typesetting.font_family),
    );
    let styled = inject_profile_style(html, &css);
    Ok(if fullwidth.is_empty() {
        styled
    } else {
        prefix_nonempty_paragraphs(&styled, &fullwidth)
    })
}

fn page_rules(width: f64, height: f64, profile: &ResolvedExportProfile) -> String {
    let margins = profile.pagination.margins;
    let base = format!(
        "@page{{size:{width}mm {height}mm;margin:{}mm {}mm {}mm {}mm}}",
        margins.top, margins.right, margins.bottom, margins.left
    );
    if profile.layout.margin_mode != "mirror" {
        return base;
    }
    let (odd_right, odd_left, even_right, even_left) = if profile.layout.binding_side == "right" {
        (margins.right, margins.left, margins.left, margins.right)
    } else {
        (margins.left, margins.right, margins.right, margins.left)
    };
    format!(
        "{base}@page :right{{margin:{}mm {odd_right}mm {}mm {odd_left}mm}}@page :left{{margin:{}mm {even_right}mm {}mm {even_left}mm}}",
        margins.top, margins.bottom, margins.top, margins.bottom
    )
}

fn page_number_template(format: &str, position: &str) -> String {
    let align = if position.ends_with("left") {
        "left"
    } else if position.ends_with("right") {
        "right"
    } else {
        "center"
    };
    let page = r#"<span class="pageNumber"></span>"#;
    let value = match format {
        "dash" => format!("— {page} —"),
        "fraction" => format!(r#"{page} / <span class="totalPages"></span>"#),
        _ => page.to_owned(),
    };
    format!(
        r#"<div style="width:100%;font-size:8pt;text-align:{align};padding:0 8mm">{value}</div>"#
    )
}

fn inject_profile_style(html: &str, css: &str) -> String {
    if let Some(index) = find_ascii_case_insensitive(html, "</head") {
        return format!("{}{css}{}", &html[..index], &html[index..]);
    }
    if let Some(start) = find_ascii_case_insensitive(html, "<html")
        && let Some(relative_end) = html[start..].find('>')
    {
        let end = start + relative_end + 1;
        return format!("{}<head>{css}</head>{}", &html[..end], &html[end..]);
    }
    format!("{css}{html}")
}

fn find_ascii_case_insensitive(haystack: &str, needle: &str) -> Option<usize> {
    let haystack = haystack.as_bytes();
    let needle = needle.as_bytes();
    haystack
        .windows(needle.len())
        .position(|window| window.eq_ignore_ascii_case(needle))
}

fn prefix_nonempty_paragraphs(html: &str, prefix: &str) -> String {
    let mut output = String::with_capacity(html.len() + prefix.len());
    let mut cursor = 0;
    while let Some(relative) = html[cursor..].find("<p") {
        let start = cursor + relative;
        output.push_str(&html[cursor..start]);
        let Some(relative_end) = html[start..].find('>') else {
            output.push_str(&html[start..]);
            return output;
        };
        let end = start + relative_end + 1;
        let opening = &html[start..end];
        let valid_opening = opening == "<p>"
            || opening
                .as_bytes()
                .get(2)
                .is_some_and(u8::is_ascii_whitespace);
        output.push_str(opening);
        if valid_opening {
            let rest = &html[end..];
            let trimmed = rest.trim_start_matches(char::is_whitespace);
            if !trimmed.starts_with("</p>") {
                output.push_str(prefix);
            }
        }
        cursor = end;
    }
    output.push_str(&html[cursor..]);
    output
}

fn css_value(value: &str) -> String {
    value
        .chars()
        .filter(|character| !matches!(character, '{' | '}' | '<' | '>' | ';'))
        .collect()
}

fn nested_object<'a>(
    parent: &'a Map<String, Value>,
    key: &str,
    label: &str,
) -> Result<&'a Map<String, Value>, String> {
    match parent.get(key) {
        None => Ok(empty_object()),
        Some(Value::Object(object)) => Ok(object),
        Some(_) => Err(format!("{label} must be an object")),
    }
}

fn empty_object() -> &'static Map<String, Value> {
    static EMPTY: std::sync::OnceLock<Map<String, Value>> = std::sync::OnceLock::new();
    EMPTY.get_or_init(Map::new)
}

fn optional_string(
    object: &Map<String, Value>,
    key: &str,
    label: &str,
) -> Result<Option<String>, String> {
    match object.get(key) {
        None => Ok(None),
        Some(Value::String(value)) => Ok(Some(value.clone())),
        Some(_) => Err(format!("{label} must be a string")),
    }
}

fn optional_number(
    object: &Map<String, Value>,
    key: &str,
    label: &str,
) -> Result<Option<f64>, String> {
    match object.get(key) {
        None => Ok(None),
        Some(Value::Number(value)) => value
            .as_f64()
            .filter(|value| value.is_finite())
            .map(Some)
            .ok_or_else(|| format!("{label} must be a finite number")),
        Some(_) => Err(format!("{label} must be a number")),
    }
}

fn optional_bool(
    object: &Map<String, Value>,
    key: &str,
    label: &str,
) -> Result<Option<bool>, String> {
    match object.get(key) {
        None => Ok(None),
        Some(Value::Bool(value)) => Ok(Some(*value)),
        Some(_) => Err(format!("{label} must be a boolean")),
    }
}

fn bounded_number(
    value: Option<f64>,
    fallback: f64,
    minimum: f64,
    maximum: f64,
    label: &str,
) -> Result<f64, String> {
    let resolved = value.unwrap_or(fallback);
    if !resolved.is_finite() || resolved < minimum || resolved > maximum {
        return Err(format!("{label} must be between {minimum} and {maximum}"));
    }
    Ok(resolved)
}

fn publisher_defaults(
    page_size: &str,
    writing_mode: &str,
    landscape: bool,
    binding_side: &str,
    natural_width: f64,
    natural_height: f64,
) -> ModeDefaults {
    let width = if landscape {
        natural_height
    } else {
        natural_width
    };
    let height = if landscape {
        natural_width
    } else {
        natural_height
    };
    let base_glyph = PUBLISHING_FONT_SIZE_PT * MM_PER_POINT;
    let minimum_outer = 18.0_f64.min(width.min(height) * 0.085);
    let expands_beyond_a4 = width * height > 210.0 * 297.0;
    let maximum_characters: f64 = if expands_beyond_a4 { 400.0 } else { 40.0 };

    if page_size == "Shirokuban" && !landscape {
        let node = 18.0;
        let fore_edge = 15.5;
        let margins = Margins {
            top: 16.5,
            bottom: 18.0,
            left: if binding_side == "left" {
                node
            } else {
                fore_edge
            },
            right: if binding_side == "right" {
                node
            } else {
                fore_edge
            },
        };
        return ModeDefaults {
            font_family: PUBLISHING_FONT_FAMILY,
            font_size: 10.0,
            characters_per_line: if writing_mode == "vertical" {
                40.0
            } else {
                27.0
            },
            lines_per_page: if writing_mode == "vertical" {
                15.0
            } else {
                26.0
            },
            margins,
        };
    }
    if page_size == "A4" && landscape && writing_mode == "vertical" {
        return ModeDefaults {
            font_family: PUBLISHING_FONT_FAMILY,
            font_size: PUBLISHING_FONT_SIZE_PT,
            characters_per_line: 40.0,
            lines_per_page: 30.0,
            margins: Margins {
                top: 30.91666666666667,
                bottom: 30.91666666666667,
                left: 28.0,
                right: 28.0,
            },
        };
    }
    if writing_mode == "vertical" {
        let binding = (width * 0.22).min(8.0_f64.max(width * (28.0 / 210.0)));
        let characters = 10.0_f64
            .max(maximum_characters.min(((height - 2.0 * minimum_outer) / base_glyph).floor()));
        let lines = 10.0_f64.max(
            (if expands_beyond_a4 {
                400.0_f64
            } else {
                30.0_f64
            })
            .min(((width - binding - minimum_outer) / base_glyph).floor()),
        );
        let glyph = base_glyph
            .min((height - 2.0 * minimum_outer) / characters)
            .min((width - binding - minimum_outer) / lines);
        return ModeDefaults {
            font_family: PUBLISHING_FONT_FAMILY,
            font_size: glyph / MM_PER_POINT,
            characters_per_line: characters,
            lines_per_page: lines,
            margins: Margins {
                top: (height - characters * glyph) / 2.0,
                bottom: (height - characters * glyph) / 2.0,
                left: if binding_side == "left" {
                    binding
                } else {
                    width - binding - lines * glyph
                },
                right: if binding_side == "right" {
                    binding
                } else {
                    width - binding - lines * glyph
                },
            },
        };
    }
    let characters =
        10.0_f64.max(maximum_characters.min(((width - 2.0 * minimum_outer) / base_glyph).floor()));
    let glyph = base_glyph.min((width - 2.0 * minimum_outer) / characters);
    let horizontal_margin = (width - characters * glyph) / 2.0;
    let vertical_margin = 6.0_f64.max(20.0_f64.min(height * 0.1));
    let lines = 10.0_f64.max(
        (if expands_beyond_a4 {
            400.0_f64
        } else {
            50.0_f64
        })
        .min(((height - 2.0 * vertical_margin) / (glyph * 1.5)).floor()),
    );
    ModeDefaults {
        font_family: PUBLISHING_FONT_FAMILY,
        font_size: glyph / MM_PER_POINT,
        characters_per_line: characters,
        lines_per_page: lines,
        margins: Margins {
            top: vertical_margin,
            bottom: vertical_margin,
            left: horizontal_margin,
            right: horizontal_margin,
        },
    }
}

fn word_defaults(
    _page_size: &str,
    writing_mode: &str,
    landscape: bool,
    natural_width: f64,
    natural_height: f64,
) -> ModeDefaults {
    let width = if landscape {
        natural_height
    } else {
        natural_width
    };
    let height = if landscape {
        natural_width
    } else {
        natural_height
    };
    let margin = 25.4_f64.min(6.0_f64.max(width.min(height) / 2.0 - 1.0));
    let glyph = PUBLISHING_FONT_SIZE_PT * MM_PER_POINT;
    let inline_extent = if writing_mode == "vertical" {
        height - 2.0 * margin
    } else {
        width - 2.0 * margin
    };
    let cross_extent = if writing_mode == "vertical" {
        width - 2.0 * margin
    } else {
        height - 2.0 * margin
    };
    ModeDefaults {
        font_family: PUBLISHING_FONT_FAMILY,
        font_size: PUBLISHING_FONT_SIZE_PT,
        characters_per_line: 10.0_f64.max(400.0_f64.min((inline_extent / glyph).floor())),
        lines_per_page: 10.0_f64.max(400.0_f64.min((cross_extent / (glyph * 1.15)).floor())),
        margins: Margins {
            top: margin,
            bottom: margin,
            left: margin,
            right: margin,
        },
    }
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PageSizeDimensions {
    pub key: &'static str,
    pub width_mm: f64,
    pub height_mm: f64,
}

const PAGE_DIMENSIONS: &[PageSizeDimensions] = &[
    PageSizeDimensions {
        key: "A0",
        width_mm: 841.0,
        height_mm: 1189.0,
    },
    PageSizeDimensions {
        key: "A1",
        width_mm: 594.0,
        height_mm: 841.0,
    },
    PageSizeDimensions {
        key: "A2",
        width_mm: 420.0,
        height_mm: 594.0,
    },
    PageSizeDimensions {
        key: "A3",
        width_mm: 297.0,
        height_mm: 420.0,
    },
    PageSizeDimensions {
        key: "A4",
        width_mm: 210.0,
        height_mm: 297.0,
    },
    PageSizeDimensions {
        key: "A5",
        width_mm: 148.0,
        height_mm: 210.0,
    },
    PageSizeDimensions {
        key: "A6",
        width_mm: 105.0,
        height_mm: 148.0,
    },
    PageSizeDimensions {
        key: "A7",
        width_mm: 74.0,
        height_mm: 105.0,
    },
    PageSizeDimensions {
        key: "A8",
        width_mm: 52.0,
        height_mm: 74.0,
    },
    PageSizeDimensions {
        key: "A9",
        width_mm: 37.0,
        height_mm: 52.0,
    },
    PageSizeDimensions {
        key: "A10",
        width_mm: 26.0,
        height_mm: 37.0,
    },
    PageSizeDimensions {
        key: "JIS-B0",
        width_mm: 1030.0,
        height_mm: 1456.0,
    },
    PageSizeDimensions {
        key: "JIS-B1",
        width_mm: 728.0,
        height_mm: 1030.0,
    },
    PageSizeDimensions {
        key: "JIS-B2",
        width_mm: 515.0,
        height_mm: 728.0,
    },
    PageSizeDimensions {
        key: "JIS-B3",
        width_mm: 364.0,
        height_mm: 515.0,
    },
    PageSizeDimensions {
        key: "JIS-B4",
        width_mm: 257.0,
        height_mm: 364.0,
    },
    PageSizeDimensions {
        key: "JIS-B5",
        width_mm: 182.0,
        height_mm: 257.0,
    },
    PageSizeDimensions {
        key: "JIS-B6",
        width_mm: 128.0,
        height_mm: 182.0,
    },
    PageSizeDimensions {
        key: "JIS-B7",
        width_mm: 91.0,
        height_mm: 128.0,
    },
    PageSizeDimensions {
        key: "JIS-B8",
        width_mm: 64.0,
        height_mm: 91.0,
    },
    PageSizeDimensions {
        key: "JIS-B9",
        width_mm: 45.0,
        height_mm: 64.0,
    },
    PageSizeDimensions {
        key: "JIS-B10",
        width_mm: 32.0,
        height_mm: 45.0,
    },
    PageSizeDimensions {
        key: "ISO-B0",
        width_mm: 1000.0,
        height_mm: 1414.0,
    },
    PageSizeDimensions {
        key: "ISO-B1",
        width_mm: 707.0,
        height_mm: 1000.0,
    },
    PageSizeDimensions {
        key: "ISO-B2",
        width_mm: 500.0,
        height_mm: 707.0,
    },
    PageSizeDimensions {
        key: "ISO-B3",
        width_mm: 353.0,
        height_mm: 500.0,
    },
    PageSizeDimensions {
        key: "ISO-B4",
        width_mm: 250.0,
        height_mm: 353.0,
    },
    PageSizeDimensions {
        key: "ISO-B5",
        width_mm: 176.0,
        height_mm: 250.0,
    },
    PageSizeDimensions {
        key: "ISO-B6",
        width_mm: 125.0,
        height_mm: 176.0,
    },
    PageSizeDimensions {
        key: "ISO-B7",
        width_mm: 88.0,
        height_mm: 125.0,
    },
    PageSizeDimensions {
        key: "ISO-B8",
        width_mm: 62.0,
        height_mm: 88.0,
    },
    PageSizeDimensions {
        key: "ISO-B9",
        width_mm: 44.0,
        height_mm: 62.0,
    },
    PageSizeDimensions {
        key: "ISO-B10",
        width_mm: 31.0,
        height_mm: 44.0,
    },
    PageSizeDimensions {
        key: "Bunko",
        width_mm: 105.0,
        height_mm: 148.0,
    },
    PageSizeDimensions {
        key: "Shinsho",
        width_mm: 103.0,
        height_mm: 182.0,
    },
    PageSizeDimensions {
        key: "Shirokuban",
        width_mm: 127.0,
        height_mm: 188.0,
    },
    PageSizeDimensions {
        key: "Kikuban",
        width_mm: 150.0,
        height_mm: 220.0,
    },
    PageSizeDimensions {
        key: "A5-ban",
        width_mm: 148.0,
        height_mm: 210.0,
    },
    PageSizeDimensions {
        key: "B6-ban",
        width_mm: 128.0,
        height_mm: 182.0,
    },
    PageSizeDimensions {
        key: "AB-ban",
        width_mm: 210.0,
        height_mm: 257.0,
    },
    PageSizeDimensions {
        key: "Ju-ban",
        width_mm: 182.0,
        height_mm: 206.0,
    },
    PageSizeDimensions {
        key: "Kiku-tate",
        width_mm: 152.0,
        height_mm: 218.0,
    },
    PageSizeDimensions {
        key: "Tankobon",
        width_mm: 130.0,
        height_mm: 188.0,
    },
    PageSizeDimensions {
        key: "Letter",
        width_mm: 216.0,
        height_mm: 279.0,
    },
    PageSizeDimensions {
        key: "Legal",
        width_mm: 216.0,
        height_mm: 356.0,
    },
    PageSizeDimensions {
        key: "Tabloid",
        width_mm: 279.0,
        height_mm: 432.0,
    },
    PageSizeDimensions {
        key: "Executive",
        width_mm: 184.0,
        height_mm: 267.0,
    },
    PageSizeDimensions {
        key: "Statement",
        width_mm: 140.0,
        height_mm: 216.0,
    },
    PageSizeDimensions {
        key: "Folio",
        width_mm: 210.0,
        height_mm: 330.0,
    },
    PageSizeDimensions {
        key: "Quarto",
        width_mm: 203.0,
        height_mm: 254.0,
    },
    PageSizeDimensions {
        key: "10x14",
        width_mm: 254.0,
        height_mm: 356.0,
    },
    PageSizeDimensions {
        key: "Naga-3",
        width_mm: 120.0,
        height_mm: 235.0,
    },
    PageSizeDimensions {
        key: "Naga-4",
        width_mm: 90.0,
        height_mm: 205.0,
    },
    PageSizeDimensions {
        key: "Kaku-2",
        width_mm: 240.0,
        height_mm: 332.0,
    },
    PageSizeDimensions {
        key: "Kaku-3",
        width_mm: 216.0,
        height_mm: 277.0,
    },
    PageSizeDimensions {
        key: "Kaku-6",
        width_mm: 162.0,
        height_mm: 229.0,
    },
    PageSizeDimensions {
        key: "Kaku-8",
        width_mm: 119.0,
        height_mm: 197.0,
    },
    PageSizeDimensions {
        key: "You-4",
        width_mm: 105.0,
        height_mm: 235.0,
    },
    PageSizeDimensions {
        key: "You-6",
        width_mm: 98.0,
        height_mm: 190.0,
    },
    PageSizeDimensions {
        key: "Hagaki",
        width_mm: 100.0,
        height_mm: 148.0,
    },
    PageSizeDimensions {
        key: "Ofuku-Hagaki",
        width_mm: 200.0,
        height_mm: 148.0,
    },
    PageSizeDimensions {
        key: "L-ban",
        width_mm: 89.0,
        height_mm: 127.0,
    },
    PageSizeDimensions {
        key: "2L-ban",
        width_mm: 127.0,
        height_mm: 178.0,
    },
    PageSizeDimensions {
        key: "KG",
        width_mm: 102.0,
        height_mm: 152.0,
    },
    PageSizeDimensions {
        key: "Cabinet",
        width_mm: 130.0,
        height_mm: 180.0,
    },
    PageSizeDimensions {
        key: "B5",
        width_mm: 176.0,
        height_mm: 250.0,
    },
    PageSizeDimensions {
        key: "B6",
        width_mm: 125.0,
        height_mm: 176.0,
    },
];

pub fn page_dimensions(page_size: &str) -> Option<(f64, f64)> {
    PAGE_DIMENSIONS
        .iter()
        .find(|dimensions| dimensions.key == page_size)
        .map(|dimensions| (dimensions.width_mm, dimensions.height_mm))
}

pub fn page_size_catalog_json() -> Result<String, String> {
    serde_json::to_string(PAGE_DIMENSIONS).map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn resolve(source: &str, writing_mode: Option<&str>) -> ResolvedExportProfile {
        let value: Value = serde_json::from_str(source).unwrap();
        resolve_export_profile(value.as_object().unwrap(), writing_mode).unwrap()
    }

    #[test]
    fn resolves_publisher_and_word_defaults_from_one_rust_authority() {
        let horizontal = resolve("{}", None);
        assert_eq!(horizontal.layout.system, "japanese-publisher");
        assert_eq!(horizontal.layout.margin_mode, "mirror");
        assert_eq!(horizontal.layout.binding_side, "left");
        assert_eq!(horizontal.typesetting.writing_mode, "horizontal");
        assert_eq!(horizontal.typesetting.font_size, 10.0);
        assert_eq!(horizontal.pagination.page_size, "Shirokuban");
        assert_eq!(horizontal.pagination.characters_per_line, 27.0);
        assert_eq!(horizontal.pagination.lines_per_page, 26.0);
        assert_eq!(
            horizontal.pagination.margins,
            Margins {
                top: 16.5,
                bottom: 18.0,
                left: 18.0,
                right: 15.5,
            }
        );

        let vertical = resolve("{}", Some("vertical"));
        assert_eq!(vertical.layout.binding_side, "right");
        assert_eq!(vertical.pagination.page_size, "A4");
        assert!(vertical.pagination.landscape);
        assert_eq!(vertical.pagination.characters_per_line, 40.0);
        assert_eq!(vertical.pagination.lines_per_page, 30.0);

        let word = resolve(r#"{"layout":{"system":"word"}}"#, None);
        assert_eq!(word.layout.margin_mode, "single");
        assert_eq!(word.pagination.grid_mode, "typographic");
        assert_eq!(word.pagination.margins.top, 25.4);
    }

    #[test]
    fn resolves_every_public_page_size_in_both_writing_modes() {
        for dimensions in PAGE_DIMENSIONS {
            let page_size = dimensions.key;
            assert!(page_dimensions(page_size).is_some(), "{page_size}");
            for writing_mode in ["horizontal", "vertical"] {
                let profile = resolve(
                    &format!(
                        r#"{{"typesetting":{{"writingMode":"{writing_mode}"}},"pagination":{{"pageSize":"{page_size}"}}}}"#
                    ),
                    None,
                );
                let (natural_width, natural_height) = page_dimensions(page_size).unwrap();
                let (width, height) = if profile.pagination.landscape {
                    (natural_height, natural_width)
                } else {
                    (natural_width, natural_height)
                };
                assert!(profile.pagination.margins.left + profile.pagination.margins.right < width);
                assert!(
                    profile.pagination.margins.top + profile.pagination.margins.bottom < height
                );
            }
        }
        assert_eq!(PAGE_DIMENSIONS.len(), 67);
        let catalog: Vec<serde_json::Value> =
            serde_json::from_str(&page_size_catalog_json().unwrap()).unwrap();
        assert_eq!(catalog.len(), PAGE_DIMENSIONS.len());
        assert_eq!(catalog[4]["key"], "A4");
        assert_eq!(catalog[4]["widthMm"], 210.0);
        assert!(page_dimensions("A11").is_none());
    }

    #[test]
    fn resolves_aliases_metadata_gutter_and_all_optional_groups() {
        let profile = resolve(
            r#"{
                "layout":{"system":"japanese-publisher","marginMode":"single","bindingSide":"right","gutter":6},
                "metadata":{"title":"Book","author":"Writer"},
                "typesetting":{"writingMode":"horizontal","fontFamily":"  ","fontSizePt":11,"lineHeight":1.5,"textIndentEm":2,"fullwidthSpaceIndent":true},
                "pagination":{"pageSize":"Letter","landscape":true,"charactersPerLine":32,"linesPerPage":28,"gridMode":"typographic","margins":{"top":10,"right":12,"bottom":11,"left":13},"pageNumbers":{"enabled":false,"format":"fraction","position":"top-right"}},
                "epub":{"chapterSplitLevel":"h3","coverPath":"cover.png"},
                "text":{"fullwidthSpaceIndent":true,"indentCount":4}
            }"#,
            None,
        );
        assert_eq!(profile.pagination.margins.right, 18.0);
        assert_eq!(profile.typesetting.font_size, 11.0);
        assert_eq!(profile.typesetting.line_spacing, Some(1.5));
        assert_eq!(profile.typesetting.font_family, PUBLISHING_FONT_FAMILY);
        assert!(!profile.pagination.page_numbers.enabled);
        assert_eq!(profile.pagination.page_numbers.format, "fraction");
        assert_eq!(profile.epub.cover_path.as_deref(), Some("cover.png"));
        assert_eq!(profile.text.indent_count, 4.0);
    }

    #[test]
    fn rejects_malformed_json_and_configured_profiles_without_a_layout() {
        assert_eq!(
            resolve_export_profile_json("{", None, false).unwrap_err(),
            "Export profile must be valid JSON"
        );
        assert_eq!(
            resolve_export_profile_json("[]", None, false).unwrap_err(),
            "Export profile must be a JSON object"
        );
        assert!(
            resolve_export_profile_json(r#"{"pagination":{}}"#, None, true)
                .unwrap_err()
                .contains("Configured exports require layout.system")
        );
        assert!(
            resolve_export_profile_json(
                r#"{"layout":{"system":"word"},"pagination":{}}"#,
                None,
                true
            )
            .is_ok()
        );
    }

    #[test]
    fn rejects_invalid_structures_enums_and_primitive_types() {
        for (source, message) in [
            (r#"{"typesetting":[]}"#, "typesetting must be an object"),
            (
                r#"{"metadata":{"title":42}}"#,
                "metadata.title must be a string",
            ),
            (
                r#"{"typesetting":{"fontFamily":1}}"#,
                "fontFamily must be a string",
            ),
            (
                r#"{"typesetting":{"writingMode":"sideways"}}"#,
                "writingMode must be vertical or horizontal",
            ),
            (
                r#"{"layout":{"system":"other"}}"#,
                "layout.system must be japanese-publisher or word",
            ),
            (
                r#"{"layout":{"marginMode":"fold"}}"#,
                "layout.marginMode must be single or mirror",
            ),
            (
                r#"{"layout":{"bindingSide":"top"}}"#,
                "layout.bindingSide must be right or left",
            ),
            (
                r#"{"pagination":{"pageSize":"A11"}}"#,
                "Unsupported page size",
            ),
            (
                r#"{"pagination":{"landscape":"yes"}}"#,
                "landscape must be a boolean",
            ),
            (
                r#"{"pagination":{"gridMode":"flexible"}}"#,
                "gridMode must be strict or typographic",
            ),
            (
                r#"{"pagination":{"pageNumbers":{"format":"roman"}}}"#,
                "Unsupported page number format",
            ),
            (
                r#"{"pagination":{"pageNumbers":{"position":"middle"}}}"#,
                "Unsupported page number position",
            ),
            (
                r#"{"epub":{"chapterSplitLevel":"h4"}}"#,
                "chapterSplitLevel must be h1, h2, h3, or none",
            ),
        ] {
            let error = resolve_export_profile_json(source, None, false).unwrap_err();
            assert!(error.contains(message), "{source}: {error}");
        }
    }

    #[test]
    fn rejects_conflicts_out_of_range_values_and_impossible_geometry() {
        for (source, message) in [
            (
                r#"{"typesetting":{"fontSize":11,"fontSizePt":12}}"#,
                "fontSize and fontSizePt",
            ),
            (
                r#"{"typesetting":{"lineSpacing":1.2,"lineHeight":1.5},"pagination":{"gridMode":"typographic"}}"#,
                "lineSpacing and lineHeight",
            ),
            (
                r#"{"typesetting":{"lineSpacing":1.5}}"#,
                "gridMode: typographic",
            ),
            (
                r#"{"layout":{"system":"word","gutter":1}}"#,
                "only available with japanese-publisher",
            ),
            (
                r#"{"layout":{"system":"word"},"pagination":{"gridMode":"strict"}}"#,
                "flowing typography",
            ),
            (r#"{"typesetting":{"fontSize":3}}"#, "fontSize"),
            (
                r#"{"typesetting":{"lineSpacing":4},"pagination":{"gridMode":"typographic"}}"#,
                "lineSpacing",
            ),
            (r#"{"typesetting":{"textIndentEm":4.1}}"#, "textIndentEm"),
            (
                r#"{"pagination":{"charactersPerLine":9}}"#,
                "charactersPerLine",
            ),
            (
                r#"{"pagination":{"margins":{"left":100,"right":100}}}"#,
                "left and right margins",
            ),
            (
                r#"{"pagination":{"margins":{"top":100,"bottom":100}}}"#,
                "top and bottom margins",
            ),
            (r#"{"text":{"indentCount":0}}"#, "text.indentCount"),
        ] {
            let error = resolve_export_profile_json(source, None, false).unwrap_err();
            assert!(error.contains(message), "{source}: {error}");
        }
    }

    #[test]
    fn prepares_vertical_mirrored_chromium_profile_and_fraction_header() {
        let prepared = prepare_chromium_print_profile_json(
            "<html><head></head><body><p>本文</p><p> </p></body></html>",
            r#"{
                "layout":{"system":"japanese-publisher","marginMode":"mirror","bindingSide":"right"},
                "typesetting":{"writingMode":"vertical","fontFamily":"Noto Serif JP","textIndentEm":2,"fullwidthSpaceIndent":true},
                "pagination":{"pageSize":"A4","landscape":true,"pageNumbers":{"enabled":true,"format":"fraction","position":"top-right"}}
            }"#,
            None,
        )
        .unwrap();
        let prepared: ChromiumPrintProfile = serde_json::from_str(&prepared).unwrap();

        assert_eq!(prepared.page.width_mm, 297.0);
        assert_eq!(prepared.page.height_mm, 210.0);
        assert!(prepared.page.landscape);
        assert!(prepared.html.contains(r#"<style id="mdi-export-profile">"#));
        assert!(prepared.html.contains("writing-mode:vertical-rl"));
        assert!(prepared.html.contains("@page :right{margin:"));
        assert!(prepared.html.contains("@page :left{margin:"));
        assert!(prepared.html.contains("font-family:Noto Serif JP"));
        assert!(prepared.html.contains("<p>　　本文</p>"));
        assert!(prepared.html.contains("<p> </p>"));
        let header = prepared.page_numbers.header_template.unwrap();
        assert!(header.contains("text-align:right"));
        assert!(header.contains(r#"class="totalPages""#));
        assert!(prepared.page_numbers.footer_template.is_none());
    }

    #[test]
    fn prepares_word_typography_disabled_numbering_and_all_style_injection_shapes() {
        let raw = r#"{
            "layout":{"system":"word"},
            "typesetting":{"fontSize":12,"lineSpacing":1.5},
            "pagination":{"pageNumbers":{"enabled":false}}
        }"#;
        for (html, marker) in [
            (
                "<HTML><HEAD></HEAD><body><p>本文</p></body></HTML>",
                r#"<style id="mdi-export-profile">"#,
            ),
            (
                "<HTML lang=\"ja\"><body><p>本文</p></body></HTML>",
                r#"<HTML lang="ja"><head><style id="mdi-export-profile">"#,
            ),
            ("<p>本文</p>", r#"<style id="mdi-export-profile">"#),
        ] {
            let prepared = prepare_chromium_print_profile_json(html, raw, None).unwrap();
            let prepared: ChromiumPrintProfile = serde_json::from_str(&prepared).unwrap();
            assert!(prepared.html.contains(marker));
            assert!(prepared.html.contains("font-size:4.233333333333"));
            assert!(prepared.html.contains("line-height:1.5"));
            assert!(prepared.html.contains("p{margin:0 0 .75em"));
            assert!(prepared.page_numbers.header_template.is_none());
            assert!(prepared.page_numbers.footer_template.is_none());
        }
    }

    #[test]
    fn applies_resolved_profile_json_without_re_resolving_it() {
        let profile = resolve(r#"{"layout":{"system":"japanese-publisher"}}"#, None);
        let html = apply_pdf_profile_json(
            "<html><head></head><body><p class=\"lead\">本文</p></body></html>",
            &serde_json::to_string(&profile).unwrap(),
        )
        .unwrap();

        assert!(html.contains("@page{size:127mm 188mm"));
        assert!(html.contains("--mdi-grid-mode:strict"));
        assert!(html.contains("--mdi-characters-per-line:27"));
        assert!(html.contains("p{margin:0;text-indent:1em}"));
        assert!(html.contains(r#"<p class="lead">本文"#));
    }
}
