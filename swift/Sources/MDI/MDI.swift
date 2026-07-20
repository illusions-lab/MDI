import Foundation
import MDICore

/// MDI's supported language-specification version.
public let mdiSpecVersion = "2.0"

/// The version of the Rust-owned JSON document contract.
public let mdiIRVersion = "1.0"

public enum MDIError: Error, Equatable, LocalizedError, Sendable {
    case core(String)
    case invalidWireFormat(String)

    public var errorDescription: String? {
        switch self {
        case let .core(message), let .invalidWireFormat(message):
            return message
        }
    }
}

public struct MDISourceSpan: Codable, Equatable, Sendable {
    public let startByte: UInt32
    public let endByte: UInt32
}

public struct MDIParserCapabilities: Codable, Equatable, Sendable {
    public let mdi: Bool
    public let commonMark: Bool
    public let gfm: Bool
    public let frontMatter: Bool
    public let sourceSpans: Bool
}

public enum MDIDiagnosticSeverity: String, Codable, Sendable { case warning, error }

public struct MDIDiagnostic: Codable, Equatable, Sendable {
    public let severity: MDIDiagnosticSeverity
    public let code: String
    public let message: String
    public let span: MDISourceSpan?
}

/// Lossless representation of a value in the versioned MDI document IR.
public indirect enum MDIJSONValue: Codable, Equatable, Sendable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([MDIJSONValue])
    case object([String: MDIJSONValue])

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() { self = .null }
        else if let value = try? container.decode(Bool.self) { self = .bool(value) }
        else if let value = try? container.decode(Double.self) { self = .number(value) }
        else if let value = try? container.decode(String.self) { self = .string(value) }
        else if let value = try? container.decode([MDIJSONValue].self) { self = .array(value) }
        else { self = .object(try container.decode([String: MDIJSONValue].self)) }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .null: try container.encodeNil()
        case let .bool(value): try container.encode(value)
        case let .number(value): try container.encode(value)
        case let .string(value): try container.encode(value)
        case let .array(value): try container.encode(value)
        case let .object(value): try container.encode(value)
        }
    }
}

public struct MDIParseResult: Codable, Equatable, Sendable {
    public let irVersion: String
    public let syntaxVersion: String
    public let capabilities: MDIParserCapabilities
    public let document: MDIJSONValue
    public let diagnostics: [MDIDiagnostic]
}

/// Swift interface to the Rust-owned MDI parser and renderers.
public enum MDI {
    public static func parse(_ source: String) throws -> MDIParseResult {
        try parseResult(from: call(source, operation: mdi_parse_json))
    }

    static func parseResult(from data: Data) throws -> MDIParseResult {
        let result: MDIParseResult
        do { result = try JSONDecoder().decode(MDIParseResult.self, from: data) }
        catch { throw MDIError.invalidWireFormat("MDI core returned invalid parse JSON: \(error.localizedDescription)") }
        guard result.irVersion == mdiIRVersion else {
            throw MDIError.invalidWireFormat("Unsupported MDI IR version: \(result.irVersion)")
        }
        return result
    }

    public static func renderHTML(_ source: String) throws -> String { try stringCall(source, operation: mdi_render_html) }
    public static func serialize(_ source: String) throws -> String { try stringCall(source, operation: mdi_serialize_mdi) }
    public static func renderText(_ source: String) throws -> String { try stringCall(source, operation: mdi_render_text) }
    public static func renderEPUB(_ source: String) throws -> Data { try call(source, operation: mdi_render_epub) }
    public static func renderDOCX(_ source: String) throws -> Data { try call(source, operation: mdi_render_docx) }

    static func string(from data: Data) throws -> String {
        guard let value = String(data: data, encoding: .utf8) else {
            throw MDIError.invalidWireFormat("MDI core returned non-UTF-8 string data")
        }
        return value
    }

    private static func stringCall(_ source: String, operation: MDIFFIOperation) throws -> String {
        try string(from: call(source, operation: operation))
    }

    static func call(_ source: String, operation: MDIFFIOperation) throws -> Data {
        try call(bytes: Array(source.utf8), operation: operation)
    }

    static func call(bytes: [UInt8], operation: MDIFFIOperation) throws -> Data {
        let result = bytes.withUnsafeBufferPointer { operation($0.baseAddress, $0.count) }
        return try data(from: result)
    }

    static func data(from result: mdi_ffi_result) throws -> Data {
        defer { mdi_free_buffer(result.value); mdi_free_buffer(result.error) }
        if result.error.len > 0 {
            let message = String(data: Data(bytes: result.error.data!, count: result.error.len), encoding: .utf8) ?? "Unknown MDI core error"
            throw MDIError.core(message)
        }
        guard result.value.len == 0 || result.value.data != nil else {
            throw MDIError.invalidWireFormat("MDI core returned an invalid buffer")
        }
        return result.value.len == 0 ? Data() : Data(bytes: result.value.data!, count: result.value.len)
    }
}

typealias MDIFFIOperation = @convention(c) (UnsafePointer<UInt8>?, Int) -> mdi_ffi_result
