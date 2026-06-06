import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const fichiers = await prisma.fichierImporte.count();
    const anomalies = await prisma.anomalie.count();
    const prestations = await prisma.prestation.count();
    
    const anomaliesByCategory = await prisma.anomalie.groupBy({
      by: ['categorie'],
      _count: true,
    });

    const anomaliesByGravite = await prisma.anomalie.groupBy({
      by: ['gravite'],
      _count: true,
    });

    const montantTotal = await prisma.prestation.aggregate({
      _sum: { montantReclame: true },
    });

    return NextResponse.json({
      fichiers,
      anomalies,
      prestations,
      montantTotal: montantTotal._sum.montantReclame || 0,
      byCategory: anomaliesByCategory,
      byGravite: anomaliesByGravite,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
