import { google } from 'googleapis';
import { redirect } from '@sveltejs/kit';
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from '$env/static/private';

export function GET() {
    const redirect_uri = 'http://localhost:5173/auth/callback';

    const oauth2 = new google.auth.OAuth2(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        redirect_uri
    );

    const url = oauth2.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',  
        scope: ['https://www.googleapis.com/auth/calendar','https://www.googleapis.com/auth/tasks.readonly']
    });
    
    throw redirect(302, '/');
}
