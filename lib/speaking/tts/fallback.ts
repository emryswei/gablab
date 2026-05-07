export type TtsFallbackCode = "browser_requested" | "missing_config" | "provider_unavailable" | "unsupported_provider";

export type TtsFallbackPayload = {
  fallback: true;
  code: TtsFallbackCode;
  reason: string;
};

const GENERIC_BROWSER_REASON = "Premium voice is unavailable. Using browser voice instead.";

export function createTtsFallback(code: TtsFallbackCode, reason = GENERIC_BROWSER_REASON): TtsFallbackPayload {
  return {
    fallback: true,
    code,
    reason,
  };
}

export function isTtsFallbackPayload(value: unknown): value is TtsFallbackPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<TtsFallbackPayload>;
  return payload.fallback === true && typeof payload.reason === "string";
}
