import "server-only";

import { initializeDatabase } from "../db/core";
import { createProfileRepository } from "../profiles/core";
import { createZiweiSnapshotRepository } from "./core";

type ZiweiRepository = ReturnType<typeof createZiweiSnapshotRepository>;

function withRepositories<T>(operation: (profiles: ReturnType<typeof createProfileRepository>, ziwei: ZiweiRepository) => T) {
  const { db, sqlite } = initializeDatabase();
  try {
    return operation(createProfileRepository(db), createZiweiSnapshotRepository(db));
  } finally {
    sqlite.close();
  }
}

export function createStoredZiweiSnapshot(profileId: string) {
  return withRepositories((profiles, ziwei) => {
    const profile = profiles.get(profileId);
    return profile ? ziwei.createOrReuse(profile) : undefined;
  });
}

export function getStoredZiweiSnapshot(profileId: string) {
  return withRepositories((profiles, ziwei) => {
    const profile = profiles.get(profileId);
    return profile ? ziwei.getLatest(profile) : undefined;
  });
}
