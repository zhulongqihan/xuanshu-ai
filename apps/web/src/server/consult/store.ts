import "server-only";

import { initializeDatabase } from "../db/core";
import { createConsultationRepository } from "./core";

type ConsultationRepository = ReturnType<typeof createConsultationRepository>;

function withRepository<T>(operation: (repository: ConsultationRepository) => T) {
  const { db, sqlite } = initializeDatabase();
  try {
    return operation(createConsultationRepository(db));
  } finally {
    sqlite.close();
  }
}

export function createStoredConsultation(profileId: string, title: string) {
  return withRepository((repository) => repository.create(profileId, title));
}

export function appendStoredMessage(
  consultationId: string,
  input: Parameters<ConsultationRepository["appendMessage"]>[1],
) {
  return withRepository((repository) => repository.appendMessage(consultationId, input));
}

export function getStoredConsultation(id: string) {
  return withRepository((repository) => repository.get(id));
}

export function listStoredConsultations(profileId?: string) {
  return withRepository((repository) => repository.list(profileId));
}
