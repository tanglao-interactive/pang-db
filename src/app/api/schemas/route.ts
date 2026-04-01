import { NextResponse } from "next/server";
import { handleSchemasRequest, toApiErrorResponse } from "@/lib/api-handlers";

export async function GET() {
  try {
    const result = await handleSchemasRequest();
    return NextResponse.json(result);
  } catch (error) {
    const payload = toApiErrorResponse(error);
    return NextResponse.json(payload, { status: 500 });
  }
}
