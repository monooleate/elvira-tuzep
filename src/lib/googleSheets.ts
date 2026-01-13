// src/lib/googleSheets.ts
import { google } from 'googleapis';

export async function appendOfferToSheet(offer: any) {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(
      Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_BASE64!, 'base64').toString('utf-8')
    ),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  

  const sheets = google.sheets({ version: 'v4', auth });

  const sheetId = process.env.GOOGLE_SHEET_ID!;
  const sheetName = 'Ajánlatok'; // lapfül neve, ha más, módosítsd

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: `${sheetName}!A1`, // mindig a következő üres sorba
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        new Date().toISOString(),
        offer.name,
        offer.email,
        offer.phone,
        offer.message,
        offer.quantity,
        offer.unit,
        offer.product.name,
        offer.product.sku,
        offer.product.price,
        offer.unit,
        offer.contacted ?? false,
        offer.orderRecorded ?? false,
        offer.orderCompleted ?? false,
      ]]
    }
  });
}
