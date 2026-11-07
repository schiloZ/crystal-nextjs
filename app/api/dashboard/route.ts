import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getApiUser();
    if (!user) return NextResponse.json({ error: "Session expirée." }, { status: 401 });
    const scope = user.role === "super_admin" ? {} : { compagnieId: Number(user.compagnieId) };
    const files = await prisma.fichierImporte.findMany({ where: scope, select: { id: true } });
    const fileIds = files.map((file) => file.id);
    const prestationWhere = { fichierImporteId: fileIds.length ? { in: fileIds } : { in: [-1] } };
    const anomalyWhere = { fichierImporteId: fileIds.length ? { in: fileIds } : { in: [-1] }, codeAnomalie: { not: "DOUBLON_STRICT" } };
    const [fichiers, anomalies, prestations, montant] = await Promise.all([
      prisma.fichierImporte.count({ where: scope }),
      prisma.anomalie.count({ where: anomalyWhere }),
      prisma.prestation.count({ where: prestationWhere }),
      prisma.prestation.aggregate({ where: prestationWhere, _sum: { montantReclame: true } }),
    ]);

    return NextResponse.json({
      fichiers,
      anomalies,
      prestations,
      montantTotal: Number(montant._sum.montantReclame ?? 0),
    });
  } catch {
    return NextResponse.json({
      fichiers: 0,
      anomalies: 0,
      prestations: 0,
      montantTotal: 0,
    });
  }
}
