export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; code: ActionErrorCode; message: string };

export type ActionErrorCode =
  | "unauthorized"
  | "invalid_credentials"
  | "validation_failed"
  | "db_error"
  | "internal";
