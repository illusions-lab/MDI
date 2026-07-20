import Foundation
import XCTest
import MDICore
@testable import MDI

final class MDITests: XCTestCase {
    func testParsesRustOwnedDocument() throws {
        let result = try MDI.parse("第^12^話")
        XCTAssertEqual(result.irVersion, mdiIRVersion)
        XCTAssertEqual(result.syntaxVersion, mdiSpecVersion)
        XCTAssertTrue(result.capabilities.mdi)
        XCTAssertTrue(result.capabilities.commonMark)
        XCTAssertTrue(result.diagnostics.isEmpty)
    }

    func testParsePreservesDocumentStructureAndUnicode() throws {
        let result = try MDI.parse("# 見出し\n\n{東京|とうきょう}で第^12^話")
        guard case let .object(document) = result.document else {
            return XCTFail("expected the document root to be an object")
        }

        // The JSON IR deliberately remains Rust-owned. Assert only its stable
        // contract here rather than imposing Swift-side node-shape assumptions.
        XCTAssertFalse(document.isEmpty)
        XCTAssertTrue(document.values.contains { value in
            guard case let .array(children) = value else { return false }
            return !children.isEmpty
        })
    }

    func testRendersThroughRust() throws {
        let html = try MDI.renderHTML("{東京|とうきょう} ^12^")
        XCTAssertTrue(html.contains("<ruby class=\"mdi-ruby\">東京"))
        XCTAssertTrue(html.contains("<span class=\"mdi-tcy\">12</span>"))
        XCTAssertEqual(try MDI.renderText("{東京|とうきょう} ^12^"), "東京 12\n")
    }

    func testSerializesMDIThroughRust() throws {
        let mdi = try MDI.serialize("{東京|とうきょう} ^12^")
        XCTAssertTrue(mdi.contains("{東京|とうきょう}"))
        XCTAssertTrue(mdi.contains("^12^"))
    }

    func testReturnsBinaryDocuments() throws {
        let epub = try MDI.renderEPUB("# Chapter\n\nText")
        let docx = try MDI.renderDOCX("# Chapter\n\nText")

        XCTAssertGreaterThan(epub.count, 100)
        XCTAssertGreaterThan(docx.count, 100)
        XCTAssertEqual(Array(epub.prefix(2)), [0x50, 0x4b])
        XCTAssertEqual(Array(docx.prefix(2)), [0x50, 0x4b])
    }

    func testJSONValueRoundTripsEveryVariant() throws {
        let value: MDIJSONValue = .object([
            "null": .null,
            "bool": .bool(true),
            "number": .number(12.5),
            "string": .string("東京"),
            "array": .array([.string("nested"), .bool(false)]),
        ])

        let data = try JSONEncoder().encode(value)
        XCTAssertEqual(try JSONDecoder().decode(MDIJSONValue.self, from: data), value)
    }

    func testPublicValueTypesDecodeFromDocumentIR() throws {
        let json = """
        {
          "irVersion": "1.0",
          "syntaxVersion": "2.0",
          "capabilities": {"mdi": true, "commonMark": true, "gfm": true, "frontMatter": true, "sourceSpans": false},
          "document": {"type": "document", "children": []},
          "diagnostics": [{"severity": "warning", "code": "example", "message": "example diagnostic", "span": {"startByte": 1, "endByte": 2}}]
        }
        """
        let result = try JSONDecoder().decode(MDIParseResult.self, from: Data(json.utf8))

        XCTAssertEqual(result.irVersion, mdiIRVersion)
        XCTAssertEqual(result.capabilities.gfm, true)
        XCTAssertEqual(result.diagnostics.first?.severity, .warning)
        XCTAssertEqual(result.diagnostics.first?.span, MDISourceSpan(startByte: 1, endByte: 2))
    }

    func testErrorsExposeTheirMessage() {
        XCTAssertEqual(MDIError.core("core failed").errorDescription, "core failed")
        XCTAssertEqual(MDIError.invalidWireFormat("bad wire").errorDescription, "bad wire")
    }

    func testRejectsMalformedNativeParsePayloads() {
        XCTAssertThrowsError(try MDI.parseResult(from: Data("not JSON".utf8))) { error in
            guard case let .invalidWireFormat(message) = error as? MDIError else {
                return XCTFail("expected an invalid wire-format error")
            }
            XCTAssertTrue(message.contains("invalid parse JSON"))
        }

        let unsupported = """
        {"irVersion":"999.0","syntaxVersion":"2.0","capabilities":{"mdi":true,"commonMark":true,"gfm":true,"frontMatter":true,"sourceSpans":false},"document":{},"diagnostics":[]}
        """
        XCTAssertThrowsError(try MDI.parseResult(from: Data(unsupported.utf8))) { error in
            XCTAssertEqual(error as? MDIError, .invalidWireFormat("Unsupported MDI IR version: 999.0"))
        }
    }

    func testRejectsMalformedNativeStringAndBufferPayloads() {
        XCTAssertThrowsError(try MDI.string(from: Data([0xff]))) { error in
            XCTAssertEqual(error as? MDIError, .invalidWireFormat("MDI core returned non-UTF-8 string data"))
        }

        let invalid = mdi_ffi_result(
            value: mdi_ffi_buffer(data: nil, len: 1),
            error: mdi_ffi_buffer(data: nil, len: 0)
        )
        XCTAssertThrowsError(try MDI.data(from: invalid)) { error in
            XCTAssertEqual(error as? MDIError, .invalidWireFormat("MDI core returned an invalid buffer"))
        }
    }

    func testForwardsRustCoreErrors() {
        XCTAssertThrowsError(try MDI.call(bytes: [0xff], operation: mdi_parse_json)) { error in
            guard case let .core(message) = error as? MDIError else {
                return XCTFail("expected a core error")
            }
            XCTAssertFalse(message.isEmpty)
        }
    }
}
