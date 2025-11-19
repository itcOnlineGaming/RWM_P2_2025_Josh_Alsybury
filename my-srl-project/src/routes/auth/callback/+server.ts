// src/routes/auth/callback/+server.ts
import { google } from 'googleapis';
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from '$env/static/private';
import type { RequestHandler } from './$types';
import { saveTokens } from '$lib/tokensStore';

const redirect_uri = 'http://localhost:5173/auth/callback';

export const GET: RequestHandler = async ({ url }) => {
  const code = url.searchParams.get('code');

  if (!code) {
    console.error('No code in callback URL');
    return new Response('Missing code', { status: 400 });
  }

  const oauth2 = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    redirect_uri
  );

  const { tokens } = await oauth2.getToken(code);
  oauth2.setCredentials(tokens);

  saveTokens(tokens);
  
  console.log('TOKENS:', tokens);

  return new Response('Google auth successful, check server logs.');
};
