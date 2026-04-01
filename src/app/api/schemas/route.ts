import { NextResponse } from "next/server";
import { handleSchemasRequest } from "@/lib/api-handlers";

export async function GET() {
  const result = await handleSchemasRequest();
  return NextResponse.json(result);
}
