import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { chromium } from "playwright";
import {
  PAGE_DIMENSIONS,
  PAGE_SIZES,
  resolveExportProfile,
} from "../packages/export-profile/dist/index.js";
import {
  renderDocxWithProfile,
  renderEpubWithProfile,
  renderHtml,
} from "../packages/mdi/dist/index.js";
import { prepareChromiumPrintProfile } from "../packages/to-pdf/dist/profile.js";

const repositoryRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const require = createRequire(import.meta.url);
const outputDirectory = mkdtempSync(join(tmpdir(), "mdi-format-contracts-"));
const openXmlProject = resolve(
  repositoryRoot,
  "nodejs/format-contracts/openxml-validator/OpenXmlValidator.csproj",
);
const epubCheckJar = process.env.EPUBCHECK_JAR;
const vnuJar = require("vnu-jar");
const soffice = process.env.SOFFICE_BIN ?? "soffice";

if (!epubCheckJar) {
  throw new Error("EPUBCHECK_JAR must point to the official EPUBCheck jar");
}

const source = `---
title: 契約試験
author: MDI
lang: ja
date: 2026-07-23
---

# 第一章

本文には{東京|とうきょう}、縦中横^12^、[[em:圏点]]、[[kern:0.1em:字間]]がある。

## 第二節

- 箇条書き
- [リンク](https://example.com)

| 項目 | 値 |
| --- | --- |
| 契約 | 有効 |

脚注[^note]

[^note]: 脚注本文

[[pagebreak]]

### 第三節

次の頁。
`;

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const onePixelJpeg = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/Aaf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/Aaf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Aqf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IV//2gAMAwEAAgADAAAAEP/EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8QH//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8QH//EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8QH//Z",
  "base64",
);

const contractCases = [
  {
    name: "word-horizontal",
    profile: {
      layout: { system: "word" },
      metadata: {
        title: "Word horizontal",
        author: "MDI",
        publisher: "Illusions",
        identifier: "urn:mdi:word-horizontal",
        language: "ja",
        date: "2026-07-23",
      },
      typesetting: {
        writingMode: "horizontal",
        fontFamily: "Yu Mincho",
        fontSize: 11,
        lineSpacing: 1.5,
        textIndentEm: 2,
        fullwidthSpaceIndent: false,
      },
      pagination: {
        pageSize: "A4",
        landscape: false,
        charactersPerLine: 60,
        linesPerPage: 50,
        gridMode: "typographic",
        margins: { top: 20, right: 21, bottom: 22, left: 23 },
        pageNumbers: { enabled: false, format: "simple", position: "top-left" },
      },
      epub: { chapterSplitLevel: "h1" },
    },
    cover: { data: onePixelPng, mediaType: "image/png" },
  },
  {
    name: "word-vertical",
    profile: {
      layout: { system: "word", marginMode: "single", bindingSide: "left" },
      typesetting: {
        writingMode: "vertical",
        fontFamily: "Noto Serif JP",
        fontSize: 12,
        lineSpacing: 1.4,
        textIndentEm: 1,
        fullwidthSpaceIndent: true,
      },
      pagination: {
        pageSize: "A5",
        landscape: true,
        gridMode: "typographic",
        pageNumbers: { enabled: true, format: "simple", position: "top-left" },
      },
      epub: { chapterSplitLevel: "h2" },
    },
    cover: { data: onePixelJpeg, mediaType: "image/jpeg" },
  },
  {
    name: "publisher-horizontal-strict",
    profile: {
      layout: {
        system: "japanese-publisher",
        marginMode: "mirror",
        bindingSide: "left",
        gutter: 2,
      },
      typesetting: {
        writingMode: "horizontal",
        fontFamily: "Hiragino Mincho ProN",
        fontSize: 10,
        textIndentEm: 0,
        fullwidthSpaceIndent: false,
      },
      pagination: {
        pageSize: "Shirokuban",
        landscape: false,
        charactersPerLine: 27,
        linesPerPage: 26,
        gridMode: "strict",
        pageNumbers: { enabled: true, format: "dash", position: "top-center" },
      },
      epub: { chapterSplitLevel: "h3" },
    },
  },
  {
    name: "publisher-vertical-strict",
    profile: {
      layout: {
        system: "japanese-publisher",
        marginMode: "mirror",
        bindingSide: "right",
        gutter: 3,
      },
      typesetting: {
        writingMode: "vertical",
        fontFamily: "Yu Mincho",
        fontSize: 10.5,
        textIndentEm: 1,
        fullwidthSpaceIndent: true,
      },
      pagination: {
        pageSize: "A4",
        landscape: true,
        charactersPerLine: 40,
        linesPerPage: 30,
        gridMode: "strict",
        pageNumbers: { enabled: true, format: "fraction", position: "top-right" },
      },
      epub: { chapterSplitLevel: "none" },
    },
  },
  {
    name: "publisher-horizontal-typographic",
    profile: {
      layout: {
        system: "japanese-publisher",
        marginMode: "single",
        bindingSide: "right",
        gutter: 0,
      },
      typesetting: {
        writingMode: "horizontal",
        fontFamily: "serif",
        fontSize: 9,
        lineSpacing: 1.8,
        textIndentEm: 3,
        fullwidthSpaceIndent: false,
      },
      pagination: {
        pageSize: "B6-ban",
        landscape: true,
        charactersPerLine: 32,
        linesPerPage: 28,
        gridMode: "typographic",
        pageNumbers: { enabled: true, format: "simple", position: "bottom-left" },
      },
      epub: { chapterSplitLevel: "h1" },
    },
  },
  {
    name: "publisher-vertical-typographic",
    profile: {
      layout: {
        system: "japanese-publisher",
        marginMode: "single",
        bindingSide: "left",
      },
      typesetting: {
        writingMode: "vertical",
        fontFamily: "sans-serif",
        fontSize: 14,
        lineSpacing: 2,
        textIndentEm: 4,
        fullwidthSpaceIndent: true,
      },
      pagination: {
        pageSize: "Legal",
        landscape: false,
        charactersPerLine: 48,
        linesPerPage: 36,
        gridMode: "typographic",
        pageNumbers: { enabled: true, format: "dash", position: "bottom-center" },
      },
      epub: { chapterSplitLevel: "h2" },
    },
  },
  {
    name: "publisher-bottom-right",
    profile: {
      layout: { system: "japanese-publisher" },
      typesetting: { writingMode: "horizontal" },
      pagination: {
        pageSize: "Letter",
        landscape: false,
        gridMode: "strict",
        pageNumbers: { enabled: true, format: "fraction", position: "bottom-right" },
      },
      epub: { chapterSplitLevel: "h3" },
    },
  },
];

