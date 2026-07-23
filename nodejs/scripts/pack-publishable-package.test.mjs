import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  existsSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import {
  createPublishManifest,
  packPublishablePackage,
} from "./pack-publishable-package.mjs";

const repositoryRoot = resolve(new URL("../..", import.meta.url).pathname);
const packagesRoot = join(repositoryRoot, "nodejs");

function packedManifest(tarball) {
  return JSON.parse(
    execFileSync("tar", ["-xOf", tarball, "package/package.json"], {
      encoding: "utf8",
    })
  );
}

test("createPublishManifest converts every workspace dependency section", () => {
  const manifest = {
    name: "consumer",
    dependencies: { core: "workspace:*", external: "^1.0.0" },
    devDependencies: { tools: "workspace:^" },
    optionalDependencies: { core: "workspace:~" },
    peerDependencies: { tools: "workspace:../tools" },
  };
  const publishManifest = createPublishManifest(
    manifest,
    new Map([
      ["core", { version: "2.3.4" }],
      ["tools", { version: "5.6.7" }],
    ])
  );

  assert.deepEqual(publishManifest, {
    name: "consumer",
    dependencies: { core: "^2.3.4", external: "^1.0.0" },
    devDependencies: { tools: "^5.6.7" },
    optionalDependencies: { core: "~2.3.4" },
    peerDependencies: { tools: "^5.6.7" },
  });
  assert.equal(manifest.dependencies.core, "workspace:*");
});

test("createPublishManifest rejects workspace dependencies outside the workspace", () => {
  assert.throws(
    () =>
      createPublishManifest(
        { name: "consumer", dependencies: { missing: "workspace:*" } },
        new Map()
      ),
    /unknown workspace package missing/
  );
});

test("npm artifacts replace workspace dependencies and MDI installs for consumers", () => {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), "mdi-consumer-install-"));
  const artifactsDirectory = join(temporaryDirectory, "artifacts");
  const consumerDirectory = join(temporaryDirectory, "consumer");

  try {
    mkdirSync(artifactsDirectory);
    const tarballs = readdirSync(join(packagesRoot, "packages")).filter((packageName) =>
      existsSync(join(packagesRoot, "packages", packageName, "package.json"))
    )
      .map((packageName) =>
        packPublishablePackage({
          packageDirectory: join(packagesRoot, "packages", packageName),
          workspaceRoot: packagesRoot,
          outputDirectory: artifactsDirectory,
        })
      );

    for (const tarball of tarballs) {
      assert.doesNotMatch(JSON.stringify(packedManifest(tarball)), /workspace:/);
    }

    mkdirSync(consumerDirectory);
    writeFileSync(
      join(consumerDirectory, "package.json"),
      JSON.stringify({ name: "mdi-consumer-fixture", private: true })
    );
    execFileSync(
      "npm",
      [
        "install",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        "--prefer-offline",
        ...tarballs,
      ],
      { cwd: consumerDirectory, stdio: "inherit" }
    );

    const installed = JSON.parse(
      readFileSync(
        join(consumerDirectory, "node_modules", "@illusions-lab", "mdi", "package.json"),
        "utf8"
      )
    );
    assert.doesNotMatch(JSON.stringify(installed), /workspace:/);

    const profileOutput = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        `import { prepareChromiumPrintProfile } from "@illusions-lab/mdi-to-pdf/profile";
         import { getPageSizeLabel, listPageSizes } from "@illusions-lab/mdi-export-profile";
         const print = prepareChromiumPrintProfile("<p>本文</p>", undefined, "vertical");
         console.log(JSON.stringify({
           hasCss: print.html.includes("mdi-export-profile"),
           widthMm: print.page.widthMm,
           heightMm: print.page.heightMm,
           bunkoLabel: getPageSizeLabel("Bunko"),
           jisB5Label: listPageSizes().find((size) => size.key === "JIS-B5")?.label,
         }));`,
      ],
      { cwd: consumerDirectory, encoding: "utf8" }
    );
    assert.deepEqual(JSON.parse(profileOutput), {
      hasCss: true,
      widthMm: 297,
      heightMm: 210,
      bunkoLabel: "文庫判",
      jisB5Label: "JIS B5判",
    });

    const source = join(consumerDirectory, "book.mdi");
    writeFileSync(
      source,
      "---\ntitle: Packaged CLI\nwriting-mode: vertical\n---\n# 章\n\n{東京|とうきょう}と[[em:強調]]。"
    );
    const cli = join(consumerDirectory, "node_modules", ".bin", "mdi");
    const outputs = {
      html: join(consumerDirectory, "book.html"),
      pdf: join(consumerDirectory, "book.pdf"),
      epub: join(consumerDirectory, "book.epub"),
      docx: join(consumerDirectory, "book.docx"),
      txt: join(consumerDirectory, "book.txt"),
      "txt-ruby": join(consumerDirectory, "book_ruby.txt"),
      narou: join(consumerDirectory, "book_narou.txt"),
      kakuyomu: join(consumerDirectory, "book_kakuyomu.txt"),
      aozora: join(consumerDirectory, "book_aozora.txt"),
    };
    for (const [format, output] of Object.entries(outputs)) {
      execFileSync(cli, ["build", source, "--to", format, "-o", output], {
        cwd: consumerDirectory,
        stdio: "inherit",
      });
      assert.ok(existsSync(output), `packaged CLI should create ${format}`);
    }
    execFileSync(cli, ["build", source, "--to", "txt-all"], {
      cwd: consumerDirectory,
      stdio: "inherit",
    });
    assert.deepEqual(
      ["book.txt", "book_ruby.txt", "book_narou.txt", "book_kakuyomu.txt", "book_aozora.txt"].map(
        (output) => existsSync(join(consumerDirectory, output))
      ),
      [true, true, true, true, true]
    );
    assert.match(readFileSync(outputs.html, "utf8"), /<ruby(?:\s|>)/);
    assert.deepEqual(readFileSync(outputs.pdf).subarray(0, 4), Buffer.from("%PDF"));
    assert.deepEqual(readFileSync(outputs.epub).subarray(0, 2), Buffer.from("PK"));
    assert.deepEqual(readFileSync(outputs.docx).subarray(0, 2), Buffer.from("PK"));
    assert.match(readFileSync(outputs["txt-ruby"], "utf8"), /\{東京\|とうきょう\}/);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});
