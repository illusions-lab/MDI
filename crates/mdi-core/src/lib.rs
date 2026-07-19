//! The language-neutral MDI 2.0 syntax core.
//!
//! This crate deliberately parses only MDI constructs.  CommonMark and GFM
//! remain the responsibility of a host integration (for example `remark` in
//! JavaScript).  Keeping that boundary here makes the grammar reusable from
//! native bindings and WebAssembly without coupling it to one Markdown AST.

use unicode_segmentation::UnicodeSegmentation;

/// MDI syntax version implemented by this crate.
pub const MDI_SPEC_VERSION: &str = "2.0";

/// A document split into MDI-relevant block boundaries.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Document {
    pub blocks: Vec<Block>,
}

/// A block-level MDI construct or ordinary source line.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Block {
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
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
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

/// The reading attached to a ruby base.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RubyReading {
    Group(String),
    Split(Vec<String>),
}

/// Parse a source document into MDI constructs.  Non-MDI Markdown is retained
/// as text for the host Markdown parser to interpret.
pub fn parse(source: &str) -> Document {
    let mut blocks = Vec::new();
    let mut pending: Option<PendingBlock> = None;

    for line in source.lines() {
        if is_blank_marker(line) {
            flush_pending(&mut blocks, &mut pending);
            blocks.push(Block::Blank);
            continue;
        }
        if let Some(pagebreak) = pagebreak(line) {
            flush_pending(&mut blocks, &mut pending);
            blocks.push(Block::Pagebreak { variant: pagebreak });
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
    Document { blocks }
}

/// Parse MDI inline syntax while keeping all other text literal.
pub fn parse_inlines(source: &str) -> Vec<Inline> {
    let mut out = Vec::new();
    let mut text = String::new();
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
            push_text(&mut out, &mut text);
            out.push(inline);
            index += consumed;
            continue;
        }
        if let Some((inline, consumed)) = tcy(rest) {
            push_text(&mut out, &mut text);
            out.push(inline);
            index += consumed;
            continue;
        }
        if let Some((inline, consumed)) = boten(rest) {
            push_text(&mut out, &mut text);
            out.push(inline);
            index += consumed;
            continue;
        }
        if let Some((inline, consumed)) = bracket_macro(rest) {
            push_text(&mut out, &mut text);
            out.push(inline);
            index += consumed;
            continue;
        }
        let character = rest.chars().next().expect("index is in bounds");
        text.push(character);
        index += character.len_utf8();
    }
    push_text(&mut out, &mut text);
    out
}

#[derive(Clone)]
enum PendingBlock {
    Indent { amount: u32, source: String },
    Bottom { amount: u32, source: String },
}

fn paragraph(line: &str, pending: Option<PendingBlock>) -> Block {
    let (indent, bottom) = match pending {
        Some(PendingBlock::Indent { amount, .. }) => (Some(amount), None),
        Some(PendingBlock::Bottom { amount, .. }) => (None, Some(amount)),
        None => (None, None),
    };
    Block::Paragraph {
        inlines: parse_inlines(line),
        indent,
        bottom,
    }
}

fn flush_pending(blocks: &mut Vec<Block>, pending: &mut Option<PendingBlock>) {
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
    let end = value.find("》》")?;
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

fn unescape_mdi(value: &str) -> String {
    unescape(value, "{}|^[]:《》")
}

fn unescape_ruby(value: &str) -> String {
    unescape(value, "{}|^[]:《》.")
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
    "{}|^[]:《》".contains(character)
}

fn push_text(out: &mut Vec<Inline>, text: &mut String) {
    if !text.is_empty() {
        out.push(Inline::Text(std::mem::take(text)));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
            parse("[[indent:2]]\n本文\n[[pagebreak:left]]\n\\"),
            Document {
                blocks: vec![
                    Block::Paragraph {
                        inlines: vec![Inline::Text("本文".into())],
                        indent: Some(2),
                        bottom: None
                    },
                    Block::Pagebreak {
                        variant: Some(PagebreakVariant::Left)
                    },
                    Block::Blank,
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
    fn applies_mdi_escapes_once_before_recognition() {
        assert_eq!(
            parse_inlines(r"\{東京\|とうきょう\} \^12\^ \[\[br\]\] \《《文字\》》"),
            vec![Inline::Text(
                "{東京|とうきょう} ^12^ [[br]] 《《文字》》".into()
            )]
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
            parse("[[indent:2]]"),
            Document {
                blocks: vec![Block::Paragraph {
                    inlines: vec![Inline::Text("[[indent:2]]".into())],
                    indent: None,
                    bottom: None
                }]
            }
        );
        assert_eq!(
            parse("[[indent:2]]\n[[bottom]]\n本文"),
            Document {
                blocks: vec![
                    Block::Paragraph {
                        inlines: vec![Inline::Text("[[indent:2]]".into())],
                        indent: None,
                        bottom: None
                    },
                    Block::Paragraph {
                        inlines: vec![Inline::Text("[[bottom]]".into())],
                        indent: None,
                        bottom: None
                    },
                    Block::Paragraph {
                        inlines: vec![Inline::Text("本文".into())],
                        indent: None,
                        bottom: None
                    }
                ]
            }
        );
    }
}
