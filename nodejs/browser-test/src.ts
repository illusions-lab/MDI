import { attachMdiWarichuLayout, measureMdiWarichu, renderHtml, layoutMdiWarichu, getMdiTextBlocks, initializeMdi, parse, resolveMdiSourceSpan, resolveMdiSourceSpans, serializeMdi } from "@illusions-lab/mdi";
import { parseForMdast, type MdiMdastDocument, type MdiMdastNode } from "@illusions-lab/mdi/internal/mdast";
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
    warichuBrowser: await testWarichuBrowser(),
    warichu: layoutMdiWarichu([{ type: "text", value: "一二三四五" }]),
    irVersion: parsed.irVersion,
    projectionVersion: projection.projectionVersion,
    provenanceJson: JSON.stringify(canonicalProvenance(parseForMdast(source).document)),
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

function canonicalProvenance(document: MdiMdastDocument): unknown {
  return {
    frontmatter: document.frontmatter?.mdiProvenance ?? null,
    children: document.children.map(canonicalNodeProvenance),
  };
}

function canonicalNodeProvenance(node: MdiMdastNode): unknown {
  return {
    provenance: node.mdiProvenance ?? null,
    children: (node.children ?? []).map(canonicalNodeProvenance),
  };
}

async function testWarichuBrowser() {
 const iframe=document.createElement('iframe');
 iframe.style.cssText='width:400px;height:500px';
 const noteText='一二三四五六七八九十'.repeat(12);
 const loaded=new Promise<void>(resolve=>iframe.onload=()=>resolve());
 iframe.srcdoc=renderHtml(`前文前文（[[warichu:${noteText}]]）後文\n\n[[warichu:甲[[br]][[br]]乙]]\n\n[[warichu:甲[[warichu:乙丙]]丁]]`);
 document.body.append(iframe);await loaded;
 const body=iframe.contentDocument!.body;
 body.style.cssText='font-size:24px;width:180px';
 const adapter=attachMdiWarichuLayout(body);
 await adapter.settled();
 const note=body.querySelector<HTMLElement>('.mdi-warichu')!;
 const original=note.dataset.mdiWarichuSource;
 const beforeZoom=measureMdiWarichu(body)[0].options;
 body.style.transform='scale(0.8)';body.style.zoom='1.5';adapter.configure();await adapter.settled();
 const afterZoom=measureMdiWarichu(body)[0].options;
 const zoomStable=JSON.stringify(beforeZoom)===JSON.stringify(afterZoom);
 body.style.transform='';body.style.zoom='';adapter.configure();await adapter.settled();
 const lines=Array.from(note.querySelectorAll<HTMLElement>('.mdi-warichu-line'));
 const geometry=lines.slice(0,2).map(line=>{const r=line.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
 const previous=note.previousSibling!;
 const openingRange=iframe.contentDocument!.createRange();openingRange.setStart(previous,previous.textContent!.length-1);openingRange.setEnd(previous,previous.textContent!.length);
 const opening=openingRange.getBoundingClientRect();
 const firstFragment=note.querySelector('.mdi-warichu-fragment')!.getBoundingClientRect();
 const adjacentOpening=opening.top<firstFragment.bottom && opening.bottom>firstFragment.top;
 const next=note.nextSibling!;const closingRange=iframe.contentDocument!.createRange();closingRange.setStart(next,0);closingRange.setEnd(next,1);
 const closing=closingRange.getBoundingClientRect();const lastFragment=Array.from(note.querySelectorAll('.mdi-warichu-fragment')).at(-1)!.getBoundingClientRect();
 const adjacentClosing=closing.top<lastFragment.bottom && closing.bottom>lastFragment.top;
 const preserved=note.textContent===noteText;
 const wraps=new Set(Array.from(note.querySelectorAll('.mdi-warichu-fragment')).map(n=>n.getBoundingClientRect().y)).size>1;
 const hardBreaks=body.querySelectorAll('.mdi-warichu')[1].querySelectorAll('br').length;
 body.style.width='280px'; adapter.configure();await adapter.settled();
 const resized=note.dataset.mdiWarichuSource===original && note.textContent===noteText;
 body.style.cssText='font-size:24px;height:220px;writing-mode:vertical-rl';adapter.configure();await adapter.settled();
 const vertical=Array.from(note.querySelectorAll('.mdi-warichu-line')).slice(0,2).map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y};});
 const outer=body.querySelectorAll<HTMLElement>('.mdi-warichu')[2];
 const inner=outer.querySelector<HTMLElement>('.mdi-warichu')!;
 const nested={text:outer.textContent,lines:inner.querySelectorAll(':scope > .mdi-warichu-fragment > .mdi-warichu-line').length,sameSize:iframe.contentWindow!.getComputedStyle(inner).fontSize===iframe.contentWindow!.getComputedStyle(outer).fontSize,measured:measureMdiWarichu(body).length};
 adapter.dispose();iframe.remove();
 return {geometry,preserved,wraps,hardBreaks,resized,vertical,adjacentOpening,adjacentClosing,zoomStable,nested};
}
