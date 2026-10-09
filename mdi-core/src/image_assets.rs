//! Body-image packaging for self-contained export.
//!
//! The core never reads the filesystem and never makes a network request.
//! Callers supply bytes keyed by the image URL exactly as it appears on the
//! parsed node. `data:` URLs are decoded here and are not taken from the map.

use crate::{Document, ResolvedExportProfile, children, page_dimensions};
use image::ImageDecoder;
use std::collections::{BTreeMap, BTreeSet};
use std::io::Cursor;

pub const DEFAULT_MAX_IMAGE_BYTES: usize = 25 * 1024 * 1024;
pub const MAX_IMAGE_PIXELS: u64 = 40_000_000;
const CSS_PIXELS_PER_INCH: f64 = 96.0;
const MM_PER_INCH: f64 = 25.4;
pub const EMU_PER_CSS_PIXEL: u64 = 9525;

#[derive(Debug, Clone)]
pub struct ImageAsset {
    pub data: Vec<u8>,
    pub media_type: String,
}

#[derive(Debug, Clone, Default)]
pub struct ImageAssets {
    entries: BTreeMap<String, ImageAsset>,
}

impl ImageAssets {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn insert(&mut self, url: impl Into<String>, asset: ImageAsset) {
        self.entries.insert(url.into(), asset);
    }

    pub fn get(&self, url: &str) -> Option<&ImageAsset> {
        self.entries.get(url)
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ImageTarget {
    Html,
    Epub,
    Docx,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ImageKind {
    Png,
    Jpeg,
    Gif,
    WebP,
    Bmp,
    Tiff,
    Svg,
}

impl ImageKind {
    fn media_type(self) -> &'static str {
        match self {
            Self::Png => "image/png",
            Self::Jpeg => "image/jpeg",
            Self::Gif => "image/gif",
            Self::WebP => "image/webp",
            Self::Bmp => "image/bmp",
            Self::Tiff => "image/tiff",
            Self::Svg => "image/svg+xml",
        }
    }

    fn extension(self) -> &'static str {
        match self {
            Self::Png => "png",
            Self::Jpeg => "jpg",
            Self::Gif => "gif",
            Self::WebP => "webp",
            Self::Bmp => "bmp",
            Self::Tiff => "tif",
            Self::Svg => "svg",
        }
    }

    fn kept_by(self, target: ImageTarget) -> bool {
        match target {
            ImageTarget::Html => matches!(
                self,
                Self::Png | Self::Jpeg | Self::Gif | Self::WebP | Self::Bmp | Self::Svg
            ),
            ImageTarget::Epub => {
                matches!(
                    self,
                    Self::Png | Self::Jpeg | Self::Gif | Self::WebP | Self::Svg
                )
            }
            ImageTarget::Docx => {
                matches!(
                    self,
                    Self::Png | Self::Jpeg | Self::Gif | Self::Bmp | Self::Tiff
                )
            }
        }
    }
}

#[derive(Debug, Clone)]
pub struct PreparedImage {
    pub url: String,
    pub media_type: String,
    pub extension: String,
    pub bytes: Vec<u8>,
    pub display_width_px: u32,
    pub display_height_px: u32,
}

impl PreparedImage {
    pub fn filename(&self, index: usize) -> String {
        format!("image{}.{}", index + 1, self.extension)
    }

    pub fn html_src(&self) -> String {
        format!(
            "data:{};base64,{}",
            self.media_type,
            base64_encode(&self.bytes)
        )
    }
}

#[derive(Debug, Clone)]
pub struct PreparedImages {
    by_url: BTreeMap<String, usize>,
    images: Vec<PreparedImage>,
    pub target: ImageTarget,
}

impl PreparedImages {
    pub fn get(&self, url: &str) -> Option<&PreparedImage> {
        self.by_url.get(url).map(|index| &self.images[*index])
    }

    pub fn index_of(&self, url: &str) -> Option<usize> {
        self.by_url.get(url).copied()
    }

    /// Package path or data URL that replaces the manuscript URL in an artifact.
    pub fn embedded_src(&self, url: &str) -> Option<String> {
        let image = self.get(url)?;
        if self.target == ImageTarget::Epub {
            let index = self.index_of(url).unwrap_or(0);
            let filename = image.filename(index);
            Some(format!("images/{filename}"))
        } else {
            Some(image.html_src())
        }
    }

    pub fn iter(&self) -> impl Iterator<Item = (usize, &PreparedImage)> {
        self.images.iter().enumerate()
    }

    pub fn is_empty(&self) -> bool {
        self.images.is_empty()
    }
}

/// Image URLs in document order. Reference-style images contribute the resolved URL.
/// `data:` URLs are included; the loader skips them because the core decodes them.
pub fn image_urls(document: &Document) -> Vec<String> {
    let mut urls = Vec::new();
    let mut seen = BTreeSet::new();
    for child in &document.children {
        collect_urls(child, &mut urls, &mut seen);
    }
    urls
}

fn collect_urls(node: &serde_json::Value, urls: &mut Vec<String>, seen: &mut BTreeSet<String>) {
    if node.get("type").and_then(serde_json::Value::as_str) == Some("image") {
        let url = node
            .get("url")
            .and_then(serde_json::Value::as_str)
            .unwrap_or_default()
            .to_owned();
        if seen.insert(url.clone()) {
            urls.push(url);
        }
    }
    for child in children(node) {
        collect_urls(child, urls, seen);
    }
}

pub fn prepare_images(
    document: &Document,
    assets: &ImageAssets,
    profile: &ResolvedExportProfile,
    target: ImageTarget,
    max_bytes: usize,
) -> Result<PreparedImages, String> {
    let max_bytes = if max_bytes == 0 {
        DEFAULT_MAX_IMAGE_BYTES
    } else {
        max_bytes
    };
    let (box_width, box_height) = content_box_px(profile);
    let mut errors = Vec::new();
    let mut images = Vec::new();
    let mut by_url = BTreeMap::new();
    for url in image_urls(document) {
        match prepare_one(&url, assets, target, box_width, box_height, max_bytes) {
            Ok(image) => {
                by_url.insert(url, images.len());
                images.push(image);
            }
            Err(reason) => errors.push(format!("- {}: {reason}", error_label(&url))),
        }
    }
    if !errors.is_empty() {
        return Err(format!("image export failed:\n{}", errors.join("\n")));
    }
    Ok(PreparedImages {
        by_url,
        images,
        target,
    })
}

fn prepare_one(
    url: &str,
    assets: &ImageAssets,
    target: ImageTarget,
    box_width: u32,
    box_height: u32,
    max_bytes: usize,
) -> Result<PreparedImage, String> {
    let (declared, mut bytes) = source_bytes_checked(url, assets, max_bytes)?;
    if bytes.len() > max_bytes {
        return Err(format!(
            "image is {} bytes, above the {max_bytes} byte limit",
            bytes.len()
        ));
    }
    let sniffed = sniff(&bytes).ok_or_else(|| "unsupported image type".to_owned())?;
    if let Some(declared) = declared
        && declared != sniffed
    {
        return Err(format!(
            "media type {} does not match {}",
            declared.media_type(),
            sniffed.media_type()
        ));
    }
    let mut kind = sniffed;
    let animated_webp = kind == ImageKind::WebP && webp_animated(&bytes);
    let mut orientation = image::metadata::Orientation::NoTransforms;
    let (width, height) = if kind == ImageKind::Svg {
        bytes = sanitize_svg(&bytes)?;
        if bytes.len() > max_bytes {
            return Err(format!(
                "image is {} bytes, above the {max_bytes} byte limit",
                bytes.len()
            ));
        }
        svg_size(&bytes)?
    } else {
        let (stored_width, stored_height) = raster_dimensions(&bytes)?;
        if (stored_width as u64) * (stored_height as u64) > MAX_IMAGE_PIXELS {
            return Err(format!(
                "image is {stored_width} by {stored_height} pixels, above the {MAX_IMAGE_PIXELS} pixel limit"
            ));
        }
        if bakes_orientation(kind, target, animated_webp) {
            orientation = raster_orientation(&bytes)?;
        }
        oriented_size(stored_width, stored_height, orientation)
    };
    if width == 0 || height == 0 {
        return Err("image has no pixel dimensions".to_owned());
    }
    let (display_width, display_height) = fit_px(width, height, box_width, box_height);
    // Animated WebP is stored as one PNG of the first frame. GIF stays the
    // original bytes, including later frames. JPEG and TIFF orientations are
    // baked into the pixels; the rewritten file omits the Orientation tag.
    if animated_webp || !kind.kept_by(target) {
        if kind == ImageKind::Svg {
            bytes = rasterize_svg(&bytes, display_width, display_height)?;
        } else {
            bytes = transcode_png(&bytes)?;
        }
        if bytes.len() > max_bytes {
            return Err(format!(
                "image is {} bytes, above the {max_bytes} byte limit",
                bytes.len()
            ));
        }
        kind = ImageKind::Png;
    } else if matches!(kind, ImageKind::Jpeg | ImageKind::Tiff)
        && orientation != image::metadata::Orientation::NoTransforms
    {
        bytes = encode_oriented(kind, &bytes)?;
        if bytes.len() > max_bytes {
            return Err(format!(
                "image is {} bytes, above the {max_bytes} byte limit",
                bytes.len()
            ));
        }
    }
    Ok(PreparedImage {
        url: url.to_owned(),
        media_type: kind.media_type().to_owned(),
        extension: kind.extension().to_owned(),
        bytes,
        display_width_px: display_width,
        display_height_px: display_height,
    })
}

fn declared_kind(value: &str) -> Result<Option<ImageKind>, String> {
    let media_type = value
        .split(';')
        .next()
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase();
    match media_type.as_str() {
        "" | "application/octet-stream" => Ok(None),
        "image/png" => Ok(Some(ImageKind::Png)),
        "image/jpeg" | "image/jpg" => Ok(Some(ImageKind::Jpeg)),
        "image/gif" => Ok(Some(ImageKind::Gif)),
        "image/webp" => Ok(Some(ImageKind::WebP)),
        "image/bmp" | "image/x-ms-bmp" => Ok(Some(ImageKind::Bmp)),
        "image/tiff" | "image/tif" => Ok(Some(ImageKind::Tiff)),
        "image/svg+xml" => Ok(Some(ImageKind::Svg)),
        other => Err(format!("unsupported image type {other}")),
    }
}

fn source_bytes_checked(
    url: &str,
    assets: &ImageAssets,
    max_bytes: usize,
) -> Result<(Option<ImageKind>, Vec<u8>), String> {
    if url.is_empty() {
        return Err("image URL is empty".to_owned());
    }
    if let Some(rest) = url.strip_prefix("data:") {
        let (media_type, bytes) = decode_data_url(rest, max_bytes)?;
        return Ok((declared_kind(&media_type)?, bytes));
    }
    let Some(asset) = assets.get(url) else {
        return Err("missing image bytes".to_owned());
    };
    if asset.data.len() > max_bytes {
        return Err(format!(
            "image is {} bytes, above the {max_bytes} byte limit",
            asset.data.len()
        ));
    }
    Ok((declared_kind(&asset.media_type)?, asset.data.clone()))
}

fn decode_data_url(rest: &str, max_bytes: usize) -> Result<(String, Vec<u8>), String> {
    let (header, payload) = rest
        .split_once(',')
        .ok_or_else(|| "data URL has no payload".to_owned())?;
    let base64 = header
        .split(';')
        .any(|part| part.eq_ignore_ascii_case("base64"));
    let media_type = header
        .split(';')
        .next()
        .unwrap_or_default()
        .trim()
        .to_owned();
    let media_type = if media_type.is_empty() {
        "text/plain".to_owned()
    } else {
        media_type
    };
    let bytes = if base64 {
        decode_base64(payload)?
    } else {
        percent_decode(payload)?
    };
    if bytes.len() > max_bytes {
        return Err(format!(
            "image is {} bytes, above the {max_bytes} byte limit",
            bytes.len()
        ));
    }
    Ok((media_type, bytes))
}

fn sniff(bytes: &[u8]) -> Option<ImageKind> {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        return Some(ImageKind::Png);
    }
    if bytes.starts_with(&[0xff, 0xd8, 0xff]) {
        return Some(ImageKind::Jpeg);
    }
    if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        return Some(ImageKind::Gif);
    }
    if bytes.len() >= 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        return Some(ImageKind::WebP);
    }
    if bytes.starts_with(b"BM") {
        return Some(ImageKind::Bmp);
    }
    if bytes.len() >= 4 && (bytes.starts_with(b"II*\0") || bytes.starts_with(b"MM\0*")) {
        return Some(ImageKind::Tiff);
    }
    if looks_like_svg(bytes) {
        return Some(ImageKind::Svg);
    }
    None
}

