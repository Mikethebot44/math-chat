import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { DEFAULT_SCOUT_MODEL_ID } from "@/lib/ai/scout-models";

// Route for updating selected-model cookie because setting in an action causes a refresh
export async function POST(request: NextRequest) {
  try {
    await request.json();

    const cookieStore = await cookies();
    cookieStore.set("chat-model", DEFAULT_SCOUT_MODEL_ID, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return NextResponse.json({
      model: DEFAULT_SCOUT_MODEL_ID,
      success: true,
    });
  } catch (_error) {
    return NextResponse.json(
      { error: "Failed to set cookie" },
      { status: 500 }
    );
  }
}
