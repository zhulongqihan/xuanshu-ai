import "server-only";

import { initializeDatabase } from "../db/core";
import { createLiuyaoCaseRepository } from "./core";

type LiuyaoCaseRepository = ReturnType<typeof createLiuyaoCaseRepository>;

function withRepository<T>(operation: (repository: LiuyaoCaseRepository) => T) {
  const { db, sqlite } = initializeDatabase();
  try {
    return operation(createLiuyaoCaseRepository(db));
  } finally {
    sqlite.close();
  }
}

export function createStoredLiuyaoCase(
  calculation: Parameters<LiuyaoCaseRepository["create"]>[0]["calculation"],
  profileId?: string,
) {
  return withRepository((repository) => repository.create({ calculation, profileId }));
}

export function listStoredLiuyaoCases(profileId?: string) {
  return withRepository((repository) => repository.list(profileId));
}

export function getStoredLiuyaoCase(id: string) {
  return withRepository((repository) => repository.get(id));
}
