const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const ts = require("typescript");

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
const decodedScopeCache = new Map();

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
                ? replaceInCodeStringLiterals(content, entry, decodedScopeCache)
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
    const parts = parseLocaleKey(key);
    if (!parts) {
        throw new Error(`Invalid locale key (missing file prefix): ${key}`);
    }
    return parts.sourceFile;
}

function parseLocaleKey(key) {
    const parts = key.split("|");
    if (parts.length < 3) {
        return null;
    }
    const sourceFile = parts[0];
    const sourceText = parts[parts.length - 1];
    const scopeToken = parts.slice(1, -1).join("|");
    return { sourceFile, scopeToken, sourceText };
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

function replaceInCodeStringLiterals(content, entry, scopeCache) {
    const keyParts = parseLocaleKey(entry.key);
    const decodedScope = decodeScopeTokenCached(keyParts?.scopeToken, scopeCache);
    const sourceFile = ts.createSourceFile("localized.ts", content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const matches = collectLiteralMatches(sourceFile, entry.source);

    if (matches.length === 0) {
        return { replaced: false, content };
    }

    const selected = selectLiteralMatch(matches, decodedScope, keyParts?.scopeToken);
    if (!selected) {
        return { replaced: false, content };
    }

    const replacementLiteral = buildReplacementLiteral(selected, entry.target);
    const next = content.slice(0, selected.start) + replacementLiteral + content.slice(selected.end);
    return { replaced: true, content: next };
}

function collectLiteralMatches(sourceFile, sourceText) {
    const exactMatches = [];
    const partialMatches = [];

    function visit(node) {
        const literalKind = getLiteralKind(node);
        if (literalKind) {
            const match = createLiteralMatch(sourceFile, node, literalKind, sourceText);
            if (match) {
                if (match.isExact) {
                    exactMatches.push(match);
                } else {
                    partialMatches.push(match);
                }
            }
        }
        ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    const matches = exactMatches.length > 0 ? exactMatches : partialMatches;

    const perScopeCounter = new Map();
    const perMachineScopeCounter = new Map();
    for (const match of matches) {
        const next = (perScopeCounter.get(match.scopeBase) ?? 0) + 1;
        perScopeCounter.set(match.scopeBase, next);
        match.scopeOccurrence = next;
        match.scopeLocator = encodeScopeLocator(match.scopeBase, next);

        if (match.machineScopeBase) {
            const machineNext = (perMachineScopeCounter.get(match.machineScopeBase) ?? 0) + 1;
            perMachineScopeCounter.set(match.machineScopeBase, machineNext);
            match.machineScopeOccurrence = machineNext;
            match.machineScopeLocator = encodeMachineScopeLocator(match.machineScopeBase, machineNext);
        }
    }

    return matches;
}

function getLiteralKind(node) {
    if (ts.isStringLiteral(node)) {
        return "string";
    }
    if (ts.isNoSubstitutionTemplateLiteral(node)) {
        return "template";
    }
    if (ts.isTemplateHead(node)) {
        return "templateHead";
    }
    if (ts.isTemplateMiddle(node)) {
        return "templateMiddle";
    }
    if (ts.isTemplateTail(node)) {
        return "templateTail";
    }
    return null;
}

function createLiteralMatch(sourceFile, node, literalKind, sourceText) {
    const literalRaw = node.getText(sourceFile);
    const literalText = node.text ?? "";
    if (literalText.length === 0 || sourceText.length === 0) {
        return null;
    }

    const matchIndex = literalText.indexOf(sourceText);
    if (matchIndex === -1) {
        return null;
    }

    const updatedText = literalText.slice(0, matchIndex) + "__LOCALE_TARGET_PLACEHOLDER__" + literalText.slice(matchIndex + sourceText.length);
    const scopeBase = buildScopeBase(node);
    const machineScopeBase = buildMachineScopeBase(node, scopeBase);
    return {
        start: node.getStart(sourceFile),
        end: node.end,
        literalKind,
        literalRaw,
        literalText,
        updatedText,
        sourceText,
        isExact: literalText === sourceText,
        scopeBase,
        scopeOccurrence: 0,
        scopeLocator: "",
        machineScopeBase,
        machineScopeOccurrence: 0,
        machineScopeLocator: "",
    };
}

function buildScopeBase(node) {
    const segments = [];
    let current = node.parent;

    while (current && !ts.isSourceFile(current)) {
        const segment = scopeSegmentForNode(current);
        if (segment) {
            segments.push(segment);
        }
        current = current.parent;
    }

    if (segments.length === 0) {
        return "global";
    }

    return segments.reverse().join("/");
}

function buildMachineScopeBase(node, scopeBase) {
    const machineId = findEnclosingMachineId(node);
    if (!machineId) {
        return null;
    }
    return `${machineId}/${scopeBase}`;
}

function findEnclosingMachineId(node) {
    let child = node;
    let current = node.parent;

    while (current && !ts.isSourceFile(current)) {
        if (ts.isBinaryExpression(current)
            && current.operatorToken.kind === ts.SyntaxKind.EqualsToken
            && child === current.right) {
            const machineIds = extractMachineIdsFromAssignmentTarget(current.left);
            if (machineIds.length > 0) {
                return machineIds[0];
            }
        }

        child = current;
        current = current.parent;
    }

    return null;
}

function extractMachineIdsFromAssignmentTarget(node) {
    if (!node) {
        return [];
    }

    if (ts.isParenthesizedExpression(node)) {
        return extractMachineIdsFromAssignmentTarget(node.expression);
    }

    if (ts.isElementAccessExpression(node)) {
        const machineId = extractMachineIdFromElementAccess(node);
        return machineId ? [machineId] : [];
    }

    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        const rightIds = extractMachineIdsFromAssignmentTarget(node.right);
        const leftIds = extractMachineIdsFromAssignmentTarget(node.left);
        return [...rightIds, ...leftIds];
    }

    return [];
}

function extractMachineIdFromElementAccess(node) {
    if (!ts.isIdentifier(node.expression) || node.expression.text !== "machines") {
        return null;
    }

    if (!node.argumentExpression) {
        return null;
    }

    if (ts.isStringLiteral(node.argumentExpression) || ts.isNoSubstitutionTemplateLiteral(node.argumentExpression)) {
        return node.argumentExpression.text;
    }

    return null;
}

function scopeSegmentForNode(node) {
    if (ts.isClassDeclaration(node)) {
        return `class:${getNodeName(node.name)}`;
    }
    if (ts.isFunctionDeclaration(node)) {
        return `function:${getNodeName(node.name)}`;
    }
    if (ts.isMethodDeclaration(node)) {
        return `method:${getPropertyName(node.name)}`;
    }
    if (ts.isConstructorDeclaration(node)) {
        return "constructor";
    }
    if (ts.isGetAccessorDeclaration(node)) {
        return `getter:${getPropertyName(node.name)}`;
    }
    if (ts.isSetAccessorDeclaration(node)) {
        return `setter:${getPropertyName(node.name)}`;
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
        return `var:${node.name.text}`;
    }
    if (ts.isPropertyDeclaration(node)) {
        return `property:${getPropertyName(node.name)}`;
    }
    if (ts.isPropertyAssignment(node)) {
        return `prop:${getPropertyName(node.name)}`;
    }
    if (ts.isEnumDeclaration(node)) {
        return `enum:${getNodeName(node.name)}`;
    }
    if (ts.isEnumMember(node)) {
        return `member:${getPropertyName(node.name)}`;
    }
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
        return functionLikeNameFromParent(node.parent);
    }
    return null;
}

function functionLikeNameFromParent(parent) {
    if (!parent) {
        return "function:<anonymous>";
    }

    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
        return `function:${parent.name.text}`;
    }
    if (ts.isPropertyAssignment(parent)) {
        return `function:${getPropertyName(parent.name)}`;
    }
    if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        return `function:${parent.left.getText()}`;
    }
    return "function:<anonymous>";
}

