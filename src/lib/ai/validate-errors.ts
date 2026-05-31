export type ValidateErrorCode =
  | "INVALID_INPUT"
  | "MASTER_FETCH_FAILED"
  | "VALIDATE_FAILED";

export class ValidateError extends Error {
  constructor(
    public readonly code: ValidateErrorCode,
    message: string = code,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ValidateError";
  }
}
