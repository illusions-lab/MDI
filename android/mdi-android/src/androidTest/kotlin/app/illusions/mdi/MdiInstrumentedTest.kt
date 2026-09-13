package app.illusions.mdi

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class MdiInstrumentedTest {
    private fun commentValues(node: JsonElement): List<String> {
        val obj = node as? JsonObject ?: return emptyList()
        val own = if (obj["type"]?.jsonPrimitive?.content == "comment") listOf(obj.getValue("value").jsonPrimitive.content) else emptyList()
        return own + (obj["children"] as? JsonArray).orEmpty().flatMap(::commentValues)
    }

    @Test
    fun shared_comment_fixtures() {
        val text = InstrumentationRegistry.getInstrumentation().context.assets.open("cases.json").bufferedReader().use { it.readText() }
        for (fixture in Json.parseToJsonElement(text).jsonArray) {
            val source = fixture.jsonObject.getValue("source").jsonPrimitive.content
            val expected = fixture.jsonObject.getValue("values").jsonArray.map { it.jsonPrimitive.content }
            assertEquals(emptyList<String>(), commentValues(Mdi.parse(source).document))
            val full = Mdi.parse(source, includeComments = true)
            assertEquals(MDI_COMMENT_IR_VERSION, full.irVersion)
            assertEquals(expected, commentValues(full.document))
            assertEquals(expected, commentValues(Mdi.parse(Mdi.serializeMdi(source), includeComments = true).document))
        }
    }

    @Test
    fun native_warichu_layout_preserves_utf8_positions_and_two_lines() {
        val result = Mdi.layoutWarichuJson("""[{"type":"text","value":"一二三四五六"}]""", 4, 2)
        assertTrue(result.contains("\"html\":[\"一\",\"二\"]"))
        assertTrue(result.contains("\"startUtf8\":6"))
        assertTrue(result.contains("\"html\":[\"三四\",\"五六\"]"))
    }

    @Test
    fun native_library_parses_unicode_and_preserves_utf8_byte_spans() {
        val source = "第^12^話"
        val result = Mdi.parse(source)

        assertEquals(MDI_IR_VERSION, result.irVersion)
        assertEquals(MDI_SPEC_VERSION, result.syntaxVersion)
        assertEquals(10, result.document["span"]?.jsonObject?.get("endByte")?.jsonPrimitive?.int)
    }

    @Test
    fun general_parse_wire_tree_never_exposes_mdast_provenance() {
        val source = """---
title: provenance isolation
---

> - {東京|とうきょう} ^12^

| image | empty |
| - | - |
| ![alt](cover.png) | ![](empty.png) |"""
        val result = Mdi.parse(source)

        assertTrue(!result.document.toString().contains("\"mdiProvenance\""))
    }

    @Test
    fun native_library_delegates_renderers_to_rust() {
        assertTrue(Mdi.renderHtml("{東京|とうきょう}").contains("mdi-ruby"))
        assertEquals("東京 12\n", Mdi.renderText("{東京|とうきょう} ^12^"))
        assertArrayEquals(byteArrayOf(0x50, 0x4b), Mdi.renderEpub("# Chapter").take(2).toByteArray())
        assertArrayEquals(byteArrayOf(0x50, 0x4b), Mdi.renderDocx("text").take(2).toByteArray())
    }
}
