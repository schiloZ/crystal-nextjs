# CRYSTAL — Audit de Gestion Santé

Projet Next.js + Prisma + MySQL généré à partir des maquettes CRYSTAL et du schéma MySQL fourni.

## Installation

```bash
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate deploy
SEED_ADMIN_EMAIL=vous@exemple.ci SEED_ADMIN_PASSWORD='MotDePasseFort2026' npm run prisma:seed
npm run dev
```

Le seed crée des données de démonstration et un compte `super_admin` avec les identifiants fournis par l'environnement. Il refuse de s'exécuter si `NODE_ENV=production`. Aucun identifiant n'est stocké dans le dépôt.

Générez un `NEXTAUTH_SECRET` propre à chaque environnement : `openssl rand -base64 32`.

## Modules inclus
Connexion, tableau de bord, import fichier, mapping colonnes, synthèse audit, rapports tardifs/doublons/bénéficiaires/prestataires/montants/fréquence/actes/temporel, scores risque, recommandation paiement, BI, paramètres, utilisateurs.

## SQL fourni
Les fichiers SQL originaux sont dans `database/`.

## Migrations de base

Le schéma est versionné dans `prisma/migrations`. En production, appliquer les migrations avec `npm run prisma:migrate` (jamais `db push`).

Pour une base existante créée avant les migrations, marquer une seule fois la migration initiale comme appliquée :

```bash
npx prisma migrate resolve --applied 0_init
```