function getNodeName(nameNode) {
    if (!nameNode) {
        return "<anonymous>";
    }
    return nameNode.getText();
}

function getPropertyName(nameNode) {
    if (!nameNode) {
        return "<unknown>";
    }
    return nameNode.getText();
}

function encodeScopeLocator(scopeBase, occurrence) {
    return `ast:${scopeBase}#${occurrence}`;
}

function encodeMachineScopeLocator(scopeBase, occurrence) {
    return `machine:${scopeBase}#${occurrence}`;
}

function decodeScopeTokenCached(scopeToken, cache) {
    if (!scopeToken || typeof scopeToken !== "string") {
        return null;
    }

    if (cache.has(scopeToken)) {
        return cache.get(scopeToken);
    }

    const decoded = decodeScopeToken(scopeToken);
    cache.set(scopeToken, decoded);
    return decoded;
}

function decodeScopeToken(scopeToken) {
    let kind = null;
    let body = "";

    if (scopeToken.startsWith("ast:")) {
        kind = "ast";
        body = scopeToken.slice(4);
    } else if (scopeToken.startsWith("machine:")) {
        kind = "machine";
        body = scopeToken.slice(8);
    } else {
        return null;
    }

    const hashIndex = body.lastIndexOf("#");
    if (hashIndex === -1) {
        return { kind, scopeBase: body, occurrence: null };
    }

    const scopeBase = body.slice(0, hashIndex);
    const occurrenceRaw = body.slice(hashIndex + 1);
    const occurrence = Number.parseInt(occurrenceRaw, 10);
    if (!Number.isFinite(occurrence) || occurrence < 1) {
        return null;
    }

    return { kind, scopeBase, occurrence };
}

