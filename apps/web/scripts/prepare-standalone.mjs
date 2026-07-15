import { cp, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";

const appRoot = process.cwd();
const standaloneApp = join(appRoot, ".next", "standalone", "apps", "web");

async function copyIfPresent(source, destination) {
  try {
    await stat(source);
  } catch {
    return;
  }

  await mkdir(destination, { recursive: true });
  await cp(source, destination, { recursive: true, force: true });
}

await copyIfPresent(
  join(appRoot, ".next", "static"),
  join(standaloneApp, ".next", "static"),
);
await copyIfPresent(join(appRoot, "public"), join(standaloneApp, "public"));
