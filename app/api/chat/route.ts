import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { sessionId, role, content } = await req.json();
  //TODO: Add payload validation
  const msg = await prisma.chatMessage.create({
    data: { sessionId, role, content },
  });
  return NextResponse.json(msg);
}
