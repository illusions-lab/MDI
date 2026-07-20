//! The deliberately small Android-only JNI boundary for `mdi-core`.
//!
//! It owns no MDI grammar, document model, or rendering logic. Kotlin passes
//! complete UTF-8 strings to this crate, which delegates every operation to
//! the Rust-authoritative core.

use jni::JNIEnv;
use jni::objects::{JObject, JString};
use jni::sys::{jbyteArray, jstring};
use mdi_core::{
    TextFormat, parse_json, render_docx, render_epub, render_html, render_text, render_text_format,
    serialize_mdi,
};
use std::ptr;

const ILLEGAL_ARGUMENT_EXCEPTION: &str = "java/lang/IllegalArgumentException";
const ILLEGAL_STATE_EXCEPTION: &str = "java/lang/IllegalStateException";

fn read_source(env: &mut JNIEnv<'_>, value: JString<'_>) -> Result<String, String> {
    env.get_string(&value)
        .map(|value| value.into())
        .map_err(|error| format!("Unable to read the UTF-8 source: {error}"))
}

fn throw(env: &mut JNIEnv<'_>, class: &str, message: impl AsRef<str>) {
    let _ = env.throw_new(class, message.as_ref());
}

fn into_jstring(env: &mut JNIEnv<'_>, result: Result<String, String>) -> jstring {
    match result {
        Ok(value) => match env.new_string(value) {
            Ok(value) => value.into_raw(),
            Err(error) => {
                throw(
                    env,
                    ILLEGAL_STATE_EXCEPTION,
                    format!("Unable to allocate a Java string: {error}"),
                );
                ptr::null_mut()
            }
        },
        Err(message) => {
            throw(env, ILLEGAL_ARGUMENT_EXCEPTION, message);
            ptr::null_mut()
        }
    }
}

fn into_byte_array(env: &mut JNIEnv<'_>, result: Result<Vec<u8>, String>) -> jbyteArray {
    match result {
        Ok(value) => match env.byte_array_from_slice(&value) {
            Ok(value) => value.into_raw(),
            Err(error) => {
                throw(
                    env,
                    ILLEGAL_STATE_EXCEPTION,
                    format!("Unable to allocate a Java byte array: {error}"),
                );
                ptr::null_mut()
            }
        },
        Err(message) => {
            throw(env, ILLEGAL_STATE_EXCEPTION, message);
            ptr::null_mut()
        }
    }
}

#[unsafe(no_mangle)]
pub extern "system" fn Java_app_illusions_mdi_internal_MdiNative_parseJson(
    mut env: JNIEnv<'_>,
    _: JObject<'_>,
    value: JString<'_>,
) -> jstring {
    let result = read_source(&mut env, value).map(|source| parse_json(&source));
    into_jstring(&mut env, result)
}

#[unsafe(no_mangle)]
pub extern "system" fn Java_app_illusions_mdi_internal_MdiNative_renderHtml(
    mut env: JNIEnv<'_>,
    _: JObject<'_>,
    value: JString<'_>,
) -> jstring {
    let result = read_source(&mut env, value).map(|source| render_html(&source));
    into_jstring(&mut env, result)
}

#[unsafe(no_mangle)]
pub extern "system" fn Java_app_illusions_mdi_internal_MdiNative_serializeMdi(
    mut env: JNIEnv<'_>,
    _: JObject<'_>,
    value: JString<'_>,
) -> jstring {
    let result = read_source(&mut env, value).map(|source| serialize_mdi(&source));
    into_jstring(&mut env, result)
}

#[unsafe(no_mangle)]
pub extern "system" fn Java_app_illusions_mdi_internal_MdiNative_renderText(
    mut env: JNIEnv<'_>,
    _: JObject<'_>,
    value: JString<'_>,
) -> jstring {
    let result = read_source(&mut env, value).map(|source| render_text(&source));
    into_jstring(&mut env, result)
}

#[unsafe(no_mangle)]
pub extern "system" fn Java_app_illusions_mdi_internal_MdiNative_renderTextFormat(
    mut env: JNIEnv<'_>,
    _: JObject<'_>,
    source_value: JString<'_>,
    format_value: JString<'_>,
    indent_prefix_value: JString<'_>,
) -> jstring {
    let result = (|| {
        let source = read_source(&mut env, source_value)?;
        let format = read_source(&mut env, format_value)?;
        let indent_prefix = read_source(&mut env, indent_prefix_value)?;
        let format = TextFormat::parse(&format)
            .ok_or_else(|| format!("Unsupported MDI text format: {format}"))?;
        Ok(render_text_format(&source, format, &indent_prefix))
    })();
    into_jstring(&mut env, result)
}

#[unsafe(no_mangle)]
pub extern "system" fn Java_app_illusions_mdi_internal_MdiNative_renderEpub(
    mut env: JNIEnv<'_>,
    _: JObject<'_>,
    value: JString<'_>,
) -> jbyteArray {
    let result = read_source(&mut env, value).and_then(|source| render_epub(&source));
    into_byte_array(&mut env, result)
}

#[unsafe(no_mangle)]
pub extern "system" fn Java_app_illusions_mdi_internal_MdiNative_renderDocx(
    mut env: JNIEnv<'_>,
    _: JObject<'_>,
    value: JString<'_>,
) -> jbyteArray {
    let result = read_source(&mut env, value).and_then(|source| render_docx(&source));
    into_byte_array(&mut env, result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn delegates_parse_and_rendering_to_mdi_core() {
        assert!(parse_json("第^12^話").contains("\"irVersion\":\"1.0\""));
        assert!(render_html("{東京|とうきょう}").contains("mdi-ruby"));
        assert_eq!(render_text("{東京|とうきょう}"), "東京\n");
        assert_eq!(serialize_mdi("第^12^話"), "第^12^話\n");
    }

    #[test]
    fn restricts_text_formats_to_the_core_contract() {
        assert_eq!(TextFormat::parse("txt-ruby"), Some(TextFormat::Ruby));
        assert_eq!(TextFormat::parse("not-an-mdi-format"), None);
    }
}