function selectLiteralMatch(matches, decodedScope, scopeToken) {
    if (decodedScope) {
        const inScope = decodedScope.kind === "machine"
            ? matches.filter((m) => m.machineScopeBase === decodedScope.scopeBase)
            : matches.filter((m) => m.scopeBase === decodedScope.scopeBase);

        if (decodedScope.occurrence != null) {
            return decodedScope.kind === "machine"
                ? inScope.find((m) => m.machineScopeOccurrence === decodedScope.occurrence) ?? null
                : inScope.find((m) => m.scopeOccurrence === decodedScope.occurrence) ?? null;
        }
        return inScope[0] ?? null;
    }

    if (scopeToken && matches.length > 1) {
        const loweredToken = scopeToken.toLowerCase();
        const fuzzy = matches.filter((m) => {
            if (m.scopeBase.toLowerCase().includes(loweredToken)) {
                return true;
            }
            if (m.machineScopeBase && m.machineScopeBase.toLowerCase().includes(loweredToken)) {
                return true;
            }
            return false;
        });
        if (fuzzy.length === 1) {
            return fuzzy[0];
        }
    }

    return matches[0];
}

function buildReplacementLiteral(match, targetText) {
    const nextText = match.updatedText.replace("__LOCALE_TARGET_PLACEHOLDER__", targetText);

    if (match.literalKind === "string") {
        const quote = inferStringQuote(match.literalRaw);
        if (quote === "'") {
            return `'${escapeForSingleQuote(nextText)}'`;
        }
        return `"${escapeForDoubleQuote(nextText)}"`;
    }
    if (match.literalKind === "template") {
        return `\`${escapeForTemplateLiteral(nextText)}\``;
    }
    if (match.literalKind === "templateHead") {
        return `\`${escapeForTemplateLiteral(nextText)}\${`;
    }
    if (match.literalKind === "templateMiddle") {
        return `}${escapeForTemplateLiteral(nextText)}\${`;
    }
    if (match.literalKind === "templateTail") {
        return `}${escapeForTemplateLiteral(nextText)}\``;
    }

    return `"${escapeForDoubleQuote(nextText)}"`;
}

function inferStringQuote(raw) {
    const text = raw ?? "";
    if (text.startsWith("'")) {
        return "'";
    }
    return '"';
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
