use pyo3::create_exception;
use pyo3::exceptions::PyValueError;
use pyo3::prelude::*;
use pyo3::types::PyBytes;

create_exception!(mdi._native, MdiRenderError, pyo3::exceptions::PyException);

#[pyfunction]
fn parse_json(source: &str) -> String {
    mdi_core::parse_json(source)
}
#[pyfunction]
fn render_html(source: &str) -> String {
    mdi_core::render_html(source)
}

#[pyfunction]
fn serialize_mdi(source: &str) -> String {
    mdi_core::serialize_mdi(source)
}

#[pyfunction]
fn render_text(source: &str) -> String {
    mdi_core::render_text(source)
}

#[pyfunction]
fn render_text_format(source: &str, format: &str, indent_prefix: &str) -> PyResult<String> {
    let format = mdi_core::TextFormat::parse(format)
        .ok_or_else(|| PyValueError::new_err(format!("Unsupported text format: {format}")))?;
    Ok(mdi_core::render_text_format(source, format, indent_prefix))
}

#[pyfunction]
fn render_epub<'py>(py: Python<'py>, source: &str) -> PyResult<Bound<'py, PyBytes>> {
    let archive = mdi_core::render_epub(source).map_err(MdiRenderError::new_err)?;
    Ok(PyBytes::new(py, &archive))
}

#[pyfunction]
fn render_docx<'py>(py: Python<'py>, source: &str) -> PyResult<Bound<'py, PyBytes>> {
    let archive = mdi_core::render_docx(source).map_err(MdiRenderError::new_err)?;
    Ok(PyBytes::new(py, &archive))
}

#[pymodule]
fn _native(module: &Bound<'_, PyModule>) -> PyResult<()> {
    module.add("MDI_SPEC_VERSION", mdi_core::MDI_SPEC_VERSION)?;
    module.add("MDI_IR_VERSION", mdi_core::MDI_IR_VERSION)?;
    module.add("MdiRenderError", module.py().get_type::<MdiRenderError>())?;
    module.add_function(wrap_pyfunction!(parse_json, module)?)?;
    module.add_function(wrap_pyfunction!(render_html, module)?)?;
    module.add_function(wrap_pyfunction!(serialize_mdi, module)?)?;
    module.add_function(wrap_pyfunction!(render_text, module)?)?;
    module.add_function(wrap_pyfunction!(render_text_format, module)?)?;
    module.add_function(wrap_pyfunction!(render_epub, module)?)?;
    module.add_function(wrap_pyfunction!(render_docx, module)?)?;
    Ok(())
}
