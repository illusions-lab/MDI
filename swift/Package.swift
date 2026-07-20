// swift-tools-version: 5.10
import PackageDescription

let package = Package(
	name: "IllusionMarkdown",
	platforms: [.macOS(.v13)],
	products: [
		.library(name: "MDI", targets: ["MDI"]),
	],
	targets: [
		.systemLibrary(name: "MDICore", path: "Sources/MDICore"),
		.target(name: "MDI", dependencies: ["MDICore"]),
		.testTarget(name: "MDITests", dependencies: ["MDI", "MDICore"]),
	]
)
