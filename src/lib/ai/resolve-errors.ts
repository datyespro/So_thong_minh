export type EntityResolveErrorCode =
  | "EMPTY_INTENT"
  | "OWNER_FETCH_FAILED"
  | "RESOLVE_FAILED";

export class EntityResolveError extends Error {
  constructor(
    public readonly code: EntityResolveErrorCode,
    message: string = code,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "EntityResolveError";
  }
}
