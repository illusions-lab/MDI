import Foundation
import XCTest
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

        XCTAssertEqual(document["type"], .string("document"))
        guard case let .array(children)? = document["children"] else {
            return XCTFail("expected document children")
        }
        XCTAssertFalse(children.isEmpty)
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
}
