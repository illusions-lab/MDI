package app.illusions.mdi

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertNotNull
import kotlin.test.assertTrue
import org.junit.After
import org.junit.Before
import kotlinx.serialization.json.int
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

class MdiJsonTest {
    private lateinit var bridge: FakeBridge

    @Before
    fun replace_native_bridge() {
        bridge = FakeBridge()
        MdiBridgeHolder.bridge = bridge
    }

    @After
    fun restore_native_bridge() {
        MdiBridgeHolder.bridge = NativeMdiBridge
    }

    @Test
    fun decodes_the_versioned_rust_wire_contract() {
        val result = MdiJson.decode(
            """{"irVersion":"1.0","syntaxVersion":"2.0","capabilities":{"mdi":true,"commonMark":true,"gfm":true,"frontMatter":true,"sourceSpans":true},"document":{"span":{"startByte":0,"endByte":10},"children":[{"type":"paragraph"}]},"diagnostics":[{"severity":"warning","code":"mdi.example","message":"Example","span":{"startByte":0,"endByte":3}}]}""",
        )

        assertEquals(MDI_IR_VERSION, result.irVersion)
        assertEquals(10, result.document["span"]?.jsonObject?.get("endByte")?.jsonPrimitive?.int)
        assertEquals("mdi.example", result.diagnostics.single().code)
        assertEquals(3, result.diagnostics.single().span?.endByte)
    }

    @Test
    fun text_formats_keep_the_stable_core_names() {
        assertEquals("txt-ruby", MdiTextFormat.Ruby.wireName)
        assertTrue(MdiTextFormat.entries.any { it.wireName == "aozora" })
        assertTrue(MdiTextFormat.entries.any { it.wireName == "note" })
        assertFalse(MdiTextFormat.entries.any { it.wireName == "pdf" })
    }

    @Test
    fun public_api_forwards_every_renderer_to_the_host_bridge() {
        assertEquals(MDI_IR_VERSION, Mdi.parse("source").irVersion)
        assertEquals("<html>", Mdi.renderHtml("source"))
        assertEquals("normalized", Mdi.serializeMdi("source"))
        assertEquals("plain", Mdi.renderText("source"))
        assertEquals("narou:  ", Mdi.renderTextFormat("source", MdiTextFormat.Narou, "  "))
        assertEquals("txt:", Mdi.renderTextFormat("source", MdiTextFormat.Plain))
        assertEquals("note:", Mdi.renderTextFormat("source", MdiTextFormat.Note))
        assertEquals(listOf<Byte>(1, 2), Mdi.renderEpub("source").toList())
        assertEquals(listOf<Byte>(3, 4), Mdi.renderDocx("source").toList())
        assertEquals(
            listOf("parse:source", "html:source", "serialize:source", "text:source", "format:narou:  ", "format:txt:", "format:note:", "epub:source", "docx:source"),
            bridge.calls,
        )
    }

    @Test
    fun public_api_rejects_an_unsupported_ir_version() {
        bridge.parseJson = validParseJson.replace("\"irVersion\":\"1.0\"", "\"irVersion\":\"2.0\"")
        val error = assertFailsWith<IllegalArgumentException> { Mdi.parse("source") }
        assertEquals("Unsupported MDI IR version: 2.0", error.message)
    }

    @Test
    fun public_wire_value_types_preserve_every_contract_field() {
        val capabilities = MdiParserCapabilities(
            mdi = true,
            commonMark = true,
            gfm = true,
            frontMatter = true,
            sourceSpans = true,
        )
        val span = MdiSourceSpan(startByte = 2, endByte = 8)
        val diagnostic = MdiDiagnostic("warning", "mdi.example", "Example", span)
        val diagnosticWithoutSpan = MdiDiagnostic("error", "mdi.none", "No span")
        val document = JsonObject(emptyMap())
        val result = MdiParseResult("1.0", "2.0", capabilities, document, listOf(diagnostic))

        assertTrue(result.capabilities.mdi)
        assertTrue(result.capabilities.commonMark)
        assertTrue(result.capabilities.gfm)
        assertTrue(result.capabilities.frontMatter)
        assertTrue(result.capabilities.sourceSpans)
        assertEquals(2, diagnostic.span?.startByte)
        assertEquals(8, diagnostic.span?.endByte)
        assertEquals("warning", diagnostic.severity)
        assertEquals("mdi.example", diagnostic.code)
        assertEquals("Example", diagnostic.message)
        assertNull(diagnosticWithoutSpan.span)
        assertEquals("error", diagnosticWithoutSpan.severity)
        assertEquals("mdi.none", diagnosticWithoutSpan.code)
        assertEquals("No span", diagnosticWithoutSpan.message)
        assertEquals("1.0", result.irVersion)
        assertEquals("2.0", result.syntaxVersion)
        assertEquals(document, result.document)
        assertEquals(listOf(diagnostic), result.diagnostics)
        assertNotNull(MdiParseResult.serializer())
        assertNotNull(MdiParserCapabilities.serializer())
        assertNotNull(MdiDiagnostic.serializer())
        assertNotNull(MdiSourceSpan.serializer())
    }

    private class FakeBridge : MdiBridge {
        val calls = mutableListOf<String>()
        var parseJson: String = validParseJson

        override fun parseJson(source: String): String = parseJson.also { calls += "parse:$source" }
        override fun renderHtml(source: String): String = "<html>".also { calls += "html:$source" }
        override fun serializeMdi(source: String): String = "normalized".also { calls += "serialize:$source" }
        override fun renderText(source: String): String = "plain".also { calls += "text:$source" }
        override fun renderTextFormat(source: String, format: String, indentPrefix: String): String =
            "$format:$indentPrefix".also { calls += "format:$format:$indentPrefix" }
        override fun renderEpub(source: String): ByteArray = byteArrayOf(1, 2).also { calls += "epub:$source" }
        override fun renderDocx(source: String): ByteArray = byteArrayOf(3, 4).also { calls += "docx:$source" }
    }

    private companion object {
        const val validParseJson =
            """{"irVersion":"1.0","syntaxVersion":"2.0","capabilities":{"mdi":true,"commonMark":true,"gfm":true,"frontMatter":true,"sourceSpans":true},"document":{"span":{"startByte":0,"endByte":0},"children":[]},"diagnostics":[]}"""
    }
}
