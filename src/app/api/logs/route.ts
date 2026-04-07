import { NextRequest } from "next/server";
import { listLogDates, readLogEntries, type LogLevel } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const date = params.get("date") ?? undefined;
  const level = (params.get("level") as LogLevel) ?? undefined;
  const module = params.get("module") ?? undefined;
  const search = params.get("search") ?? undefined;
  const limit = params.get("limit") ? Number(params.get("limit")) : 500;

  const entries = readLogEntries({ date, level, module, search, limit });
  const dates = listLogDates();

  // Collect unique module names for filter dropdown
  const modules = [...new Set(entries.map((e) => e.module))].sort();

  return Response.json({ entries, dates, modules });
}
