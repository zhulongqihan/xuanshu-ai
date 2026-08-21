import "server-only";

import { initializeDatabase } from "../db/core";
import { createProfileRepository } from "../profiles/core";
import { createBaziSnapshotRepository } from "./core";

type BaziSnapshotRepository = ReturnType<typeof createBaziSnapshotRepository>;

function withRepositories<T>(operation: (
  profileRepository: ReturnType<typeof createProfileRepository>,
  snapshotRepository: BaziSnapshotRepository,
) => T) {
  const { db, sqlite } = initializeDatabase();
  try {
    return operation(
      createProfileRepository(db),
      createBaziSnapshotRepository(db),
    );
  } finally {
    sqlite.close();
  }
}

export function createStoredBaziSnapshot(
  profileId: string,
  options: { cycleCount?: number } = {},
) {
  return withRepositories((profiles, snapshots) => {
    const profile = profiles.get(profileId);
    return profile ? snapshots.createOrReuse(profile, options) : undefined;
  });
}

export function getStoredBaziSnapshot(profileId: string) {
  return withRepositories((profiles, snapshots) => {
    const profile = profiles.get(profileId);
    return profile ? snapshots.getLatest(profile) : undefined;
  });
}
