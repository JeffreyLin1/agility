import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  // Create a response object
  const res = NextResponse.next();
  
  // Create a Supabase client with the request and response
  const supabase = createMiddlewareClient({ req, res });
  
  // Refresh the session if needed
  await supabase.auth.getSession();
  
  // Return the response with the updated cookies
  return res;
}

// Only run on /workflow routes
export const config = {
  matcher: ['/workflow', '/workflow/:path*'],
}; 