import { NextResponse } from "next/server";

import { getLessonById } from "@/lib/learning/courses";
import { createLessonReport, isReportSession } from "@/lib/learning/report";

export async function POST(request: Request) {
  let payload: { session?: unknown };
  try {
    payload = (await request.json()) as { session?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isReportSession(payload.session)) {
    return NextResponse.json({ error: "Invalid practice session." }, { status: 400 });
  }

  const lesson = getLessonById(payload.session.lessonId);
  if (!lesson || lesson.version !== payload.session.lessonVersion) {
    return NextResponse.json({ error: "Unknown lesson version." }, { status: 400 });
  }

  return NextResponse.json(await createLessonReport(payload.session, lesson));
}

