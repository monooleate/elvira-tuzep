// src/lib/googleSheets.ts
import { google } from 'googleapis';

export async function appendOfferToSheet(offer: any) {
  try {
    console.log('=== Google Sheets append kezdődik ===');
    console.log('Offer data:', JSON.stringify(offer, null, 2));
    
    // Ellenőrizzük a környezeti változókat
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_BASE64) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_BASE64 nincs beállítva!');
    }
    if (!process.env.GOOGLE_SHEET_ID) {
      throw new Error('GOOGLE_SHEET_ID nincs beállítva!');
    }
    
    console.log('Sheet ID:', process.env.GOOGLE_SHEET_ID);
    
    const credentials = JSON.parse(
      Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_BASE64!, 'base64').toString('utf-8')
    );
    console.log('Credentials parsed, client_email:', credentials.client_email);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const sheetId = process.env.GOOGLE_SHEET_ID!;
    const sheetName = 'Ajánlatok';

    console.log('Attempting append to:', `${sheetName}!A1`);

    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${sheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          new Date().toISOString(),
          offer.name,
          offer.email,
          offer.phone || '',
          offer.message || '',
          offer.quantity,
          offer.unit || '',
          offer.product?.name || '',
          offer.product?.sku || '',
          offer.product?.price || '',
          offer.contacted ?? false,
          offer.orderRecorded ?? false,
          offer.orderCompleted ?? false,
        ]]
      }
    });

    console.log('✓ Sheet append successful:', response.data);
    return response;

  } catch (error: any) {
    console.error('!!! Google Sheets hiba !!!');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Error details:', JSON.stringify(error, null, 2));
    throw error;
  }
}