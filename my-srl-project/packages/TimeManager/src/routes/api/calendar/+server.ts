// src/routes/api/calendar/+server.ts
import type { RequestHandler } from './$types';
import { google } from 'googleapis';
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } from '$env/static/private';
import { loadTokens } from '$lib/tokensStore';

export const GET: RequestHandler = async () => {
  const tokens = loadTokens();

  if (!tokens?.refresh_token) {
    return new Response('Not authorized with Google yet', { status: 401 });
  }

  const oauth2 = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI  // ← Use env variable
  );

  // googleapis will auto‑refresh access_token using this refresh_token
  oauth2.setCredentials({ refresh_token: tokens.refresh_token });

  const calendar = google.calendar({ version: 'v3', auth: oauth2 });
  const tasksClient = google.tasks({ version: 'v1', auth: oauth2 });

  const now = new Date();
  const monday = new Date(now);
  const diff = (monday.getDay() + 6) % 7; // 0 = Monday
  monday.setDate(monday.getDate() - diff);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 7);

  const { data: calData } = await calendar.events.list({
    calendarId: 'primary',
    timeMin: monday.toISOString(),
    timeMax: sunday.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 100
  });

  const allItems = [...(calData.items ?? [])];

  return new Response(JSON.stringify(allItems), {
    headers: { 'Content-Type': 'application/json' }
  })
};
