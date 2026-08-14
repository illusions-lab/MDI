import Foundation
import XCTest
import MDICore
@testable import MDI

final class MDITests: XCTestCase {
    private let formatContractSource = """
    ---
    title: Swift package contract
    lang: ja
    ---

    # Swift package contract

    {東京|とうきょう}で第^12^話。
    """

    func testParsesRustOwnedDocument() throws {
        let result = try MDI.parse("第^12^話")
        XCTAssertEqual(result.irVersion, mdiIRVersion)
        XCTAssertEqual(result.syntaxVersion, mdiSpecVersion)
        XCTAssertTrue(result.capabilities.mdi)
        XCTAssertTrue(result.capabilities.commonMark)
        XCTAssertTrue(result.capabilities.gfm)
        XCTAssertTrue(result.capabilities.frontMatter)
        XCTAssertTrue(result.capabilities.sourceSpans)
        XCTAssertTrue(result.diagnostics.isEmpty)
    }

    func testReturnsRecoverableDiagnosticsWithUTF8ByteSpans() throws {
        let source = "---\nmdi: '3.0'\n---\n\n👨‍👩‍👧"
        let result = try MDI.parse(source)

        XCTAssertEqual(result.diagnostics, [
            MDIDiagnostic(
                severity: .warning,
                code: "mdi.version.unsupported",
                message: "MDI 3.0 is newer than the supported 2.0",
                span: MDISourceSpan(startByte: 0, endByte: 18)
            ),
        ])
        XCTAssertEqual(documentSpan(in: result.document)?.endByte, UInt32(source.utf8.count))
    }