const docxPaths = [];
const libreOfficeDocxPaths = [];
const epubPaths = [];
const htmlPaths = [];
const pdfCases = [];
let rejectedDocxPageSizes = 0;
let completed = false;

try {
  for (const contractCase of contractCases) {
    const resolved = resolveExportProfile(contractCase.profile);
    const docxPath = join(outputDirectory, `${contractCase.name}.docx`);
    const epubPath = join(outputDirectory, `${contractCase.name}.epub`);
    writeFileSync(docxPath, await renderDocxWithProfile(source, contractCase.profile));
    writeFileSync(
      epubPath,
      await renderEpubWithProfile(source, {
        profile: contractCase.profile,
        cover: contractCase.cover,
      }),
    );
    docxPaths.push(docxPath);
    libreOfficeDocxPaths.push(docxPath);
    epubPaths.push(epubPath);
    pdfCases.push({ name: contractCase.name, profile: resolved });
  }

  for (const htmlCase of [
    {
      name: "html-horizontal",
      source,
    },
    {
      name: "html-vertical",
      source: source.replace(
        "lang: ja",
        'lang: "ja"\nwriting-mode: vertical',
      ),
    },
    {
      name: "html-escaped-metadata",
      source: `---
title: "A < B & \\"quoted\\""
lang: "ja"
---

# HTML contract

Raw <em>markup</em> and {東京|とうきょう}.
`,
    },
  ]) {
    const path = join(outputDirectory, `${htmlCase.name}.html`);
    writeFileSync(path, renderHtml(htmlCase.source));
    htmlPaths.push(path);
  }

  // Every public paper-size value must produce a schema-valid DOCX package.
  for (const [index, pageSize] of PAGE_SIZES.entries()) {
    const profile = {
      layout: { system: "word" },
      typesetting: {
        writingMode: index % 2 === 0 ? "horizontal" : "vertical",
        fontFamily: index % 2 === 0 ? "Yu Mincho" : "Noto Serif JP",
      },
      pagination: {
        pageSize,
        landscape: index % 3 === 0,
        gridMode: "typographic",
      },
    };
    const dimensions = PAGE_DIMENSIONS[pageSize];
    const widthMm = profile.pagination.landscape ? dimensions.height : dimensions.width;
    const heightMm = profile.pagination.landscape ? dimensions.width : dimensions.height;
    if (Math.max(widthMm, heightMm) > 558.8) {
      await assertDocxRejectsOversizedPage(profile, pageSize);
      rejectedDocxPageSizes += 1;
    } else {
      const path = join(outputDirectory, `page-${pageSize}.docx`);
      writeFileSync(path, await renderDocxWithProfile("紙面契約", profile));
      docxPaths.push(path);
    }
    pdfCases.push({
      name: `page-${pageSize}`,
      profile: resolveExportProfile(profile),
      source: "紙面契約",
    });
  }

  validateDocx(docxPaths);
  await validateLibreOfficeDocx(libreOfficeDocxPaths);
  await validatePdfs(pdfCases);
  validateEpubs(epubPaths);
  validateHtml(htmlPaths);
  completed = true;
  console.log(
    `Publication contracts passed: ${docxPaths.length} DOCX + ${rejectedDocxPageSizes} specified rejections (${libreOfficeDocxPaths.length} LibreOffice imports), ${pdfCases.length} PDF, ${epubPaths.length} EPUB, ${htmlPaths.length} HTML`,
  );
} finally {
  if (completed || process.env.KEEP_FORMAT_CONTRACT_ARTIFACTS !== "1") {
    rmSync(outputDirectory, { recursive: true, force: true });
  } else {
    console.error(`Contract artifacts retained at ${outputDirectory}`);
  }
}

