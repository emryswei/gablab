import { NextResponse } from "next/server";

import { createCoachResponse } from "@/lib/speaking/coach/service";
import type { CoachPayload } from "@/lib/speaking/coach/types";

export async function POST(request: Request) {
  let payload: CoachPayload;
  try {
    payload = (await request.json()) as CoachPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const coachResponse = await createCoachResponse(payload);
  if ("error" in coachResponse) {
    return NextResponse.json({ error: coachResponse.error }, { status: coachResponse.status });
  }

  return NextResponse.json(coachResponse);
}
