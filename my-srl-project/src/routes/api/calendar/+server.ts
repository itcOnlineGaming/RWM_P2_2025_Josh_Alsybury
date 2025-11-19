// src/routes/api/calendar/+server.ts
import type { RequestHandler } from './$types';
import { google } from 'googleapis';
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from '$env/static/private';
import { loadTokens } from '$lib/tokensStore';

const redirect_uri = 'http://localhost:5173/api/calendar';

export const GET: RequestHandler = async () => {
  const tokens = loadTokens();

  if (!tokens?.refresh_token) {
    return new Response('Not authorized with Google yet', { status: 401 });
  }

  const oauth2 = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    redirect_uri
  );

  // googleapis will auto‑refresh access_token using this refresh_token
  oauth2.setCredentials({ refresh_token: tokens.refresh_token });

  const calendar = google.calendar({ version: 'v3', auth: oauth2 });

  const { data } = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date().toISOString(),
    maxResults: 20,
    singleEvents: true,
    orderBy: 'startTime'
  });

  return new Response(JSON.stringify(data.items ?? []), {
    headers: { 'Content-Type': 'application/json' }
  });
};
