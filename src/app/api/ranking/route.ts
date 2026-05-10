import { NextResponse } from "next/server";
import { PrismaScanRepository } from "@/infrastructure/database/repositories/PrismaScanRepository";

export async function GET() {
  const repo = new PrismaScanRepository();
  const ranking = await repo.findRanking(50);
  return NextResponse.json(ranking);
}