    func testKeepsTheJSAdversarialCorpusInsideTheRustWireContract() throws {
        let corpus = [
            "\\{}《《傍点》》\n\n\\[{東京|とう.きょう}",
            "👨‍👩‍👧 [[em:**強調**]] [^n]\n\n[^n]: 注",
            "[[indent:2]]\n{𠮟る|しか.る} [[no-break:^12^]]\n\n[[pagebreak:left]]",
            "```mdi\n{東京|とうきょう}\n```\n\n| a | b |\n| - | - |\n| [[em:x]] | ^12^ |",
        ]

        for source in corpus {
            let result = try MDI.parse(source)
            XCTAssertEqual(
                documentSpan(in: result.document),
                MDISourceSpan(startByte: 0, endByte: UInt32(source.utf8.count))
            )
            assertValidSpans(in: result.document, sourceByteCount: UInt32(source.utf8.count))
            XCTAssertTrue(try MDI.renderHTML(source).hasPrefix("<!DOCTYPE html>"))
            XCTAssertEqual(try MDI.parse(MDI.serialize(source)).irVersion, mdiIRVersion)
        }
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

    func testGeneralParseWireTreeNeverExposesMdastProvenance() throws {
        let source = """
        ---
        title: provenance isolation
        ---

        > - {東京|とうきょう} ^12^

        | image | empty |
        | - | - |
        | ![alt](cover.png) | ![](empty.png) |
        """
        let result = try MDI.parse(source)

        assertKeyAbsent("mdiProvenance", in: result.document)
        let encoded = try JSONEncoder().encode(result)
        XCTAssertFalse(String(decoding: encoded, as: UTF8.self).contains("\"mdiProvenance\""))
    }

    func testRendersThroughRust() throws {
        let html = try MDI.renderHTML("{東京|とうきょう} ^12^")
        XCTAssertTrue(html.contains("<ruby class=\"mdi-ruby\">東京"))
        XCTAssertTrue(html.contains("<span class=\"mdi-tcy\">12</span>"))
        XCTAssertEqual(try MDI.renderText("{東京|とうきょう} ^12^"), "東京 12\n")
    }

    func testRendersEveryPublicTextFormatThroughRust() throws {
        let source = "{東京|とうきょう}"
        let expected: [MDITextFormat: String] = [
            .plain: "　東京",
            .ruby: "　{東京|とうきょう}",
            .narou: "　｜東京《とうきょう》",
            .kakuyomu: "　｜東京《とうきょう》",
            .aozora: "　｜東京《とうきょう》",
            .note: "　｜東京《とうきょう》",
        ]

        XCTAssertEqual(
            Set(MDITextFormat.allCases.map(\.rawValue)),
            ["txt", "txt-ruby", "narou", "kakuyomu", "aozora", "note"]
        )
        for format in MDITextFormat.allCases {
            XCTAssertEqual(
                try MDI.renderTextFormat(source, format: format, indentPrefix: "　"),
                expected[format]
            )
        }
    }

    func testSerializesMDIThroughRust() throws {
        let mdi = try MDI.serialize("{東京|とうきょう} ^12^")
        XCTAssertTrue(mdi.contains("{東京|とうきょう}"))
        XCTAssertTrue(mdi.contains("^12^"))
    }

    func testAllPublicFormatsPreserveThePackageContract() throws {
        let html = try MDI.renderHTML(formatContractSource)
        let text = try MDI.renderText(formatContractSource)
        let serialized = try MDI.serialize(formatContractSource)
        let reparsed = try MDI.parse(serialized)
        let epub = try MDI.renderEPUB(formatContractSource)
        let docx = try MDI.renderDOCX(formatContractSource)

        XCTAssertTrue(html.contains("<h1>Swift package contract</h1>"))
        XCTAssertTrue(html.contains("<ruby class=\"mdi-ruby\">東京"))
        XCTAssertTrue(html.contains("<span class=\"mdi-tcy\">12</span>"))
        XCTAssertTrue(text.contains("Swift package contract"))
        XCTAssertTrue(text.contains("東京で第12話。"))
        XCTAssertTrue(serialized.contains("{東京|とうきょう}"))
        XCTAssertTrue(serialized.contains("^12^"))
        XCTAssertEqual(reparsed.irVersion, mdiIRVersion)
        XCTAssertTrue(reparsed.diagnostics.isEmpty)
        XCTAssertGreaterThan(epub.count, 100)
        XCTAssertGreaterThan(docx.count, 100)
        XCTAssertEqual(Array(epub.prefix(2)), [0x50, 0x4b])
        XCTAssertEqual(Array(docx.prefix(2)), [0x50, 0x4b])

#if os(macOS)
        XCTAssertTrue(
            try archiveEntries(in: epub, extension: "epub").isSuperset(of: [
                "mimetype",
                "META-INF/container.xml",
                "OEBPS/package.opf",
                "OEBPS/nav.xhtml",
                "OEBPS/style.css",
                "OEBPS/chapter-1.xhtml",
            ])
        )
        XCTAssertTrue(
            try archiveEntries(in: docx, extension: "docx").isSuperset(of: [
                "[Content_Types].xml",
                "_rels/.rels",
                "docProps/core.xml",
                "word/document.xml",
            ])
        )
#endif
    }

    /// CI supplies `MDI_SWIFT_SMOKE_OUTPUT` and then opens these exact
    /// package-level products with EPUBCheck and Apple's document importers.
    func testWritesEveryPublicFormatForExternalConsumers() throws {
        guard let outputPath = ProcessInfo.processInfo.environment["MDI_SWIFT_SMOKE_OUTPUT"] else {
            throw XCTSkip("external format smoke output was not requested")
        }

        let output = URL(fileURLWithPath: outputPath, isDirectory: true)
        try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
        var formats: [(String, Data)] = [
            ("document.html", Data(try MDI.renderHTML(formatContractSource).utf8)),
            ("document.txt", Data(try MDI.renderText(formatContractSource).utf8)),
            ("document.mdi", Data(try MDI.serialize(formatContractSource).utf8)),
            ("document.epub", try MDI.renderEPUB(formatContractSource)),
            ("document.docx", try MDI.renderDOCX(formatContractSource)),
        ]
        for format in MDITextFormat.allCases {
            formats.append((
                "document-\(format.rawValue).txt",
                Data(try MDI.renderTextFormat(
                    formatContractSource,
                    format: format,
                    indentPrefix: "　"
                ).utf8)
            ))
        }

        for (name, contents) in formats {
            XCTAssertFalse(contents.isEmpty, "\(name) must not be empty")
            try contents.write(to: output.appendingPathComponent(name), options: .atomic)
        }

        let serialized = try String(contentsOf: output.appendingPathComponent("document.mdi"), encoding: .utf8)
        XCTAssertEqual(try MDI.serialize(serialized), serialized)
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

    func testRejectsMalformedNativeStringAndBufferPayloads() throws {
        XCTAssertThrowsError(try MDI.string(from: Data([0xff]))) { error in
            XCTAssertEqual(error as? MDIError, .invalidWireFormat("MDI core returned non-UTF-8 string data"))
        }
        XCTAssertEqual(MDI.coreErrorMessage(from: Data([0xff])), "Unknown MDI core error")

        let invalid = mdi_ffi_result(
            value: mdi_ffi_buffer(data: nil, len: 1),
            error: mdi_ffi_buffer(data: nil, len: 0)
        )
        XCTAssertThrowsError(try MDI.data(from: invalid)) { error in
            XCTAssertEqual(error as? MDIError, .invalidWireFormat("MDI core returned an invalid buffer"))
        }

        let empty = mdi_ffi_result(
            value: mdi_ffi_buffer(data: nil, len: 0),
            error: mdi_ffi_buffer(data: nil, len: 0)
        )
        XCTAssertEqual(try MDI.data(from: empty), Data())
    }

    func testForwardsRustCoreErrors() {
        XCTAssertThrowsError(try MDI.call(bytes: [0xff], operation: mdi_parse_json)) { error in
            guard case let .core(message) = error as? MDIError else {
                return XCTFail("expected a core error")
            }
            XCTAssertFalse(message.isEmpty)
        }
    }

#if os(macOS)
    private func archiveEntries(in data: Data, extension fileExtension: String) throws -> Set<String> {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("mdi-swift-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }

        let archive = directory.appendingPathComponent("document.\(fileExtension)")
        try data.write(to: archive, options: .atomic)

        let process = Process()
        let standardOutput = Pipe()
        let standardError = Pipe()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/unzip")
        process.arguments = ["-Z1", archive.path]
        process.standardOutput = standardOutput
        process.standardError = standardError
        try process.run()
        process.waitUntilExit()

        let output = standardOutput.fileHandleForReading.readDataToEndOfFile()
        let error = standardError.fileHandleForReading.readDataToEndOfFile()
        guard process.terminationStatus == 0 else {
            throw MDIError.invalidWireFormat(
                "unzip could not open \(fileExtension): \(String(decoding: error, as: UTF8.self))"
            )
        }
        return Set(String(decoding: output, as: UTF8.self).split(separator: "\n").map(String.init))
    }
#endif

    private func documentSpan(in value: MDIJSONValue) -> MDISourceSpan? {
        guard
            case let .object(object) = value,
            case let .object(span)? = object["span"],
            case let .number(start)? = span["startByte"],
            case let .number(end)? = span["endByte"]
        else {
            return nil
        }
        return MDISourceSpan(startByte: UInt32(start), endByte: UInt32(end))
    }

    private func assertValidSpans(
        in value: MDIJSONValue,
        sourceByteCount: UInt32,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        switch value {
        case let .array(values):
            for child in values {
                assertValidSpans(
                    in: child,
                    sourceByteCount: sourceByteCount,
                    file: file,
                    line: line
                )
            }
        case let .object(object):
            if let span = documentSpan(in: value) {
                XCTAssertLessThanOrEqual(span.startByte, span.endByte, file: file, line: line)
                XCTAssertLessThanOrEqual(span.endByte, sourceByteCount, file: file, line: line)
            }
            for child in object.values {
                assertValidSpans(
                    in: child,
                    sourceByteCount: sourceByteCount,
                    file: file,
                    line: line
                )
            }
        case .null, .bool, .number, .string:
            break
        }
    }

    private func assertKeyAbsent(
        _ forbidden: String,
        in value: MDIJSONValue,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        switch value {
        case let .array(values):
            for child in values {
                assertKeyAbsent(forbidden, in: child, file: file, line: line)
            }
        case let .object(object):
            XCTAssertNil(object[forbidden], file: file, line: line)
            for child in object.values {
                assertKeyAbsent(forbidden, in: child, file: file, line: line)
            }
        case .null, .bool, .number, .string:
            break
        }
    }
}
