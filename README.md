# CRYSTAL — Audit de Gestion Santé

Projet Next.js + Prisma + MySQL généré à partir des maquettes CRYSTAL et du schéma MySQL fourni.

## Installation

```bash
cp .env.example .env
npm install
npx prisma generate
npx prisma db push
npm run prisma:seed
npm run dev
```

Compte de test : `admin@crystal.ci` / `Crystal@2026`.

## Modules inclus
Connexion, tableau de bord, import fichier, mapping colonnes, synthèse audit, rapports tardifs/doublons/bénéficiaires/prestataires/montants/fréquence/actes/temporel, scores risque, recommandation paiement, BI, paramètres, utilisateurs.

## SQL fourni
Les fichiers SQL originaux sont dans `database/`.
