import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (sessionToken) {
      try {
        // Hash the token using Node crypto SHA-256
        const tokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');

        // Delete the matching session row from the "sessions" table
        const { error } = await supabaseAdmin
          .from('sessions')
          .delete()
          .eq('token_hash', tokenHash);

        if (error) {
          console.error('Database error deleting session:', error);
        }
      } catch (err) {
        console.error('Unhandled error during session deletion:', err);
      }
    }

    // Always clear the cookie
    cookieStore.set({
      name: 'session_token',
      value: '',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unhandled logout error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error.' },
      { status: 500 }
    );
  }
}
