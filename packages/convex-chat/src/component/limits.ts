import { ConvexError } from "convex/values";

export const CHAT_LIMITS = {
  attachmentBytes: 25 * 1024 * 1024,
  attachmentDimension: 100_000,
  attachmentDurationMs: 24 * 60 * 60 * 1_000,
  attachmentFallbackCodePoints: 500,
  filenameCodePoints: 240,
  identifierCodePoints: 200,
  mediaTypeCodePoints: 255,
  membersPerConversation: 100,
  messageCodePoints: 10_000,
  pageSize: 100,
  storageKeyCodePoints: 1_024,
  storageProviderCodePoints: 100,
  titleCodePoints: 200,
} as const;

export function codePointLength(value: string) {
  return [...value].length;
}

function invalidArgument(message: string): never {
  throw new ConvexError({ code: "INVALID_ARGUMENT", message });
}

export function validateIdentifier(value: string, name: string) {
  validateBoundedString(value, name, CHAT_LIMITS.identifierCodePoints);
}

export function validateBoundedString(
  value: string,
  name: string,
  maximumCodePoints: number,
) {
  const length = codePointLength(value);
  if (value.trim().length === 0 || length > maximumCodePoints) {
    invalidArgument(
      `${name} must contain 1 to ${maximumCodePoints.toLocaleString("en-US")} code points`,
    );
  }
}

export function validateOptionalPositiveInteger(
  value: number | undefined,
  name: string,
  maximum: number,
) {
  if (
    value !== undefined &&
    (!Number.isSafeInteger(value) || value <= 0 || value > maximum)
  ) {
    invalidArgument(
      `${name} must be a positive integer no greater than ${maximum}`,
    );
  }
}

export function normalizePageSize(value: number | undefined) {
  if (value === undefined) return 50;
  if (
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > CHAT_LIMITS.pageSize
  ) {
    invalidArgument(
      `limit must be an integer from 1 to ${CHAT_LIMITS.pageSize}`,
    );
  }
  return value;
}
