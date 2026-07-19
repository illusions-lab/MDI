import {
  AlignmentType,
  Document,
  Footer,
  HeadingLevel,
  Header,
  ImportedXmlComponent,
  Packer,
  PageBreak,
  PageNumber,
  PageTextDirectionType,
  Paragraph,
  TextRun,
} from "docx";
import type { Root, RootContent, PhrasingContent } from "mdast";
import type {} from "mdast-util-mdi";
import type {} from "@illusions-lab/mdi-remark";
import {
  PAGE_DIMENSIONS,
  resolvePrintProfile,
  type ExportProfile,
  type ResolvedExportProfile,
} from "@illusions-lab/mdi-export-profile";

export const MDI_SPEC_VERSION = "2.0";

/** Creates a DOCX file using the same profile fields as PDF and EPUB exports. */
export async function mdiToDocx(
  tree: Root,
  profile?: ExportProfile
): Promise<Buffer> {
  const options = resolvePrintProfile(
    profile,
    tree.data?.frontmatter?.writingMode
  );
  const children = tree.children.flatMap((node) => block(node, options));
  const dimensions = PAGE_DIMENSIONS[options.pagination.pageSize];
  const widthMm = options.pagination.landscape
    ? dimensions.height
    : dimensions.width;
  const heightMm = options.pagination.landscape
    ? dimensions.width
    : dimensions.height;
  const primary =
    options.typesetting.writingMode === "vertical"
      ? heightMm -
        options.pagination.margins.top -
        options.pagination.margins.bottom
      : widthMm -
        options.pagination.margins.left -
        options.pagination.margins.right;
  const cross =
    options.typesetting.writingMode === "vertical"
      ? widthMm -
        options.pagination.margins.left -
        options.pagination.margins.right
      : heightMm -
        options.pagination.margins.top -
        options.pagination.margins.bottom;
  const fontSizeMm = primary / options.pagination.charactersPerLine;
  const fontSizeHalfPoints = Math.round((fontSizeMm / 25.4) * 72 * 2);
  const lineTwips = Math.round(
    (cross / options.pagination.linesPerPage / 25.4) * 1440
  );
  const document = new Document({
    title: options.metadata.title ?? tree.data?.frontmatter?.title,
    creator: options.metadata.author ?? tree.data?.frontmatter?.author,
    styles: {
      default: {
        document: {
          run: {
            font: options.typesetting.fontFamily,
            size: fontSizeHalfPoints,
          },
          paragraph: { spacing: { line: lineTwips } },
        },
        heading1: { run: headingRun(options) },
        heading2: { run: headingRun(options) },
        heading3: { run: headingRun(options) },
        heading4: { run: headingRun(options) },
        heading5: { run: headingRun(options) },
        heading6: { run: headingRun(options) },
      },
    },
    sections: [
      {
        ...pageNumberSection(options, fontSizeHalfPoints),
        properties: {
          page: {
            size: { width: mmToTwips(widthMm), height: mmToTwips(heightMm) },
            margin: Object.fromEntries(
              Object.entries(options.pagination.margins).map(([key, value]) => [
                key,
                mmToTwips(value),
              ])
            ),
            ...(options.pagination.pageNumbers.enabled
              ? { pageNumbers: { start: 1 } }
              : {}),
            ...(options.typesetting.writingMode === "vertical"
              ? {
                  textDirection:
                    PageTextDirectionType.TOP_TO_BOTTOM_RIGHT_TO_LEFT,
                }
              : {}),
          },
        },
        children,
      },
    ],
  });
  return Packer.toBuffer(document);
}

/** Word's built-in Heading styles are blue by default; MDI headings inherit document typography. */
function headingRun(options: ResolvedExportProfile) {
  return { font: options.typesetting.fontFamily, color: "000000" };
}

function pageNumberSection(
  options: ResolvedExportProfile,
  size: number
): { headers?: { default: Header }; footers?: { default: Footer } } {
  const page = options.pagination.pageNumbers;
  if (!page.enabled) return {};
  const alignment = page.position.endsWith("left")
    ? AlignmentType.LEFT
    : page.position.endsWith("right")
    ? AlignmentType.RIGHT
    : AlignmentType.CENTER;
  const current = new TextRun({ children: [PageNumber.CURRENT], size });
  const runs =
    page.format === "dash"
      ? [
          new TextRun({ text: "— ", size }),
          current,
          new TextRun({ text: " —", size }),
        ]
      : page.format === "fraction"
      ? [
          current,
          new TextRun({ text: " / ", size }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size }),
        ]
      : [current];
  const paragraph = new Paragraph({ alignment, children: runs });
  return page.position.startsWith("top-")
    ? { headers: { default: new Header({ children: [paragraph] }) } }
    : { footers: { default: new Footer({ children: [paragraph] }) } };
}

