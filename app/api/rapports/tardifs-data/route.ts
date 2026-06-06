import { NextResponse } from "next/server";
import { getAuditReport } from "@/lib/audit";

export async function GET() {
  try {
    return NextResponse.json(await getAuditReport("TEMPOREL"));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
