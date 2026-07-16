import { homedir } from "node:os";
import { join, resolve } from "node:path";

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
  if (environment.XUANSHU_AI_DATA_DIR) {
    return resolve(environment.XUANSHU_AI_DATA_DIR);
  }

  if (platform === "win32") {
    return join(environment.LOCALAPPDATA ?? homeDirectory, "XuanshuAI");
  }

  if (platform === "darwin") {
    return join(homeDirectory, "Library", "Application Support", "XuanshuAI");
  }

  return join(environment.XDG_DATA_HOME ?? join(homeDirectory, ".local", "share"), "XuanshuAI");
}
