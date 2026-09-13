package app.illusions.registry

import app.illusions.mdi.Mdi
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class RegistryTest {
    @Test fun publishedNativeComments() {
        val source = "Beforeα<!--MAVEN_PRIVATE_21-->after"
        val default = Mdi.parse(source)
        assertEquals("1.0", default.irVersion)
        assertFalse(default.document.toString().contains("MAVEN_PRIVATE_21"))
        val full = Mdi.parse(source, includeComments = true)
        assertEquals("1.1", full.irVersion)
        assertTrue(full.document.toString().contains("MAVEN_PRIVATE_21"))
        assertTrue(Mdi.serializeMdi(source).contains("<!--MAVEN_PRIVATE_21-->"))
        assertFalse(Mdi.renderText(source).contains("MAVEN_PRIVATE_21"))
        assertFalse(Mdi.renderHtml(source).contains("MAVEN_PRIVATE_21"))
    }
}
