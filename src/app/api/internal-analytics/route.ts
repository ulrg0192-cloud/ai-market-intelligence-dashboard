import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const { count: totalUsers } = await supabaseAdmin
      .from("users")
      .select("*", { count: "exact", head: true });

    const { count: totalSessions } = await supabaseAdmin
      .from("sessions")
      .select("*", { count: "exact", head: true });

    const { count: failedAttempts } = await supabaseAdmin
      .from("login_attempts")
      .select("*", { count: "exact", head: true })
      .eq("success", false);

    return NextResponse.json({
      totalUsers: totalUsers || 0,
      totalSessions: totalSessions || 0,
      failedAttempts: failedAttempts || 0,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}