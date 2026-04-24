const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.join(__dirname, "..");
const releaseDir = path.join(rootDir, "release");

runCommand("npm", ["run", "package:win"]);
runCommand("npm", ["run", "package:minimal"]);

printReleaseArtifacts();

function runCommand(command, args) {
    const result = spawnSync(command, args, {
        cwd: rootDir,
        stdio: "inherit",
        shell: true,
        env: {
            ...process.env,
        },
    });

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

function printReleaseArtifacts() {
    if (!fs.existsSync(releaseDir)) {
        console.warn("release directory not found.");
        return;
    }

    const entries = fs.readdirSync(releaseDir)
        .filter((name) => name.endsWith(".exe") || name.endsWith(".zip"))
        .sort();

    console.log("\nRelease artifacts:");
    for (const name of entries) {
        const fullPath = path.join(releaseDir, name);
        const sizeMb = (fs.statSync(fullPath).size / (1024 * 1024)).toFixed(2);
        console.log(`- ${name} (${sizeMb} MB)`);
    }
}
