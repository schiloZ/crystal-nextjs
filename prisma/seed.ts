import { prisma } from "../lib/prisma"; import bcrypt from "bcryptjs";
async function main(){
 const cie=await prisma.compagnie.upsert({where:{code:'NSIA'}, update:{}, create:{code:'NSIA', nom:'NSIA Assurances CI', ville:'Abidjan'}});
 const fil=await prisma.filiale.upsert({where:{code_compagnieId:{code:'ABJ', compagnieId:cie.id}}, update:{}, create:{code:'ABJ', nom:'NSIA CI Abidjan', compagnieId:cie.id, ville:'Abidjan'}});
 const gest=await prisma.gestionnaire.upsert({where:{code:'MEDIASSUR'}, update:{}, create:{code:'MEDIASSUR', nom:'MEDIASSUR SARL', compagnieId:cie.id}});
 const ex=await prisma.exerciceComptable.create({data:{compagnieId:cie.id, codeExercice:'2026', dateDebut:new Date('2026-01-01'), dateFin:new Date('2026-12-31')}}).catch(async()=> (await prisma.exerciceComptable.findFirst())!);
 await prisma.utilisateur.upsert({where:{email:'admin@crystal.ci'}, update:{}, create:{compagnieId:cie.id, filialeId:fil.id, nom:'LOROUGNON', prenoms:'IBO', email:'admin@crystal.ci', motDePasse:await bcrypt.hash('Crystal@2026',10), role:'super_admin'}});
 await prisma.fichierImporte.create({data:{compagnieId:cie.id, filialeId:fil.id, gestionnaireId:gest.id, exerciceId:ex.id, moisFichier:1, anneeFichier:2026, nomFichier:'soins_janvier_2026.xlsx', nbLignesTotal:12485, nbLignesValides:11238, nbLignesAnomalies:1247, nbLignesTardives:198, nbDoublons:87, montantTotalReclame:248567450, montantNetRecommande:231272450, tauxAnomalie:10.0, statut:'analyse'}}).catch(()=>{});
}
main().finally(()=>prisma.$disconnect());
