// src/app/api/imagekit-auth/route.ts
import { NextResponse } from 'next/server';
import ImageKit from 'imagekit';

// WARNING: Keys are cleared to disconnect from the service.
// This is NOT recommended for production without a proper config management system.
const imagekit = new ImageKit({
  publicKey: "",
  privateKey: "",
  urlEndpoint: ""
});

export async function GET() {
  try {
    // Check if keys are provided before attempting to get parameters
    if (!imagekit.options.publicKey || !imagekit.options.privateKey || !imagekit.options.urlEndpoint) {
      return NextResponse.json({ error: "ImageKit service is not configured." }, { status: 503 });
    }
    const authenticationParameters = imagekit.getAuthenticationParameters();
    return NextResponse.json(authenticationParameters);
  } catch (error) {
    console.error("Error getting ImageKit authentication parameters:", error);
    return NextResponse.json({ error: "Failed to get authentication parameters" }, { status: 500 });
  }
}
