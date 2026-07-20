package app.illusions.mdi

import app.illusions.mdi.internal.MdiNative
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject

/** MDI syntax version supported by this Android binding. */
public const val MDI_SPEC_VERSION: String = "2.0"

/** Version of the Rust-owned document IR understood by this binding. */
public const val MDI_IR_VERSION: String = "1.0"

/** Complete Android interface to the Rust-authoritative MDI implementation. */
public object Mdi {
    /** Parses complete MDI source; Kotlin does not tokenize or repair syntax. */
    @JvmStatic
    public fun parse(source: String): MdiParseResult {
        val result = MdiJson.decode(MdiBridgeHolder.bridge.parseJson(source))
        require(result.irVersion == MDI_IR_VERSION) {
            "Unsupported MDI IR version: ${result.irVersion}"
        }
        return result
    }

    /** Renders standalone HTML from the Rust-owned document IR. */
    @JvmStatic public fun renderHtml(source: String): String = MdiBridgeHolder.bridge.renderHtml(source)

    /** Canonically serializes source through the Rust parser. */
    @JvmStatic public fun serializeMdi(source: String): String = MdiBridgeHolder.bridge.serializeMdi(source)

    /** Renders deterministic plain text through Rust. */
    @JvmStatic public fun renderText(source: String): String = MdiBridgeHolder.bridge.renderText(source)

    /** Renders a named publication-text convention through Rust. */
    @JvmStatic
    public fun renderTextFormat(source: String, format: MdiTextFormat, indentPrefix: String = ""): String =
        MdiBridgeHolder.bridge.renderTextFormat(source, format.wireName, indentPrefix)

    /** Builds an EPUB archive. Persist the returned bytes with Android's Storage Access Framework. */
    @JvmStatic public fun renderEpub(source: String): ByteArray = MdiBridgeHolder.bridge.renderEpub(source)

    /** Builds a DOCX archive. Persist the returned bytes with Android's Storage Access Framework. */
    @JvmStatic public fun renderDocx(source: String): ByteArray = MdiBridgeHolder.bridge.renderDocx(source)
}

/** Text export conventions implemented by mdi-core. */
public enum class MdiTextFormat(internal val wireName: String) {
    Plain("txt"), Ruby("txt-ruby"), Narou("narou"), Kakuyomu("kakuyomu"), Aozora("aozora"),
}

@Serializable
public data class MdiParseResult(
    val irVersion: String,
    val syntaxVersion: String,
    val capabilities: MdiParserCapabilities,
    /** Rust's tagged, extensible document IR. Do not infer MDI grammar from it. */
    val document: JsonObject,
    val diagnostics: List<MdiDiagnostic>,
)

@Serializable
public data class MdiParserCapabilities(
    val mdi: Boolean,
    val commonMark: Boolean,
    val gfm: Boolean,
    val frontMatter: Boolean,
    val sourceSpans: Boolean,
)

@Serializable
public data class MdiDiagnostic(
    val severity: String,
    val code: String,
    val message: String,
    val span: MdiSourceSpan? = null,
)

/** Half-open UTF-8 byte range, not a Kotlin String character range. */
@Serializable
public data class MdiSourceSpan(
    val startByte: Int,
    val endByte: Int,
)

internal object MdiJson {
    private val json = Json { ignoreUnknownKeys = false }

    fun decode(value: String): MdiParseResult = json.decodeFromString(value)
}

/** Host boundary kept separate so unit tests can cover the public API without JNI. */
internal interface MdiBridge {
    fun parseJson(source: String): String
    fun renderHtml(source: String): String
    fun serializeMdi(source: String): String
    fun renderText(source: String): String
    fun renderTextFormat(source: String, format: String, indentPrefix: String): String
    fun renderEpub(source: String): ByteArray
    fun renderDocx(source: String): ByteArray
}

internal object NativeMdiBridge : MdiBridge {
    override fun parseJson(source: String): String = MdiNative.parseJson(source)
    override fun renderHtml(source: String): String = MdiNative.renderHtml(source)
    override fun serializeMdi(source: String): String = MdiNative.serializeMdi(source)
    override fun renderText(source: String): String = MdiNative.renderText(source)
    override fun renderTextFormat(source: String, format: String, indentPrefix: String): String =
        MdiNative.renderTextFormat(source, format, indentPrefix)
    override fun renderEpub(source: String): ByteArray = MdiNative.renderEpub(source)
    override fun renderDocx(source: String): ByteArray = MdiNative.renderDocx(source)
}

internal object MdiBridgeHolder {
    var bridge: MdiBridge = NativeMdiBridge
}
