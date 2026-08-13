import { getMdiTextBlocks, initializeMdi, parse, resolveMdiSourceSpan, resolveMdiSourceSpans, serializeMdi } from "@illusions-lab/mdi";
import remarkMdi from "@illusions-lab/mdi-remark";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";

const source = `---
title: ブラウザ 😀
---
# Browser

{東京|とうきょう} ^12^ と émoji 😀。

| column | value |
| --- | --- |
| nested | [[em:MDI]] |
`;
const largeSource = `${source}\n\n${"段落 {東京|とうきょう} 😀\n\n".repeat(256)}`;
const recoverySource = `[[no-break:^12^]]---
mdi: '3.0'
title: adversarial
---
---
mdi: '3.0'
title: adversarial
---
`;

void run().catch((error: unknown) => {
  document.querySelector("#result")!.textContent = JSON.stringify({
    error: error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error),
  });
});

async function run(): Promise<void> {
  const retry = new URL(location.href).searchParams.has("retry");
  if (retry) {
    // The test server deliberately fails the first WASM request. The facade
    // must clear its rejected promise so a later concurrent retry can succeed.
    try {
      await Promise.all([initializeMdi(), initializeMdi()]);
    } catch {
      await Promise.all([initializeMdi(), initializeMdi()]);
    }
  } else {
    await Promise.all([initializeMdi(), initializeMdi()]);
  }

  const parsed = parse(source);
  const projection = getMdiTextBlocks(source);
  const sourceResolutionSpan = parsed.document.children[1]!.span!;
  const sourceResolution = resolveMdiSourceSpan(source, sourceResolutionSpan);
  const sourceResolutions = resolveMdiSourceSpans(source, [sourceResolutionSpan, { startByte: 0, endByte: 0 }]);
  const recoveryProjection = getMdiTextBlocks(recoverySource);
  const canonical = serializeMdi(source);
  const large = parse(largeSource);
  const unsupportedVersion = parse("---\nmdi: '3.0'\n---\n\nmalformed-version corpus");
  const processor = unified().use(remarkParse).use(remarkMdi).use(remarkStringify);
  const tree = processor.parse(source);
  const transformed = await processor.run(tree);
  const remarkOutput = processor.stringify(transformed);

  document.querySelector("#result")!.textContent = JSON.stringify({
    irVersion: parsed.irVersion,
    projectionVersion: projection.projectionVersion,
    provenanceJson: JSON.stringify(parsed.document.children.map((node) => node.mdiProvenance)),
    projectionSource: source,
    projectionJson: JSON.stringify(projection),
    sourceResolutionSpan,
    sourceResolutionJson: JSON.stringify(sourceResolution),
    sourceResolutionsJson: JSON.stringify(sourceResolutions),
    recoverySource,
    recoveryProjectionJson: JSON.stringify(recoveryProjection),
    recoveryDiagnostic: recoveryProjection.diagnostics[0],
    projectedBlocks: projection.blocks.map(({ kind, text, range }) => ({ kind, text, range })),
    firstNode: parsed.document.children[0]?.type,
    canonical,
    remarkOutput,
    hasFrontmatter: Boolean(parsed.document.frontmatter),
    tableType: parsed.document.children.find((node) => node.type === "table")?.type,
    utf8Span: parsed.document.children[1]?.span,
    largeNodeCount: large.document.children.length,
    diagnostic: unsupportedVersion.diagnostics[0],
  });
}
