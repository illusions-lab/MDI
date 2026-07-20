// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "IllusionMarkdown",
    platforms: [.macOS(.v13), .iOS(.v15)],
    products: [
        .library(name: "MDI", targets: ["MDI"]),
    ],
    targets: [
        .binaryTarget(name: "MDICore", url: "https://github.com/illusions-lab/MDI/releases/download/2.0.2/MDICore.xcframework.zip", checksum: "d1fd0fedd6cb5464edbd193efac60052589dc0a71cef380e64f15197c319fc89"),
        .target(name: "MDI", dependencies: ["MDICore"], path: "swift/Sources/MDI"),
        .testTarget(name: "MDITests", dependencies: ["MDI"], path: "swift/Tests/MDITests"),
    ]
)
