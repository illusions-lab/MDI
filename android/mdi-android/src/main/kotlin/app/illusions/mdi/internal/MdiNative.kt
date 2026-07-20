package app.illusions.mdi.internal

/** JNI declarations only. All public types belong to the parent package. */
internal object MdiNative {
    init {
        System.loadLibrary("mdi_android")
    }

    external fun parseJson(source: String): String
    external fun renderHtml(source: String): String
    external fun serializeMdi(source: String): String
    external fun renderText(source: String): String
    external fun renderTextFormat(source: String, format: String, indentPrefix: String): String
    external fun renderEpub(source: String): ByteArray
    external fun renderDocx(source: String): ByteArray
}
