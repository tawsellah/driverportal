// src/app/api/imagekit-auth/route.ts
import { NextResponse } from 'next/server';
import ImageKit from 'imagekit';

// WARNING: Never expose your privateKey in client-side code or commit it to version control.
// Use environment variables for sensitive data in production.
// For this example, keys are hardcoded but this is NOT recommended for production.
const imagekit = new ImageKit({
  publicKey: process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY || "public_IfRvA+ieL0CZzBuuO9i9cFceLn8=",
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY || "private_M639+xksOgWoN42TwbWpr10mkvc=",
  urlEndpoint: process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || "https://ik.imagekit.io/Tawsellah/"
});

export async function GET() {
  try {
    const authenticationParameters = imagekit.getAuthenticationParameters();
    return NextResponse.json(authenticationParameters);
  } catch (error) {
    console.error("Error getting ImageKit authentication parameters:", error);
    return NextResponse.json({ error: "Failed to get authentication parameters" }, { status: 500 });
  }
}
