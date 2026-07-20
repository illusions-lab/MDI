package app.illusions.mdi

import androidx.test.ext.junit.runners.AndroidJUnit4
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
    @Test
    fun native_library_parses_unicode_and_preserves_utf8_byte_spans() {
        val source = "第^12^話"
        val result = Mdi.parse(source)

        assertEquals(MDI_IR_VERSION, result.irVersion)
        assertEquals(MDI_SPEC_VERSION, result.syntaxVersion)
        assertEquals(10, result.document["span"]?.jsonObject?.get("endByte")?.jsonPrimitive?.int)
    }

    @Test
    fun native_library_delegates_renderers_to_rust() {
        assertTrue(Mdi.renderHtml("{東京|とうきょう}").contains("mdi-ruby"))
        assertEquals("東京 12\n", Mdi.renderText("{東京|とうきょう} ^12^"))
        assertArrayEquals(byteArrayOf(0x50, 0x4b), Mdi.renderEpub("# Chapter").take(2).toByteArray())
        assertArrayEquals(byteArrayOf(0x50, 0x4b), Mdi.renderDocx("text").take(2).toByteArray())
    }
}
