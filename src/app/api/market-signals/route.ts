import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const from = searchParams.get('from');
    const to = searchParams.get('to');

    let query = supabaseAdmin
      .from('market_signals')
      .select('*')
      .order('week_start', { ascending: true });

    // 🔥 Convertimos fechas a ISO completas
    if (from) {
      const fromISO = new Date(from + 'T00:00:00.000Z').toISOString();
      query = query.gte('week_start', fromISO);
    }

    if (to) {
      const toISO = new Date(to + 'T23:59:59.999Z').toISOString();
      query = query.lte('week_start', toISO);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Market signals fetch error:', error);
      return NextResponse.json(
        { success: false },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });

  } catch (err) {
    console.error('Unhandled market signals error:', err);
    return NextResponse.json(
      { success: false },
      { status: 500 }
    );
  }
}