function block(node: RootContent, options: ResolvedExportProfile): Paragraph[] {
  if (node.type === "heading")
    return [
      new Paragraph({
        heading: [
          HeadingLevel.HEADING_1,
          HeadingLevel.HEADING_2,
          HeadingLevel.HEADING_3,
          HeadingLevel.HEADING_4,
          HeadingLevel.HEADING_5,
          HeadingLevel.HEADING_6,
        ][node.depth - 1],
        children: inline(node.children),
      }),
    ];
  if (node.type === "paragraph") return [paragraph(node.children, options)];
  if (node.type === "list")
    return node.children.flatMap((item) =>
      item.children
        .filter((n) => n.type === "paragraph")
        .map(
          (n) =>
            new Paragraph({
              children: inline(n.children),
              bullet: { level: 0 },
            })
        )
    );
  if (node.type === "mdiPagebreak")
    return [new Paragraph({ children: [new PageBreak()] })];
  if (node.type === "mdiBlank") return [new Paragraph("")];
  return [];
}

function paragraph(
  nodes: PhrasingContent[],
  options: ResolvedExportProfile
): Paragraph {
  const fontSizeMm = (() => {
    const dimensions = PAGE_DIMENSIONS[options.pagination.pageSize];
    const primary =
      options.typesetting.writingMode === "vertical"
        ? (options.pagination.landscape
            ? dimensions.width
            : dimensions.height) -
          options.pagination.margins.top -
          options.pagination.margins.bottom
        : (options.pagination.landscape
            ? dimensions.height
            : dimensions.width) -
          options.pagination.margins.left -
          options.pagination.margins.right;
    return primary / options.pagination.charactersPerLine;
  })();
  const prefix = options.typesetting.fullwidthSpaceIndent
    ? [new TextRun("　".repeat(Math.round(options.typesetting.textIndentEm)))]
    : [];
  return new Paragraph({
    indent: options.typesetting.fullwidthSpaceIndent
      ? undefined
      : {
          firstLine: Math.round(
            ((options.typesetting.textIndentEm * fontSizeMm) / 25.4) * 1440
          ),
        },
    children: [...prefix, ...inline(nodes)],
  });
}

function inline(nodes: PhrasingContent[]): TextRun[] {
  return nodes.flatMap((node) => {
    if (node.type === "text") return [new TextRun(node.value)];
    if (node.type === "break" || node.type === "mdiBreak")
      return [new TextRun({ break: 1 })];
    if (node.type === "emphasis")
      return [new TextRun({ italics: true, children: inline(node.children) })];
    if (node.type === "strong")
      return [new TextRun({ bold: true, children: inline(node.children) })];
    if (node.type === "delete")
      return [new TextRun({ strike: true, children: inline(node.children) })];
    if (node.type === "mdiRuby") return [rawRun(rubyXml(node.base, node.ruby))];
    if (node.type === "mdiTcy")
      return [
        rawRun(
          `<w:r><w:rPr><w:eastAsianLayout w:combine="1" w:combineBrackets="none"/></w:rPr><w:t>${xml(
            node.value
          )}</w:t></w:r>`
        ),
      ];
    if ("children" in node) return inline(node.children as PhrasingContent[]);
    return [];
  });
}

function mmToTwips(mm: number): number {
  return Math.round((mm / 25.4) * 1440);
}
function rubyXml(base: string, reading: string | string[]): string {
  const text = Array.isArray(reading) ? reading.join(".") : reading;
  return `<w:ruby><w:rubyPr><w:rubyAlign w:val="center"/><w:hps w:val="12"/><w:hpsRaise w:val="18"/><w:hpsBaseText w:val="24"/></w:rubyPr><w:rt><w:r><w:t>${xml(
    text
  )}</w:t></w:r></w:rt><w:rubyBase><w:r><w:t>${xml(
    base
  )}</w:t></w:r></w:rubyBase></w:ruby>`;
}
function rawRun(xmlString: string): TextRun {
  return ImportedXmlComponent.fromXmlString(xmlString) as unknown as TextRun;
}
function xml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
}