fn looks_like_svg(bytes: &[u8]) -> bool {
    let Ok(text) = std::str::from_utf8(bytes) else {
        return false;
    };
    let text = text.trim_start_matches('\u{feff}');
    let lower = text.trim_start().to_ascii_lowercase();
    lower.starts_with("<svg") || (lower.starts_with("<?xml") && lower.contains("<svg"))
}

fn raster_dimensions(bytes: &[u8]) -> Result<(u32, u32), String> {
    let (width, height) = header_dimensions(bytes)?;
    if width == 0 || height == 0 || u64::from(width) * u64::from(height) > MAX_IMAGE_PIXELS {
        return Err(format!(
            "image is {width} by {height} pixels, above the {MAX_IMAGE_PIXELS} pixel limit"
        ));
    }
    let decoded = image::ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .map_err(|error| error.to_string())?
        .into_dimensions()
        .map_err(|_| "image dimensions could not be read".to_owned())?;
    if decoded.0 == 0 || decoded.1 == 0 {
        return Err("image has no pixel dimensions".to_owned());
    }
    Ok(decoded)
}

fn header_dimensions(bytes: &[u8]) -> Result<(u32, u32), String> {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") && bytes.len() >= 24 {
        return Ok((
            u32::from_be_bytes([bytes[16], bytes[17], bytes[18], bytes[19]]),
            u32::from_be_bytes([bytes[20], bytes[21], bytes[22], bytes[23]]),
        ));
    }
    if (bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a")) && bytes.len() >= 10 {
        return Ok((
            u16::from_le_bytes([bytes[6], bytes[7]]) as u32,
            u16::from_le_bytes([bytes[8], bytes[9]]) as u32,
        ));
    }
    if bytes.starts_with(b"BM") && bytes.len() >= 26 {
        let width = i32::from_le_bytes([bytes[18], bytes[19], bytes[20], bytes[21]]).unsigned_abs();
        let height =
            i32::from_le_bytes([bytes[22], bytes[23], bytes[24], bytes[25]]).unsigned_abs();
        return Ok((width, height));
    }
    image::ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .map_err(|error| error.to_string())?
        .into_dimensions()
        .map_err(|_| "image dimensions could not be read".to_owned())
}

fn webp_animated(bytes: &[u8]) -> bool {
    image::codecs::webp::WebPDecoder::new(Cursor::new(bytes))
        .map(|decoder| decoder.has_animation())
        .unwrap_or(false)
}

fn bakes_orientation(kind: ImageKind, target: ImageTarget, animated_webp: bool) -> bool {
    animated_webp || !kind.kept_by(target) || matches!(kind, ImageKind::Jpeg | ImageKind::Tiff)
}

fn oriented_size(width: u32, height: u32, orientation: image::metadata::Orientation) -> (u32, u32) {
    use image::metadata::Orientation::{Rotate90, Rotate90FlipH, Rotate270, Rotate270FlipH};
    if matches!(
        orientation,
        Rotate90 | Rotate270 | Rotate90FlipH | Rotate270FlipH
    ) {
        (height, width)
    } else {
        (width, height)
    }
}

fn raster_orientation(bytes: &[u8]) -> Result<image::metadata::Orientation, String> {
    let mut decoder = image::ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .map_err(|error| error.to_string())?
        .into_decoder()
        .map_err(|_| "image could not be decoded".to_owned())?;
    decoder
        .orientation()
        .map_err(|_| "image could not be decoded".to_owned())
}

fn decode_oriented(bytes: &[u8]) -> Result<image::DynamicImage, String> {
    let mut decoder = image::ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .map_err(|error| error.to_string())?
        .into_decoder()
        .map_err(|_| "image could not be decoded".to_owned())?;
    let orientation = decoder
        .orientation()
        .map_err(|_| "image could not be decoded".to_owned())?;
    let mut image = image::DynamicImage::from_decoder(decoder)
        .map_err(|_| "image could not be decoded".to_owned())?;
    image.apply_orientation(orientation);
    Ok(image)
}

fn encode_oriented(kind: ImageKind, bytes: &[u8]) -> Result<Vec<u8>, String> {
    let decoded = decode_oriented(bytes)?;
    let mut output = Cursor::new(Vec::new());
    match kind {
        ImageKind::Jpeg => decoded
            .write_with_encoder(image::codecs::jpeg::JpegEncoder::new_with_quality(
                &mut output,
                100,
            ))
            .map_err(|error| error.to_string())?,
        ImageKind::Tiff => decoded
            .write_with_encoder(image::codecs::tiff::TiffEncoder::new(&mut output))
            .map_err(|error| error.to_string())?,
        _ => return Err("image could not be decoded".to_owned()),
    }
    Ok(output.into_inner())
}

pub fn content_box_px(profile: &ResolvedExportProfile) -> (u32, u32) {
    let (natural_width, natural_height) =
        page_dimensions(&profile.pagination.page_size).unwrap_or((210.0, 297.0));
    let (page_width, page_height) = if profile.pagination.landscape {
        (natural_height, natural_width)
    } else {
        (natural_width, natural_height)
    };
    let width_mm =
        (page_width - profile.pagination.margins.left - profile.pagination.margins.right).max(1.0);
    let height_mm =
        (page_height - profile.pagination.margins.top - profile.pagination.margins.bottom).max(1.0);
    (mm_to_css_px(width_mm), mm_to_css_px(height_mm))
}

fn mm_to_css_px(mm: f64) -> u32 {
    ((mm / MM_PER_INCH) * CSS_PIXELS_PER_INCH).floor().max(1.0) as u32
}

pub fn fit_px(width: u32, height: u32, box_width: u32, box_height: u32) -> (u32, u32) {
    if width == 0 || height == 0 {
        return (1, 1);
    }
    if width <= box_width && height <= box_height {
        return (width, height);
    }
    let scale = (box_width as f64 / width as f64).min(box_height as f64 / height as f64);
    let fitted_width = ((width as f64) * scale).floor().max(1.0) as u32;
    let fitted_height = ((height as f64) * scale).floor().max(1.0) as u32;
    (
        fitted_width.min(box_width).max(1),
        fitted_height.min(box_height).max(1),
    )
}

pub fn emu(px: u32) -> u64 {
    u64::from(px) * EMU_PER_CSS_PIXEL
}

fn transcode_png(bytes: &[u8]) -> Result<Vec<u8>, String> {
    let decoded = decode_oriented(bytes)?;
    let mut output = Cursor::new(Vec::new());
    decoded
        .write_with_encoder(image::codecs::png::PngEncoder::new(&mut output))
        .map_err(|error| error.to_string())?;
    Ok(output.into_inner())
}

fn svg_size(bytes: &[u8]) -> Result<(u32, u32), String> {
    let text = std::str::from_utf8(bytes).map_err(|_| "SVG is not UTF-8")?;
    let tree = usvg_tree(text)?;
    let width = tree.size().width().round().max(1.0) as u32;
    let height = tree.size().height().round().max(1.0) as u32;
    Ok((width, height))
}

fn rasterize_svg(bytes: &[u8], width: u32, height: u32) -> Result<Vec<u8>, String> {
    let text = std::str::from_utf8(bytes).map_err(|_| "SVG is not UTF-8")?;
    let tree = usvg_tree(text)?;
    let source_width = tree.size().width();
    let source_height = tree.size().height();
    if source_width <= 0.0 || source_height <= 0.0 {
        return Err("SVG has no pixel dimensions".to_owned());
    }
    let mut pixmap = resvg::tiny_skia::Pixmap::new(width.max(1), height.max(1))
        .ok_or_else(|| "SVG raster size is too large".to_owned())?;
    resvg::render(
        &tree,
        resvg::tiny_skia::Transform::from_scale(
            width as f32 / source_width,
            height as f32 / source_height,
        ),
        &mut pixmap.as_mut(),
    );
    pixmap.encode_png().map_err(|error| error.to_string())
}

fn usvg_tree(text: &str) -> Result<resvg::usvg::Tree, String> {
    resvg::usvg::Tree::from_str(text, &usvg_options())
        .map_err(|error| format!("SVG could not be parsed: {error}"))
}

fn usvg_options() -> resvg::usvg::Options<'static> {
    let mut options = resvg::usvg::Options::default();
    // The default resolver treats href strings as filesystem paths.
    options.image_href_resolver.resolve_string = Box::new(|_href, _options| None);
    options.image_href_resolver.resolve_data =
        Box::new(|_mime, data, _options| match sniff(data.as_slice()) {
            Some(ImageKind::Png) => Some(resvg::usvg::ImageKind::PNG(data)),
            Some(ImageKind::Jpeg) => Some(resvg::usvg::ImageKind::JPEG(data)),
            Some(ImageKind::Gif) => Some(resvg::usvg::ImageKind::GIF(data)),
            Some(ImageKind::WebP) => Some(resvg::usvg::ImageKind::WEBP(data)),
            _ => None,
        });
    options
}

fn sanitize_svg(bytes: &[u8]) -> Result<Vec<u8>, String> {
    sanitize_svg_at(bytes, 0)
}

