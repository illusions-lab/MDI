//! Contract tests for the three publication-platform text exporters.
//!
//! These assertions deliberately cite the platform-owned specifications rather
//! than MDI documentation:
//! - Narou ruby: https://syosetu.com/helpcenter/helppage/helppageid/42/
//! - Narou boten UI: https://syosetu.com/helpcenter/helppage/helppageid/43/
//! - Kakuyomu notation: https://kakuyomu.jp/help/entry/notation
//! - Aozora input manual: https://www.aozora.gr.jp/aozora-manual/index-input.html
//! - Aozora annotations: https://www.aozora.gr.jp/annotation/

use mdi_core::{TextFormat, render_text_format};

fn render(source: &str, format: TextFormat) -> String {
    render_text_format(source, format, "")
}

#[test]
fn narou_uses_the_documented_explicit_ruby_form_and_ten_character_limits() {
    assert_eq!(
        render("{山田太郎|やまだたろう}", TextFormat::Narou),
        "｜山田太郎《やまだたろう》"
    );

    let exact_limit = "{一二三四五六七八九十|あいうえおかきくけこ}";
    assert_eq!(
        render(exact_limit, TextFormat::Narou),
        "｜一二三四五六七八九十《あいうえおかきくけこ》"
    );

    // The official contract permits 1–10 base characters and 1–10 reading
    // characters. An unrepresentable annotation must degrade to its readable
    // base instead of emitting a tag the site rejects or misparses.
    assert_eq!(
        render(
            "{一二三四五六七八九十一|あいうえおかきくけこ}",
            TextFormat::Narou
        ),
        "一二三四五六七八九十一"
    );
    assert_eq!(
        render(
            "{一二三四五六七八九十|あいうえおかきくけこさ}",
            TextFormat::Narou
        ),
        "一二三四五六七八九十"
    );
    assert_eq!(render("{東京|}", TextFormat::Narou), "東京");
}

#[test]
fn narou_rejects_the_four_documented_problem_characters_inside_ruby() {
    for source in [
        "{A&B|えー}",
        "{A\"B|えー}",
        "{A<B|えー}",
        "{A>B|えー}",
        "{東京|とう&きょう}",
        "{東京|とう\"きょう}",
        "{東京|とう<きょう}",
        "{東京|とう>きょう}",
    ] {
        let output = render(source, TextFormat::Narou);
        assert!(
            !output.contains('《'),
            "Narou must not receive a ruby tag containing a documented problem character: {output}"
        );
    }
}

#[test]
fn narou_boten_is_composed_only_from_documented_valid_one_character_ruby() {
    assert_eq!(
        render("[[em:強調]]", TextFormat::Narou),
        "｜強《・》｜調《・》"
    );
    assert_eq!(
        render("漢字（説明）とASCII(test)", TextFormat::Narou),
        "漢字｜（説明）とASCII|(test)"
    );
    assert_eq!(render("^12^", TextFormat::Narou), "12");
    assert_eq!(
        render("前\n\n[[pagebreak]]\n\n後", TextFormat::Narou),
        "前\n\n後"
    );
}

#[test]
fn kakuyomu_obeys_ruby_limits_literal_escape_and_boten_exclusion() {
    assert_eq!(
        render("{etc|えとせとら}", TextFormat::Kakuyomu),
        "｜etc《えとせとら》"
    );

    let base_at_limit = "12345678901234567890";
    let reading_at_limit = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんぁぃぅぇ";
    assert_eq!(
        render(
            &format!("{{{base_at_limit}|{reading_at_limit}}}"),
            TextFormat::Kakuyomu
        ),
        format!("｜{base_at_limit}《{reading_at_limit}》")
    );
    assert_eq!(
        render(
            &format!("{{{base_at_limit}余|{reading_at_limit}}}"),
            TextFormat::Kakuyomu
        ),
        format!("{base_at_limit}余")
    );
    assert_eq!(
        render(
            &format!("{{{base_at_limit}|{reading_at_limit}ぇ}}"),
            TextFormat::Kakuyomu
        ),
        base_at_limit
    );
    assert_eq!(
        render("{親《文字|よみ}", TextFormat::Kakuyomu),
        "親｜《文字"
    );
    assert_eq!(render("{親文字|よ《み}", TextFormat::Kakuyomu), "親文字");

    assert_eq!(
        render("研究されたので《花がたみ》", TextFormat::Kakuyomu),
        "研究されたので｜《花がたみ》"
    );
    assert_eq!(
        render("[[em:柴刈り]]", TextFormat::Kakuyomu),
        "《《柴刈り》》"
    );
    // Kakuyomu explicitly forbids ruby and boten on the same text.
    assert_eq!(
        render("[[em:{東京|とうきょう}]]", TextFormat::Kakuyomu),
        "｜東京《とうきょう》"
    );
}

