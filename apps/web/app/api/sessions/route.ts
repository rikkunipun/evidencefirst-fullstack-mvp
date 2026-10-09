import { NextResponse, type NextRequest } from "next/server";
import { createSessionSchema } from "@/lib/zod/requests";
import { getServiceClient } from "@/lib/supabase/service-client";
import { generateParticipantCode } from "@/lib/participant-code";
import { resolveTopicKey } from "@/lib/decision-cues";
import {
  signSessionCookie,
  SESSION_COOKIE_NAME,
  RESUME_COOKIE_MAX_AGE_SECONDS,
} from "@/lib/capability";
import { recordAuditEvent } from "@/lib/audit";
import { checkRateLimit, clientIpFrom } from "@/lib/rate-limit";

const SESSION_CREATE_LIMIT = 10;
const SESSION_CREATE_WINDOW_MS = 10 * 60 * 1000;

export async function POST(req: NextRequest) {
  const rate = checkRateLimit(`session-create:${clientIpFrom(req)}`, SESSION_CREATE_LIMIT, SESSION_CREATE_WINDOW_MS);
  if (!rate.allowed) {
    return NextResponse.json({ error: "rate_limited", retryAfterMs: rate.retryAfterMs }, { status: 429 });
  }

  const json = await req.json().catch(() => null);
  const parsed = createSessionSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;
  const supabase = getServiceClient();

  // Participant row with a unique, human-shareable code. Retry on the rare collision.
  let participantId: string | null = null;
  let participantCode: string | null = null;
  for (let attempt = 0; attempt < 5 && !participantId; attempt++) {
    const code = generateParticipantCode();
    const { data, error } = await supabase.from("participants").insert({ participant_code: code }).select("id").single();
    if (!error) {
      participantId = data.id;
      participantCode = code;
    } else if (!error.message.toLowerCase().includes("duplicate")) {
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
  }
  if (!participantId) return NextResponse.json({ error: "server_error" }, { status: 500 });

  const topicKey = resolveTopicKey(body.situationCard, body.decisionCueId);

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .insert({ participant_id: participantId, state: "consented", pack_topic: topicKey })
    .select("id")
    .single();
  if (sessionError || !session) {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  const { error: consentError } = await supabase.from("consent_events").insert({
    session_id: session.id,
    consent_version: body.consentVersion,
  });
  if (consentError) return NextResponse.json({ error: "server_error" }, { status: 500 });

  const { error: contextError } = await supabase.from("context_answers").insert({
    session_id: session.id,
    situation_card: body.situationCard,
    goal: body.goal ?? null,
    decision_cue: body.decisionCueId ?? null,
    free_text: body.freeText ?? null,
    card_order: body.cardOrder ?? null,
  });
  if (contextError) return NextResponse.json({ error: "server_error" }, { status: 500 });

  const { error: transitionError } = await supabase
    .from("sessions")
    .update({ state: "context", revision: 1 })
    .eq("id", session.id)
    .eq("revision", 0);
  if (transitionError) return NextResponse.json({ error: "server_error" }, { status: 500 });

  await recordAuditEvent({
    actorType: "participant",
    action: "session_created",
    entityType: "sessions",
    entityId: session.id,
    after: { state: "context", situationCard: body.situationCard, topicKey },
  });

  const response = NextResponse.json({ sessionId: session.id, participantCode });
  response.cookies.set(SESSION_COOKIE_NAME, signSessionCookie(session.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: RESUME_COOKIE_MAX_AGE_SECONDS,
  });
  return response;
}
