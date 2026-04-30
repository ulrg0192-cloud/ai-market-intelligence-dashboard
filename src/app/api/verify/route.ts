import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import crypto from 'crypto';
import { cookies } from 'next/headers';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_REGEX = /^\d{6}$/;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, code } = body;

    if (
      !email ||
      typeof email !== 'string' ||
      !EMAIL_REGEX.test(email) ||
      !code ||
      typeof code !== 'string' ||
      !CODE_REGEX.test(code)
    ) {
      return NextResponse.json(
        { success: false, message: 'Invalid credentials.' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    const ip =
      req.headers.get('x-forwarded-for') ||
      req.headers.get('x-real-ip') ||
      'unknown';
      // ⛔ Rate limit por IP - 10 intentos en 10 minutos
const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

const { count: ipCount } = await supabaseAdmin
  .from('login_attempts')
  .select('*', { count: 'exact', head: true })
  .eq('ip_address', ip)
  .eq('success', false)
  .gt('created_at', tenMinutesAgo);

if (ipCount && ipCount >= 10) {
  return NextResponse.json(
    { success: false, message: 'Too many attempts from this IP. Try later.' },
    { status: 429 }
  );
}

    // 🔒 Rate limit check (last 15 min)
    const fifteenMinutesAgo = new Date(
      Date.now() - 15 * 60 * 1000
    ).toISOString();

    const { count } = await supabaseAdmin
      .from('login_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('email', normalizedEmail)
      .eq('success', false)
      .gt('created_at', fifteenMinutesAgo);

    if (count && count >= 5) {
      return NextResponse.json(
        { success: false, message: 'Too many attempts. Try later.' },
        { status: 429 }
      );
    }

    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (!user) {
      await supabaseAdmin.from('login_attempts').insert([
        {
          email: normalizedEmail,
          ip_address: ip,
          success: false,
        },
      ]);

      return NextResponse.json(
        { success: false, message: 'Invalid credentials.' },
        { status: 401 }
      );
    }

    const hashedProvidedCode = crypto
      .createHash('sha256')
      .update(code)
      .digest('hex');

    const { data: accessCode } = await supabaseAdmin
      .from('access_codes')
      .select('id')
      .eq('user_id', user.id)
      .eq('hashed_code', hashedProvidedCode)
      .eq('is_used', false)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (!accessCode) {
      await supabaseAdmin.from('login_attempts').insert([
        {
          email: normalizedEmail,
          ip_address: ip,
          success: false,
        },
      ]);

      return NextResponse.json(
        { success: false, message: 'Invalid credentials.' },
        { status: 401 }
      );
    }

    // marcar código usado
    await supabaseAdmin
      .from('access_codes')
      .update({ is_used: true })
      .eq('id', accessCode.id);

    // invalidar sesiones anteriores
    await supabaseAdmin
      .from('sessions')
      .delete()
      .eq('user_id', user.id);

    // generar nueva sesión
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    await supabaseAdmin.from('sessions').insert([
      {
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
      },
    ]);

    await supabaseAdmin.from('login_attempts').insert([
      {
        email: normalizedEmail,
        ip_address: ip,
        success: true,
      },
    ]);

    const cookieStore = await cookies();
    cookieStore.set({
      name: 'session_token',
      value: rawToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 48 * 60 * 60,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Verify error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error.' },
      { status: 500 }
    );
  }
}