#[test]
fn aozora_uses_documented_range_annotations_for_nested_markup() {
    assert_eq!(
        render("# {独|ひと}り寝", TextFormat::Aozora),
        "｜独《ひと》り寝［＃「独り寝」は中見出し］"
    );
    assert_eq!(
        render("[[em:{東京|とうきょう}]]", TextFormat::Aozora),
        "［＃傍点］｜東京《とうきょう》［＃傍点終わり］"
    );
    assert_eq!(
        render("# [[em:強調]]", TextFormat::Aozora),
        "［＃中見出し］［＃傍点］強調［＃傍点終わり］［＃中見出し終わり］"
    );
    assert_eq!(
        render(
            "^12^、[[warichu:割り注]]、[[em:﹆:白点]]",
            TextFormat::Aozora
        ),
        concat!(
            "12［＃「12」は縦中横］、",
            "［＃割り注］割り注［＃割り注終わり］、",
            "［＃白ゴマ傍点］白点［＃白ゴマ傍点終わり］"
        )
    );
}

#[test]
fn aozora_assigns_heading_sizes_from_the_documented_hierarchy_rules() {
    assert_eq!(
        render("# 一\n\n### 三", TextFormat::Aozora),
        "一［＃「一」は大見出し］\r\n三［＃「三」は中見出し］"
    );
    assert_eq!(
        render("# 一\n\n## 二\n\n### 三\n\n#### 四", TextFormat::Aozora),
        concat!(
            "一［＃「一」は大見出し］\r\n",
            "二［＃「二」は中見出し］\r\n",
            "三［＃「三」は小見出し］\r\n",
            "四\r\n\r\n",
            "※小見出しよりもさらに下位の見出しには、注記しませんでした。"
        )
    );
}

#[test]
fn aozora_maps_layout_blocks_to_the_official_annotations() {
    let source = "[[indent:12]]\n字下げ\n\n[[indent:104567890]]\n全数字\n\n[[bottom]]\n地付き\n\n[[bottom:3]]\n地寄せ\n\n[[pagebreak]]\n\n[[pagebreak:left]]\n\n[[pagebreak:right]]";
    assert_eq!(
        render(source, TextFormat::Aozora),
        concat!(
            "［＃１２字下げ］字下げ\r\n",
            "［＃１０４５６７８９０字下げ］全数字\r\n",
            "［＃地付き］地付き\r\n",
            "［＃地から３字上げ］地寄せ\r\n",
            "［＃改ページ］\r\n",
            "［＃改丁］\r\n",
            "［＃改見開き］"
        )
    );
}

#[test]
fn aozora_escapes_every_documented_reserved_literal_and_uses_crlf_only() {
    let output = render("《》［］〔〕｜＃※\n\n次", TextFormat::Aozora);
    assert_eq!(
        output,
        concat!(
            "※［＃始め二重山括弧、1-1-52］",
            "※［＃終わり二重山括弧、1-1-53］",
            "※［＃始め角括弧、1-1-46］",
            "※［＃終わり角括弧、1-1-47］",
            "※［＃始めきっこう（亀甲）括弧、1-1-44］",
            "※［＃終わりきっこう（亀甲）括弧、1-1-45］",
            "※［＃縦線、1-1-35］",
            "※［＃井げた、1-1-84］",
            "※［＃米印、1-2-8］",
            "\r\n次"
        )
    );
    assert!(!output.replace("\r\n", "").contains('\n'));
}
