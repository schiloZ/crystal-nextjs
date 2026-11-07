import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getApiUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

type RefType = "assures" | "prestataires" | "actes" | "contrats" | "plafonds";
const titles: Record<RefType, string> = {
  assures: "Référentiel assurés",
  prestataires: "Réseau de soins",
  actes: "Nomenclature actes",
  contrats: "Contrats actifs",
  plafonds: "Plafonds contrats",
};

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) return NextResponse.json({ error: "Session expirée." }, { status: 401 });

  const url = new URL(request.url);
  const type = typeParam(url.searchParams.get("type"));
  const format = url.searchParams.get("format") === "pdf" ? "pdf" : "xlsx";
  if (!type) return NextResponse.json({ error: "Type de référentiel invalide." }, { status: 400 });

  const companyId = user.role === "super_admin" ? numberParam(url.searchParams.get("compagnie")) : Number(user.compagnieId);
  const where = companyId ? { compagnieId: companyId } : {};
  const rows = await loadRows(type, where);
  const title = titles[type];

  if (format === "pdf") {
    const buffer = createPdf(title, rows);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${type}-crystal-${dateStamp()}.pdf"`,
      },
    });
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), title.slice(0, 31));
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${type}-crystal-${dateStamp()}.xlsx"`,
    },
  });
}

async function loadRows(type: RefType, where: { compagnieId?: number }) {
  if (type === "assures") {
    const rows = await prisma.refAssure.findMany({ where, orderBy: { id: "asc" } });
    return rows.map((item) => ({
      Matricule: item.matricule,
      Nom: item.nom,
      Prénom: item.prenom ?? "",
      Statut: item.statut ?? "",
      Police: item.police ?? "",
      "Police interne": item.policeInterne ?? "",
      "N° collège": item.numeroCollege ?? "",
      Collège: item.college ?? "",
      Souscripteur: item.souscripteur ?? "",
      Actif: item.actif ? "Oui" : "Non",
    }));
  }
  if (type === "prestataires") {
    const rows = await prisma.refPrestataire.findMany({ where, orderBy: { id: "asc" } });
    return rows.map((item) => ({ Code: item.code, Prestataire: item.nom, Statut: item.statut, Actif: item.actif ? "Oui" : "Non" }));
  }
  if (type === "actes") {
    const rows = await prisma.refActe.findMany({ where, orderBy: { id: "asc" } });
    return rows.map((item) => ({
      "Code acte": item.codeActe,
      Libellé: item.libelle,
      Famille: item.famille ?? "",
      "Tarif conventionné": Number(item.tarifConventionne),
      Couvert: item.couvert ? "Oui" : "Non",
      Actif: item.actif ? "Oui" : "Non",
    }));
  }
  if (type === "contrats") {
    const rows = await prisma.refContrat.findMany({ where, orderBy: { id: "asc" } });
    return rows.map((item) => ({
      "Code contrat": item.codeContrat,
      Libellé: item.libelle,
      Police: item.police ?? "",
      "Police interne": item.policeInterne ?? "",
      "Code souscripteur": item.codeSouscripteur ?? "",
      Souscripteur: item.souscripteur ?? "",
      Actif: item.actif ? "Oui" : "Non",
    }));
  }
  const rows = await prisma.refPlafond.findMany({ where, include: { contrat: true }, orderBy: { id: "asc" } });
  return rows.map((item) => ({
    "Code plafond": item.codePlafond,
    Libellé: item.libelle,
    Type: item.typePlafond,
    Police: item.police ?? item.contrat?.police ?? "",
    "N° collège": item.numeroCollege ?? "",
    "Code acte": item.codeActe ?? "",
    Famille: item.famille ?? "",
    "Montant plafond": Number(item.montantPlafond),
    Périodicité: item.periodicite ?? "",
    Actif: item.actif ? "Oui" : "Non",
  }));
}

function createPdf(title: string, rows: Record<string, unknown>[]) {
  const lines = [title, `Généré le ${new Date().toLocaleDateString("fr-FR")}`, `Nombre: ${rows.length}`, ""];
  const headers = Object.keys(rows[0] ?? { Liste: "Aucune donnée" });
  lines.push(headers.join(" | "));
  lines.push("-".repeat(100));
  for (const row of rows.slice(0, 240)) lines.push(headers.map((header) => String(row[header] ?? "")).join(" | "));
  if (rows.length > 240) lines.push(`... ${rows.length - 240} ligne(s) supplémentaires dans l'export Excel.`);

  const chunks = chunkLines(lines, 42);
  const fontId = 3 + chunks.length * 2;
  const pageKids = chunks.map((_, index) => `${3 + index * 2} 0 R`);
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageKids.join(" ")}] /Count ${chunks.length} >>`,
  ];
  chunks.forEach((chunk, index) => {
    const pageId = 3 + index * 2;
    const contentId = pageId + 1;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    const stream = textStream(chunk);
    objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  });
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  const body: string[] = ["%PDF-1.4"];
  const offsets: number[] = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(body.join("\n") + "\n"));
    body.push(`${index + 1} 0 obj\n${objects[index]}\nendobj`);
  }
  const xrefOffset = Buffer.byteLength(body.join("\n") + "\n");
  body.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f `);
  for (const offset of offsets.slice(1)) body.push(`${String(offset).padStart(10, "0")} 00000 n `);
  body.push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  return Buffer.from(body.join("\n"), "utf8");
}

function textStream(lines: string[]) {
  return `BT\n/F1 8 Tf\n36 560 Td\n${lines.map((line, index) => `${index ? "0 -12 Td\n" : ""}(${pdfEscape(asciiPdfText(line).slice(0, 170))}) Tj`).join("\n")}\nET`;
}

function chunkLines(lines: string[], size: number) {
  const chunks: string[][] = [];
  for (let index = 0; index < lines.length; index += size) chunks.push(lines.slice(index, index + size));
  return chunks.length ? chunks : [["Aucune donnée."]];
}

function pdfEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function asciiPdfText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, " ");
}

function typeParam(value: string | null): RefType | null {
  return ["assures", "prestataires", "actes", "contrats", "plafonds"].includes(value ?? "") ? value as RefType : null;
}

function numberParam(value: string | null) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}
