-- CreateTable
CREATE TABLE `compagnies` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(20) NOT NULL,
    `nom` VARCHAR(200) NOT NULL,
    `adresse` TEXT NULL,
    `ville` VARCHAR(100) NULL,
    `telephone` VARCHAR(50) NULL,
    `email` VARCHAR(100) NULL,
    `actif` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `compagnies_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `filiales` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `compagnie_id` INTEGER NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `nom` VARCHAR(200) NOT NULL,
    `ville` VARCHAR(100) NULL,
    `adresse` TEXT NULL,
    `telephone` VARCHAR(50) NULL,
    `email` VARCHAR(100) NULL,
    `actif` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `filiales_code_compagnie_id_key`(`code`, `compagnie_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gestionnaires` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `compagnie_id` INTEGER NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `nom` VARCHAR(200) NOT NULL,
    `prenoms` VARCHAR(200) NULL,
    `contact` VARCHAR(150) NULL,
    `telephone` VARCHAR(50) NULL,
    `email` VARCHAR(100) NULL,
    `actif` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `gestionnaires_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exercices_comptables` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `compagnie_id` INTEGER NOT NULL,
    `code_exercice` VARCHAR(20) NOT NULL,
    `date_debut` DATE NOT NULL,
    `date_fin` DATE NOT NULL,
    `date_debut_tolerance_tardif` DATE NULL,
    `date_fin_tolerance_tardif` DATE NULL,
    `actif` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `utilisateurs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `compagnie_id` INTEGER NOT NULL,
    `filiale_id` INTEGER NULL,
    `nom` VARCHAR(100) NOT NULL,
    `prenoms` VARCHAR(150) NULL,
    `email` VARCHAR(150) NOT NULL,
    `mot_de_passe` VARCHAR(255) NOT NULL,
    `role` ENUM('super_admin', 'admin_compagnie', 'admin_filiale', 'auditeur', 'lecteur') NOT NULL DEFAULT 'auditeur',
    `actif` BOOLEAN NOT NULL DEFAULT true,
    `derniere_connexion` DATETIME(3) NULL,
    `refresh_token` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `utilisateurs_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fichiers_importes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `compagnie_id` INTEGER NOT NULL,
    `filiale_id` INTEGER NOT NULL,
    `gestionnaire_id` INTEGER NOT NULL,
    `exercice_id` INTEGER NOT NULL,
    `mois_fichier` INTEGER NOT NULL,
    `annee_fichier` INTEGER NOT NULL,
    `nom_fichier` VARCHAR(255) NOT NULL,
    `taille_fichier` BIGINT NULL,
    `nb_lignes_total` INTEGER NOT NULL DEFAULT 0,
    `nb_lignes_valides` INTEGER NOT NULL DEFAULT 0,
    `nb_lignes_anomalies` INTEGER NOT NULL DEFAULT 0,
    `nb_lignes_tardives` INTEGER NOT NULL DEFAULT 0,
    `nb_doublons` INTEGER NOT NULL DEFAULT 0,
    `montant_total_reclame` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `montant_net_recommande` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `taux_anomalie` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `statut` ENUM('importe', 'en_analyse', 'analyse', 'valide', 'rejete') NOT NULL DEFAULT 'importe',
    `date_import` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `historique_importations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `compagnie_id` INTEGER NOT NULL,
    `fichier_importe_id` INTEGER NULL,
    `nom_fichier` VARCHAR(255) NOT NULL,
    `action` VARCHAR(30) NOT NULL,
    `utilisateur_id` INTEGER NULL,
    `utilisateur_nom` VARCHAR(200) NOT NULL,
    `utilisateur_email` VARCHAR(150) NOT NULL,
    `nb_lignes_total` INTEGER NOT NULL DEFAULT 0,
    `nb_anomalies` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_hist_import_compagnie_date`(`compagnie_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `prestations` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `fichier_importe_id` INTEGER NOT NULL,
    `compagnie_id` INTEGER NOT NULL,
    `filiale_id` INTEGER NOT NULL,
    `gestionnaire_id` INTEGER NOT NULL,
    `exercice_id` INTEGER NOT NULL,
    `numero_prestation` VARCHAR(100) NULL,
    `code_souscripteur` VARCHAR(50) NULL,
    `souscripteur` VARCHAR(200) NULL,
    `date_soins` DATE NULL,
    `date_comptable` DATETIME(3) NULL,
    `code_affection` VARCHAR(50) NULL,
    `affection` VARCHAR(200) NULL,
    `code_famille_prestation` VARCHAR(50) NULL,
    `famille_prestation` VARCHAR(200) NULL,
    `code_acte` VARCHAR(50) NULL,
    `acte` VARCHAR(200) NULL,
    `code_prescripteur` VARCHAR(50) NULL,
    `prescripteur` VARCHAR(200) NULL,
    `code_prestataire` VARCHAR(50) NULL,
    `prestataire` VARCHAR(200) NULL,
    `matricule_assure_principal` VARCHAR(50) NULL,
    `nom_assure_principal` VARCHAR(150) NULL,
    `prenoms_assure_principal` VARCHAR(150) NULL,
    `matricule_beneficiaire` VARCHAR(50) NULL,
    `nom_beneficiaire` VARCHAR(150) NULL,
    `prenoms_beneficiaire` VARCHAR(150) NULL,
    `statut_beneficiaire` VARCHAR(50) NULL,
    `date_naissance_beneficiaire` DATE NULL,
    `police` VARCHAR(100) NULL,
    `police_interne` VARCHAR(100) NULL,
    `numero_college` VARCHAR(50) NULL,
    `college` VARCHAR(150) NULL,
    `montant_reclame` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `montant_exclu` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `base_remboursement` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `ticket_moderateur` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `montant_ticket_moderateur` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `montant_paye` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `code_exercice` VARCHAR(20) NULL,
    `debut_exercice` DATE NULL,
    `fin_exercice` DATE NULL,
    `mois_fichier` INTEGER NULL,
    `code_gestionnaire` VARCHAR(20) NULL,
    `code_filiale` VARCHAR(20) NULL,
    `est_valide` BOOLEAN NOT NULL DEFAULT true,
    `est_tardive` BOOLEAN NOT NULL DEFAULT false,
    `est_rejetee` BOOLEAN NOT NULL DEFAULT false,
    `nb_anomalies` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `anomalies` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `prestation_id` BIGINT NULL,
    `fichier_importe_id` INTEGER NOT NULL,
    `session_audit_id` INTEGER NULL,
    `compagnie_id` INTEGER NOT NULL,
    `filiale_id` INTEGER NOT NULL,
    `categorie` ENUM('INTEGRITE', 'BENEFICIAIRE', 'PRESTATAIRE', 'DOUBLON', 'FREQUENCE', 'MONTANT', 'ACTE', 'TEMPOREL', 'CONTRACTUEL', 'STATISTIQUE') NOT NULL,
    `code_anomalie` VARCHAR(60) NOT NULL,
    `description` TEXT NULL,
    `gravite` ENUM('critique', 'eleve', 'moyen', 'faible') NOT NULL,
    `montant_impacte` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `matricule_benef` VARCHAR(50) NULL,
    `nom_benef` VARCHAR(150) NULL,
    `date_detection` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ref_assures` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `compagnie_id` INTEGER NOT NULL,
    `matricule` VARCHAR(50) NOT NULL,
    `nom` VARCHAR(150) NOT NULL,
    `prenom` VARCHAR(150) NULL,
    `date_naissance` DATE NULL,
    `sexe` VARCHAR(10) NULL,
    `statut` VARCHAR(50) NULL,
    `date_affiliation` DATE NULL,
    `date_radiation` DATE NULL,
    `date_fin_droit` DATE NULL,
    `code_souscripteur` VARCHAR(50) NULL,
    `souscripteur` VARCHAR(200) NULL,
    `numero_groupe` VARCHAR(50) NULL,
    `matricule_assure_principal` VARCHAR(50) NULL,
    `nom_assure_principal` VARCHAR(150) NULL,
    `prenoms_assure_principal` VARCHAR(150) NULL,
    `police` VARCHAR(100) NULL,
    `police_interne` VARCHAR(100) NULL,
    `numero_college` VARCHAR(50) NULL,
    `college` VARCHAR(150) NULL,
    `actif` BOOLEAN NOT NULL DEFAULT true,

    INDEX `idx_ref_assures_cle_prestation`(`compagnie_id`, `matricule`, `police`, `police_interne`, `numero_college`, `code_souscripteur`),
    INDEX `idx_ref_assures_assure_principal`(`compagnie_id`, `matricule_assure_principal`),
    UNIQUE INDEX `ref_assures_matricule_compagnie_id_key`(`matricule`, `compagnie_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ref_prestataires` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `compagnie_id` INTEGER NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `nom` VARCHAR(200) NOT NULL,
    `statut` VARCHAR(20) NOT NULL DEFAULT 'agree',
    `actif` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `ref_prestataires_code_compagnie_id_key`(`code`, `compagnie_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ref_actes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `compagnie_id` INTEGER NOT NULL,
    `code_acte` VARCHAR(50) NOT NULL,
    `libelle` VARCHAR(200) NOT NULL,
    `famille` VARCHAR(100) NULL,
    `tarif_conventionne` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `couvert` BOOLEAN NOT NULL DEFAULT true,
    `actif` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `ref_actes_code_acte_compagnie_id_key`(`code_acte`, `compagnie_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ref_contrats` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `compagnie_id` INTEGER NOT NULL,
    `code_contrat` VARCHAR(50) NOT NULL,
    `libelle` VARCHAR(200) NOT NULL,
    `police` VARCHAR(100) NULL,
    `police_interne` VARCHAR(100) NULL,
    `code_souscripteur` VARCHAR(50) NULL,
    `souscripteur` VARCHAR(200) NULL,
    `date_debut` DATE NULL,
    `date_fin` DATE NULL,
    `actif` BOOLEAN NOT NULL DEFAULT true,

    INDEX `idx_ref_contrats_perimetre`(`compagnie_id`, `police`, `police_interne`, `code_souscripteur`),
    UNIQUE INDEX `ref_contrats_code_contrat_compagnie_id_key`(`code_contrat`, `compagnie_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ref_plafonds` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `compagnie_id` INTEGER NOT NULL,
    `contrat_id` INTEGER NULL,
    `code_plafond` VARCHAR(50) NOT NULL,
    `libelle` VARCHAR(200) NOT NULL,
    `type_plafond` VARCHAR(50) NOT NULL,
    `police` VARCHAR(100) NULL,
    `numero_college` VARCHAR(50) NULL,
    `code_acte` VARCHAR(50) NULL,
    `famille` VARCHAR(100) NULL,
    `montant_plafond` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `periodicite` VARCHAR(50) NULL,
    `actif` BOOLEAN NOT NULL DEFAULT true,

    INDEX `idx_ref_plafonds_regle`(`compagnie_id`, `police`, `numero_college`, `code_acte`, `famille`),
    UNIQUE INDEX `ref_plafonds_code_plafond_compagnie_id_key`(`code_plafond`, `compagnie_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `filiales` ADD CONSTRAINT `filiales_compagnie_id_fkey` FOREIGN KEY (`compagnie_id`) REFERENCES `compagnies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gestionnaires` ADD CONSTRAINT `gestionnaires_compagnie_id_fkey` FOREIGN KEY (`compagnie_id`) REFERENCES `compagnies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `utilisateurs` ADD CONSTRAINT `utilisateurs_compagnie_id_fkey` FOREIGN KEY (`compagnie_id`) REFERENCES `compagnies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `utilisateurs` ADD CONSTRAINT `utilisateurs_filiale_id_fkey` FOREIGN KEY (`filiale_id`) REFERENCES `filiales`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fichiers_importes` ADD CONSTRAINT `fichiers_importes_compagnie_id_fkey` FOREIGN KEY (`compagnie_id`) REFERENCES `compagnies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fichiers_importes` ADD CONSTRAINT `fichiers_importes_filiale_id_fkey` FOREIGN KEY (`filiale_id`) REFERENCES `filiales`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fichiers_importes` ADD CONSTRAINT `fichiers_importes_gestionnaire_id_fkey` FOREIGN KEY (`gestionnaire_id`) REFERENCES `gestionnaires`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fichiers_importes` ADD CONSTRAINT `fichiers_importes_exercice_id_fkey` FOREIGN KEY (`exercice_id`) REFERENCES `exercices_comptables`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prestations` ADD CONSTRAINT `prestations_fichier_importe_id_fkey` FOREIGN KEY (`fichier_importe_id`) REFERENCES `fichiers_importes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `anomalies` ADD CONSTRAINT `anomalies_fichier_importe_id_fkey` FOREIGN KEY (`fichier_importe_id`) REFERENCES `fichiers_importes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `anomalies` ADD CONSTRAINT `anomalies_prestation_id_fkey` FOREIGN KEY (`prestation_id`) REFERENCES `prestations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ref_contrats` ADD CONSTRAINT `ref_contrats_compagnie_id_fkey` FOREIGN KEY (`compagnie_id`) REFERENCES `compagnies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ref_plafonds` ADD CONSTRAINT `ref_plafonds_compagnie_id_fkey` FOREIGN KEY (`compagnie_id`) REFERENCES `compagnies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ref_plafonds` ADD CONSTRAINT `ref_plafonds_contrat_id_fkey` FOREIGN KEY (`contrat_id`) REFERENCES `ref_contrats`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

