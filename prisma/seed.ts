import { prisma } from "../lib/prisma";
import { hashPassword, passwordSchema } from "../lib/password";

// Données de démonstration : à ne jamais exécuter en production.
// Identifiants fournis par l'environnement, jamais écrits dans le dépôt :
//   SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... npm run prisma:seed
async function main(){
 if (process.env.NODE_ENV === "production") throw new Error("Le seed de démonstration est interdit en production.");
 const adminEmail = String(process.env.SEED_ADMIN_EMAIL || "").trim().toLowerCase();
 const adminPassword = process.env.SEED_ADMIN_PASSWORD;
 if (!adminEmail || !adminPassword) throw new Error("Définissez SEED_ADMIN_EMAIL et SEED_ADMIN_PASSWORD avant de lancer le seed.");
 passwordSchema.parse(adminPassword);
 const cie=await prisma.compagnie.upsert({where:{code:'NSIA'}, update:{}, create:{code:'NSIA', nom:'NSIA Assurances CI', ville:'Abidjan'}});
 const fil=await prisma.filiale.upsert({where:{code_compagnieId:{code:'ABJ', compagnieId:cie.id}}, update:{}, create:{code:'ABJ', nom:'NSIA CI Abidjan', compagnieId:cie.id, ville:'Abidjan'}});
 const gest=await prisma.gestionnaire.upsert({where:{code:'MEDIASSUR'}, update:{}, create:{code:'MEDIASSUR', nom:'MEDIASSUR SARL', compagnieId:cie.id}});
 const ex=await prisma.exerciceComptable.create({data:{compagnieId:cie.id, codeExercice:'2026', dateDebut:new Date('2026-01-01'), dateFin:new Date('2026-12-31')}}).catch(async()=> (await prisma.exerciceComptable.findFirst())!);
 await prisma.utilisateur.upsert({where:{email:adminEmail}, update:{}, create:{compagnieId:cie.id, filialeId:fil.id, nom:'LOROUGNON', prenoms:'IBO', email:adminEmail, motDePasse:await hashPassword(adminPassword), role:'super_admin'}});
 await prisma.fichierImporte.create({data:{compagnieId:cie.id, filialeId:fil.id, gestionnaireId:gest.id, exerciceId:ex.id, moisFichier:1, anneeFichier:2026, nomFichier:'soins_janvier_2026.xlsx', nbLignesTotal:12485, nbLignesValides:11238, nbLignesAnomalies:1247, nbLignesTardives:198, nbDoublons:87, montantTotalReclame:248567450, montantNetRecommande:231272450, tauxAnomalie:10.0, statut:'analyse'}}).catch(()=>{});
}
main().finally(()=>prisma.$disconnect());
