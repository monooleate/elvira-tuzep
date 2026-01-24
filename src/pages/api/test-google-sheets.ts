// src/pages/api/test-google-sheets.ts
import type { APIRoute } from 'astro';
import { google } from 'googleapis';

export const prerender = false;

export const GET: APIRoute = async () => {
  const results = {
    envVarsPresent: {
      serviceAccount: !!process.env.GOOGLE_SERVICE_ACCOUNT_BASE64,
      sheetId: !!process.env.GOOGLE_SHEET_ID,
    },
    sheetId: process.env.GOOGLE_SHEET_ID,
    serviceAccountEmail: '',
    canReadSheet: false,
    availableSheets: [] as string[],
    canWriteSheet: false,
    error: null as string | null,
  };

  try {
    // Parse credentials
    const credentials = JSON.parse(
      Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_BASE64!, 'base64').toString('utf-8')
    );
    results.serviceAccountEmail = credentials.client_email;

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const sheetId = process.env.GOOGLE_SHEET_ID!;

    // Test READ
    try {
      const readResponse = await sheets.spreadsheets.get({
        spreadsheetId: sheetId,
      });
      results.canReadSheet = true;
      results.availableSheets = readResponse.data.sheets?.map(s => s.properties?.title || '') || [];
    } catch (readError: any) {
      results.error = `Read failed: ${readError.message}`;
    }

    // Test WRITE
    if (results.canReadSheet) {
      try {
        await sheets.spreadsheets.values.append({
          spreadsheetId: sheetId,
          range: 'Ajánlatok!A1',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[
              new Date().toISOString(),
              'TEST',
              'test@test.com',
              '',
              'Connection test',
              1,
              'db',
              'Test',
              'TEST-001',
              0,
              false,
              false,
              false,
            ]]
          }
        });
        results.canWriteSheet = true;
      } catch (writeError: any) {
        results.error = `Write failed: ${writeError.message} (code: ${writeError.code})`;
      }
    }

  } catch (error: any) {
    results.error = error.message;
  }

  return new Response(JSON.stringify(results, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};