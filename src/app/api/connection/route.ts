import { NextResponse } from "next/server";
import { handleConnectionRequest } from "@/lib/api-handlers";

export async function GET() {
  const result = await handleConnectionRequest();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