fn sanitize_svg_at(bytes: &[u8], depth: u32) -> Result<Vec<u8>, String> {
    if depth > 4 {
        return Err("SVG external references are not allowed".to_owned());
    }
    let text = std::str::from_utf8(bytes).map_err(|_| "SVG is not UTF-8".to_owned())?;
    let lowered = text.to_ascii_lowercase();
    if lowered.contains("<!doctype") || lowered.contains("<!entity") {
        return Err("SVG document type declarations are not allowed".to_owned());
    }
    let document = roxmltree::Document::parse(text).map_err(|_| "SVG is not well-formed XML")?;
    let root = document.root_element();
    if !root.tag_name().name().eq_ignore_ascii_case("svg") {
        return Err("SVG root element is missing".to_owned());
    }
    let mut output = String::new();
    write_svg_node(root, depth, &mut output)?;
    Ok(output.into_bytes())
}

fn write_svg_node(
    node: roxmltree::Node<'_, '_>,
    depth: u32,
    output: &mut String,
) -> Result<(), String> {
    match node.node_type() {
        roxmltree::NodeType::Root => {
            for child in node.children() {
                write_svg_node(child, depth, output)?;
            }
            Ok(())
        }
        roxmltree::NodeType::Text => {
            let text = node.text().unwrap_or_default();
            if node
                .parent()
                .is_some_and(|parent| parent.tag_name().name().eq_ignore_ascii_case("style"))
            {
                vet_style(text)?;
            }
            let rewritten = rewrite_nested_svgs(text, depth)?;
            output.push_str(&xml_escape(&rewritten));
            Ok(())
        }
        roxmltree::NodeType::Element => {
            let name = node.tag_name().name();
            if name.eq_ignore_ascii_case("script") || name.eq_ignore_ascii_case("foreignObject") {
                return Ok(());
            }
            if name.eq_ignore_ascii_case("include") {
                return Err("SVG external references are not allowed".to_owned());
            }
            output.push('<');
            output.push_str(name);
            for namespace in node.namespaces() {
                output.push(' ');
                match namespace.name() {
                    Some(prefix) => {
                        output.push_str("xmlns:");
                        output.push_str(prefix);
                    }
                    None => output.push_str("xmlns"),
                }
                output.push_str("=\"");
                output.push_str(&xml_escape(namespace.uri()));
                output.push('"');
            }
            for attribute in node.attributes() {
                match attribute_action(attribute, depth)? {
                    AttributeAction::Keep(value) => {
                        output.push(' ');
                        if let Some(prefix) = attribute.namespace().and_then(|uri| {
                            node.namespaces()
                                .find(|namespace| namespace.uri() == uri)
                                .and_then(|namespace| namespace.name())
                        }) {
                            output.push_str(prefix);
                            output.push(':');
                        }
                        output.push_str(attribute.name());
                        output.push_str("=\"");
                        output.push_str(&xml_escape(&value));
                        output.push('"');
                    }
                    AttributeAction::Drop => {}
                }
            }
            let mut children = String::new();
            for child in node.children() {
                write_svg_node(child, depth, &mut children)?;
            }
            if children.is_empty() {
                output.push_str("/>");
            } else {
                output.push('>');
                output.push_str(&children);
                output.push_str("</");
                output.push_str(name);
                output.push('>');
            }
            Ok(())
        }
        _ => Ok(()),
    }
}

enum AttributeAction {
    Keep(String),
    Drop,
}

fn attribute_action(
    attribute: roxmltree::Attribute<'_, '_>,
    depth: u32,
) -> Result<AttributeAction, String> {
    let name = attribute.name();
    if name.to_ascii_lowercase().starts_with("on")
        || name.eq_ignore_ascii_case("base")
        || name.eq_ignore_ascii_case("xml:base")
    {
        return Ok(AttributeAction::Drop);
    }
    let value = rewrite_nested_svgs(attribute.value(), depth)?;
    if name.eq_ignore_ascii_case("style") {
        vet_style(&value)?;
        return Ok(AttributeAction::Keep(value));
    }
    if is_reference_attribute(name) {
        return match reference_action(&value)? {
            ReferenceDecision::Keep => Ok(AttributeAction::Keep(value)),
            ReferenceDecision::Drop => Ok(AttributeAction::Drop),
        };
    }
    if is_smil_value_attribute(name) {
        return match smil_action(&value)? {
            ReferenceDecision::Keep => Ok(AttributeAction::Keep(value)),
            ReferenceDecision::Drop => Ok(AttributeAction::Drop),
        };
    }
    if contains_javascript(&value) {
        return Ok(AttributeAction::Drop);
    }
    vet_urls(&value)?;
    Ok(AttributeAction::Keep(value))
}

fn is_reference_attribute(name: &str) -> bool {
    matches!(
        name.to_ascii_lowercase().as_str(),
        "href" | "xlink:href" | "src"
    )
}

fn is_smil_value_attribute(name: &str) -> bool {
    matches!(name.to_ascii_lowercase().as_str(), "to" | "from" | "values")
}

enum ReferenceDecision {
    Keep,
    Drop,
}

fn reference_action(value: &str) -> Result<ReferenceDecision, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() || trimmed.starts_with('#') {
        return Ok(ReferenceDecision::Keep);
    }
    if contains_javascript(trimmed) {
        return Ok(ReferenceDecision::Drop);
    }
    let compact = strip_url_whitespace(trimmed);
    if compact.to_ascii_lowercase().starts_with("data:") {
        vet_urls(trimmed)?;
        return Ok(ReferenceDecision::Keep);
    }
    Err("SVG external references are not allowed".to_owned())
}

fn smil_action(value: &str) -> Result<ReferenceDecision, String> {
    if contains_javascript(value) {
        return Ok(ReferenceDecision::Drop);
    }
    vet_urls(value)?;
    for part in value.split(';') {
        let part = strip_url_whitespace(part);
        let trimmed = part.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        let lower = trimmed.to_ascii_lowercase();
        if lower.starts_with("data:") {
            continue;
        }
        if trimmed.contains('/') || trimmed.contains("://") || trimmed.starts_with("//") {
            return Err("SVG external references are not allowed".to_owned());
        }
    }
    Ok(ReferenceDecision::Keep)
}

fn vet_style(value: &str) -> Result<(), String> {
    let compact = strip_url_whitespace(value).to_ascii_lowercase();
    if compact.contains("javascript:") || compact.contains("@import") {
        return Err("SVG external references are not allowed".to_owned());
    }
    vet_urls(value)
}

fn vet_urls(value: &str) -> Result<(), String> {
    let compact = strip_url_whitespace(value);
    let lower = compact.to_ascii_lowercase();
    let mut rest = lower.as_str();
    while let Some(start) = rest.find("url(") {
        let after = &rest[start + 4..];
        let body = after.trim_start_matches(['\'', '"', ' ']);
        if !(body.starts_with('#') || body.starts_with("data:")) {
            return Err("SVG external references are not allowed".to_owned());
        }
        rest = body;
    }
    Ok(())
}

fn contains_javascript(value: &str) -> bool {
    strip_url_whitespace(value)
        .to_ascii_lowercase()
        .contains("javascript:")
}

fn strip_url_whitespace(value: &str) -> String {
    value
        .chars()
        .filter(|character| !matches!(character, '\t' | '\n' | '\r' | '\0'))
        .collect()
}

fn rewrite_nested_svgs(value: &str, depth: u32) -> Result<String, String> {
    let needle = "data:image/svg+xml";
    if !value.to_ascii_lowercase().contains(needle) {
        return Ok(value.to_owned());
    }
    let mut output = String::new();
    let mut rest = value;
    loop {
        let lower = rest.to_ascii_lowercase();
        let Some(start) = lower.find(needle) else {
            output.push_str(rest);
            break;
        };
        output.push_str(&rest[..start]);
        let after = &rest[start..];
        let end = after
            .find([' ', '"', '\'', ')', '>'])
            .unwrap_or(after.len());
        let rewritten = sanitized_svg_data_url(&after[..end], depth)?;
        output.push_str(&rewritten);
        rest = &after[end..];
    }
    Ok(output)
}

fn sanitized_svg_data_url(url: &str, depth: u32) -> Result<String, String> {
    let Some(rest) = url.get("data:".len()..) else {
        return Err("SVG external references are not allowed".to_owned());
    };
    let (media_type, bytes) = decode_data_url(rest, DEFAULT_MAX_IMAGE_BYTES)?;
    if !media_type
        .split(';')
        .next()
        .unwrap_or_default()
        .trim()
        .eq_ignore_ascii_case("image/svg+xml")
    {
        return Ok(url.to_owned());
    }
    let clean = sanitize_svg_at(&bytes, depth + 1)?;
    let encoded = base64_encode(&clean);
    Ok(format!("data:image/svg+xml;base64,{encoded}"))
}

fn xml_escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

pub fn error_label(url: &str) -> String {
    if let Some(rest) = url.strip_prefix("data:") {
        let media_type = rest
            .split([',', ';'])
            .next()
            .unwrap_or("application/octet-stream");
        let media_type = if media_type.is_empty() {
            "text/plain"
        } else {
            media_type
        };
        return format!("data:{media_type}");
    }
    strip_userinfo(url)
}

fn strip_userinfo(url: &str) -> String {
    let (prefix_len, rest) = if let Some(rest) = url.strip_prefix("//") {
        (2, rest)
    } else if let Some(index) = url.find("://") {
        (index + 3, &url[index + 3..])
    } else {
        return url.to_owned();
    };
    let Some(at) = rest.find('@') else {
        return url.to_owned();
    };
    if rest[..at].contains('/') {
        return url.to_owned();
    }
    format!("{}{}", &url[..prefix_len], &rest[at + 1..])
}

fn base64_encode(bytes: &[u8]) -> String {
    const TABLE: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut output = String::new();
    let mut index = 0;
    while index + 3 <= bytes.len() {
        let value = u32::from(bytes[index]) << 16
            | u32::from(bytes[index + 1]) << 8
            | u32::from(bytes[index + 2]);
        output.push(TABLE[((value >> 18) & 63) as usize] as char);
        output.push(TABLE[((value >> 12) & 63) as usize] as char);
        output.push(TABLE[((value >> 6) & 63) as usize] as char);
        output.push(TABLE[(value & 63) as usize] as char);
        index += 3;
    }
    if index < bytes.len() {
        let remaining = bytes.len() - index;
        let mut value = u32::from(bytes[index]) << 16;
        if remaining == 2 {
            value |= u32::from(bytes[index + 1]) << 8;
        }
        output.push(TABLE[((value >> 18) & 63) as usize] as char);
        output.push(TABLE[((value >> 12) & 63) as usize] as char);
        if remaining == 2 {
            output.push(TABLE[((value >> 6) & 63) as usize] as char);
            output.push('=');
        } else {
            output.push('=');
            output.push('=');
        }
    }
    output
}

