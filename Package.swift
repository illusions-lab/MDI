// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "IllusionMarkdown",
    platforms: [.macOS(.v13), .iOS(.v15)],
    products: [
        .library(name: "MDI", targets: ["MDI"]),
    ],
    targets: [
        .binaryTarget(name: "MDICore", url: "https://github.com/illusions-lab/MDI/releases/download/2.0.3/MDICore.xcframework.zip", checksum: "ab6d91840673a7f54f4d76fb814f9102359780d274751e1e11ea5c411f73621e"),
        .target(name: "MDI", dependencies: ["MDICore"], path: "swift/Sources/MDI"),
        .testTarget(name: "MDITests", dependencies: ["MDI", "MDICore"], path: "swift/Tests/MDITests"),
    ]
)
