import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import crypto from 'crypto';



const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    // 1️⃣ Parse body
    const body = await req.json();
    const { email, name } = body;

    // 2️⃣ Validate email
    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { success: false, message: 'Invalid email format.' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedName =
      typeof name === 'string' && name.trim().length > 0
        ? name.trim()
        : null;

    // 3️⃣ Check if user exists
    const { data: existingUser, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching user:', fetchError);
      return NextResponse.json(
        { success: false, message: 'Internal server error.' },
        { status: 500 }
      );
    }

    let userId: string;

    // 4️⃣ Create or update user
    if (!existingUser) {
      const { data: newUser, error: insertError } = await supabaseAdmin
        .from('users')
        .insert([
          {
            email: normalizedEmail,
            name: normalizedName,
            role: 'visitor',
          },
        ])
        .select('id')
        .single();

      if (insertError || !newUser) {
        console.error('Error creating user:', insertError);
        return NextResponse.json(
          { success: false, message: 'Internal server error.' },
          { status: 500 }
        );
      }

      userId = newUser.id;
    } else {
      userId = existingUser.id;

      if (normalizedName) {
        await supabaseAdmin
          .from('users')
          .update({ name: normalizedName })
          .eq('id', userId);
      }
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'Internal server error.' },
        { status: 500 }
      );
    }

    // 5️⃣ Invalidate previous unused codes (security hardening)
    await supabaseAdmin
      .from('access_codes')
      .update({ is_used: true })
      .eq('user_id', userId)
      .eq('is_used', false);

    // 6️⃣ Generate new code
    const rawCode = crypto.randomInt(100000, 1000000).toString();
    const hashedCode = crypto
      .createHash('sha256')
      .update(rawCode)
      .digest('hex');

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    // 7️⃣ Store access code FIRST
    const { error: codeError } = await supabaseAdmin
      .from('access_codes')
      .insert([
        {
          user_id: userId,
          hashed_code: hashedCode,
          is_used: false,
          expires_at: expiresAt.toISOString(),
        },
      ]);

    if (codeError) {
      console.error('Error storing access code:', codeError);
      return NextResponse.json(
        { success: false, message: 'Internal server error.' },
        { status: 500 }
      );
    }

    // 8️⃣ Validate API key
    if (!process.env.RESEND_API_KEY) {
      console.error('Missing RESEND_API_KEY');
      return NextResponse.json(
        { success: false, message: 'Email service not configured.' },
        { status: 500 }
      );
    }

    const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

    // 9️⃣ Send email
    const { error: emailError } = await transporter.sendMail({
  from: `"AI Market Dashboard" <${process.env.EMAIL_USER}>`,
  to: normalizedEmail,
  subject: "Your Secure Access Code",
  html: `
    <div style="font-family: Arial; padding:20px;">
      <h2>Your secure access code</h2>
      <p>Hello ${normalizedName ?? ''},</p>
      <p>Your verification code is:</p>
      <h1 style="letter-spacing:6px;">${rawCode}</h1>
      <p>This code expires in 48 hours.</p>
    </div>
  `,
});

    if (emailError) {
      console.error('Error sending email:', emailError);
      return NextResponse.json(
        { success: false, message: 'Failed to send email.' },
        { status: 500 }
      );
    }

 return NextResponse.json({
  success: true,
  message: 'If the email exists, an access code has been sent.'
});

  } catch (error) {
    console.error('Unhandled registration error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error.' },
      { status: 500 }
    );
  }
}