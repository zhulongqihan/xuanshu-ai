import "server-only";

import { initializeDatabase } from "../db/core";
import { deleteAllData, exportBackup, restoreBackup } from "./core";

export function exportStoredBackup() {
  const { sqlite } = initializeDatabase();
  try {
    return exportBackup(sqlite);
  } finally {
    sqlite.close();
  }
}

export function restoreStoredBackup(input: unknown) {
  const { sqlite } = initializeDatabase();
  try {
    return restoreBackup(sqlite, input);
  } finally {
    sqlite.close();
  }
}

export function deleteAllStoredData() {
  const { sqlite } = initializeDatabase();
  try {
    deleteAllData(sqlite);
  } finally {
    sqlite.close();
  }
}
