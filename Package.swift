// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "IllusionMarkdown",
    platforms: [.macOS(.v13), .iOS(.v15)],
    products: [
        .library(name: "MDI", targets: ["MDI"]),
    ],
    targets: [
        .binaryTarget(name: "MDICore", url: "https://github.com/illusions-lab/MDI/releases/download/2.1.0/MDICore.xcframework.zip", checksum: "58b08b71ba8aaaf3c33a060e800ee9d7018707cec71c53c245579df9b34c13e0"),
        .target(name: "MDI", dependencies: ["MDICore"], path: "swift/Sources/MDI"),
        .testTarget(name: "MDITests", dependencies: ["MDI", "MDICore"], path: "swift/Tests/MDITests"),
    ]
)
