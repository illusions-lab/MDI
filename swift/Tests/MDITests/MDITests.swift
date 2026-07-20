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

    func testRendersThroughRust() throws {
        let html = try MDI.renderHTML("{東京|とうきょう} ^12^")
        XCTAssertTrue(html.contains("<ruby class=\"mdi-ruby\">東京"))
        XCTAssertTrue(html.contains("<span class=\"mdi-tcy\">12</span>"))
        XCTAssertEqual(try MDI.renderText("{東京|とうきょう} ^12^"), "東京 12\n")
    }

    func testReturnsBinaryDocuments() throws {
        XCTAssertEqual(Array(try MDI.renderEPUB("text").prefix(2)), [0x50, 0x4b])
        XCTAssertEqual(Array(try MDI.renderDOCX("text").prefix(2)), [0x50, 0x4b])
    }
}