fn decode_base64(value: &str) -> Result<Vec<u8>, String> {
    let bytes = value
        .bytes()
        .filter(|byte| !byte.is_ascii_whitespace())
        .collect::<Vec<_>>();
    if bytes.len() % 4 != 0 {
        return Err("data URL base64 is invalid".to_owned());
    }
    let mut output = Vec::new();
    for chunk in bytes.chunks(4) {
        let decoded = [
            base64_value(chunk[0])?,
            base64_value(chunk[1])?,
            base64_value(chunk[2])?,
            base64_value(chunk[3])?,
        ];
        output.push((decoded[0] << 2) | (decoded[1] >> 4));
        if chunk[2] != b'=' {
            output.push((decoded[1] << 4) | (decoded[2] >> 2));
        }
        if chunk[3] != b'=' {
            output.push((decoded[2] << 6) | decoded[3]);
        }
    }
    Ok(output)
}

fn base64_value(byte: u8) -> Result<u8, String> {
    match byte {
        b'A'..=b'Z' => Ok(byte - b'A'),
        b'a'..=b'z' => Ok(byte - b'a' + 26),
        b'0'..=b'9' => Ok(byte - b'0' + 52),
        b'+' => Ok(62),
        b'/' => Ok(63),
        b'=' => Ok(0),
        _ => Err("data URL base64 is invalid".to_owned()),
    }
}

