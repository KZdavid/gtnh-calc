const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.join(__dirname, "..");
const desktopDir = path.join(rootDir, "desktop");
const releaseDir = path.join(rootDir, "release");
const desktopWorkDir = path.join(releaseDir, "desktop-work");
// Read build config from the dedicated electron-builder config (not polluting root package.json)
const builderConfig = require(path.join(rootDir, "electron-builder.json"));
const rootPackageJson = require(path.join(rootDir, "package.json"));

const args = process.argv.slice(2);
const builderArgs = args.length > 0 ? args : ["--win", "portable"];

runCommand("npm", ["run", "build:localized"]);

closeRunningPackagedApp();

ensureDirectory(releaseDir);
recreateDirectory(desktopWorkDir);

// Install electron / electron-builder from the isolated desktop package
console.log("\nInstalling desktop packaging dependencies...");
runCommand("npm", ["install"], { cwd: desktopDir });

// Run electron-builder via cli.js directly to avoid shell shim issues on Windows.
const electronPackageJsonPath = path.join(desktopDir, "node_modules", "electron", "package.json");
const electronBuilderCliPath = path.join(desktopDir, "node_modules", "electron-builder", "cli.js");
const electronDistPath = path.join(desktopDir, "node_modules", "electron", "dist");

const electronPackageJson = JSON.parse(fs.readFileSync(electronPackageJsonPath, "utf8"));
const electronVersion = electronPackageJson.version;

const finalBuilderArgs = [
    ...builderArgs,
    "--config.electronVersion",
    electronVersion,
    "--config.electronDist",
    electronDistPath,
    "--config.directories.output",
    desktopWorkDir,
];

runCommand("node", [electronBuilderCliPath, ...finalBuilderArgs], {
    env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: "false" },
    shell: false,
});

moveWorkArtifactsToRelease(desktopWorkDir, releaseDir);
recreateDirectory(desktopWorkDir);

function runCommand(command, commandArgs, options = {}) {
    const result = spawnSync(command, commandArgs, {
        cwd: options.cwd ?? rootDir,
        stdio: "inherit",
        shell: options.shell ?? true,
        env: options.env ?? process.env,
    });

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

function moveWorkArtifactsToRelease(srcDir, destDir) {
    if (!fs.existsSync(srcDir)) {
        return;
    }

    const artifactExtensions = new Set([".exe", ".zip", ".nupkg", ".AppImage", ".dmg", ".snap", ".msi"]);
    const entries = fs.readdirSync(srcDir);

    for (const name of entries) {
        const srcPath = path.join(srcDir, name);
        const dstPath = path.join(destDir, name);
        const ext = path.extname(name);

        if (!artifactExtensions.has(ext)) {
            continue;
        }

        if (fs.existsSync(dstPath)) {
            fs.rmSync(dstPath, { recursive: true, force: true });
        }

        fs.renameSync(srcPath, dstPath);
    }
}

function ensureDirectory(dirPath) {
    if (fs.existsSync(dirPath) && !fs.statSync(dirPath).isDirectory()) {
        throw new Error(`Path exists and is not directory: ${dirPath}`);
    }
    fs.mkdirSync(dirPath, { recursive: true });
}

function recreateDirectory(dirPath) {
    if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
    }
    fs.mkdirSync(dirPath, { recursive: true });
}

function closeRunningPackagedApp() {
    if (process.platform !== "win32") {
        return;
    }

    const executableNames = [
        `${builderConfig.productName}.exe`,
        `${builderConfig.productName} ${rootPackageJson.version}.exe`,
    ];

    for (const executableName of executableNames) {
        spawnSync("taskkill", ["/F", "/T", "/IM", executableName], {
            cwd: rootDir,
            stdio: "ignore",
            shell: true,
        });
    }
}
