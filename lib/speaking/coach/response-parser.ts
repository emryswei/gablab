import type { ParsedCoach } from "./types.ts";

export function parseCoachContent(rawContent: string): ParsedCoach | null {
  try {
    return JSON.parse(rawContent) as ParsedCoach;
  } catch {
    // Continue with best-effort extraction below.
  }

  const firstBrace = rawContent.indexOf("{");
  const lastBrace = rawContent.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  const jsonSlice = rawContent.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(jsonSlice) as ParsedCoach;
  } catch {
    return null;
  }
}

export function normalizeFeedback(feedback: ParsedCoach["feedback"]) {
  if (Array.isArray(feedback)) {
    return feedback.map((item) => item.trim()).filter(Boolean).join(" ") || undefined;
  }
  if (typeof feedback === "string") {
    return feedback.trim() || undefined;
  }
  return undefined;
}

export function normalizeOptionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function extractCoachReply(rawContent: string) {
  const trimmed = rawContent.trim();

  const parsed = parseCoachContent(trimmed);
  if (parsed?.reply && typeof parsed.reply === "string") {
    return parsed.reply.trim();
  }
  if (parsed?.coachReply && typeof parsed.coachReply === "string") {
    return parsed.coachReply.trim();
  }

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    const parsedFence = parseCoachContent(fenceMatch[1].trim());
    if (parsedFence?.reply && typeof parsedFence.reply === "string") {
      return parsedFence.reply.trim();
    }
    if (parsedFence?.coachReply && typeof parsedFence.coachReply === "string") {
      return parsedFence.coachReply.trim();
    }
  }

  const lineMatch = trimmed.match(/coach\s*reply\s*:\s*([\s\S]*)/i);
  if (lineMatch?.[1]) {
    return lineMatch[1].trim();
  }

  return trimmed
    .replace(/^\s*json response\s*:\s*/i, "")
    .replace(/^\s*corrected\s*:\s*.*$/gim, "")
    .replace(/^\s*feedback\s*:\s*.*$/gim, "")
    .trim();
}
