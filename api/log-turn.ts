// API route for logging turns to Neon database (dev/backup)
import { db } from '../src/lib/db';
import { turns, sessions } from '../src/lib/schema';
import { eq } from 'drizzle-orm';

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const { sessionId, turnData } = body;

    if (!sessionId || !turnData) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Ensure session exists
    const existingSession = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    });

    if (!existingSession) {
      await db.insert(sessions).values({
        id: sessionId,
        condition: turnData.condition || 'control',
      });
    }

    // Insert turn
    await db.insert(turns).values({
      sessionId,
      turnIndex: turnData.turnIndex,
      userMessage: turnData.userMessage,
      assistantMessage: turnData.assistantMessage,
      inductData: turnData.inductAI || null,
      typesSupportData: turnData.typesSupportAI || null,
      inductUserData: turnData.inductUser || null,
      typesSupportUserData: turnData.typesSupportUser || null,
      inductUserReasons: turnData.inductUserReasons || null,
      typesSupportUserReasons: turnData.typesSupportUserReasons || null,
      inductReactions: turnData.inductReactions || null,
      typesSupportReactions: turnData.typesSupportReactions || null,
      highlights: turnData.highlights || null,
      feelingScore: turnData.feelingScore || null,
      helpfulnessScore: turnData.helpfulnessScore || null,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error logging turn:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export const config = {
  runtime: 'edge',
};
