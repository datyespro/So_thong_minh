import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const cwd = process.cwd();
const isolatedDistDir = ".next-build";
const nextManagedFiles = ["next-env.d.ts", "tsconfig.json"];

// next build cleans its distDir. If a local server is using .next, build elsewhere.
function commandIncludesWorkspace(commandLine) {
  return commandLine.toLowerCase().includes(cwd.toLowerCase());
}

function commandLooksLikeNextDev(commandLine) {
  return /\bnext(?:\.cmd)?["']?\s+dev\b/i.test(commandLine);
}

function hasWorkspaceNextDevProcess() {
  if (process.platform === "win32") {
    const script = [
      "$ErrorActionPreference = 'SilentlyContinue'",
      "$cwd = [Console]::In.ReadToEnd().Trim()",
      "Get-CimInstance Win32_Process |",
      "  Where-Object { $_.CommandLine -and $_.CommandLine.ToLower().Contains($cwd.ToLower()) -and $_.CommandLine -match 'next(\\.cmd)?[\"'']?\\s+dev\\b' } |",
      "  Select-Object -First 1 -ExpandProperty ProcessId",
    ].join("\n");

    const result = spawnSync(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
      {
        encoding: "utf8",
        input: cwd,
        windowsHide: true,
      },
    );

    return result.status === 0 && result.stdout.trim().length > 0;
  }

  const result = spawnSync("ps", ["-eo", "args="], {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    return false;
  }

  return result.stdout
    .split(/\r?\n/)
    .some(
      (line) => commandIncludesWorkspace(line) && commandLooksLikeNextDev(line),
    );
}

function snapshotFiles(relativePaths) {
  return new Map(
    relativePaths.map((relativePath) => {
      const absolutePath = path.join(cwd, relativePath);

      return [
        absolutePath,
        existsSync(absolutePath) ? readFileSync(absolutePath) : null,
      ];
    }),
  );
}

function restoreFiles(snapshot) {
  for (const [absolutePath, content] of snapshot.entries()) {
    if (content !== null) {
      writeFileSync(absolutePath, content);
    }
  }
}

const nextBin = path.join(cwd, "node_modules", "next", "dist", "bin", "next");
const devIsRunning = hasWorkspaceNextDevProcess();
const env = {
  ...process.env,
  ...(devIsRunning ? { NEXT_DIST_DIR: isolatedDistDir } : {}),
};

if (devIsRunning) {
  console.log(
    `[safe-build] Detected next dev in this workspace. Building into ${isolatedDistDir} so the running dev server keeps its .next assets.`,
  );
} else {
  console.log("[safe-build] No workspace next dev process detected. Building into .next.");
}

const nextManagedSnapshot = devIsRunning
  ? snapshotFiles(nextManagedFiles)
  : new Map();

const result = spawnSync(process.execPath, [nextBin, "build"], {
  cwd,
  env,
  shell: false,
  stdio: "inherit",
});

if (devIsRunning) {
  restoreFiles(nextManagedSnapshot);
}

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

if (result.signal) {
  process.kill(process.pid, result.signal);
} else {
  process.exit(result.status ?? 1);
}