function validateDocx(paths) {
  execFileSync(
    "dotnet",
    ["run", "--project", openXmlProject, "--configuration", "Release", "--", ...paths],
    {
      cwd: repositoryRoot,
      stdio: "inherit",
      env: {
        ...process.env,
        DOTNET_ROLL_FORWARD: process.env.DOTNET_ROLL_FORWARD ?? "Major",
      },
    },
  );
}

async function validateLibreOfficeDocx(paths) {
  const output = join(outputDirectory, "libreoffice-pdf");
  const profile = join(outputDirectory, "libreoffice-profile");
  mkdirSync(output);
  mkdirSync(profile);
  execFileSync(
    soffice,
    [
      "--headless",
      `-env:UserInstallation=${pathToFileURL(profile).href}`,
      "--convert-to",
      "pdf",
      "--outdir",
      output,
      ...paths,
    ],
    { cwd: repositoryRoot, stdio: "inherit" },
  );
  for (const path of paths) {
    const pdfPath = join(output, `${basename(path, ".docx")}.pdf`);
    if (!existsSync(pdfPath))
      throw new Error(`${path}: LibreOffice did not produce a PDF`);
    await validatePdf(pdfPath, readFileSync(pdfPath));
    console.log(`LibreOffice imported: ${basename(path)}`);
  }
}

async function validatePdfs(cases) {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const { name, profile, source: caseSource = source } of cases) {
      const prepared = prepareChromiumPrintProfile(renderHtml(caseSource), profile);
      const page = await browser.newPage();
      try {
        await page.setContent(prepared.html);
        const pdf = Buffer.from(
          await page.pdf({
            preferCSSPageSize: true,
            printBackground: true,
            margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
            displayHeaderFooter: prepared.pageNumbers.enabled,
            headerTemplate: prepared.pageNumbers.headerTemplate ?? "<span></span>",
            footerTemplate: prepared.pageNumbers.footerTemplate ?? "<span></span>",
          }),
        );
        const path = join(outputDirectory, `${name}.pdf`);
        writeFileSync(path, pdf);
        await validatePdf(path, pdf);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
}

async function assertDocxRejectsOversizedPage(profile, pageSize) {
  try {
    await renderDocxWithProfile("紙面契約", profile);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message ===
      `DOCX page size ${pageSize} exceeds Word's 22-inch maximum page dimension`
    ) {
      console.log(`DOCX specified rejection: page-${pageSize}`);
      return;
    }
    throw error;
  }
  throw new Error(`DOCX page size ${pageSize} should exceed Word's maximum`);
}

async function validatePdf(path, bytes) {
  const loadingTask = getDocument({
    data: new Uint8Array(bytes),
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const document = await loadingTask.promise;
  try {
    if (document.numPages < 1) throw new Error(`${path}: PDF has no pages`);
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      await page.getOperatorList();
      await page.getTextContent();
    }
    console.log(`PDF.js valid: ${basename(path)} (${document.numPages} page(s))`);
  } finally {
    await loadingTask.destroy();
  }
}

function validateEpubs(paths) {
  for (const path of paths) {
    execFileSync("java", ["-jar", epubCheckJar, path, "--failonwarnings"], {
      cwd: repositoryRoot,
      stdio: "inherit",
    });
  }
}

function validateHtml(paths) {
  execFileSync(
    "java",
    [
      "-jar",
      vnuJar,
      "--errors-only",
      "--also-check-css",
      ...paths,
    ],
    { cwd: repositoryRoot, stdio: "inherit" },
  );
  for (const path of paths)
    console.log(`Nu HTML valid: ${basename(path)}`);
}
