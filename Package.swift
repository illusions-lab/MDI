// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "IllusionMarkdown",
    platforms: [.macOS(.v13), .iOS(.v15)],
    products: [
        .library(name: "MDI", targets: ["MDI"]),
    ],
    targets: [
        .binaryTarget(name: "MDICore", url: "https://github.com/illusions-lab/MDI/releases/download/2.0.4/MDICore.xcframework.zip", checksum: "1d88f210332a025c9bac39da11286e8889144a1af97a9652f8a7bdbb6a66f962"),
        .target(name: "MDI", dependencies: ["MDICore"], path: "swift/Sources/MDI"),
        .testTarget(name: "MDITests", dependencies: ["MDI", "MDICore"], path: "swift/Tests/MDITests"),
    ]
)
