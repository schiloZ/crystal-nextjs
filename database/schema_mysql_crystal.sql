-- =============================================================
-- CRYSTAL v2 — Schéma MySQL 8.0+
-- Base de données complète : tables, index, triggers
-- ARIEL INDUSTRIES SARL — 2026
-- =============================================================
-- MySQL choisi pour : simplicité hébergement (PlanetScale,
-- Railway, TiDB Cloud, IONOS, OVH), écosystème mature,
-- support complet CTEs et window functions en 8.0+
-- =============================================================

CREATE DATABASE IF NOT EXISTS crystal
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE crystal;

SET FOREIGN_KEY_CHECKS = 0;
SET sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO';

-- =============================================================
-- 1. COMPAGNIES
-- =============================================================
CREATE TABLE IF NOT EXISTS compagnies (
    id          INT           NOT NULL AUTO_INCREMENT,
    code        VARCHAR(20)   NOT NULL,
    nom         VARCHAR(200)  NOT NULL,
    adresse     TEXT,
    ville       VARCHAR(100),
    telephone   VARCHAR(50),
    email       VARCHAR(100),
    actif       TINYINT(1)    NOT NULL DEFAULT 1,
    created_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uk_compagnies_code UNIQUE (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- 2. FILIALES
-- =============================================================
CREATE TABLE IF NOT EXISTS filiales (
    id              INT           NOT NULL AUTO_INCREMENT,
    compagnie_id    INT           NOT NULL,
    code            VARCHAR(20)   NOT NULL,
    nom             VARCHAR(200)  NOT NULL,
    ville           VARCHAR(100),
    adresse         TEXT,
    telephone       VARCHAR(50),
    email           VARCHAR(100),
    actif           TINYINT(1)    NOT NULL DEFAULT 1,
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uk_filiales_code_cie UNIQUE (code, compagnie_id),
    CONSTRAINT fk_filiales_cie FOREIGN KEY (compagnie_id)
        REFERENCES compagnies(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_filiales_cie ON filiales(compagnie_id);

-- =============================================================
-- 3. GESTIONNAIRES
-- =============================================================
CREATE TABLE IF NOT EXISTS gestionnaires (
    id              INT           NOT NULL AUTO_INCREMENT,
    compagnie_id    INT           NOT NULL,
    code            VARCHAR(20)   NOT NULL,
    nom             VARCHAR(200)  NOT NULL,
    contact         VARCHAR(150),
    telephone       VARCHAR(50),
    email           VARCHAR(100),
    actif           TINYINT(1)    NOT NULL DEFAULT 1,
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uk_gest_code UNIQUE (code),
    CONSTRAINT fk_gest_cie FOREIGN KEY (compagnie_id)
        REFERENCES compagnies(id) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_gest_cie ON gestionnaires(compagnie_id);

-- =============================================================
-- 4. EXERCICES COMPTABLES
-- =============================================================
CREATE TABLE IF NOT EXISTS exercices_comptables (
    id              INT           NOT NULL AUTO_INCREMENT,
    compagnie_id    INT           NOT NULL,
    code_exercice   VARCHAR(20)   NOT NULL,
    libelle         VARCHAR(100),
    date_debut      DATE          NOT NULL,
    date_fin        DATE          NOT NULL,
    actif           TINYINT(1)    NOT NULL DEFAULT 1,
    clos            TINYINT(1)    NOT NULL DEFAULT 0,
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uk_exercice_cie UNIQUE (code_exercice, compagnie_id),
    CONSTRAINT fk_exercice_cie FOREIGN KEY (compagnie_id)
        REFERENCES compagnies(id) ON UPDATE CASCADE,
    CONSTRAINT chk_exercice_dates CHECK (date_fin > date_debut)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_exercices_cie ON exercices_comptables(compagnie_id);

-- =============================================================
-- 5. UTILISATEURS
-- =============================================================
CREATE TABLE IF NOT EXISTS utilisateurs (
    id                  INT           NOT NULL AUTO_INCREMENT,
    compagnie_id        INT           NOT NULL,
    filiale_id          INT,
    nom                 VARCHAR(100)  NOT NULL,
    prenoms             VARCHAR(150),
    email               VARCHAR(150)  NOT NULL,
    mot_de_passe        VARCHAR(255)  NOT NULL COMMENT 'bcrypt hash',
    role                ENUM('super_admin','admin_compagnie','admin_filiale','auditeur','lecteur')
                        NOT NULL DEFAULT 'auditeur',
    actif               TINYINT(1)    NOT NULL DEFAULT 1,
    derniere_connexion  DATETIME,
    refresh_token       TEXT,
    created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uk_users_email UNIQUE (email),
    CONSTRAINT fk_users_cie FOREIGN KEY (compagnie_id)
        REFERENCES compagnies(id) ON UPDATE CASCADE,
    CONSTRAINT fk_users_filiale FOREIGN KEY (filiale_id)
        REFERENCES filiales(id) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_users_cie     ON utilisateurs(compagnie_id);
CREATE INDEX idx_users_filiale ON utilisateurs(filiale_id);

-- =============================================================
-- 6. FICHIERS IMPORTES
-- =============================================================
CREATE TABLE IF NOT EXISTS fichiers_importes (
    id                      INT               NOT NULL AUTO_INCREMENT,
    compagnie_id            INT               NOT NULL,
    filiale_id              INT               NOT NULL,
    gestionnaire_id         INT               NOT NULL,
    exercice_id             INT               NOT NULL,
    mois_fichier            TINYINT UNSIGNED  NOT NULL COMMENT '1-12',
    annee_fichier           SMALLINT UNSIGNED NOT NULL,
    nom_fichier             VARCHAR(255)      NOT NULL,
    taille_fichier          BIGINT UNSIGNED,
    -- Statistiques post-analyse
    nb_lignes_total         INT               NOT NULL DEFAULT 0,
    nb_lignes_valides       INT               NOT NULL DEFAULT 0,
    nb_lignes_anomalies     INT               NOT NULL DEFAULT 0,
    nb_lignes_tardives      INT               NOT NULL DEFAULT 0,
    nb_doublons             INT               NOT NULL DEFAULT 0,
    montant_total_reclame   DECIMAL(15,2)     NOT NULL DEFAULT 0.00,
    montant_total_paye      DECIMAL(15,2)     NOT NULL DEFAULT 0.00,
    montant_total_exclu     DECIMAL(15,2)     NOT NULL DEFAULT 0.00,
    montant_anomalies       DECIMAL(15,2)     NOT NULL DEFAULT 0.00,
    montant_net_recommande  DECIMAL(15,2)     NOT NULL DEFAULT 0.00,
    taux_anomalie           DECIMAL(5,2)      NOT NULL DEFAULT 0.00,
    -- Statut
    statut                  ENUM('importe','en_analyse','analyse','valide','rejete')
                            NOT NULL DEFAULT 'importe',
    date_import             DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    date_analyse            DATETIME,
    import_par              INT,
    notes                   TEXT,
    created_at              DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT chk_fi_mois CHECK (mois_fichier BETWEEN 1 AND 12),
    CONSTRAINT fk_fi_cie      FOREIGN KEY (compagnie_id)   REFERENCES compagnies(id),
    CONSTRAINT fk_fi_filiale  FOREIGN KEY (filiale_id)     REFERENCES filiales(id),
    CONSTRAINT fk_fi_gest     FOREIGN KEY (gestionnaire_id) REFERENCES gestionnaires(id),
    CONSTRAINT fk_fi_exercice FOREIGN KEY (exercice_id)    REFERENCES exercices_comptables(id),
    CONSTRAINT fk_fi_user     FOREIGN KEY (import_par)     REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_fi_cie        ON fichiers_importes(compagnie_id);
CREATE INDEX idx_fi_filiale    ON fichiers_importes(filiale_id);
CREATE INDEX idx_fi_gest       ON fichiers_importes(gestionnaire_id);
CREATE INDEX idx_fi_exercice   ON fichiers_importes(exercice_id);
CREATE INDEX idx_fi_mois_annee ON fichiers_importes(annee_fichier, mois_fichier);
CREATE INDEX idx_fi_statut     ON fichiers_importes(statut);

-- =============================================================
-- 7. SESSIONS D'AUDIT (mono-mois OU multi-mois)
-- =============================================================
CREATE TABLE IF NOT EXISTS sessions_audit (
    id              INT           NOT NULL AUTO_INCREMENT,
    compagnie_id    INT           NOT NULL,
    filiale_id      INT           NOT NULL,
    exercice_id     INT           NOT NULL,
    gestionnaire_id INT           COMMENT 'NULL = tous les gestionnaires',
    libelle         VARCHAR(200),
    mois_debut      TINYINT UNSIGNED,
    mois_fin        TINYINT UNSIGNED,
    annee_fichier   SMALLINT UNSIGNED,
    type_session    ENUM('mono_mois','multi_mois','exercice_complet')
                    NOT NULL DEFAULT 'mono_mois',
    statut          ENUM('en_cours','complete','archivee')
                    NOT NULL DEFAULT 'en_cours',
    nb_fichiers     INT           NOT NULL DEFAULT 0,
    nb_anomalies    INT           NOT NULL DEFAULT 0,
    montant_total   DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    cree_par        INT,
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_sa_cie   FOREIGN KEY (compagnie_id)   REFERENCES compagnies(id),
    CONSTRAINT fk_sa_fil   FOREIGN KEY (filiale_id)     REFERENCES filiales(id),
    CONSTRAINT fk_sa_ex    FOREIGN KEY (exercice_id)    REFERENCES exercices_comptables(id),
    CONSTRAINT fk_sa_gest  FOREIGN KEY (gestionnaire_id) REFERENCES gestionnaires(id) ON DELETE SET NULL,
    CONSTRAINT fk_sa_user  FOREIGN KEY (cree_par)       REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_sa_cie     ON sessions_audit(compagnie_id);
CREATE INDEX idx_sa_filiale ON sessions_audit(filiale_id);
CREATE INDEX idx_sa_exercice ON sessions_audit(exercice_id);

-- Liaison session <-> fichiers (N-N)
CREATE TABLE IF NOT EXISTS sessions_audit_fichiers (
    session_id          INT           NOT NULL,
    fichier_importe_id  INT           NOT NULL,
    ordre_analyse       TINYINT       NOT NULL DEFAULT 1 COMMENT 'Ordre chronologique',
    PRIMARY KEY (session_id, fichier_importe_id),
    CONSTRAINT fk_saf_session  FOREIGN KEY (session_id)         REFERENCES sessions_audit(id) ON DELETE CASCADE,
    CONSTRAINT fk_saf_fichier  FOREIGN KEY (fichier_importe_id) REFERENCES fichiers_importes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_saf_fichier ON sessions_audit_fichiers(fichier_importe_id);

-- =============================================================
-- 8. PRESTATIONS — TABLE CENTRALE (38 colonnes source + enrichissements)
-- =============================================================
CREATE TABLE IF NOT EXISTS prestations (
    -- Clés
    id                              BIGINT        NOT NULL AUTO_INCREMENT,
    fichier_importe_id              INT           NOT NULL,
    compagnie_id                    INT           NOT NULL,
    filiale_id                      INT           NOT NULL,
    gestionnaire_id                 INT           NOT NULL,
    exercice_id                     INT           NOT NULL,

    -- [G1] Identification
    numero_prestation               VARCHAR(100),

    -- [G2] Souscripteur
    code_souscripteur               VARCHAR(50),
    souscripteur                    VARCHAR(200),

    -- [G3] Dates
    date_soins                      DATE,
    date_comptable                  DATE,

    -- [G4] Affection / Famille / Acte
    code_affection                  VARCHAR(50),
    affection                       VARCHAR(200),
    code_famille_prestation         VARCHAR(50),
    famille_prestation              VARCHAR(100),
    code_acte                       VARCHAR(50),
    acte                            VARCHAR(200),

    -- [G5] Prescripteur
    code_prescripteur               VARCHAR(50),
    prescripteur                    VARCHAR(200),

    -- [G6] Prestataire
    code_prestataire                VARCHAR(50),
    prestataire                     VARCHAR(200),

    -- [G7] Assuré principal
    matricule_assure_principal      VARCHAR(50),
    nom_assure_principal            VARCHAR(150),
    prenoms_assure_principal        VARCHAR(150),

    -- [G8] Bénéficiaire
    matricule_beneficiaire          VARCHAR(50),
    nom_beneficiaire                VARCHAR(150),
    statut_beneficiaire             VARCHAR(50),
    date_naissance_beneficiaire     DATE,

    -- [G9] Police / Collège
    police                          VARCHAR(50),
    police_interne                  VARCHAR(50),
    numero_college                  VARCHAR(50),
    college                         VARCHAR(200),

    -- [G10] Montants
    montant_reclame                 DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    montant_exclu                   DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    base_remboursement              DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    ticket_moderateur               DECIMAL(6,2)  NOT NULL DEFAULT 0.00 COMMENT 'Taux en %',
    montant_ticket_moderateur       DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    montant_paye                    DECIMAL(15,2) NOT NULL DEFAULT 0.00,

    -- [G11] Exercice et période (depuis le fichier source)
    code_exercice                   VARCHAR(20),
    date_debut_exercice             DATE,
    date_fin_exercice               DATE,
    mois_fichier                    TINYINT UNSIGNED,
    annee_fichier                   SMALLINT UNSIGNED,

    -- [G12] Codes gestionnaire et filiale (depuis le fichier source)
    code_gestionnaire               VARCHAR(50),
    code_filiale                    VARCHAR(50),

    -- Flags d'audit
    est_valide                      TINYINT(1)    NOT NULL DEFAULT 1,
    est_tardive                     TINYINT(1)    NOT NULL DEFAULT 0,
    est_rejetee                     TINYINT(1)    NOT NULL DEFAULT 0,
    nb_anomalies                    INT           NOT NULL DEFAULT 0,

    created_at                      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    CONSTRAINT fk_prest_fichier  FOREIGN KEY (fichier_importe_id) REFERENCES fichiers_importes(id),
    CONSTRAINT fk_prest_cie      FOREIGN KEY (compagnie_id)       REFERENCES compagnies(id),
    CONSTRAINT fk_prest_filiale  FOREIGN KEY (filiale_id)         REFERENCES filiales(id),
    CONSTRAINT fk_prest_gest     FOREIGN KEY (gestionnaire_id)    REFERENCES gestionnaires(id),
    CONSTRAINT fk_prest_exercice FOREIGN KEY (exercice_id)        REFERENCES exercices_comptables(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  ROW_FORMAT=COMPRESSED;

-- Index essentiels
CREATE INDEX idx_prest_fichier     ON prestations(fichier_importe_id);
CREATE INDEX idx_prest_cie         ON prestations(compagnie_id);
CREATE INDEX idx_prest_filiale     ON prestations(filiale_id);
CREATE INDEX idx_prest_gest        ON prestations(gestionnaire_id);
CREATE INDEX idx_prest_mat_benef   ON prestations(matricule_beneficiaire);
CREATE INDEX idx_prest_mat_assure  ON prestations(matricule_assure_principal);
CREATE INDEX idx_prest_code_prest  ON prestations(code_prestataire);
CREATE INDEX idx_prest_date_soins  ON prestations(date_soins);
CREATE INDEX idx_prest_num_prest   ON prestations(numero_prestation);
CREATE INDEX idx_prest_code_acte   ON prestations(code_acte);
CREATE INDEX idx_prest_famille     ON prestations(code_famille_prestation);
CREATE INDEX idx_prest_police      ON prestations(police);
CREATE INDEX idx_prest_college     ON prestations(numero_college);
CREATE INDEX idx_prest_mois_annee  ON prestations(annee_fichier, mois_fichier);
-- Index composites critiques
CREATE INDEX idx_prest_police_col  ON prestations(compagnie_id, police, numero_college);
CREATE INDEX idx_prest_doublon     ON prestations(matricule_beneficiaire, date_soins, code_acte, code_prestataire, montant_paye);
CREATE INDEX idx_prest_freq        ON prestations(fichier_importe_id, matricule_beneficiaire, code_famille_prestation, annee_fichier, mois_fichier);

-- =============================================================
-- 9. ANOMALIES
-- =============================================================
CREATE TABLE IF NOT EXISTS anomalies (
    id                  BIGINT        NOT NULL AUTO_INCREMENT,
    prestation_id       BIGINT        COMMENT 'NULL si anomalie globale (ex: Benford)',
    fichier_importe_id  INT           NOT NULL,
    session_audit_id    INT,
    compagnie_id        INT           NOT NULL,
    filiale_id          INT           NOT NULL,
    -- Classification
    categorie           ENUM('INTEGRITE','BENEFICIAIRE','PRESTATAIRE','DOUBLON',
                             'FREQUENCE','MONTANT','ACTE','TEMPOREL',
                             'CONTRACTUEL','STATISTIQUE') NOT NULL,
    code_anomalie       VARCHAR(60)   NOT NULL,
    description         TEXT,
    gravite             ENUM('critique','eleve','moyen','faible') NOT NULL,
    montant_impacte     DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    -- Traçabilité bénéficiaire
    matricule_assure    VARCHAR(50),
    nom_assure          VARCHAR(150),
    prenoms_assure      VARCHAR(150),
    matricule_benef     VARCHAR(50),
    nom_benef           VARCHAR(150),
    -- Police / Collège
    police              VARCHAR(50),
    numero_college      VARCHAR(50),
    -- Valeurs comparées
    valeur_observee     TEXT,
    valeur_attendue     TEXT,
    detail_json         JSON          COMMENT 'Détails spécifiques en JSON',
    -- Ref doublon inter-mois
    fichier_source_id   INT,
    date_detection      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_anom_fichier  FOREIGN KEY (fichier_importe_id) REFERENCES fichiers_importes(id),
    CONSTRAINT fk_anom_session  FOREIGN KEY (session_audit_id)   REFERENCES sessions_audit(id) ON DELETE SET NULL,
    CONSTRAINT fk_anom_prest    FOREIGN KEY (prestation_id)      REFERENCES prestations(id) ON DELETE SET NULL,
    CONSTRAINT fk_anom_cie      FOREIGN KEY (compagnie_id)       REFERENCES compagnies(id),
    CONSTRAINT fk_anom_filiale  FOREIGN KEY (filiale_id)         REFERENCES filiales(id),
    CONSTRAINT fk_anom_src      FOREIGN KEY (fichier_source_id)  REFERENCES fichiers_importes(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_anom_fichier  ON anomalies(fichier_importe_id);
CREATE INDEX idx_anom_session  ON anomalies(session_audit_id);
CREATE INDEX idx_anom_prest    ON anomalies(prestation_id);
CREATE INDEX idx_anom_categ    ON anomalies(categorie);
CREATE INDEX idx_anom_gravite  ON anomalies(gravite);
CREATE INDEX idx_anom_cie      ON anomalies(compagnie_id);
CREATE INDEX idx_anom_benef    ON anomalies(matricule_benef);

-- =============================================================
-- 10. REF_ASSURES
-- =============================================================
CREATE TABLE IF NOT EXISTS ref_assures (
    id                  INT           NOT NULL AUTO_INCREMENT,
    compagnie_id        INT           NOT NULL,
    filiale_id          INT,
    matricule           VARCHAR(50)   NOT NULL,
    nom                 VARCHAR(150)  NOT NULL,
    prenom              VARCHAR(150),
    date_naissance      DATE,
    sexe                ENUM('M','F') COMMENT 'M=Masculin, F=Féminin',
    statut              ENUM('principal','ayant_droit','conjoint','enfant'),
    date_affiliation    DATE,
    date_radiation      DATE,
    police              VARCHAR(50),
    numero_college      VARCHAR(50),
    college             VARCHAR(200),
    actif               TINYINT(1)    NOT NULL DEFAULT 1,
    created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uk_assure_mat UNIQUE (matricule, compagnie_id),
    CONSTRAINT fk_ra_cie FOREIGN KEY (compagnie_id) REFERENCES compagnies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_ra_matricule  ON ref_assures(matricule, compagnie_id);
CREATE INDEX idx_ra_police_col ON ref_assures(compagnie_id, police, numero_college);

-- =============================================================
-- 11. REF_PRESTATAIRES
-- =============================================================
CREATE TABLE IF NOT EXISTS ref_prestataires (
    id                  INT           NOT NULL AUTO_INCREMENT,
    compagnie_id        INT           NOT NULL,
    code                VARCHAR(50)   NOT NULL,
    nom                 VARCHAR(200)  NOT NULL,
    type_prestataire    VARCHAR(50),
    zone                VARCHAR(100),
    ville               VARCHAR(100),
    statut              ENUM('agree','radie','suspendu','en_attente') NOT NULL DEFAULT 'agree',
    date_agrement       DATE,
    date_radiation      DATE,
    actif               TINYINT(1)    NOT NULL DEFAULT 1,
    created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uk_prest_code UNIQUE (code, compagnie_id),
    CONSTRAINT fk_rpr_cie FOREIGN KEY (compagnie_id) REFERENCES compagnies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_rpr_code ON ref_prestataires(code, compagnie_id);

-- =============================================================
-- 12. REF_PRESCRIPTEURS
-- =============================================================
CREATE TABLE IF NOT EXISTS ref_prescripteurs (
    id                      INT           NOT NULL AUTO_INCREMENT,
    compagnie_id            INT           NOT NULL,
    code                    VARCHAR(50)   NOT NULL,
    nom                     VARCHAR(200)  NOT NULL,
    specialite              VARCHAR(100),
    familles_autorisees     JSON          COMMENT 'Ex: ["CONSULTATION","PHARMACIE"]',
    actif                   TINYINT(1)    NOT NULL DEFAULT 1,
    created_at              DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uk_prescr_code UNIQUE (code, compagnie_id),
    CONSTRAINT fk_rpsc_cie FOREIGN KEY (compagnie_id) REFERENCES compagnies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- 13. REF_ACTES
-- =============================================================
CREATE TABLE IF NOT EXISTS ref_actes (
    id                          INT           NOT NULL AUTO_INCREMENT,
    compagnie_id                INT           NOT NULL,
    code_acte                   VARCHAR(50)   NOT NULL,
    libelle                     VARCHAR(200)  NOT NULL,
    code_famille                VARCHAR(50),
    famille                     VARCHAR(100),
    tarif_conventionne          DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    plafond_unitaire_global     DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    taux_ticket_moderateur      DECIMAL(6,2)  NOT NULL DEFAULT 0.00,
    profil_beneficiaire         ENUM('tous','homme','femme','enfant','adulte') NOT NULL DEFAULT 'tous',
    necessite_hospitalisation   TINYINT(1)    NOT NULL DEFAULT 0,
    couvert                     TINYINT(1)    NOT NULL DEFAULT 1,
    actif                       TINYINT(1)    NOT NULL DEFAULT 1,
    created_at                  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uk_acte_code UNIQUE (code_acte, compagnie_id),
    CONSTRAINT fk_ractes_cie FOREIGN KEY (compagnie_id) REFERENCES compagnies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_ra_cie_acte ON ref_actes(compagnie_id, code_acte);

-- =============================================================
-- 14. REF_PLAFONDS (par police + collège)
-- =============================================================
CREATE TABLE IF NOT EXISTS ref_plafonds (
    id                          INT           NOT NULL AUTO_INCREMENT,
    compagnie_id                INT           NOT NULL,
    filiale_id                  INT,
    -- Clé police + collège
    police                      VARCHAR(50)   NOT NULL,
    police_interne              VARCHAR(50),
    code_souscripteur           VARCHAR(50),
    souscripteur                VARCHAR(200),
    numero_college              VARCHAR(50)   NOT NULL,
    college                     VARCHAR(200),
    -- Plafonds individuels
    plafond_individuel_mensuel  DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    plafond_individuel_annuel   DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    plafond_par_acte_global     DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    -- Ticket modérateur par défaut
    taux_ticket_moderateur      DECIMAL(6,2)  NOT NULL DEFAULT 0.00,
    -- Validité
    date_effet                  DATE,
    date_echeance               DATE,
    actif                       TINYINT(1)    NOT NULL DEFAULT 1,
    created_at                  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uk_plafond_pc UNIQUE (compagnie_id, police, numero_college),
    CONSTRAINT fk_rp_cie     FOREIGN KEY (compagnie_id) REFERENCES compagnies(id),
    CONSTRAINT fk_rp_fil     FOREIGN KEY (filiale_id)   REFERENCES filiales(id) ON DELETE SET NULL,
    CONSTRAINT chk_plf_positif CHECK (plafond_individuel_mensuel >= 0 AND plafond_individuel_annuel >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_rp_police_col ON ref_plafonds(compagnie_id, police, numero_college);

-- =============================================================
-- 15. REF_PLAFONDS_FAMILLES (par police + collège + famille)
-- =============================================================
CREATE TABLE IF NOT EXISTS ref_plafonds_familles (
    id                          INT           NOT NULL AUTO_INCREMENT,
    compagnie_id                INT           NOT NULL,
    filiale_id                  INT,
    police                      VARCHAR(50)   NOT NULL,
    numero_college              VARCHAR(50)   NOT NULL,
    college                     VARCHAR(200),
    code_famille_prestation     VARCHAR(50)   NOT NULL,
    famille_prestation          VARCHAR(100),
    plafond_mensuel             DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    plafond_annuel              DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    plafond_par_acte            DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    plafond_par_ordonnance      DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    taux_remboursement          DECIMAL(6,2)  NOT NULL DEFAULT 100.00,
    taux_ticket_moderateur      DECIMAL(6,2)  NOT NULL DEFAULT 0.00,
    actif                       TINYINT(1)    NOT NULL DEFAULT 1,
    created_at                  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uk_plf_fam UNIQUE (compagnie_id, police, numero_college, code_famille_prestation),
    CONSTRAINT fk_rpf_cie FOREIGN KEY (compagnie_id) REFERENCES compagnies(id),
    CONSTRAINT fk_rpf_fil FOREIGN KEY (filiale_id)   REFERENCES filiales(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_rpf_pc_fam ON ref_plafonds_familles(compagnie_id, police, numero_college, code_famille_prestation);

-- =============================================================
-- 16. REF_FREQUENCES (par police + collège + acte ou famille)
-- =============================================================
CREATE TABLE IF NOT EXISTS ref_frequences (
    id                              INT           NOT NULL AUTO_INCREMENT,
    compagnie_id                    INT           NOT NULL,
    filiale_id                      INT,
    police                          VARCHAR(50)   NOT NULL,
    numero_college                  VARCHAR(50)   NOT NULL,
    college                         VARCHAR(200),
    type_reference                  ENUM('ACTE','FAMILLE') NOT NULL,
    code_reference                  VARCHAR(50)   NOT NULL COMMENT 'code_acte OU code_famille',
    libelle_reference               VARCHAR(200),
    -- Limites fréquence
    max_par_mois                    SMALLINT UNSIGNED,
    max_par_trimestre               SMALLINT UNSIGNED,
    max_par_semestre                SMALLINT UNSIGNED,
    max_par_an                      SMALLINT UNSIGNED,
    max_par_30_jours                SMALLINT UNSIGNED COMMENT 'Fenêtre glissante',
    -- Limites quantité (pharmacie, matériel)
    max_quantite_par_ordonnance     SMALLINT UNSIGNED,
    max_quantite_par_mois           SMALLINT UNSIGNED,
    max_quantite_par_an             SMALLINT UNSIGNED,
    -- Action en cas de dépassement
    action_depassement              ENUM('REJETER','ALERTER') NOT NULL DEFAULT 'ALERTER',
    actif                           TINYINT(1)    NOT NULL DEFAULT 1,
    created_at                      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uk_freq_pc UNIQUE (compagnie_id, police, numero_college, type_reference, code_reference),
    CONSTRAINT fk_rf_cie FOREIGN KEY (compagnie_id) REFERENCES compagnies(id),
    CONSTRAINT fk_rf_fil FOREIGN KEY (filiale_id)   REFERENCES filiales(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_rf_pc_ref ON ref_frequences(compagnie_id, police, numero_college, type_reference, code_reference);

-- =============================================================
-- 17. REF_CONTRATS
-- =============================================================
CREATE TABLE IF NOT EXISTS ref_contrats (
    id                  INT           NOT NULL AUTO_INCREMENT,
    compagnie_id        INT           NOT NULL,
    gestionnaire_id     INT           NOT NULL,
    numero_contrat      VARCHAR(50)   NOT NULL,
    police              VARCHAR(50),
    souscripteur        VARCHAR(200),
    code_souscripteur   VARCHAR(50),
    date_effet          DATE          NOT NULL,
    date_echeance       DATE          NOT NULL,
    actif               TINYINT(1)    NOT NULL DEFAULT 1,
    created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uk_contrat_cie UNIQUE (numero_contrat, compagnie_id),
    CONSTRAINT fk_rc_cie  FOREIGN KEY (compagnie_id)   REFERENCES compagnies(id),
    CONSTRAINT fk_rc_gest FOREIGN KEY (gestionnaire_id) REFERENCES gestionnaires(id),
    CONSTRAINT chk_contrat_dates CHECK (date_echeance >= date_effet)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_rc_cie  ON ref_contrats(compagnie_id);
CREATE INDEX idx_rc_gest ON ref_contrats(gestionnaire_id);

-- =============================================================
-- 18. VUES ANALYTIQUES
-- =============================================================

-- Vue : statistiques par fichier
CREATE OR REPLACE VIEW v_stats_fichier AS
SELECT
    p.fichier_importe_id,
    COUNT(*)                                           AS nb_total,
    SUM(p.est_valide)                                  AS nb_valides,
    SUM(IF(p.est_valide = 0, 1, 0))                    AS nb_invalides,
    SUM(p.est_tardive)                                 AS nb_tardives,
    SUM(p.est_rejetee)                                 AS nb_rejetees,
    ROUND(SUM(p.montant_reclame), 2)                   AS total_reclame,
    ROUND(SUM(p.montant_paye), 2)                      AS total_paye,
    ROUND(SUM(p.montant_exclu), 2)                     AS total_exclu,
    ROUND(SUM(IF(p.est_rejetee = 1, p.montant_paye, 0))
        / NULLIF(SUM(p.montant_paye), 0) * 100, 2)    AS taux_rejet_pct,
    COUNT(DISTINCT p.matricule_beneficiaire)            AS nb_beneficiaires,
    COUNT(DISTINCT p.code_prestataire)                  AS nb_prestataires,
    COUNT(DISTINCT p.code_acte)                         AS nb_actes_distincts
FROM prestations p
GROUP BY p.fichier_importe_id;

-- Vue : prestations enrichies
CREATE OR REPLACE VIEW v_prestations_enrichies AS
SELECT
    p.*,
    fi.mois_fichier          AS fi_mois,
    fi.annee_fichier         AS fi_annee,
    fi.statut                AS fi_statut,
    g.nom                    AS gestionnaire_nom,
    g.code                   AS gestionnaire_code,
    f.nom                    AS filiale_nom,
    ec.code_exercice         AS exercice_code,
    ec.date_debut            AS exercice_debut,
    ec.date_fin              AS exercice_fin
FROM prestations p
JOIN fichiers_importes fi    ON fi.id  = p.fichier_importe_id
JOIN gestionnaires     g     ON g.id   = p.gestionnaire_id
JOIN filiales          f     ON f.id   = p.filiale_id
JOIN exercices_comptables ec ON ec.id  = p.exercice_id;

-- Vue : tableau de bord filiale
CREATE OR REPLACE VIEW v_dashboard_filiale AS
SELECT
    fi.filiale_id,
    fi.compagnie_id,
    fi.gestionnaire_id,
    g.nom                                              AS gestionnaire_nom,
    fi.annee_fichier,
    fi.mois_fichier,
    fi.statut,
    fi.nb_lignes_total,
    fi.nb_lignes_anomalies,
    fi.montant_total_reclame,
    fi.montant_total_paye,
    fi.montant_net_recommande,
    fi.taux_anomalie,
    fi.montant_anomalies,
    (fi.montant_total_reclame - fi.montant_net_recommande) AS economies_detectees
FROM fichiers_importes fi
JOIN gestionnaires g ON g.id = fi.gestionnaire_id
WHERE fi.statut IN ('analyse','valide');

-- =============================================================
-- 19. TRIGGERS
-- =============================================================

DELIMITER $$

-- Incrémenter nb_anomalies sur la prestation après insertion anomalie
CREATE TRIGGER trg_anomalie_insert
AFTER INSERT ON anomalies
FOR EACH ROW
BEGIN
    IF NEW.prestation_id IS NOT NULL THEN
        UPDATE prestations
        SET
            nb_anomalies = nb_anomalies + 1,
            est_valide = CASE
                WHEN NEW.gravite IN ('critique','eleve') THEN 0
                ELSE est_valide
            END
        WHERE id = NEW.prestation_id;
    END IF;
END$$

-- Décrémenter nb_anomalies sur suppression anomalie
CREATE TRIGGER trg_anomalie_delete
AFTER DELETE ON anomalies
FOR EACH ROW
BEGIN
    IF OLD.prestation_id IS NOT NULL THEN
        UPDATE prestations
        SET nb_anomalies = GREATEST(0, nb_anomalies - 1)
        WHERE id = OLD.prestation_id;
    END IF;
END$$

-- Mettre à jour les stats du fichier après analyse complète
CREATE TRIGGER trg_fi_stats_update
AFTER UPDATE ON fichiers_importes
FOR EACH ROW
BEGIN
    -- Mettre à jour les stats de la session_audit associée si elle existe
    IF NEW.statut = 'analyse' AND OLD.statut != 'analyse' THEN
        UPDATE sessions_audit sa
        JOIN sessions_audit_fichiers saf ON saf.session_id = sa.id
        SET
            sa.nb_fichiers  = (SELECT COUNT(*) FROM sessions_audit_fichiers WHERE session_id = sa.id),
            sa.montant_total = (
                SELECT COALESCE(SUM(fi2.montant_total_paye), 0)
                FROM sessions_audit_fichiers saf2
                JOIN fichiers_importes fi2 ON fi2.id = saf2.fichier_importe_id
                WHERE saf2.session_id = sa.id
            ),
            sa.nb_anomalies = (
                SELECT COALESCE(SUM(fi2.nb_lignes_anomalies), 0)
                FROM sessions_audit_fichiers saf2
                JOIN fichiers_importes fi2 ON fi2.id = saf2.fichier_importe_id
                WHERE saf2.session_id = sa.id
            ),
            sa.updated_at = NOW()
        WHERE saf.fichier_importe_id = NEW.id;
    END IF;
END$$

DELIMITER ;

-- =============================================================
-- 20. DONNEES INITIALES
-- =============================================================

INSERT INTO compagnies (code, nom, ville, actif) VALUES
    ('NSIA-CI',  'NSIA Assurances Côte d''Ivoire', 'Abidjan', 1),
    ('SAAR-CI',  'SAAR Assurances CI',             'Abidjan', 1),
    ('SAHAM-CI', 'SAHAM Assurance CI',              'Abidjan', 1);

INSERT INTO filiales (compagnie_id, code, nom, ville) VALUES
    (1, 'NSIA-ABJ', 'NSIA CI — Abidjan Centre', 'Abidjan'),
    (1, 'NSIA-BKE', 'NSIA CI — Bouaké',         'Bouaké'),
    (1, 'NSIA-SMP', 'NSIA CI — San-Pedro',       'San-Pedro'),
    (2, 'SAAR-ABJ', 'SAAR — Abidjan',            'Abidjan'),
    (3, 'SAHAM-ABJ','SAHAM — Abidjan',            'Abidjan');

INSERT INTO gestionnaires (compagnie_id, code, nom) VALUES
    (1, 'MEDIASSUR', 'MEDIASSUR SARL'),
    (1, 'EURAFRIC',  'EURAFRIC GESTION SANTE'),
    (1, 'SOGEHAN',   'SOGEHAN SANTE'),
    (1, 'GMS',       'GESTION MEDICALE ET SOCIALE'),
    (2, 'MGTS-CI',   'MGTS CÔTE D''IVOIRE'),
    (3, 'OPTIMED',   'OPTIMED GESTION');

INSERT INTO exercices_comptables (compagnie_id, code_exercice, libelle, date_debut, date_fin, actif) VALUES
    (1, 'EX-2024', 'Exercice 2024', '2024-01-01', '2024-12-31', 1),
    (1, 'EX-2025', 'Exercice 2025', '2025-01-01', '2025-12-31', 1),
    (1, 'EX-2026', 'Exercice 2026', '2026-01-01', '2026-12-31', 1),
    (2, 'EX-2025', 'Exercice 2025', '2025-01-01', '2025-12-31', 1),
    (2, 'EX-2026', 'Exercice 2026', '2026-01-01', '2026-12-31', 1),
    (3, 'EX-2025', 'Exercice 2025', '2025-01-01', '2025-12-31', 1),
    (3, 'EX-2026', 'Exercice 2026', '2026-01-01', '2026-12-31', 1);

-- Super administrateur initial (mot de passe: Crystal@2026! hashé bcrypt)
INSERT INTO utilisateurs (compagnie_id, filiale_id, nom, prenoms, email, mot_de_passe, role) VALUES
    (1, 1, 'KONAN', 'Ange Marie Yves', 'admin@crystal.ariel.ci',
     '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMUFMOX3a8.9CkH8', 'super_admin');

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================
-- FIN DU SCHEMA CRYSTAL v2 — MySQL 8.0+
-- =============================================================
