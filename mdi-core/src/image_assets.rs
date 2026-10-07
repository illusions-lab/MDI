//! Body-image packaging for self-contained export.
//!
//! The core never reads the filesystem and never makes a network request.
//! Callers supply bytes keyed by the image URL exactly as it appears on the
//! parsed node. `data:` URLs are decoded here and are not taken from the map.

use crate::{Document, ResolvedExportProfile, children, page_dimensions};
use image::GenericImageView;
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
                matches!(self, Self::Png | Self::Jpeg | Self::Gif | Self::WebP | Self::Svg)
            }
            ImageTarget::Docx => {
                matches!(self, Self::Png | Self::Jpeg | Self::Gif | Self::Bmp | Self::Tiff)
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
    let (raw_width, raw_height, orientation) = if kind == ImageKind::Svg {
        bytes = sanitize_svg(&bytes)?;
        if bytes.len() > max_bytes {
            return Err(format!(
                "image is {} bytes, above the {max_bytes} byte limit",
                bytes.len()
            ));
        }
        let (width, height) = svg_size(&bytes)?;
        (width, height, 1)
    } else {
        let (width, height) = raster_dimensions(&bytes)?;
        let orientation = image_orientation(kind, &bytes);
        if (width as u64) * (height as u64) > MAX_IMAGE_PIXELS {
            return Err(format!(
                "image is {width} by {height} pixels, above the {MAX_IMAGE_PIXELS} pixel limit"
            ));
        }
        (width, height, orientation)
    };
    let (oriented_width, oriented_height) = if orientation_swaps(orientation) {
        (raw_height, raw_width)
    } else {
        (raw_width, raw_height)
    };
    if oriented_width == 0 || oriented_height == 0 {
        return Err("image has no pixel dimensions".to_owned());
    }
    let (display_width, display_height) =
        fit_px(oriented_width, oriented_height, box_width, box_height);
    if !kind.kept_by(target) {
        if kind == ImageKind::Svg {
            bytes = rasterize_svg(&bytes, display_width, display_height)?;
        } else {
            bytes = transcode_png(&bytes, orientation)?;
        }
        if bytes.len() > max_bytes {
            return Err(format!(
                "image is {} bytes, above the {max_bytes} byte limit",
                bytes.len()
            ));
        }
        kind = ImageKind::Png;
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
    if bytes.len() >= 4
        && (bytes.starts_with(b"II*\0") || bytes.starts_with(b"MM\0*"))
    {
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

fn image_orientation(kind: ImageKind, bytes: &[u8]) -> u16 {
    match kind {
        ImageKind::Jpeg => jpeg_orientation(bytes).unwrap_or(1),
        ImageKind::Tiff => tiff_orientation(bytes).unwrap_or(1),
        _ => 1,
    }
}

fn orientation_swaps(orientation: u16) -> bool {
    matches!(orientation, 5 | 6 | 7 | 8)
}

fn jpeg_orientation(bytes: &[u8]) -> Option<u16> {
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
            let segment = &bytes[offset + 2..offset + length];
            if segment.starts_with(b"Exif\0\0") {
                return tiff_orientation(&segment[6..]);
            }
        }
        if (0xc0..=0xcf).contains(&marker) && marker != 0xc4 && marker != 0xc8 && marker != 0xcc {
            return None;
        }
        offset += length;
    }
    None
}

fn tiff_orientation(bytes: &[u8]) -> Option<u16> {
    if bytes.len() < 8 {
        return None;
    }
    let little = bytes.starts_with(b"II");
    if !little && !bytes.starts_with(b"MM") {
        return None;
    }
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
    let magic = read_u16(2)?;
    if magic != 42 {
        return None;
    }
    let mut ifd = read_u32(4)? as usize;
    if ifd + 2 > bytes.len() {
        return None;
    }
    let count = read_u16(ifd)? as usize;
    ifd += 2;
    for _ in 0..count {
        if ifd + 12 > bytes.len() {
            return None;
        }
        let tag = read_u16(ifd)?;
        let kind = read_u16(ifd + 2)?;
        if tag == 0x0112 && kind == 3 {
            return read_u16(ifd + 8);
        }
        ifd += 12;
    }
    None
}

pub fn content_box_px(profile: &ResolvedExportProfile) -> (u32, u32) {
    let (natural_width, natural_height) =
        page_dimensions(&profile.pagination.page_size).unwrap_or((210.0, 297.0));
    let (page_width, page_height) = if profile.pagination.landscape {
        (natural_height, natural_width)
    } else {
        (natural_width, natural_height)
    };
    let width_mm = (page_width
        - profile.pagination.margins.left
        - profile.pagination.margins.right)
        .max(1.0);
    let height_mm = (page_height
        - profile.pagination.margins.top
        - profile.pagination.margins.bottom)
        .max(1.0);
    (mm_to_css_px(width_mm), mm_to_css_px(height_mm))
}

fn mm_to_css_px(mm: f64) -> u32 {
    ((mm / MM_PER_INCH) * CSS_PIXELS_PER_INCH)
        .floor()
        .max(1.0) as u32
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

fn transcode_png(bytes: &[u8], orientation: u16) -> Result<Vec<u8>, String> {
    let decoded = image::load_from_memory(bytes).map_err(|_| "image could not be decoded")?;
    let (decoded_width, decoded_height) = decoded.dimensions();
    let (header_width, header_height) = raster_dimensions(bytes)?;
    let transformed = if orientation != 1
        && decoded_width == header_width
        && decoded_height == header_height
    {
        apply_orientation(decoded, orientation)
    } else {
        decoded
    };
    let mut output = Cursor::new(Vec::new());
    transformed
        .write_with_encoder(image::codecs::png::PngEncoder::new(&mut output))
        .map_err(|error| error.to_string())?;
    Ok(output.into_inner())
}

fn apply_orientation(image: image::DynamicImage, orientation: u16) -> image::DynamicImage {
    use image::imageops::{flip_horizontal, flip_vertical, rotate180, rotate270, rotate90};
    match orientation {
        2 => image::DynamicImage::ImageRgba8(flip_horizontal(&image)),
        3 => image::DynamicImage::ImageRgba8(rotate180(&image)),
        4 => image::DynamicImage::ImageRgba8(flip_vertical(&image)),
        5 => image::DynamicImage::ImageRgba8(flip_horizontal(&rotate270(&image))),
        6 => image::DynamicImage::ImageRgba8(rotate90(&image)),
        7 => image::DynamicImage::ImageRgba8(flip_horizontal(&rotate90(&image))),
        8 => image::DynamicImage::ImageRgba8(rotate270(&image)),
        _ => image,
    }
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
    pixmap
        .encode_png()
        .map_err(|error| error.to_string())
}

fn usvg_tree(text: &str) -> Result<resvg::usvg::Tree, String> {
    resvg::usvg::Tree::from_str(text, &resvg::usvg::Options::default())
        .map_err(|error| format!("SVG could not be parsed: {error}"))
}

fn sanitize_svg(bytes: &[u8]) -> Result<Vec<u8>, String> {
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
    write_svg_node(root, &mut output)?;
    Ok(output.into_bytes())
}

fn write_svg_node(node: roxmltree::Node<'_, '_>, output: &mut String) -> Result<(), String> {
    match node.node_type() {
        roxmltree::NodeType::Root => {
            for child in node.children() {
                write_svg_node(child, output)?;
            }
            Ok(())
        }
        roxmltree::NodeType::Text => {
            output.push_str(&xml_escape(node.text().unwrap_or_default()));
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
                match attribute_action(attribute)? {
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
                        output.push_str(&xml_escape(value));
                        output.push('"');
                    }
                    AttributeAction::Drop => {}
                }
            }
            let mut children = String::new();
            for child in node.children() {
                write_svg_node(child, &mut children)?;
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

enum AttributeAction<'a> {
    Keep(&'a str),
    Drop,
}

fn attribute_action<'a>(
    attribute: roxmltree::Attribute<'a, '_>,
) -> Result<AttributeAction<'a>, String> {
    let name = attribute.name();
    if name.to_ascii_lowercase().starts_with("on") || name.eq_ignore_ascii_case("xml:base") {
        return Ok(AttributeAction::Drop);
    }
    let value = attribute.value();
    if name.eq_ignore_ascii_case("style") {
        return style_action(value);
    }
    if is_reference_attribute(name) {
        return match reference_action(value)? {
            ReferenceAction::Keep => Ok(AttributeAction::Keep(value)),
            ReferenceAction::Drop => Ok(AttributeAction::Drop),
        };
    }
    if value.to_ascii_lowercase().contains("javascript:") {
        return Ok(AttributeAction::Drop);
    }
    Ok(AttributeAction::Keep(value))
}

fn is_reference_attribute(name: &str) -> bool {
    matches!(
        name.to_ascii_lowercase().as_str(),
        "href" | "xlink:href" | "src"
    )
}

enum ReferenceAction {
    Keep,
    Drop,
}

fn reference_action(value: &str) -> Result<ReferenceAction, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() || trimmed.starts_with('#') {
        return Ok(ReferenceAction::Keep);
    }
    let lower = trimmed.to_ascii_lowercase();
    if lower.starts_with("javascript:") {
        return Ok(ReferenceAction::Drop);
    }
    if lower.starts_with("data:") {
        return Ok(ReferenceAction::Keep);
    }
    Err("SVG external references are not allowed".to_owned())
}

fn style_action(value: &str) -> Result<AttributeAction<'_>, String> {
    let lower = value.to_ascii_lowercase();
    if lower.contains("javascript:") {
        return Ok(AttributeAction::Drop);
    }
    if lower.contains("url(") {
        let mut rest = lower.as_str();
        while let Some(start) = rest.find("url(") {
            let after = &rest[start + 4..];
            let body = after.trim_start_matches(['\'', '"', ' ']);
            if !(body.starts_with('#') || body.starts_with("data:")) {
                return Err("SVG external references are not allowed".to_owned());
            }
            rest = body;
        }
    }
    Ok(AttributeAction::Keep(value))
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
    let Some(scheme) = url.find("://") else {
        return url.to_owned();
    };
    let rest = &url[scheme + 3..];
    let Some(at) = rest.find('@') else {
        return url.to_owned();
    };
    if rest[..at].contains('/') {
        return url.to_owned();
    }
    format!("{}{}", &url[..=scheme + 2], &rest[at + 1..])
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
                u8::from_str_radix(hex, 16).map_err(|_| "data URL encoding is invalid".to_owned())?,
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
    use crate::{parse_document, resolve_export_profile};
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
        assert_eq!(sniff(b"<svg xmlns=\"http://www.w3.org/2000/svg\"/>"), Some(ImageKind::Svg));
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
        assert!(prepared.get(&url).expect("image").html_src().starts_with("data:image/png;base64,"));

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
        assert!(sanitize_svg(external).expect_err("external").contains("external"));
        assert!(sanitize_svg(b"<!DOCTYPE svg [<!ENTITY xxe SYSTEM 'file:///etc/passwd'>]><svg/>").is_err());
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
        let error = prepare_images(&document, &assets, &profile(), ImageTarget::Html, 1024 * 1024)
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
        assets.insert("https://user:secret@example.test/a.jpg", asset(jpeg.clone(), "image/jpeg"));
        let kept = prepare_images(
            &parse_document("![](https://user:secret@example.test/a.jpg)\n"),
            &assets,
            &profile(),
            ImageTarget::Epub,
            DEFAULT_MAX_IMAGE_BYTES,
        )
        .expect("jpeg");
        assert_eq!(
            kept.get("https://user:secret@example.test/a.jpg").expect("image").media_type,
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
        assets.insert("a.bmp", asset(bmp, "image/bmp"));
        let epub = prepare_images(&parse_document("![](a.bmp)\n"), &assets, &profile(), ImageTarget::Epub, DEFAULT_MAX_IMAGE_BYTES).expect("bmp epub");
        assert_eq!(epub.get("a.bmp").expect("image").media_type, "image/png");
        let docx = prepare_images(&parse_document("![](a.bmp)\n"), &assets, &profile(), ImageTarget::Docx, DEFAULT_MAX_IMAGE_BYTES).expect("bmp docx");
        assert_eq!(docx.get("a.bmp").expect("image").media_type, "image/bmp");

        let svg = br#"<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="black"/></svg>"#;
        let mut assets = ImageAssets::new();
        assets.insert("a.svg", asset(svg.to_vec(), "image/svg+xml"));
        let epub = prepare_images(&parse_document("![](a.svg)\n"), &assets, &profile(), ImageTarget::Epub, DEFAULT_MAX_IMAGE_BYTES).expect("svg");
        assert_eq!(epub.get("a.svg").expect("image").media_type, "image/svg+xml");
        assert!(!String::from_utf8_lossy(&epub.get("a.svg").expect("image").bytes).contains("<script"));
        let docx = prepare_images(&parse_document("![](a.svg)\n"), &assets, &profile(), ImageTarget::Docx, DEFAULT_MAX_IMAGE_BYTES).expect("svg docx");
        assert_eq!(docx.get("a.svg").expect("image").media_type, "image/png");
        assert!(error_label("https://user:secret@example.test/a.png").contains("example.test"));
        assert!(!error_label("https://user:secret@example.test/a.png").contains("secret"));
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
        let html = crate::render_html_with_assets(source, &assets, DEFAULT_MAX_IMAGE_BYTES)
            .expect("html");
        assert!(html.contains("data:image/png;base64,"));
        assert!(html.contains("alt=\"a&lt;b\""));
        assert!(html.contains("data-mdi-warichu-source"));
        assert!(!html.contains("[Content_Types].xml"));
        assert!(!html.contains("note.png"));
        assert_eq!(
            crate::render_html(source).matches("src=\"../../[Content_Types].xml\"").count(),
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
        assert_eq!(names.iter().filter(|name| name.contains("images/image1.png")).count(), 1);
        assert!(names.iter().all(|name| !name.contains("..")));
        let mut opf = String::new();
        archive.by_name("OEBPS/package.opf").expect("opf").read_to_string(&mut opf).expect("read");
        assert_eq!(opf.matches("images/image1.png").count(), 1);
        assert!(opf.contains("version=\"3.0\""));
        let mut chapter = String::new();
        archive.by_name("OEBPS/chapter-1.xhtml").expect("chapter").read_to_string(&mut chapter).expect("read");
        assert!(chapter.contains("<img src=\"images/image1.png\""));
        assert!(chapter.contains("/>"));
        let mut chapter_two = String::new();
        archive.by_name("OEBPS/chapter-2.xhtml").expect("chapter").read_to_string(&mut chapter_two).expect("read");
        assert!(chapter_two.contains("images/image1.png"));

        let docx = crate::render_docx_with_profile_and_assets(source, &profile, &assets, DEFAULT_MAX_IMAGE_BYTES)
            .expect("docx");
        let mut archive = zip::ZipArchive::new(Cursor::new(docx)).expect("zip");
        let names = archive.file_names().map(str::to_owned).collect::<Vec<_>>();
        assert!(names.iter().any(|name| name == "word/media/image1.png"));
        assert!(names.iter().all(|name| !name.contains("..")));
        assert!(names.iter().filter(|name| name.starts_with("word/media/")).all(|name| {
            name.strip_prefix("word/media/image").is_some_and(|rest| rest.chars().next().is_some_and(|c| c.is_ascii_digit()))
        }));
        let mut document = String::new();
        archive.by_name("word/document.xml").expect("document").read_to_string(&mut document).expect("read");
        assert!(document.contains("r:embed=\"rImg"));
        assert!(document.contains("descr=\"a&lt;b\""));
        assert!(document.contains("w:eastAsianLayout"));
        let mut footnotes = String::new();
        archive.by_name("word/footnotes.xml").expect("footnotes").read_to_string(&mut footnotes).expect("read");
        assert!(footnotes.contains("r:embed=\"rFnImg"));
        let mut footnote_rels = String::new();
        archive.by_name("word/_rels/footnotes.xml.rels").expect("rels").read_to_string(&mut footnote_rels).expect("read");
        assert!(footnote_rels.contains("wordprocessingml") || footnote_rels.contains("/image"));
        assert!(footnote_rels.contains("media/image"));
    }
}
