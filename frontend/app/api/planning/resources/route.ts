import { NextResponse } from "next/server";
import { listResources } from "@/lib/actions/resources";

export async function GET() {
  const result = await listResources();
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json(result.data ?? []);
}
