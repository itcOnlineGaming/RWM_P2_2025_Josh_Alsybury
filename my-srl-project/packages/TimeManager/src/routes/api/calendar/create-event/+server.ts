// src/routes/api/calendar/create-event/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { google } from 'googleapis';
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } from '$env/static/private';
import { loadTokens } from '$lib/tokensStore';

export const POST: RequestHandler = async ({ request }) => {
  const tokens = loadTokens();

  if (!tokens?.refresh_token) {
    return new Response('Not authenticated', { status: 401 });
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
    );

    // googleapis will auto-refresh access_token using this refresh_token
    oauth2Client.setCredentials({ 
      refresh_token: tokens.refresh_token 
    });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    const eventData = await request.json();

    const event = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: eventData.summary,
        start: eventData.start,
        end: eventData.end,
        colorId: '9'
      }
    });

    return json(event.data);
  } catch (error: any) {
    console.error('Error creating calendar event:', error);
    return new Response(error.message || 'Failed to create event', { status: 500 });
  }
};