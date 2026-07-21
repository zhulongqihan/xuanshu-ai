export type BirthNormalizationErrorCode =
  | "invalid_lunar_date"
  | "unsupported_range";

export class BirthNormalizationError extends Error {
  readonly code: BirthNormalizationErrorCode;

  constructor(code: BirthNormalizationErrorCode, message: string) {
    super(message);
    this.name = "BirthNormalizationError";
    this.code = code;
  }
}
