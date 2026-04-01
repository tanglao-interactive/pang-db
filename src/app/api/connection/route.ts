import { NextResponse } from "next/server";
import { handleConnectionRequest, toApiErrorResponse } from "@/lib/api-handlers";

export async function GET() {
  try {
    const result = await handleConnectionRequest();
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (error) {
    const payload = toApiErrorResponse(error);
    return NextResponse.json(payload, { status: 500 });
  }
}
