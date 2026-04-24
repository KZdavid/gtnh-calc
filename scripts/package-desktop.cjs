const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.join(__dirname, "..");
const desktopDir = path.join(rootDir, "desktop");
const releaseDir = path.join(rootDir, "release");
// Read build config from the dedicated electron-builder config (not polluting root package.json)
const builderConfig = require(path.join(rootDir, "electron-builder.json"));
const rootPackageJson = require(path.join(rootDir, "package.json"));

const args = process.argv.slice(2);
const builderArgs = args.length > 0 ? args : ["--win", "portable"];

runCommand("npm", ["run", "build"]);

closeRunningPackagedApp();

if (fs.existsSync(releaseDir)) {
    try {
        fs.rmSync(releaseDir, { recursive: true, force: true });
    } catch (error) {
        console.warn("Unable to fully clean release directory, continuing with incremental packaging.");
        console.warn(error.message);
    }
}

// Install electron / electron-builder from the isolated desktop package
console.log("\nInstalling desktop packaging dependencies...");
runCommand("npm", ["install"], { cwd: desktopDir });

// Run electron-builder from the project root using the locally installed binary
const ebBin = path.join(desktopDir, "node_modules", ".bin", "electron-builder");
runCommand("node", [ebBin, ...builderArgs], {
    env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: "false" },
});

function runCommand(command, commandArgs, options = {}) {
    const result = spawnSync(command, commandArgs, {
        cwd: options.cwd ?? rootDir,
        stdio: "inherit",
        shell: true,
        env: options.env ?? process.env,
    });

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
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
