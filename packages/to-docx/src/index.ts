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
  Table as DocxTable,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
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
            color: "000000",
          },
          paragraph: { spacing: { line: lineTwips, after: 120 } },
        },
        heading1: headingStyle(options, 1),
        heading2: headingStyle(options, 2),
        heading3: headingStyle(options, 3),
        heading4: headingStyle(options, 4),
        heading5: headingStyle(options, 5),
        heading6: headingStyle(options, 6),
        listParagraph: {
          run: { font: options.typesetting.fontFamily, color: "000000" },
        },
      },
      paragraphStyles: [
        customHeadingStyle(options, 7),
        customHeadingStyle(options, 8),
        customHeadingStyle(options, 9),
        {
          id: "MdiQuote",
          name: "MDI Quote",
          basedOn: "Normal",
          run: { font: options.typesetting.fontFamily, color: "000000", italics: true },
          paragraph: {
            indent: { left: 720, right: 360 },
            spacing: { before: 120, after: 120, line: lineTwips },
          },
        },
        {
          id: "MdiList",
          name: "MDI List",
          basedOn: "ListParagraph",
          run: { font: options.typesetting.fontFamily, color: "000000" },
          paragraph: { spacing: { after: 60, line: lineTwips } },
        },
        {
          id: "MdiCode",
          name: "MDI Code Block",
          basedOn: "Normal",
          run: { font: "Courier New", color: "000000" },
          paragraph: {
            indent: { left: 360, right: 360 },
            spacing: { before: 120, after: 120, line: lineTwips },
          },
        },
        {
          id: "MdiThematicBreak",
          name: "MDI Thematic Break",
          basedOn: "Normal",
          run: { font: options.typesetting.fontFamily, color: "000000" },
          paragraph: { spacing: { before: 120, after: 180 } },
        },
      ],
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

/** Word's built-in Heading styles are blue by default; MDI uses a black print hierarchy. */
function headingStyle(options: ResolvedExportProfile, level: number) {
  const scale = [1.8, 1.55, 1.35, 1.2, 1.1, 1][level - 1] ?? 1;
  const before = [360, 300, 240, 180, 150, 120][level - 1] ?? 120;
  return {
    run: {
      font: options.typesetting.fontFamily,
      color: "000000",
      bold: true,
      size: Math.round(22 * scale),
    },
    paragraph: {
      spacing: { before, after: 120 },
      keepNext: true,
      keepLines: true,
      outlineLevel: level - 1,
    },
  };
}

function customHeadingStyle(options: ResolvedExportProfile, level: number) {
  const style = headingStyle(options, level);
  return {
    id: `Heading${level}`,
    name: `Heading ${level}`,
    basedOn: "Normal",
    next: "Normal",
    quickFormat: true,
    ...style,
  };
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

function block(
  node: RootContent,
  options: ResolvedExportProfile
): Array<Paragraph | DocxTable> {
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
              style: "MdiList",
              children: inline(n.children),
              bullet: { level: 0 },
            })
        )
    );
  if (node.type === "blockquote")
    return node.children.flatMap((child) =>
      child.type === "paragraph"
        ? [paragraph(child.children, options, "MdiQuote")]
        : block(child, options)
    );
  if (node.type === "code")
    return [
      new Paragraph({
        style: "MdiCode",
        children: node.value.split("\n").map(
          (line, index) =>
            new TextRun({
              text: line,
              break: index === 0 ? undefined : 1,
              font: "Courier New",
            })
        ),
      }),
    ];
  if (node.type === "thematicBreak")
    return [
      new Paragraph({
        style: "MdiThematicBreak",
        alignment: AlignmentType.CENTER,
        children: [new TextRun("— — —")],
      }),
    ];
  if (node.type === "table") return [tableBlock(node, options)];
  if (node.type === "mdiPagebreak")
    return [new Paragraph({ children: [new PageBreak()] })];
  if (node.type === "mdiBlank") return [new Paragraph("")];
  return [];
}

function tableBlock(
  node: Extract<RootContent, { type: "table" }>,
  options: ResolvedExportProfile
): DocxTable {
  const columns = Math.max(1, ...node.children.map((row) => row.children.length));
  const dimensions = PAGE_DIMENSIONS[options.pagination.pageSize];
  const pageWidth = options.pagination.landscape ? dimensions.height : dimensions.width;
  const usableWidth = mmToTwips(
    pageWidth - options.pagination.margins.left - options.pagination.margins.right
  );
  const columnWidth = Math.floor(usableWidth / columns);
  return new DocxTable({
    width: { size: usableWidth, type: WidthType.DXA },
    columnWidths: Array.from({ length: columns }, () => columnWidth),
    layout: TableLayoutType.FIXED,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    rows: node.children.map(
      (row, rowIndex) =>
        new TableRow({
          children: row.children.map(
            (cell) =>
              new TableCell({
                width: { size: columnWidth, type: WidthType.DXA },
                children: [
                  new Paragraph({
                    children:
                      rowIndex === 0
                        ? [new TextRun({ bold: true, children: inline(cell.children) })]
                        : inline(cell.children),
                  }),
                ],
              })
          ),
        })
    ),
  });
}

function paragraph(
  nodes: PhrasingContent[],
  options: ResolvedExportProfile,
  style?: string
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
    style,
    indent: options.typesetting.fullwidthSpaceIndent
      ? undefined
      : {
          ...(style
            ? {}
            : {
                firstLine: Math.round(
                  ((options.typesetting.textIndentEm * fontSizeMm) / 25.4) *
                    1440
                ),
              }),
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
    if (node.type === "inlineCode")
      return [new TextRun({ text: node.value, font: "Courier New" })];
    if (node.type === "image")
      return [new TextRun({ text: node.alt ? `[Image: ${node.alt}]` : "[Image]" })];
    if (node.type === "footnoteReference")
      return [new TextRun({ text: `[${node.label ?? node.identifier}]`, superScript: true })];
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
  // Imported fragments must declare the WordprocessingML prefix themselves.
  // Without it, xml-js parses the root as `undefined` and docx serializes an
  // invalid `<undefined>` wrapper that Word refuses to open.
  const namespaced = xmlString.replace(
    /^<w:([\w-]+)/,
    '<w:$1 xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
  );
  // `fromXmlString()` returns a document wrapper whose root key is undefined;
  // insert its parsed element, not that wrapper, into the paragraph.
  const imported = ImportedXmlComponent.fromXmlString(namespaced);
  return (imported as unknown as { root: unknown[] }).root[0] as TextRun;
}
function xml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
}
