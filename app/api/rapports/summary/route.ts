import { NextResponse } from "next/server";
import { CategorieAnomalie } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Anomalies by category with stats
    const categories: CategorieAnomalie[] = ['DOUBLON', 'FREQUENCE', 'MONTANT', 'ACTE', 'TEMPOREL', 'PRESTATAIRE', 'INTEGRITE', 'CONTRACTUEL', 'STATISTIQUE'];
    const anomalyWhere = (cat: CategorieAnomalie) => cat === "DOUBLON" ? { categorie: cat, codeAnomalie: { not: "DOUBLON_STRICT" } } : { categorie: cat };
    
    const stats = await Promise.all(
      categories.map(async (cat) => {
        const where = anomalyWhere(cat);
        const [count, montant, gravites] = await Promise.all([
          prisma.anomalie.count({ where }),
          prisma.anomalie.aggregate({
            where,
            _sum: { montantImpacte: true },
          }),
          prisma.anomalie.groupBy({
            by: ['gravite'],
            where,
            _count: true,
          }),
        ]);
        
        return {
          categorie: cat,
          count,
          montantImpacte: montant._sum.montantImpacte || 0,
          byGravite: gravites.reduce((acc, g) => ({ ...acc, [g.gravite]: g._count }), {}),
        };
      })
    );

    // Top providers with issues
    const providersWithIssues = await prisma.prestation.groupBy({
      by: ['codePrestataire', 'prestataire'],
      _count: true,
      _sum: { montantReclame: true },
      orderBy: [{ _count: { id: 'desc' } }],
      take: 10,
    });

    return NextResponse.json({
      stats,
      providersWithIssues,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
