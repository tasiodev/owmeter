import { NextResponse } from "next/server";
import { PrismaScanRepository } from "@/infrastructure/database/repositories/PrismaScanRepository";

export async function GET() {
  const scanRepo = new PrismaScanRepository();
  const projects = await scanRepo.findPublicPerfectScoreScans(20);
  return NextResponse.json(projects);
}