fn percent_decode(value: &str) -> Result<Vec<u8>, String> {
    let bytes = value.as_bytes();
    let mut output = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' {
            if index + 2 >= bytes.len() {
                return Err("data URL encoding is invalid".to_owned());
            }
            let hex = std::str::from_utf8(&bytes[index + 1..index + 3])
                .map_err(|_| "data URL encoding is invalid".to_owned())?;
            output.push(
                u8::from_str_radix(hex, 16)
                    .map_err(|_| "data URL encoding is invalid".to_owned())?,
            );
            index += 3;
        } else {
            output.push(bytes[index]);
            index += 1;
        }
    }
    Ok(output)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{EpubCover, parse_document, resolve_export_profile};
    use image::GenericImageView;
    use serde_json::Map;
    use std::io::Read;

    fn profile() -> ResolvedExportProfile {
        resolve_export_profile(&Map::new(), None).expect("default profile")
    }

    fn png() -> Vec<u8> {
        let image = image::RgbaImage::from_pixel(2, 1, image::Rgba([255, 0, 0, 255]));
        let mut bytes = Cursor::new(Vec::new());
        image
            .write_with_encoder(image::codecs::png::PngEncoder::new(&mut bytes))
            .expect("png");
        bytes.into_inner()
    }

    fn asset(bytes: Vec<u8>, media_type: &str) -> ImageAsset {
        ImageAsset {
            data: bytes,
            media_type: media_type.to_owned(),
        }
    }

    #[test]
    fn sniff_recognizes_signatures_and_rejects_html() {
        assert_eq!(sniff(&png()), Some(ImageKind::Png));
        assert_eq!(sniff(b"GIF89a"), Some(ImageKind::Gif));
        assert_eq!(sniff(&[0xff, 0xd8, 0xff, 0xd9]), Some(ImageKind::Jpeg));
        assert_eq!(sniff(b"RIFF\0\0\0\0WEBP"), Some(ImageKind::WebP));
        assert_eq!(sniff(b"BM"), Some(ImageKind::Bmp));
        assert_eq!(sniff(b"II*\0"), Some(ImageKind::Tiff));
        assert_eq!(
            sniff(b"<svg xmlns=\"http://www.w3.org/2000/svg\"/>"),
            Some(ImageKind::Svg)
        );
        assert_eq!(sniff(b"<html><img></html>"), None);
        assert_eq!(sniff(b""), None);
    }

    #[test]
    fn data_url_decodes_and_rejects_a_type_mismatch() {
        let bytes = png();
        let url = format!("data:image/png;base64,{}", base64_encode(&bytes));
        let document = parse_document(&format!("![]({url})\n"));
        let prepared = prepare_images(
            &document,
            &ImageAssets::new(),
            &profile(),
            ImageTarget::Html,
            DEFAULT_MAX_IMAGE_BYTES,
        )
        .expect("png data url");
        assert_eq!(prepared.get(&url).expect("image").media_type, "image/png");
        assert!(
            prepared
                .get(&url)
                .expect("image")
                .html_src()
                .starts_with("data:image/png;base64,")
        );

        let wrong = format!("data:image/gif;base64,{}", base64_encode(&bytes));
        let document = parse_document(&format!("![]({wrong})\n"));
        let error = prepare_images(
            &document,
            &ImageAssets::new(),
            &profile(),
            ImageTarget::Html,
            1024,
        )
        .expect_err("mismatch");
        assert!(error.contains("does not match"));
        assert!(!error.contains(&base64_encode(&bytes)));
    }

    #[test]
    fn missing_extra_empty_and_distinct_keys() {
        let document = parse_document("![](a%20b.png)\n\n![]()\n\n![](<a b.png>)\n");
        let mut assets = ImageAssets::new();
        assets.insert("a%20b.png", asset(png(), "image/png"));
        assets.insert("unused.png", asset(png(), "image/png"));
        let error = prepare_images(
            &document,
            &assets,
            &profile(),
            ImageTarget::Html,
            DEFAULT_MAX_IMAGE_BYTES,
        )
        .expect_err("missing and empty");
        assert!(error.contains("a b.png"));
        assert!(error.contains("image URL is empty"));
        assert!(!error.contains("unused.png"));
    }

    #[test]
    fn repeated_url_is_prepared_once() {
        let document = parse_document("![](a.png)\n\n![](a.png)\n");
        let mut assets = ImageAssets::new();
        assets.insert("a.png", asset(png(), "application/octet-stream"));
        let prepared = prepare_images(
            &document,
            &assets,
            &profile(),
            ImageTarget::Html,
            DEFAULT_MAX_IMAGE_BYTES,
        )
        .expect("png");
        assert_eq!(prepared.iter().count(), 1);
        assert_eq!(image_urls(&document), vec!["a.png".to_owned()]);
    }

    #[test]
    fn svg_sanitizer_removes_active_content_and_rejects_external_refs() {
        let safe = br##"<svg xmlns="http://www.w3.org/2000/svg" width="8" height="4"><script>alert(1)</script><rect width="8" height="4" onclick="alert(1)"/><use href="#icon"/></svg>"##;
        let sanitized = sanitize_svg(safe).expect("sanitize");
        let text = String::from_utf8(sanitized).expect("utf8");
        assert!(!text.to_ascii_lowercase().contains("script"));
        assert!(!text.contains("onclick"));
        assert!(text.contains("href=\"#icon\""));

        let external = br#"<svg xmlns="http://www.w3.org/2000/svg" width="8" height="4"><image href="https://example.test/a.png"/></svg>"#;
        assert!(
            sanitize_svg(external)
                .expect_err("external")
                .contains("external")
        );
        assert!(
            sanitize_svg(b"<!DOCTYPE svg [<!ENTITY xxe SYSTEM 'file:///etc/passwd'>]><svg/>")
                .is_err()
        );
        let styled = br#"<svg xmlns="http://www.w3.org/2000/svg" width="8" height="4"><style>@import "https://evil.example/a.css"</style></svg>"#;
        assert!(sanitize_svg(styled).is_err());
        let fill = br#"<svg xmlns="http://www.w3.org/2000/svg" width="8" height="4"><rect width="8" height="4" fill="url(https://evil.example/a.png)"/></svg>"#;
        assert!(sanitize_svg(fill).is_err());
        let obfuscated = br#"<svg xmlns="http://www.w3.org/2000/svg" width="8" height="4"><set attributeName="href" to="java&#9;script:alert(1)"/></svg>"#;
        let cleaned =
            String::from_utf8(sanitize_svg(obfuscated).expect("obfuscated")).expect("utf8");
        assert!(!cleaned.to_ascii_lowercase().contains("javascript"));
        assert!(!cleaned.contains("alert"));
        let inner = base64_encode(
            b"<svg xmlns=\"http://www.w3.org/2000/svg\"><image href=\"/etc/passwd\"/></svg>",
        );
        let nested = format!(
            "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"8\" height=\"4\"><image href=\"data:image/svg+xml;base64,{inner}\"/></svg>"
        );
        assert!(sanitize_svg(nested.as_bytes()).is_err());
    }

    #[test]
    fn fit_keeps_small_images_and_scales_both_sides_without_upscaling() {
        assert_eq!(fit_px(10, 20, 100, 100), (10, 20));
        assert_eq!(fit_px(200, 100, 100, 100), (100, 50));
        assert_eq!(fit_px(100, 400, 100, 100), (25, 100));
        assert_eq!(emu(2), 19_050);
    }

    #[test]
    fn content_box_uses_page_minus_margins() {
        let profile = profile();
        let (width, height) = content_box_px(&profile);
        assert!(width > 100 && height > 100);
        assert!(width < mm_to_css_px(210.0));
        assert!(height < mm_to_css_px(297.0));
    }

    #[test]
    fn oversized_declared_dimensions_fail_before_transcode() {
        let mut header = png();
        header[16..20].copy_from_slice(&40_000u32.to_be_bytes());
        header[20..24].copy_from_slice(&40_000u32.to_be_bytes());
        let document = parse_document("![](big.png)\n");
        let mut assets = ImageAssets::new();
        assets.insert("big.png", asset(header, "image/png"));
        let error = prepare_images(
            &document,
            &assets,
            &profile(),
            ImageTarget::Html,
            1024 * 1024,
        )
        .expect_err("pixel limit");
        assert!(error.contains("pixel limit"));
    }

    #[test]
    fn conversion_matrix_and_error_labels() {
        let jpeg = {
            let image = image::RgbImage::from_pixel(1, 1, image::Rgb([1, 2, 3]));
            let mut bytes = Cursor::new(Vec::new());
            image
                .write_with_encoder(image::codecs::jpeg::JpegEncoder::new(&mut bytes))
                .expect("jpeg");
            bytes.into_inner()
        };
        let document = parse_document("![](a.jpg)\n");
        let mut assets = ImageAssets::new();
        assets.insert(
            "https://user:secret@example.test/a.jpg",
            asset(jpeg.clone(), "image/jpeg"),
        );
        let kept = prepare_images(
            &parse_document("![](https://user:secret@example.test/a.jpg)\n"),
            &assets,
            &profile(),
            ImageTarget::Epub,
            DEFAULT_MAX_IMAGE_BYTES,
        )
        .expect("jpeg");
        assert_eq!(
            kept.get("https://user:secret@example.test/a.jpg")
                .expect("image")
                .media_type,
            "image/jpeg"
        );

        let bmp = {
            let image = image::RgbImage::from_pixel(1, 1, image::Rgb([4, 5, 6]));
            let mut bytes = Cursor::new(Vec::new());
            image
                .write_with_encoder(image::codecs::bmp::BmpEncoder::new(&mut bytes))
                .expect("bmp");
            bytes.into_inner()
        };
        let mut assets = ImageAssets::new();
        assets.insert("a.bmp", asset(bmp.clone(), "image/bmp"));
        let epub = prepare_images(
            &parse_document("![](a.bmp)\n"),
            &assets,
            &profile(),
            ImageTarget::Epub,
            DEFAULT_MAX_IMAGE_BYTES,
        )
        .expect("bmp epub");
        assert_eq!(epub.get("a.bmp").expect("image").media_type, "image/png");
        let docx = prepare_images(
            &parse_document("![](a.bmp)\n"),
            &assets,
            &profile(),
            ImageTarget::Docx,
            DEFAULT_MAX_IMAGE_BYTES,
        )
        .expect("bmp docx");
        assert_eq!(docx.get("a.bmp").expect("image").media_type, "image/bmp");
        let html = prepare_images(
            &parse_document("![](a.bmp)\n"),
            &assets,
            &profile(),
            ImageTarget::Html,
            DEFAULT_MAX_IMAGE_BYTES,
        )
        .expect("bmp html");
        assert_eq!(html.get("a.bmp").expect("image").media_type, "image/bmp");
        assert_eq!(html.get("a.bmp").expect("image").bytes, bmp);

        let tiff = {
            let image = image::RgbImage::from_pixel(2, 1, image::Rgb([1, 1, 1]));
            let mut bytes = Cursor::new(Vec::new());
            image
                .write_with_encoder(image::codecs::tiff::TiffEncoder::new(&mut bytes))
                .expect("tiff");
            bytes.into_inner()
        };
        let mut assets = ImageAssets::new();
        assets.insert("a.tif", asset(tiff, "image/tiff"));
        for target in [ImageTarget::Html, ImageTarget::Epub] {
            let prepared = prepare_images(
                &parse_document("![](a.tif)\n"),
                &assets,
                &profile(),
                target,
                DEFAULT_MAX_IMAGE_BYTES,
            )
            .expect("tiff png");
            let image = prepared.get("a.tif").expect("image");
            assert_eq!(image.media_type, "image/png");
            assert!(image.bytes.starts_with(b"\x89PNG\r\n\x1a\n"));
        }
        let docx = prepare_images(
            &parse_document("![](a.tif)\n"),
            &assets,
            &profile(),
            ImageTarget::Docx,
            DEFAULT_MAX_IMAGE_BYTES,
        )
        .expect("tiff docx");
        let image = docx.get("a.tif").expect("image");
        assert_eq!(image.media_type, "image/tiff");
        if stored_orientation(ImageKind::Tiff, &image.bytes).is_some() {
            assert_eq!(stored_orientation(ImageKind::Tiff, &image.bytes), Some(1));
        }

        let still = lossless_webp();
        let mut assets = ImageAssets::new();
        assets.insert("a.webp", asset(still.clone(), "image/webp"));
        let epub = prepare_images(
            &parse_document("![](a.webp)\n"),
            &assets,
            &profile(),
            ImageTarget::Epub,
            DEFAULT_MAX_IMAGE_BYTES,
        )
        .expect("webp epub");
        let image = epub.get("a.webp").expect("image");
        assert_eq!(image.media_type, "image/webp");
        assert_eq!(image.bytes, still);

        let svg = br#"<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="black"/></svg>"#;
        let mut assets = ImageAssets::new();
        assets.insert("a.svg", asset(svg.to_vec(), "image/svg+xml"));
        let epub = prepare_images(
            &parse_document("![](a.svg)\n"),
            &assets,
            &profile(),
            ImageTarget::Epub,
            DEFAULT_MAX_IMAGE_BYTES,
        )
        .expect("svg");
        assert_eq!(
            epub.get("a.svg").expect("image").media_type,
            "image/svg+xml"
        );
        assert!(
            !String::from_utf8_lossy(&epub.get("a.svg").expect("image").bytes).contains("<script")
        );
        let docx = prepare_images(
            &parse_document("![](a.svg)\n"),
            &assets,
            &profile(),
            ImageTarget::Docx,
            DEFAULT_MAX_IMAGE_BYTES,
        )
        .expect("svg docx");
        assert_eq!(docx.get("a.svg").expect("image").media_type, "image/png");
        assert!(error_label("https://user:secret@example.test/a.png").contains("example.test"));
        assert!(!error_label("https://user:secret@example.test/a.png").contains("secret"));
        assert!(!error_label("//user:secret@example.test/a.png").contains("secret"));
        assert!(error_label("//user:secret@example.test/a.png").contains("example.test"));
        assert!(error_label("https://example.test/a@b.png").contains("a@b.png"));
        assert_eq!(error_label("data:image/png;base64,aaaa"), "data:image/png");
        let _ = (document, jpeg);
    }

    #[test]
    fn supplied_data_url_ignores_the_asset_map() {
        let bytes = png();
        let other = image::RgbaImage::from_pixel(1, 1, image::Rgba([0, 0, 0, 255]));
        let mut other_bytes = Cursor::new(Vec::new());
        other
            .write_with_encoder(image::codecs::png::PngEncoder::new(&mut other_bytes))
            .expect("png");
        let url = format!("data:image/png;base64,{}", base64_encode(&bytes));
        let mut assets = ImageAssets::new();
        assets.insert(&url, asset(other_bytes.into_inner(), "image/png"));
        let prepared = prepare_images(
            &parse_document(&format!("![]({url})\n")),
            &assets,
            &profile(),
            ImageTarget::Html,
            DEFAULT_MAX_IMAGE_BYTES,
        )
        .expect("data");
        assert_eq!(prepared.get(&url).expect("image").bytes, bytes);
    }

    #[test]
    fn packages_html_epub_and_docx_without_the_original_url() {
        let source = "![a<b](../../[Content_Types].xml)\n\n![a<b](../../[Content_Types].xml)\n\nSee [^n].\n\n[^n]: ![note](note.png)\n\n[[warichu:![cut](note.png)]]\n";
        let mut assets = ImageAssets::new();
        assets.insert("../../[Content_Types].xml", asset(png(), "image/png"));
        assets.insert("note.png", asset(png(), "image/png"));
        let html = crate::render_html_with_assets(source, &assets, None, DEFAULT_MAX_IMAGE_BYTES)
            .expect("html");
        assert!(html.contains("data:image/png;base64,"));
        assert!(html.contains("alt=\"a&lt;b\""));
        assert!(html.contains("data-mdi-warichu-source"));
        assert!(!html.contains("[Content_Types].xml"));
        assert!(!html.contains("note.png"));
        assert_eq!(
            crate::render_html(source)
                .matches("src=\"../../[Content_Types].xml\"")
                .count(),
            2
        );

        let profile = serde_json::json!({"layout":{"system":"word"}}).to_string();
        let epub = crate::render_epub_with_profile_and_assets(
            "# One\n\n![](a.png)\n\n# Two\n\n![](a.png)\n",
            &profile,
            None,
            &{
                let mut assets = ImageAssets::new();
                assets.insert("a.png", asset(png(), "image/png"));
                assets
            },
            DEFAULT_MAX_IMAGE_BYTES,
        )
        .expect("epub");
        let mut archive = zip::ZipArchive::new(Cursor::new(epub)).expect("zip");
        let mut names = archive.file_names().map(str::to_owned).collect::<Vec<_>>();
        names.sort();
        assert_eq!(
            names
                .iter()
                .filter(|name| name.contains("images/image1.png"))
                .count(),
            1
        );
        assert!(names.iter().all(|name| !name.contains("..")));
        let mut opf = String::new();
        archive
            .by_name("OEBPS/package.opf")
            .expect("opf")
            .read_to_string(&mut opf)
            .expect("read");
        assert_eq!(opf.matches("images/image1.png").count(), 1);
        assert!(opf.contains("version=\"3.0\""));
        let mut chapter = String::new();
        archive
            .by_name("OEBPS/chapter-1.xhtml")
            .expect("chapter")
            .read_to_string(&mut chapter)
            .expect("read");
        assert!(chapter.contains("<img src=\"images/image1.png\""));
        assert!(chapter.contains("/>"));
        let mut chapter_two = String::new();
        archive
            .by_name("OEBPS/chapter-2.xhtml")
            .expect("chapter")
            .read_to_string(&mut chapter_two)
            .expect("read");
        assert!(chapter_two.contains("images/image1.png"));

        let docx = crate::render_docx_with_profile_and_assets(
            source,
            &profile,
            &assets,
            DEFAULT_MAX_IMAGE_BYTES,
        )
        .expect("docx");
        let mut archive = zip::ZipArchive::new(Cursor::new(docx)).expect("zip");
        let names = archive.file_names().map(str::to_owned).collect::<Vec<_>>();
        assert!(names.iter().any(|name| name == "word/media/image1.png"));
        assert!(names.iter().all(|name| !name.contains("..")));
        assert!(
            names
                .iter()
                .filter(|name| name.starts_with("word/media/"))
                .all(|name| {
                    name.strip_prefix("word/media/image")
                        .is_some_and(|rest| rest.chars().next().is_some_and(|c| c.is_ascii_digit()))
                })
        );
        let mut document = String::new();
        archive
            .by_name("word/document.xml")
            .expect("document")
            .read_to_string(&mut document)
            .expect("read");
        assert!(document.contains("r:embed=\"rImg"));
        assert!(document.contains("descr=\"a&lt;b\""));
        assert!(document.contains("w:eastAsianLayout"));
        let mut footnotes = String::new();
        archive
            .by_name("word/footnotes.xml")
            .expect("footnotes")
            .read_to_string(&mut footnotes)
            .expect("read");
        assert!(footnotes.contains("r:embed=\"rFnImg"));
        let mut footnote_rels = String::new();
        archive
            .by_name("word/_rels/footnotes.xml.rels")
            .expect("rels")
            .read_to_string(&mut footnote_rels)
            .expect("read");
        assert!(footnote_rels.contains("wordprocessingml") || footnote_rels.contains("/image"));
        assert!(footnote_rels.contains("media/image"));
        let mut types = String::new();
        archive
            .by_name("[Content_Types].xml")
            .expect("types")
            .read_to_string(&mut types)
            .expect("read");
        assert!(types.contains("Extension=\"png\""));
        assert!(types.contains("ContentType=\"image/png\""));
        let mut rels = String::new();
        archive
            .by_name("word/_rels/document.xml.rels")
            .expect("rels")
            .read_to_string(&mut rels)
            .expect("read");
        assert!(rels.contains("relationships/image"));
    }

    #[test]
    fn word_profile_fits_a_wide_image_that_the_default_box_shrinks() {
        let wide = wide_png(400, 2);
        let mut assets = ImageAssets::new();
        assets.insert("wide.png", asset(wide, "image/png"));
        let source = "![](wide.png)\n";
        let word = r#"{"layout":{"system":"word"}}"#;
        let fitted =
            crate::render_html_with_assets(source, &assets, Some(word), DEFAULT_MAX_IMAGE_BYTES)
                .expect("word");
        assert!(fitted.contains("width=\"400\""));
        let shrunk = crate::render_html_with_assets(source, &assets, None, DEFAULT_MAX_IMAGE_BYTES)
            .expect("default");
        assert!(!shrunk.contains("width=\"400\""));
    }

    #[test]
    fn warichu_settle_html_keeps_the_fitted_size() {
        let mut assets = ImageAssets::new();
        assets.insert("wide.png", asset(wide_png(800, 4), "image/png"));
        let html = crate::render_html_with_assets(
            "[[warichu:![x](wide.png)]]\n",
            &assets,
            Some(r#"{"layout":{"system":"word"}}"#),
            DEFAULT_MAX_IMAGE_BYTES,
        )
        .expect("html");
        let marker = "data-mdi-warichu-source=\"";
        let start = html.find(marker).expect("attribute") + marker.len();
        let end = html[start..].find('"').expect("end") + start;
        let nodes = html[start..end]
            .replace("&quot;", "\"")
            .replace("&amp;", "&")
            .replace("&lt;", "<")
            .replace("&gt;", ">");
        assert!(nodes.contains("displayWidth"));
        assert!(!nodes.contains("wide.png"));
        let layout = crate::layout_warichu_options_json(
            &nodes,
            r#"{"firstCapacity":80,"continuationCapacity":80}"#,
        )
        .expect("layout");
        assert!(layout.contains("width="));
        assert!(layout.contains("height="));
        assert!(!layout.contains("wide.png"));
    }

    #[test]
    fn linked_image_stays_inside_the_link() {
        let mut assets = ImageAssets::new();
        assets.insert("a.png", asset(png(), "image/png"));
        let source = "[![alt](a.png)](https://example.test/page)\n";
        let html = crate::render_html_with_assets(source, &assets, None, DEFAULT_MAX_IMAGE_BYTES)
            .expect("html");
        assert!(html.contains("<a href=\"https://example.test/page\">"));
        assert!(html.contains("data:image/png;base64,"));
        assert!(!html.contains("a.png"));
        let profile = "{}";
        let docx = crate::render_docx_with_profile_and_assets(
            source,
            profile,
            &assets,
            DEFAULT_MAX_IMAGE_BYTES,
        )
        .expect("docx");
        let mut document = String::new();
        let mut archive = zip::ZipArchive::new(Cursor::new(docx)).expect("zip");
        archive
            .by_name("word/document.xml")
            .expect("document")
            .read_to_string(&mut document)
            .expect("read");
        assert!(document.contains("<w:hyperlink"));
        assert!(document.contains("r:embed=\"rImg"));
        assert!(!document.contains("a.png"));
    }

    #[test]
    fn gif_bytes_stay_and_animated_webp_becomes_the_first_frame() {
        let gif = animated_gif();
        let mut assets = ImageAssets::new();
        assets.insert("a.gif", asset(gif.clone(), "image/gif"));
        for target in [ImageTarget::Html, ImageTarget::Epub, ImageTarget::Docx] {
            let prepared = prepare_images(
                &parse_document("![](a.gif)\n"),
                &assets,
                &profile(),
                target,
                DEFAULT_MAX_IMAGE_BYTES,
            )
            .expect("gif");
            let image = prepared.get("a.gif").expect("image");
            assert_eq!(image.media_type, "image/gif");
            assert_eq!(image.bytes, gif);
        }

        let still = lossless_webp();
        let mut assets = ImageAssets::new();
        assets.insert("a.webp", asset(still.clone(), "image/webp"));
        let html = prepare_images(
            &parse_document("![](a.webp)\n"),
            &assets,
            &profile(),
            ImageTarget::Html,
            DEFAULT_MAX_IMAGE_BYTES,
        )
        .expect("still");
        assert_eq!(html.get("a.webp").expect("image").bytes, still);
        let docx = prepare_images(
            &parse_document("![](a.webp)\n"),
            &assets,
            &profile(),
            ImageTarget::Docx,
            DEFAULT_MAX_IMAGE_BYTES,
        )
        .expect("docx webp");
        assert_eq!(docx.get("a.webp").expect("image").media_type, "image/png");

        let animated = animated_webp(&still);
        assert!(webp_animated(&animated));
        let mut assets = ImageAssets::new();
        assets.insert("a.webp", asset(animated, "image/webp"));
        let prepared = prepare_images(
            &parse_document("![](a.webp)\n"),
            &assets,
            &profile(),
            ImageTarget::Html,
            DEFAULT_MAX_IMAGE_BYTES,
        )
        .expect("animated");
        let image = prepared.get("a.webp").expect("image");
        assert_eq!(image.media_type, "image/png");
        assert!(image.bytes.starts_with(b"\x89PNG\r\n\x1a\n"));
        assert_eq!(image.display_width_px, 1);
        assert_eq!(image.display_height_px, 1);
        for target in [ImageTarget::Epub, ImageTarget::Docx] {
            let prepared = prepare_images(
                &parse_document("![](a.webp)\n"),
                &assets,
                &profile(),
                target,
                DEFAULT_MAX_IMAGE_BYTES,
            )
            .expect("animated webp");
            let image = prepared.get("a.webp").expect("image");
            assert_eq!(image.media_type, "image/png");
            assert!(image.bytes.starts_with(b"\x89PNG\r\n\x1a\n"));
        }
    }

    #[test]
    fn orientation_is_baked_into_pixels() {
        let jpeg = red_blue_jpeg(Some(6));
        for target in [ImageTarget::Html, ImageTarget::Epub, ImageTarget::Docx] {
            let mut assets = ImageAssets::new();
            assets.insert("a.jpg", asset(jpeg.clone(), "image/jpeg"));
            let prepared = prepare_images(
                &parse_document("![](a.jpg)\n"),
                &assets,
                &profile(),
                target,
                DEFAULT_MAX_IMAGE_BYTES,
            )
            .expect("jpeg");
            let image = prepared.get("a.jpg").expect("image");
            assert_eq!(image.media_type, "image/jpeg");
            assert_eq!(image.display_width_px, 1);
            assert_eq!(image.display_height_px, 2);
            assert!(stored_orientation(ImageKind::Jpeg, &image.bytes).is_none());
            assert_upright_red_blue(&image.bytes);
        }

        let tiff = red_blue_tiff(Some(6));
        for target in [ImageTarget::Html, ImageTarget::Epub] {
            let mut assets = ImageAssets::new();
            assets.insert("a.tif", asset(tiff.clone(), "image/tiff"));
            let prepared = prepare_images(
                &parse_document("![](a.tif)\n"),
                &assets,
                &profile(),
                target,
                DEFAULT_MAX_IMAGE_BYTES,
            )
            .expect("tiff png");
            let image = prepared.get("a.tif").expect("image");
            assert_eq!(image.media_type, "image/png");
            assert_eq!(image.display_width_px, 1);
            assert_eq!(image.display_height_px, 2);
            let decoded = image::load_from_memory(&image.bytes).expect("png");
            assert_eq!((decoded.width(), decoded.height()), (1, 2));
            assert_eq!(decoded.get_pixel(0, 0).0[0..3], [255, 0, 0]);
            assert_eq!(decoded.get_pixel(0, 1).0[0..3], [0, 0, 255]);
        }
        let mut assets = ImageAssets::new();
        assets.insert("a.tif", asset(tiff, "image/tiff"));
        let prepared = prepare_images(
            &parse_document("![](a.tif)\n"),
            &assets,
            &profile(),
            ImageTarget::Docx,
            DEFAULT_MAX_IMAGE_BYTES,
        )
        .expect("tiff");
        let image = prepared.get("a.tif").expect("image");
        assert_eq!(image.media_type, "image/tiff");
        assert_eq!(image.display_width_px, 1);
        assert_eq!(image.display_height_px, 2);
        assert!(stored_orientation(ImageKind::Tiff, &image.bytes).is_none());
        let decoded = image::load_from_memory(&image.bytes).expect("tiff");
        assert_eq!((decoded.width(), decoded.height()), (1, 2));
        assert_eq!(decoded.get_pixel(0, 0).0[0..3], [255, 0, 0]);
        assert_eq!(decoded.get_pixel(0, 1).0[0..3], [0, 0, 255]);
    }

    #[test]
    fn unoriented_jpeg_bytes_stay() {
        for jpeg in [red_blue_jpeg(None), red_blue_jpeg(Some(1))] {
            let mut assets = ImageAssets::new();
            assets.insert("a.jpg", asset(jpeg.clone(), "image/jpeg"));
            let prepared = prepare_images(
                &parse_document("![](a.jpg)\n"),
                &assets,
                &profile(),
                ImageTarget::Html,
                DEFAULT_MAX_IMAGE_BYTES,
            )
            .expect("jpeg");
            let image = prepared.get("a.jpg").expect("image");
            assert_eq!(image.bytes, jpeg);
            assert_eq!(image.display_width_px, 2);
            assert_eq!(image.display_height_px, 1);
        }
    }

    #[test]
    fn unsupported_containers_fail_without_credentials() {
        let samples = [
            ("a.avif", b"\0\0\0\x18ftypavif\0\0\0\0avif".to_vec()),
            ("a.heic", b"\0\0\0\x18ftypheic\0\0\0\0heic".to_vec()),
            ("a.jxl", b"\0\0\0\x0cJXL \x0d\x0a\x87\x0a".to_vec()),
        ];
        for (name, bytes) in samples {
            let url = format!("https://user:secret@example.test/{name}");
            let mut assets = ImageAssets::new();
            assets.insert(url.clone(), asset(bytes, "application/octet-stream"));
            let source = format!("![]({url})\n");
            let error = prepare_images(
                &parse_document(&source),
                &assets,
                &profile(),
                ImageTarget::Html,
                DEFAULT_MAX_IMAGE_BYTES,
            )
            .expect_err("unsupported");
            assert!(error.contains("unsupported"));
            assert!(!error.contains("secret"));
            assert!(error.contains("example.test"));
        }
    }

    #[test]
    fn empty_assets_do_not_change_an_image_free_docx() {
        let source = "Hello\n";
        let profile = "{}";
        let plain = crate::render_docx_with_profile(source, profile).expect("plain");
        let embedded =
            crate::render_docx_with_profile_and_assets(source, profile, &ImageAssets::new(), 0)
                .expect("embedded");
        assert_eq!(zip_entries(&plain), zip_entries(&embedded));
    }

    #[test]
    fn one_error_lists_every_failed_image() {
        let document = parse_document("![](missing-a.png)\n\n![](missing-b.png)\n\n![]()\n");
        let mut assets = ImageAssets::new();
        assets.insert("unused.png", asset(png(), "image/png"));
        let error = prepare_images(
            &document,
            &assets,
            &profile(),
            ImageTarget::Html,
            DEFAULT_MAX_IMAGE_BYTES,
        )
        .expect_err("all images");
        assert!(error.starts_with("image export failed:\n"));
        assert!(error.contains("missing-a.png"));
        assert!(error.contains("missing-b.png"));
        assert!(error.contains("image URL is empty"));
        assert!(!error.contains("unused.png"));
    }

    #[test]
    fn zero_byte_limit_is_twenty_five_megabytes_and_data_urls_count() {
        let mut assets = ImageAssets::new();
        assets.insert("a.png", asset(png(), "image/png"));
        prepare_images(
            &parse_document("![](a.png)\n"),
            &assets,
            &profile(),
            ImageTarget::Html,
            0,
        )
        .expect("default limit");

        let mut assets = ImageAssets::new();
        assets.insert(
            "big.bin",
            asset(
                vec![0; DEFAULT_MAX_IMAGE_BYTES + 1],
                "application/octet-stream",
            ),
        );
        let error = prepare_images(
            &parse_document("![](big.bin)\n"),
            &assets,
            &profile(),
            ImageTarget::Html,
            0,
        )
        .expect_err("default ceiling");
        assert!(error.contains(&DEFAULT_MAX_IMAGE_BYTES.to_string()));

        let bytes = png();
        let url = format!("data:image/png;base64,{}", base64_encode(&bytes));
        let mut assets = ImageAssets::new();
        assets.insert(url.clone(), asset(vec![1, 2, 3], "image/png"));
        let error = prepare_images(
            &parse_document(&format!("![]({url})\n")),
            &assets,
            &profile(),
            ImageTarget::Html,
            bytes.len() - 1,
        )
        .expect_err("data url limit");
        assert!(error.contains("byte limit"));
        assert!(error.contains(&bytes.len().to_string()));
        assert!(!error.contains("missing image bytes"));
    }

    #[test]
    fn raw_html_img_stays_escaped_text() {
        let html =
            crate::render_html_with_assets("<img src=\"pic.png\">\n", &ImageAssets::new(), None, 0)
                .expect("html");
        assert!(html.contains("&lt;img"));
        assert!(html.contains("pic.png"));
        assert!(!html.contains("<img"));
        assert!(!html.contains("data:image"));
    }

    #[test]
    fn image_title_is_omitted_and_empty_alt_stays_empty() {
        let mut assets = ImageAssets::new();
        assets.insert("a.png", asset(png(), "image/png"));
        let titled = crate::render_html_with_assets("![alt](a.png \"題\")\n", &assets, None, 0)
            .expect("titled");
        assert!(titled.contains("alt=\"alt\""));
        assert!(!titled.contains("題"));
        assert!(!titled.contains("title="));
        let empty =
            crate::render_html_with_assets("![](a.png)\n", &assets, None, 0).expect("empty");
        assert!(empty.contains("alt=\"\""));
    }

    #[test]
    fn list_image_is_embedded_in_each_package() {
        let source = "# Chapter\n\n- ![item](a.png)\n";
        let mut assets = ImageAssets::new();
        assets.insert("a.png", asset(png(), "image/png"));
        let html = crate::render_html_with_assets(source, &assets, None, 0).expect("html");
        assert!(html.contains("<li>"));
        assert!(html.contains("data:image/png;base64,"));
        assert!(!html.contains("a.png"));

        let epub = crate::render_epub_with_profile_and_assets(source, "{}", None, &assets, 0)
            .expect("epub");
        let mut archive = zip::ZipArchive::new(Cursor::new(epub)).expect("zip");
        let mut chapter = String::new();
        archive
            .by_name("OEBPS/chapter-1.xhtml")
            .expect("chapter")
            .read_to_string(&mut chapter)
            .expect("read");
        assert!(chapter.contains("<li>"));
        assert!(chapter.contains("images/image1.png"));
        assert!(!chapter.contains("a.png"));

        let docx =
            crate::render_docx_with_profile_and_assets(source, "{}", &assets, 0).expect("docx");
        let mut archive = zip::ZipArchive::new(Cursor::new(docx)).expect("zip");
        let mut document = String::new();
        archive
            .by_name("word/document.xml")
            .expect("document")
            .read_to_string(&mut document)
            .expect("read");
        assert!(document.contains("r:embed=\"rImg"));
        assert!(!document.contains("a.png"));
        assert!(archive.by_name("word/media/image1.png").is_ok());
    }

    #[test]
    fn epub_linked_image_stays_inside_the_link() {
        let mut assets = ImageAssets::new();
        assets.insert("a.png", asset(png(), "image/png"));
        let epub = crate::render_epub_with_profile_and_assets(
            "# Chapter\n\n[![alt](a.png)](https://example.test/page)\n",
            "{}",
            None,
            &assets,
            0,
        )
        .expect("epub");
        let mut chapter = String::new();
        let mut archive = zip::ZipArchive::new(Cursor::new(epub)).expect("zip");
        archive
            .by_name("OEBPS/chapter-1.xhtml")
            .expect("chapter")
            .read_to_string(&mut chapter)
            .expect("read");
        let anchor = chapter
            .find("<a href=\"https://example.test/page\">")
            .expect("anchor");
        let image = chapter[anchor..].find("<img ").expect("image");
        assert!(chapter[anchor + image..].contains("images/image1.png"));
        assert!(!chapter.contains("a.png"));
    }

    #[test]
    fn cover_is_not_deduplicated_with_body_bytes() {
        let bytes = png();
        let mut assets = ImageAssets::new();
        assets.insert("a.png", asset(bytes.clone(), "image/png"));
        let cover = EpubCover {
            data: bytes.clone(),
            media_type: "image/png".to_owned(),
        };
        let epub = crate::render_epub_with_profile_and_assets(
            "# Chapter\n\n![](a.png)\n",
            "{}",
            Some(&cover),
            &assets,
            0,
        )
        .expect("epub");
        let mut archive = zip::ZipArchive::new(Cursor::new(epub)).expect("zip");
        let mut cover_bytes = Vec::new();
        archive
            .by_name("OEBPS/cover.png")
            .expect("cover")
            .read_to_end(&mut cover_bytes)
            .expect("read");
        assert_eq!(cover_bytes, bytes);
        let mut body = Vec::new();
        archive
            .by_name("OEBPS/images/image1.png")
            .expect("body")
            .read_to_end(&mut body)
            .expect("read");
        assert_eq!(body, bytes);

        let rejected = crate::render_epub_with_profile_and_assets(
            "Hello\n",
            "{}",
            Some(&EpubCover {
                data: bytes,
                media_type: "image/gif".to_owned(),
            }),
            &ImageAssets::new(),
            0,
        )
        .expect_err("gif cover");
        assert!(rejected.contains("image/png or image/jpeg"));
    }

    #[test]
    fn contract_webp_bytes_stay_in_epub() {
        const WEBP: &[u8] = include_bytes!("../tests/fixtures/images/one-pixel.webp");
        let mut assets = ImageAssets::new();
        assets.insert("figure.webp", asset(WEBP.to_vec(), "image/webp"));
        let prepared = prepare_images(
            &parse_document("![](figure.webp)\n"),
            &assets,
            &profile(),
            ImageTarget::Epub,
            0,
        )
        .expect("webp");
        let image = prepared.get("figure.webp").expect("image");
        assert_eq!(image.media_type, "image/webp");
        assert_eq!(image.bytes, WEBP);
    }

    #[test]
    fn svg_stays_markup_and_rasterizes_at_the_fitted_size() {
        let svg = br#"<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="8"><script>alert(1)</script><rect width="4000" height="8" fill="black"/></svg>"#;
        let mut assets = ImageAssets::new();
        assets.insert("a.svg", asset(svg.to_vec(), "image/svg+xml"));
        let document = parse_document("![](a.svg)\n");
        let word_json: Map<String, serde_json::Value> =
            serde_json::from_str(r#"{"layout":{"system":"word"}}"#).expect("json");
        let word = resolve_export_profile(&word_json, None).expect("word");
        for target in [ImageTarget::Html, ImageTarget::Epub] {
            let prepared = prepare_images(
                &document,
                &assets,
                &profile(),
                target,
                DEFAULT_MAX_IMAGE_BYTES,
            )
            .expect("svg");
            let image = prepared.get("a.svg").expect("image");
            assert_eq!(image.media_type, "image/svg+xml");
            let text = String::from_utf8(image.bytes.clone()).expect("utf8");
            assert!(!text.to_ascii_lowercase().contains("script"));
            assert!(text.contains("<svg"));
        }
        let fitted = prepare_images(
            &document,
            &assets,
            &word,
            ImageTarget::Docx,
            DEFAULT_MAX_IMAGE_BYTES,
        )
        .expect("word svg");
        let shrunk = prepare_images(
            &document,
            &assets,
            &profile(),
            ImageTarget::Docx,
            DEFAULT_MAX_IMAGE_BYTES,
        )
        .expect("default svg");
        let fitted_image = fitted.get("a.svg").expect("image");
        let shrunk_image = shrunk.get("a.svg").expect("image");
        assert_eq!(fitted_image.media_type, "image/png");
        assert_eq!(shrunk_image.media_type, "image/png");
        assert_eq!(
            png_size(&fitted_image.bytes),
            (
                fitted_image.display_width_px,
                fitted_image.display_height_px
            )
        );
        assert_eq!(
            png_size(&shrunk_image.bytes),
            (
                shrunk_image.display_width_px,
                shrunk_image.display_height_px
            )
        );
        assert_ne!(fitted_image.display_width_px, shrunk_image.display_width_px);

        let html = crate::render_html_with_assets("![](a.svg)\n", &assets, None, 0).expect("html");
        assert!(html.contains("data:image/svg+xml"));
        let epub = crate::render_epub_with_profile_and_assets(
            "# Chapter\n\n![](a.svg)\n",
            "{}",
            None,
            &assets,
            0,
        )
        .expect("epub");
        let mut archive = zip::ZipArchive::new(Cursor::new(epub)).expect("zip");
        let mut stored = Vec::new();
        archive
            .by_name("OEBPS/images/image1.svg")
            .expect("svg")
            .read_to_end(&mut stored)
            .expect("read");
        assert!(
            !String::from_utf8(stored)
                .expect("utf8")
                .to_ascii_lowercase()
                .contains("script")
        );
    }

    fn png_size(bytes: &[u8]) -> (u32, u32) {
        assert!(bytes.starts_with(b"\x89PNG\r\n\x1a\n") && bytes.len() >= 24);
        (
            u32::from_be_bytes(bytes[16..20].try_into().expect("width")),
            u32::from_be_bytes(bytes[20..24].try_into().expect("height")),
        )
    }

    fn wide_png(width: u32, height: u32) -> Vec<u8> {
        let image = image::RgbImage::from_pixel(width, height, image::Rgb([1, 2, 3]));
        let mut bytes = Cursor::new(Vec::new());
        image
            .write_with_encoder(image::codecs::png::PngEncoder::new(&mut bytes))
            .expect("png");
        bytes.into_inner()
    }

    fn animated_gif() -> Vec<u8> {
        let mut bytes = Cursor::new(Vec::new());
        let mut encoder = image::codecs::gif::GifEncoder::new(&mut bytes);
        let red = image::RgbaImage::from_pixel(1, 1, image::Rgba([255, 0, 0, 255]));
        let blue = image::RgbaImage::from_pixel(1, 1, image::Rgba([0, 0, 255, 255]));
        encoder
            .encode_frame(image::Frame::from_parts(
                red,
                0,
                0,
                image::Delay::from_numer_denom_ms(100, 1),
            ))
            .expect("frame");
        encoder
            .encode_frame(image::Frame::from_parts(
                blue,
                0,
                0,
                image::Delay::from_numer_denom_ms(100, 1),
            ))
            .expect("frame");
        drop(encoder);
        bytes.into_inner()
    }

    fn lossless_webp() -> Vec<u8> {
        let mut bytes = Cursor::new(Vec::new());
        image::codecs::webp::WebPEncoder::new_lossless(&mut bytes)
            .encode(&[255, 0, 0], 1, 1, image::ExtendedColorType::Rgb8)
            .expect("webp");
        bytes.into_inner()
    }

    fn animated_webp(still: &[u8]) -> Vec<u8> {
        assert!(still.starts_with(b"RIFF") && &still[8..12] == b"WEBP");
        let payload_size = u32::from_le_bytes(still[16..20].try_into().expect("size")) as usize;
        let vp8l = still[12..20 + payload_size].to_vec();
        let mut anmf = vec![0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 100, 0, 0, 0];
        anmf.extend_from_slice(&vp8l);
        let mut body = b"WEBP".to_vec();
        body.extend(riff_chunk(b"VP8X", &[0x02, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
        body.extend(riff_chunk(b"ANIM", &[0, 0, 0, 0, 0, 0]));
        body.extend(riff_chunk(b"ANMF", &anmf));
        let mut file = b"RIFF".to_vec();
        file.extend_from_slice(&(body.len() as u32).to_le_bytes());
        file.extend(body);
        file
    }

    fn riff_chunk(tag: &[u8; 4], payload: &[u8]) -> Vec<u8> {
        let mut chunk = tag.to_vec();
        chunk.extend_from_slice(&(payload.len() as u32).to_le_bytes());
        chunk.extend_from_slice(payload);
        if payload.len() % 2 == 1 {
            chunk.push(0);
        }
        chunk
    }

    fn red_blue_jpeg(orientation: Option<u16>) -> Vec<u8> {
        let mut image = image::RgbImage::new(2, 1);
        image.put_pixel(0, 0, image::Rgb([255, 0, 0]));
        image.put_pixel(1, 0, image::Rgb([0, 0, 255]));
        let mut bytes = Cursor::new(Vec::new());
        image
            .write_with_encoder(image::codecs::jpeg::JpegEncoder::new_with_quality(
                &mut bytes, 100,
            ))
            .expect("jpeg");
        let bytes = bytes.into_inner();
        match orientation {
            Some(orientation) => with_jpeg_orientation(&bytes, orientation),
            None => bytes,
        }
    }

    fn red_blue_tiff(orientation: Option<u16>) -> Vec<u8> {
        let mut image = image::RgbImage::new(2, 1);
        image.put_pixel(0, 0, image::Rgb([255, 0, 0]));
        image.put_pixel(1, 0, image::Rgb([0, 0, 255]));
        let mut bytes = Cursor::new(Vec::new());
        image
            .write_with_encoder(image::codecs::tiff::TiffEncoder::new(&mut bytes))
            .expect("tiff");
        let bytes = bytes.into_inner();
        match orientation {
            Some(orientation) => with_tiff_orientation(&bytes, orientation),
            None => bytes,
        }
    }

    fn with_tiff_orientation(tiff: &[u8], orientation: u16) -> Vec<u8> {
        let little = tiff.starts_with(b"II");
        assert!(little || tiff.starts_with(b"MM"));
        let read_u16 = |bytes: &[u8], offset: usize| -> u16 {
            let pair = [bytes[offset], bytes[offset + 1]];
            if little {
                u16::from_le_bytes(pair)
            } else {
                u16::from_be_bytes(pair)
            }
        };
        let read_u32 = |bytes: &[u8], offset: usize| -> u32 {
            let quad = [
                bytes[offset],
                bytes[offset + 1],
                bytes[offset + 2],
                bytes[offset + 3],
            ];
            if little {
                u32::from_le_bytes(quad)
            } else {
                u32::from_be_bytes(quad)
            }
        };
        let write_u16 = |value: u16| {
            if little {
                value.to_le_bytes()
            } else {
                value.to_be_bytes()
            }
        };
        let write_u32 = |value: u32| {
            if little {
                value.to_le_bytes()
            } else {
                value.to_be_bytes()
            }
        };
        let ifd = read_u32(tiff, 4) as usize;
        let count = read_u16(tiff, ifd) as usize;
        let mut entries = Vec::with_capacity(count + 1);
        let mut replaced = false;
        for index in 0..count {
            let at = ifd + 2 + index * 12;
            let mut entry = tiff[at..at + 12].to_vec();
            if read_u16(&entry, 0) == 0x0112 {
                let value = write_u16(orientation);
                entry[8] = value[0];
                entry[9] = value[1];
                entry[10] = 0;
                entry[11] = 0;
                replaced = true;
            }
            entries.push(entry);
        }
        if !replaced {
            let mut entry = vec![0u8; 12];
            let tag = write_u16(0x0112);
            let field_type = write_u16(3);
            let count = write_u32(1);
            let value = write_u16(orientation);
            entry[0] = tag[0];
            entry[1] = tag[1];
            entry[2] = field_type[0];
            entry[3] = field_type[1];
            entry[4..8].copy_from_slice(&count);
            entry[8] = value[0];
            entry[9] = value[1];
            entries.push(entry);
            entries.sort_by_key(|entry| read_u16(entry, 0));
        }
        let next = read_u32(tiff, ifd + 2 + count * 12);
        let mut out = tiff.to_vec();
        let new_ifd = write_u32(out.len() as u32);
        out[4..8].copy_from_slice(&new_ifd);
        out.extend_from_slice(&write_u16(entries.len() as u16));
        for entry in &entries {
            out.extend_from_slice(entry);
        }
        out.extend_from_slice(&write_u32(next));
        out
    }

    fn assert_upright_red_blue(bytes: &[u8]) {
        let decoded = image::load_from_memory(bytes).expect("decoded");
        assert_eq!((decoded.width(), decoded.height()), (1, 2));
        let top = decoded.get_pixel(0, 0).0;
        let bottom = decoded.get_pixel(0, 1).0;
        assert!(top[0] > top[2], "{top:?}");
        assert!(bottom[2] > bottom[0], "{bottom:?}");
    }

    fn with_jpeg_orientation(jpeg: &[u8], orientation: u16) -> Vec<u8> {
        let mut tiff = vec![
            b'I', b'I', 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x12, 0x01, 0x03, 0x00,
            0x01, 0x00, 0x00, 0x00,
        ];
        tiff.extend_from_slice(&orientation.to_le_bytes());
        tiff.extend_from_slice(&[0, 0, 0, 0, 0, 0]);
        let mut segment = b"Exif\0\0".to_vec();
        segment.extend_from_slice(&tiff);
        let length = (segment.len() + 2) as u16;
        let mut out = vec![0xff, 0xd8, 0xff, 0xe1];
        out.extend_from_slice(&length.to_be_bytes());
        out.extend_from_slice(&segment);
        out.extend_from_slice(&jpeg[2..]);
        out
    }

    fn jpeg_exif_tiff_offset(bytes: &[u8]) -> Option<usize> {
        if bytes.len() < 4 || !bytes.starts_with(&[0xff, 0xd8]) {
            return None;
        }
        let mut offset = 2;
        while offset + 4 < bytes.len() {
            if bytes[offset] != 0xff {
                return None;
            }
            while offset < bytes.len() && bytes[offset] == 0xff {
                offset += 1;
            }
            if offset >= bytes.len() {
                return None;
            }
            let marker = bytes[offset];
            offset += 1;
            if marker == 0xd8 || marker == 0xd9 || (0xd0..=0xd7).contains(&marker) {
                continue;
            }
            if offset + 2 > bytes.len() {
                return None;
            }
            let length = u16::from_be_bytes([bytes[offset], bytes[offset + 1]]) as usize;
            if length < 2 || offset + length > bytes.len() {
                return None;
            }
            if marker == 0xe1 {
                let segment_at = offset + 2;
                let segment = &bytes[segment_at..offset + length];
                if segment.starts_with(b"Exif\0\0") {
                    return Some(segment_at + 6);
                }
            }
            if (0xc0..=0xcf).contains(&marker) && marker != 0xc4 && marker != 0xc8 && marker != 0xcc
            {
                return None;
            }
            offset += length;
        }
        None
    }

    fn stored_orientation(kind: ImageKind, bytes: &[u8]) -> Option<u16> {
        let tiff_at = match kind {
            ImageKind::Jpeg => jpeg_exif_tiff_offset(bytes)?,
            ImageKind::Tiff => 0,
            _ => return None,
        };
        let little = bytes.get(tiff_at..)?.starts_with(b"II");
        let read_u16 = |offset: usize| -> Option<u16> {
            let pair = bytes.get(offset..offset + 2)?;
            Some(if little {
                u16::from_le_bytes([pair[0], pair[1]])
            } else {
                u16::from_be_bytes([pair[0], pair[1]])
            })
        };
        let read_u32 = |offset: usize| -> Option<u32> {
            let quad = bytes.get(offset..offset + 4)?;
            Some(if little {
                u32::from_le_bytes([quad[0], quad[1], quad[2], quad[3]])
            } else {
                u32::from_be_bytes([quad[0], quad[1], quad[2], quad[3]])
            })
        };
        if read_u16(tiff_at + 2)? != 42 {
            return None;
        }
        let mut ifd = tiff_at + read_u32(tiff_at + 4)? as usize;
        let count = read_u16(ifd)? as usize;
        ifd += 2;
        for _ in 0..count {
            if read_u16(ifd)? == 0x0112 && read_u16(ifd + 2)? == 3 && read_u32(ifd + 4)? == 1 {
                return read_u16(ifd + 8);
            }
            ifd += 12;
        }
        None
    }

    fn zip_entries(bytes: &[u8]) -> BTreeMap<String, Vec<u8>> {
        let mut archive = zip::ZipArchive::new(Cursor::new(bytes)).expect("zip");
        let mut entries = BTreeMap::new();
        for index in 0..archive.len() {
            let mut file = archive.by_index(index).expect("entry");
            let mut data = Vec::new();
            file.read_to_end(&mut data).expect("read");
            entries.insert(file.name().to_owned(), data);
        }
        entries
    }
}
