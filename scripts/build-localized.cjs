const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.join(__dirname, "..");
const localeFile = path.join(rootDir, "assets", "locales", "ui-zh-CN.json");
const localizedRoot = path.join(rootDir, ".localized-build");
const localizedSrc = path.join(localizedRoot, "src");
const localizedIndex = path.join(localizedRoot, "index.html");
const localizedTsconfig = path.join(localizedRoot, "tsconfig.json");
const srcDir = path.join(rootDir, "src");
const indexFile = path.join(rootDir, "index.html");
const distDir = path.join(rootDir, "dist");

const args = process.argv.slice(2);
const prepareOnly = args.includes("--prepare-only");
const strict = args.includes("--strict");

const localeConfig = JSON.parse(fs.readFileSync(localeFile, "utf8"));
const translations = localeConfig.translations ?? [];
const links = localeConfig.links ?? [];
const missingEntries = [];

prepareLocalizedSources();

if (!prepareOnly) {
    buildLocalizedDist();
}

function prepareLocalizedSources() {
    resetDir(localizedRoot);
    fs.cpSync(srcDir, localizedSrc, { recursive: true });
    fs.copyFileSync(indexFile, localizedIndex);

    const filesToEntries = new Map();

    for (const entry of translations) {
        validateEntry(entry, "translation");
        const sourceFile = getSourceFileFromKey(entry.key);
        const targetFile = resolveLocalizedPath(sourceFile);
        if (!filesToEntries.has(targetFile)) {
            filesToEntries.set(targetFile, []);
        }
        filesToEntries.get(targetFile).push(entry);
    }

    for (const [filePath, entries] of filesToEntries.entries()) {
        if (!fs.existsSync(filePath)) {
            throw new Error(`Localized target file does not exist: ${toRelative(filePath)}`);
        }

        let content = fs.readFileSync(filePath, "utf8");
        const isCodeFile = filePath.endsWith(".ts") || filePath.endsWith(".js");
        for (const entry of entries) {
            const result = isCodeFile
                ? replaceInCodeStringLiterals(content, entry.source, entry.target)
                : replaceOnce(content, entry.source, entry.target);
            if (!result.replaced) {
                reportMissing(entry, filePath, "text");
            }
            content = result.content;
        }
        fs.writeFileSync(filePath, content, "utf8");
    }

    applyLinkReplacements(links);
    writeLocalizedTsconfig();

    const missingCount = missingEntries.length;
    writeMissingReport();
    console.log(`Prepared localized source at ${toRelative(localizedRoot)}.`);
    console.log(`Applied ${translations.length} text entries and ${links.length} link entries.`);
    if (missingCount > 0) {
        const message = `Missing locale matches: ${missingCount}`;
        if (strict) {
            throw new Error(message + " (strict mode)");
        }
        console.warn(message);
    }
}

function buildLocalizedDist() {
    resetDir(distDir);

    runCommand("npx", ["tsc", "-p", localizedTsconfig]);

    fs.copyFileSync(localizedIndex, path.join(distDir, "index.html"));
    fs.cpSync(path.join(rootDir, "assets"), path.join(distDir, "assets"), { recursive: true });
    fs.cpSync(path.join(rootDir, "data"), path.join(distDir, "data"), { recursive: true });

    console.log("Localized build complete: dist now contains localized outputs.");
}

function writeLocalizedTsconfig() {
    const tsconfig = {
        extends: "../tsconfig.json",
        compilerOptions: {
            rootDir: "./src",
            outDir: "../dist",
        },
        include: ["src/**/*"],
        exclude: ["../release"],
    };

    fs.writeFileSync(localizedTsconfig, JSON.stringify(tsconfig, null, 2) + "\n", "utf8");
}

function applyLinkReplacements(entries) {
    let content = fs.readFileSync(localizedIndex, "utf8");
    for (const entry of entries) {
        validateEntry(entry, "link");
        const result = replaceOnce(content, entry.source, entry.target);
        if (!result.replaced) {
            reportMissing(entry, localizedIndex, "link");
        }
        content = result.content;
    }
    fs.writeFileSync(localizedIndex, content, "utf8");
}

function getSourceFileFromKey(key) {
    const delimiter = key.indexOf("|");
    if (delimiter === -1) {
        throw new Error(`Invalid locale key (missing file prefix): ${key}`);
    }
    return key.slice(0, delimiter);
}

function resolveLocalizedPath(sourceFile) {
    if (sourceFile === "index.html") {
        return localizedIndex;
    }
    if (sourceFile.startsWith("src/")) {
        return path.join(localizedRoot, sourceFile);
    }
    throw new Error(`Unsupported localized source file in key: ${sourceFile}`);
}

function replaceOnce(content, source, target) {
    const index = content.indexOf(source);
    if (index === -1) {
        return { replaced: false, content };
    }

    const next = content.slice(0, index) + target + content.slice(index + source.length);
    return { replaced: true, content: next };
}

function replaceInCodeStringLiterals(content, source, target) {
    const candidates = [
        {
            source: `"${escapeForDoubleQuote(source)}"`,
            target: `"${escapeForDoubleQuote(target)}"`,
        },
        {
            source: `'${escapeForSingleQuote(source)}'`,
            target: `'${escapeForSingleQuote(target)}'`,
        },
        {
            source: `\`${escapeForTemplateLiteral(source)}\``,
            target: `\`${escapeForTemplateLiteral(target)}\``,
        },
    ];

    for (const candidate of candidates) {
        const result = replaceOnce(content, candidate.source, candidate.target);
        if (result.replaced) {
            return result;
        }
    }

    return { replaced: false, content };
}

function escapeForDoubleQuote(text) {
    return text.replace(/\\/g, "\\\\").replace(/\"/g, "\\\"");
}

function escapeForSingleQuote(text) {
    return text.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function escapeForTemplateLiteral(text) {
    return text.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

function reportMissing(entry, filePath, kind) {
    missingEntries.push({ kind, key: entry.key, file: toRelative(filePath) });
}

function writeMissingReport() {
    const reportPath = path.join(localizedRoot, "missing-locale-entries.json");
    fs.writeFileSync(reportPath, JSON.stringify(missingEntries, null, 2) + "\n", "utf8");
}

function validateEntry(entry, kind) {
    if (!entry || typeof entry.key !== "string" || typeof entry.source !== "string" || typeof entry.target !== "string") {
        throw new Error(`Invalid ${kind} entry: ${JSON.stringify(entry)}`);
    }
}

function resetDir(dirPath) {
    fs.rmSync(dirPath, { recursive: true, force: true });
    fs.mkdirSync(dirPath, { recursive: true });
}

function runCommand(command, commandArgs) {
    const result = spawnSync(command, commandArgs, {
        cwd: rootDir,
        stdio: "inherit",
        shell: true,
    });

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

function toRelative(targetPath) {
    return path.relative(rootDir, targetPath).replace(/\\/g, "/");
}
