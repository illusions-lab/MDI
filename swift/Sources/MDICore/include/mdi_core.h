#ifndef MDI_CORE_H
#define MDI_CORE_H

#include <stddef.h>
#include <stdint.h>

typedef struct { uint8_t *data; size_t len; } mdi_ffi_buffer;
typedef struct { mdi_ffi_buffer value; mdi_ffi_buffer error; } mdi_ffi_result;

mdi_ffi_result mdi_parse_json(const uint8_t *data, size_t len);
mdi_ffi_result mdi_render_html(const uint8_t *data, size_t len);
mdi_ffi_result mdi_serialize_mdi(const uint8_t *data, size_t len);
mdi_ffi_result mdi_render_text(const uint8_t *data, size_t len);
mdi_ffi_result mdi_render_epub(const uint8_t *data, size_t len);
mdi_ffi_result mdi_render_docx(const uint8_t *data, size_t len);
void mdi_free_buffer(mdi_ffi_buffer buffer);

#endif
