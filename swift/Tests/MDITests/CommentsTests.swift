import Foundation
import XCTest
@testable import MDI

final class CommentsTests: XCTestCase {
    private func values(_ node: MDIJSONValue) -> [String] {
        guard case let .object(fields) = node else { return [] }
        var result: [String] = []
        if fields["type"] == .string("comment"), case let .string(value) = fields["value"] {
            result.append(value)
        }
        if case let .array(children) = fields["children"] {
            result += children.flatMap(values)
        }
        return result
    }

    func testSharedCommentFixtures() throws {
        let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        let data = try Data(contentsOf: root.appendingPathComponent("mdi-core/tests/fixtures/comments/cases.json"))
        struct Fixture: Decodable { let name: String; let source: String; let values: [String] }
        for fixture in try JSONDecoder().decode([Fixture].self, from: data) {
            XCTAssertEqual(values(try MDI.parse(fixture.source).document), [], fixture.name)
            let full = try MDI.parse(fixture.source, includeComments: true)
            XCTAssertEqual(full.irVersion, mdiCommentIRVersion)
            XCTAssertEqual(values(full.document), fixture.values, fixture.name)
            XCTAssertEqual(values(try MDI.parse(MDI.serialize(fixture.source), includeComments: true).document), fixture.values, fixture.name)
        }
    }
}
