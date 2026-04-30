import { NextResponse } from 'next/server';
import googleTrends from 'google-trends-api';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const KEYWORDS = [
  'CRM',
  'ERP',
  'Artificial Intelligence',
  'Cloud computing',
  'Cybersecurity',
  'SaaS'
];

const COUNTRIES = ['MX', 'BR', 'AR', 'CO', 'CL'];

export async function GET() {
  try {
    for (const country of COUNTRIES) {
      for (const keyword of KEYWORDS) {
        const results = await googleTrends.interestOverTime({
          keyword,
          geo: country,
          timeframe: 'today 3-m',
        });

        const parsed = JSON.parse(results);
        const timeline = parsed.default.timelineData;

        for (const point of timeline) {
          await supabaseAdmin.from('market_signals').insert([
            {
              keyword,
              country,
              interest: point.value[0],
              week_start: new Date(Number(point.time) * 1000)
                .toISOString()
                .split('T')[0],
            },
          ]);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Trends error:', error);
    return NextResponse.json(
      { success: false },
      { status: 500 }
    );
  }
}