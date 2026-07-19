import "server-only";

import { initializeDatabase } from "../db/core";
import { createProfileRepository, type CreateProfileInput } from "./core";

type ProfileRepository = ReturnType<typeof createProfileRepository>;

function withProfileRepository<T>(operation: (repository: ProfileRepository) => T) {
  const { db, sqlite } = initializeDatabase();
  try {
    return operation(createProfileRepository(db));
  } finally {
    sqlite.close();
  }
}

export function listStoredProfiles() {
  return withProfileRepository((repository) => repository.list());
}

export function createStoredProfile(input: CreateProfileInput) {
  return withProfileRepository((repository) => repository.create(input));
}

export function deleteStoredProfile(profileId: string) {
  return withProfileRepository((repository) => repository.delete(profileId));
}
