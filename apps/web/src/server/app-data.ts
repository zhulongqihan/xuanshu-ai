import { homedir } from "node:os";
import { posix, win32 } from "node:path";

type AppDataPathOptions = {
  environment?: Readonly<Record<string, string | undefined>>;
  homeDirectory?: string;
  platform?: NodeJS.Platform;
};

export function getAppDataDirectory({
  environment = process.env,
  homeDirectory = homedir(),
  platform = process.platform,
}: AppDataPathOptions = {}) {
  const path = platform === "win32" ? win32 : posix;

  if (environment.XUANSHU_AI_DATA_DIR) {
    return path.resolve(environment.XUANSHU_AI_DATA_DIR);
  }

  if (platform === "win32") {
    return path.join(environment.LOCALAPPDATA ?? homeDirectory, "XuanshuAI");
  }

  if (platform === "darwin") {
    return path.join(homeDirectory, "Library", "Application Support", "XuanshuAI");
  }

  return path.join(
    environment.XDG_DATA_HOME ?? path.join(homeDirectory, ".local", "share"),
    "XuanshuAI",
  );
}
