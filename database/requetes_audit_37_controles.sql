-- =============================================================
-- CRYSTAL v2 — Requêtes d'audit MySQL 8.0+
-- 37 contrôles — 10 catégories — Mono-mois ET Multi-mois
-- ARIEL INDUSTRIES SARL — 2026
-- =============================================================
-- PARAMÈTRES GLOBAUX (remplacés par l'application) :
--   @session_id    = ID de la session_audit
--   @compagnie_id  = ID de la compagnie courante
--   @exercice_id   = ID de l'exercice comptable
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- HELPER : Vue temporaire des fichiers d'une session
-- À utiliser dans chaque requête via une CTE nommée fs
-- ─────────────────────────────────────────────────────────────
-- WITH fs AS (
--   SELECT fichier_importe_id FROM sessions_audit_fichiers
--   WHERE session_id = @session_id
-- )

-- ================================================================
-- CATEGORIE 1 — INTÉGRITÉ DES DONNÉES  (INCONDITIONNEL)
-- ================================================================

-- ── 1.1 Champs obligatoires manquants ────────────────────────
-- Gravité : ÉLEVÉ
WITH fs AS (
    SELECT fichier_importe_id FROM sessions_audit_fichiers WHERE session_id = @session_id
)
SELECT
    p.id,
    p.numero_prestation,
    p.fichier_importe_id,
    fi.mois_fichier,
    fi.annee_fichier,
    p.matricule_assure_principal,
    p.nom_assure_principal,
    p.prenoms_assure_principal,
    p.matricule_beneficiaire,
    p.nom_beneficiaire,
    p.date_soins,
    p.montant_reclame,
    p.montant_paye,
    JSON_ARRAY(
        IF(p.date_soins              IS NULL OR p.date_soins = '',              'date_soins',              NULL),
        IF(p.date_comptable          IS NULL OR p.date_comptable = '',          'date_comptable',          NULL),
        IF(p.matricule_assure_principal IS NULL OR p.matricule_assure_principal = '', 'matricule_assure', NULL),
        IF(p.matricule_beneficiaire  IS NULL OR p.matricule_beneficiaire = '',  'matricule_beneficiaire',  NULL),
        IF(p.montant_reclame         IS NULL,                                   'montant_reclame',         NULL),
        IF(p.montant_paye            IS NULL,                                   'montant_paye',            NULL),
        IF(p.code_prestataire        IS NULL OR p.code_prestataire = '',        'code_prestataire',        NULL),
        IF(p.code_acte               IS NULL OR p.code_acte = '',               'code_acte',               NULL)
    ) AS champs_manquants
FROM prestations p
JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
JOIN fichiers_importes fi ON fi.id = p.fichier_importe_id
WHERE p.date_soins IS NULL OR p.date_soins = ''
   OR p.date_comptable IS NULL
   OR p.matricule_assure_principal IS NULL OR p.matricule_assure_principal = ''
   OR p.matricule_beneficiaire IS NULL OR p.matricule_beneficiaire = ''
   OR p.montant_reclame IS NULL
   OR p.montant_paye IS NULL;

-- ── 1.2 Montants négatifs ─────────────────────────────────────
-- Gravité : ÉLEVÉ
WITH fs AS (
    SELECT fichier_importe_id FROM sessions_audit_fichiers WHERE session_id = @session_id
)
SELECT
    p.id, p.numero_prestation, p.fichier_importe_id, fi.mois_fichier, fi.annee_fichier,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.montant_reclame, p.montant_paye, p.montant_exclu,
    p.base_remboursement, p.montant_ticket_moderateur, p.date_soins
FROM prestations p
JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
JOIN fichiers_importes fi ON fi.id = p.fichier_importe_id
WHERE p.montant_reclame < 0 OR p.montant_paye < 0
   OR p.montant_ticket_moderateur < 0 OR p.base_remboursement < 0;

-- ── 1.3 Montant payé > montant réclamé ────────────────────────
-- Gravité : CRITIQUE
WITH fs AS (
    SELECT fichier_importe_id FROM sessions_audit_fichiers WHERE session_id = @session_id
)
SELECT
    p.id, p.numero_prestation, p.fichier_importe_id, fi.mois_fichier, fi.annee_fichier,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.montant_reclame, p.montant_paye,
    ROUND(p.montant_paye - p.montant_reclame, 2) AS surplus,
    p.date_soins
FROM prestations p
JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
JOIN fichiers_importes fi ON fi.id = p.fichier_importe_id
WHERE p.montant_paye > p.montant_reclame;

-- ── 1.4 Ticket modérateur incohérent ──────────────────────────
-- Gravité : MOYEN  (paye + TM ≠ reclame avec tolérance 1 FCFA)
WITH fs AS (
    SELECT fichier_importe_id FROM sessions_audit_fichiers WHERE session_id = @session_id
)
SELECT
    p.id, p.numero_prestation, p.fichier_importe_id, fi.mois_fichier, fi.annee_fichier,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.montant_reclame, p.montant_paye, p.montant_ticket_moderateur,
    ROUND(p.montant_paye + p.montant_ticket_moderateur, 2) AS somme_calculee,
    ROUND(ABS(p.montant_reclame - (p.montant_paye + p.montant_ticket_moderateur)), 2) AS ecart,
    p.date_soins
FROM prestations p
JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
JOIN fichiers_importes fi ON fi.id = p.fichier_importe_id
WHERE p.montant_reclame > 0
  AND p.montant_ticket_moderateur > 0
  AND ABS(p.montant_reclame - (p.montant_paye + p.montant_ticket_moderateur)) > 1;

-- ================================================================
-- CATEGORIE 2 — BÉNÉFICIAIRES  (CONDITIONNEL — ref_assures)
-- ================================================================

-- ── 2.1 Bénéficiaire inexistant dans le référentiel ───────────
-- Gravité : CRITIQUE
WITH fs AS (
    SELECT fichier_importe_id FROM sessions_audit_fichiers WHERE session_id = @session_id
)
SELECT
    p.id, p.numero_prestation, p.fichier_importe_id, fi.mois_fichier, fi.annee_fichier,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.police, p.numero_college, p.college,
    p.date_soins, p.montant_paye
FROM prestations p
JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
JOIN fichiers_importes fi ON fi.id = p.fichier_importe_id
LEFT JOIN ref_assures ra
       ON ra.matricule     = p.matricule_beneficiaire
      AND ra.compagnie_id  = @compagnie_id
WHERE ra.matricule IS NULL
ORDER BY p.montant_paye DESC;

-- ── 2.2 Bénéficiaire radié ────────────────────────────────────
-- Gravité : CRITIQUE
WITH fs AS (
    SELECT fichier_importe_id FROM sessions_audit_fichiers WHERE session_id = @session_id
)
SELECT
    p.id, p.numero_prestation, p.fichier_importe_id, fi.mois_fichier, fi.annee_fichier,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.date_soins, p.montant_paye,
    ra.date_radiation,
    DATEDIFF(p.date_soins, ra.date_radiation) AS jours_apres_radiation
FROM prestations p
JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
JOIN fichiers_importes fi ON fi.id = p.fichier_importe_id
JOIN ref_assures ra
  ON ra.matricule    = p.matricule_beneficiaire
 AND ra.compagnie_id = @compagnie_id
 AND ra.date_radiation IS NOT NULL
WHERE p.date_soins > ra.date_radiation
ORDER BY jours_apres_radiation DESC;

-- ── 2.3 Bénéficiaire non encore affilié ──────────────────────
-- Gravité : CRITIQUE
WITH fs AS (
    SELECT fichier_importe_id FROM sessions_audit_fichiers WHERE session_id = @session_id
)
SELECT
    p.id, p.numero_prestation, p.fichier_importe_id, fi.mois_fichier, fi.annee_fichier,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.date_soins, p.montant_paye,
    ra.date_affiliation,
    DATEDIFF(ra.date_affiliation, p.date_soins) AS jours_avant_affiliation
FROM prestations p
JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
JOIN fichiers_importes fi ON fi.id = p.fichier_importe_id
JOIN ref_assures ra
  ON ra.matricule    = p.matricule_beneficiaire
 AND ra.compagnie_id = @compagnie_id
WHERE p.date_soins < ra.date_affiliation;

-- ── 2.4 Incohérence nom / matricule ──────────────────────────
-- Gravité : ÉLEVÉ
WITH fs AS (
    SELECT fichier_importe_id FROM sessions_audit_fichiers WHERE session_id = @session_id
)
SELECT
    p.id, p.numero_prestation, p.fichier_importe_id, fi.mois_fichier, fi.annee_fichier,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.matricule_beneficiaire,
    p.nom_beneficiaire            AS nom_dans_fichier,
    ra.nom                        AS nom_referentiel,
    ra.prenom                     AS prenom_referentiel,
    p.date_soins, p.montant_paye
FROM prestations p
JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
JOIN fichiers_importes fi ON fi.id = p.fichier_importe_id
JOIN ref_assures ra
  ON ra.matricule    = p.matricule_beneficiaire
 AND ra.compagnie_id = @compagnie_id
WHERE LOWER(TRIM(p.nom_beneficiaire)) != LOWER(TRIM(ra.nom))
  AND ra.nom IS NOT NULL
  AND p.nom_beneficiaire IS NOT NULL;

-- ── 2.5 Bénéficiaire hors police / collège ───────────────────
-- Gravité : ÉLEVÉ
WITH fs AS (
    SELECT fichier_importe_id FROM sessions_audit_fichiers WHERE session_id = @session_id
)
SELECT
    p.id, p.numero_prestation, p.fichier_importe_id, fi.mois_fichier, fi.annee_fichier,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.police, p.numero_college, p.college,
    ra.police           AS police_referentiel,
    ra.numero_college   AS college_referentiel,
    p.date_soins, p.montant_paye
FROM prestations p
JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
JOIN fichiers_importes fi ON fi.id = p.fichier_importe_id
JOIN ref_assures ra
  ON ra.matricule    = p.matricule_beneficiaire
 AND ra.compagnie_id = @compagnie_id
WHERE ra.police IS NOT NULL
  AND (p.police != ra.police OR p.numero_college != ra.numero_college);

-- ── 2.6 Ayant droit dépassant l'âge limite ───────────────────
-- Gravité : ÉLEVÉ  — @age_limite = 21 par défaut
WITH fs AS (
    SELECT fichier_importe_id FROM sessions_audit_fichiers WHERE session_id = @session_id
)
SELECT
    p.id, p.numero_prestation, p.fichier_importe_id, fi.mois_fichier, fi.annee_fichier,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.police, p.numero_college,
    ra.date_naissance,
    p.date_soins, p.montant_paye,
    TIMESTAMPDIFF(YEAR, ra.date_naissance, p.date_soins) AS age_lors_soins
FROM prestations p
JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
JOIN fichiers_importes fi ON fi.id = p.fichier_importe_id
JOIN ref_assures ra
  ON ra.matricule    = p.matricule_beneficiaire
 AND ra.compagnie_id = @compagnie_id
 AND ra.statut IN ('ayant_droit','enfant','conjoint')
WHERE ra.date_naissance IS NOT NULL
  AND TIMESTAMPDIFF(YEAR, ra.date_naissance, p.date_soins) > COALESCE(@age_limite, 21);

-- ================================================================
-- CATEGORIE 3 — PRESTATAIRES  (CONDITIONNEL — ref_prestataires)
-- ================================================================

-- ── 3.1 Prestataire non agréé ─────────────────────────────────
-- Gravité : CRITIQUE
WITH fs AS (
    SELECT fichier_importe_id FROM sessions_audit_fichiers WHERE session_id = @session_id
)
SELECT
    p.code_prestataire, p.prestataire,
    COUNT(*)                       AS nb_prestations,
    ROUND(SUM(p.montant_paye), 2)  AS montant_total,
    MIN(p.date_soins)              AS premiere_date,
    MAX(p.date_soins)              AS derniere_date,
    JSON_ARRAYAGG(DISTINCT p.matricule_beneficiaire) AS beneficiaires
FROM prestations p
JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
LEFT JOIN ref_prestataires rpr
       ON rpr.code        = p.code_prestataire
      AND rpr.compagnie_id = @compagnie_id
WHERE rpr.code IS NULL
GROUP BY p.code_prestataire, p.prestataire
ORDER BY montant_total DESC;

-- ── 3.2 Prestataire radié ou suspendu ─────────────────────────
-- Gravité : CRITIQUE
WITH fs AS (
    SELECT fichier_importe_id FROM sessions_audit_fichiers WHERE session_id = @session_id
)
SELECT
    p.id, p.numero_prestation, p.fichier_importe_id, fi.mois_fichier, fi.annee_fichier,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.code_prestataire, p.prestataire,
    rpr.statut          AS statut_prestataire,
    rpr.date_radiation,
    p.date_soins, p.montant_paye
FROM prestations p
JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
JOIN fichiers_importes fi ON fi.id = p.fichier_importe_id
JOIN ref_prestataires rpr
  ON rpr.code         = p.code_prestataire
 AND rpr.compagnie_id = @compagnie_id
WHERE rpr.statut IN ('radie','suspendu')
   OR (rpr.date_radiation IS NOT NULL AND p.date_soins > rpr.date_radiation);

-- ── 3.3 Incohérence code / nom prestataire ────────────────────
-- Gravité : ÉLEVÉ
WITH fs AS (
    SELECT fichier_importe_id FROM sessions_audit_fichiers WHERE session_id = @session_id
),
prest_distincts AS (
    SELECT DISTINCT p.code_prestataire, p.prestataire
    FROM prestations p
    JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
)
SELECT
    pd.code_prestataire,
    pd.prestataire           AS nom_dans_fichier,
    rpr.nom                  AS nom_referentiel
FROM prest_distincts pd
JOIN ref_prestataires rpr
  ON rpr.code         = pd.code_prestataire
 AND rpr.compagnie_id = @compagnie_id
WHERE LOWER(TRIM(pd.prestataire)) != LOWER(TRIM(rpr.nom));

-- ── 3.4 Zone géographique incohérente ─────────────────────────
-- Gravité : MOYEN  (hors hospitalisation/urgence)
WITH fs AS (
    SELECT fichier_importe_id FROM sessions_audit_fichiers WHERE session_id = @session_id
)
SELECT
    p.id, p.numero_prestation, p.fichier_importe_id, fi.mois_fichier, fi.annee_fichier,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.code_prestataire, p.prestataire,
    rpr.zone                 AS zone_prestataire,
    ra.ville                 AS ville_assure,
    p.date_soins, p.montant_paye
FROM prestations p
JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
JOIN fichiers_importes fi ON fi.id = p.fichier_importe_id
JOIN ref_prestataires rpr ON rpr.code = p.code_prestataire AND rpr.compagnie_id = @compagnie_id
JOIN ref_assures ra ON ra.matricule = p.matricule_beneficiaire AND ra.compagnie_id = @compagnie_id
WHERE rpr.zone IS NOT NULL
  AND ra.ville IS NOT NULL
  AND LOWER(rpr.zone) != LOWER(ra.ville)
  AND UPPER(p.code_famille_prestation) NOT IN ('HOSPITALISATION','URGENCE','MATERNITE');

-- ── 3.5 Prescripteur non habilité ────────────────────────────
-- Gravité : ÉLEVÉ
WITH fs AS (
    SELECT fichier_importe_id FROM sessions_audit_fichiers WHERE session_id = @session_id
)
SELECT
    p.id, p.numero_prestation, p.fichier_importe_id, fi.mois_fichier, fi.annee_fichier,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.code_prescripteur, p.prescripteur,
    p.code_famille_prestation, p.famille_prestation,
    p.date_soins, p.montant_paye,
    IF(rpsc.code IS NULL, 'Prescripteur absent', 'Famille non autorisée') AS motif
FROM prestations p
JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
JOIN fichiers_importes fi ON fi.id = p.fichier_importe_id
LEFT JOIN ref_prescripteurs rpsc
       ON rpsc.code         = p.code_prescripteur
      AND rpsc.compagnie_id = @compagnie_id
WHERE p.code_prescripteur IS NOT NULL AND p.code_prescripteur != ''
  AND (
      rpsc.code IS NULL
      OR JSON_SEARCH(rpsc.familles_autorisees, 'one', p.code_famille_prestation) IS NULL
  );

-- ================================================================
-- CATEGORIE 4 — DOUBLONS  (INCONDITIONNEL)
-- ================================================================

-- ── 4.1 Doublons stricts (même numero_prestation dans la session) ──
-- Gravité : CRITIQUE
WITH fs AS (
    SELECT fichier_importe_id FROM sessions_audit_fichiers WHERE session_id = @session_id
)
SELECT
    p.numero_prestation,
    COUNT(*)                                     AS nb_occurrences,
    ROUND(SUM(p.montant_paye), 2)                AS montant_total,
    ROUND((COUNT(*) - 1) * MIN(p.montant_paye), 2) AS montant_en_double,
    GROUP_CONCAT(DISTINCT CONCAT(fi.mois_fichier,'/',fi.annee_fichier) SEPARATOR ', ') AS mois_concernes,
    MIN(p.matricule_assure_principal)            AS matricule_assure,
    MIN(p.nom_assure_principal)                  AS nom_assure,
    MIN(p.prenoms_assure_principal)              AS prenoms_assure,
    MIN(p.matricule_beneficiaire)                AS matricule_benef,
    MIN(p.nom_beneficiaire)                      AS nom_benef,
    MIN(p.date_soins)                            AS date_soins
FROM prestations p
JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
JOIN fichiers_importes fi ON fi.id = p.fichier_importe_id
WHERE p.numero_prestation IS NOT NULL AND p.numero_prestation != ''
GROUP BY p.numero_prestation
HAVING COUNT(*) > 1
ORDER BY montant_en_double DESC;

-- ── 4.2 Doublons fonctionnels (même clé métier dans la session) ──
-- Clé : mat_benef + date_soins + code_acte + code_prestataire + montant_paye
-- Gravité : CRITIQUE
WITH fs AS (
    SELECT fichier_importe_id FROM sessions_audit_fichiers WHERE session_id = @session_id
)
SELECT
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.date_soins, p.code_acte, p.acte,
    p.code_prestataire, p.prestataire, p.montant_paye,
    COUNT(*)                                     AS nb_occurrences,
    ROUND(SUM(p.montant_paye), 2)                AS montant_total,
    ROUND((COUNT(*) - 1) * p.montant_paye, 2)   AS montant_en_double,
    GROUP_CONCAT(p.id ORDER BY p.fichier_importe_id SEPARATOR ',') AS ids_prestations,
    GROUP_CONCAT(DISTINCT CONCAT(fi.mois_fichier,'/',fi.annee_fichier) SEPARATOR ', ') AS mois_concernes
FROM prestations p
JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
JOIN fichiers_importes fi ON fi.id = p.fichier_importe_id
GROUP BY
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.date_soins, p.code_acte, p.acte,
    p.code_prestataire, p.prestataire, p.montant_paye
HAVING COUNT(*) > 1
ORDER BY montant_en_double DESC;

-- ── 4.3 Doublons inter-gestionnaires ─────────────────────────
-- Gravité : CRITIQUE  — Cherche dans TOUTE la compagnie
WITH fs AS (
    SELECT saf.fichier_importe_id, fi.gestionnaire_id
    FROM sessions_audit_fichiers saf
    JOIN fichiers_importes fi ON fi.id = saf.fichier_importe_id
    WHERE saf.session_id = @session_id
)
SELECT
    p1.id                   AS prestation_session,
    p1.matricule_assure_principal, p1.nom_assure_principal, p1.prenoms_assure_principal,
    p1.matricule_beneficiaire, p1.nom_beneficiaire,
    p1.date_soins, p1.code_acte, p1.code_prestataire,
    ROUND(p1.montant_paye, 2) AS montant_paye,
    fi2.mois_fichier        AS mois_doublon,
    fi2.annee_fichier       AS annee_doublon,
    g2.nom                  AS gestionnaire_doublon
FROM prestations p1
JOIN fs ON fs.fichier_importe_id = p1.fichier_importe_id
JOIN prestations p2
  ON p2.compagnie_id           = p1.compagnie_id
 AND p2.gestionnaire_id        != fs.gestionnaire_id
 AND p2.matricule_beneficiaire = p1.matricule_beneficiaire
 AND p2.date_soins             = p1.date_soins
 AND p2.code_acte              = p1.code_acte
 AND p2.code_prestataire       = p1.code_prestataire
 AND p2.montant_paye           = p1.montant_paye
JOIN fichiers_importes fi2 ON fi2.id = p2.fichier_importe_id
JOIN gestionnaires g2 ON g2.id = p2.gestionnaire_id
ORDER BY p1.date_soins DESC;

-- ── 4.4 Doublons inter-mois (MULTI-MOIS) ─────────────────────
-- Gravité : CRITIQUE — Détecte les prestations d'un mois refacturées un autre mois
WITH fs AS (
    SELECT saf.fichier_importe_id,
           fi.gestionnaire_id,
           fi.mois_fichier,
           fi.annee_fichier,
           (fi.annee_fichier * 12 + fi.mois_fichier) AS rang_mois
    FROM sessions_audit_fichiers saf
    JOIN fichiers_importes fi ON fi.id = saf.fichier_importe_id
    WHERE saf.session_id = @session_id
)
SELECT
    p1.id                   AS id_mois_recent,
    p2.id                   AS id_mois_anterieur,
    fs1.mois_fichier        AS mois_recent,
    fs1.annee_fichier       AS annee_recente,
    fs2.mois_fichier        AS mois_anterieur,
    fs2.annee_fichier       AS annee_anterieure,
    p1.matricule_assure_principal, p1.nom_assure_principal, p1.prenoms_assure_principal,
    p1.matricule_beneficiaire, p1.nom_beneficiaire,
    p1.police, p1.numero_college,
    p1.date_soins, p1.code_acte, p1.acte,
    p1.code_prestataire, p1.prestataire,
    ROUND(p1.montant_paye, 2) AS montant_paye
FROM prestations p1
JOIN fs fs1 ON fs1.fichier_importe_id = p1.fichier_importe_id
JOIN prestations p2
  ON p2.fichier_importe_id     != p1.fichier_importe_id
 AND p2.gestionnaire_id         = p1.gestionnaire_id
 AND p2.matricule_beneficiaire  = p1.matricule_beneficiaire
 AND p2.date_soins              = p1.date_soins
 AND p2.code_acte               = p1.code_acte
 AND p2.code_prestataire        = p1.code_prestataire
 AND p2.montant_paye            = p1.montant_paye
JOIN fs fs2 ON fs2.fichier_importe_id = p2.fichier_importe_id
-- Garder uniquement mois récent vs mois antérieur
WHERE fs1.rang_mois > fs2.rang_mois
ORDER BY p1.date_soins DESC;

-- ================================================================
-- CATEGORIE 5 — FRÉQUENCE & VOLUMÉTRIE  (INCONDITIONNEL + ref_frequences)
-- ================================================================

-- ── 5.1 Fréquence par FAMILLE — dépassement mensuel ──────────
-- Gravité : ÉLEVÉ  (par police + collège)
WITH fs AS (
    SELECT fichier_importe_id FROM sessions_audit_fichiers WHERE session_id = @session_id
)
SELECT
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.police, p.numero_college, p.college,
    p.code_famille_prestation, p.famille_prestation,
    YEAR(p.date_soins)   AS annee,
    MONTH(p.date_soins)  AS mois,
    COUNT(*)             AS nb_occurrences,
    rf.max_par_mois      AS limite_mensuelle,
    COUNT(*) - rf.max_par_mois AS depassement,
    ROUND(SUM(p.montant_paye), 2)  AS montant_total,
    rf.action_depassement,
    GROUP_CONCAT(p.id ORDER BY p.date_soins SEPARATOR ',') AS ids
FROM prestations p
JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
JOIN ref_frequences rf
  ON rf.compagnie_id   = p.compagnie_id
 AND rf.police         = p.police
 AND rf.numero_college = p.numero_college
 AND rf.type_reference = 'FAMILLE'
 AND rf.code_reference = p.code_famille_prestation
 AND rf.max_par_mois   IS NOT NULL
 AND rf.actif          = 1
GROUP BY
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.police, p.numero_college, p.college,
    p.code_famille_prestation, p.famille_prestation,
    YEAR(p.date_soins), MONTH(p.date_soins),
    rf.max_par_mois, rf.action_depassement
HAVING COUNT(*) > rf.max_par_mois
ORDER BY depassement DESC;

-- ── 5.2 Fréquence par ACTE — dépassement mensuel ─────────────
-- Gravité : ÉLEVÉ  (par police + collège)
WITH fs AS (
    SELECT fichier_importe_id FROM sessions_audit_fichiers WHERE session_id = @session_id
)
SELECT
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.police, p.numero_college, p.college,
    p.code_acte, p.acte,
    YEAR(p.date_soins)  AS annee,
    MONTH(p.date_soins) AS mois,
    COUNT(*)            AS nb_occurrences,
    rf.max_par_mois     AS limite,
    COUNT(*) - rf.max_par_mois AS depassement,
    ROUND(SUM(p.montant_paye), 2) AS montant_total,
    rf.action_depassement
FROM prestations p
JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
JOIN ref_frequences rf
  ON rf.compagnie_id   = p.compagnie_id
 AND rf.police         = p.police
 AND rf.numero_college = p.numero_college
 AND rf.type_reference = 'ACTE'
 AND rf.code_reference = p.code_acte
 AND rf.max_par_mois   IS NOT NULL
 AND rf.actif          = 1
GROUP BY
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.police, p.numero_college, p.college, p.code_acte, p.acte,
    YEAR(p.date_soins), MONTH(p.date_soins),
    rf.max_par_mois, rf.action_depassement
HAVING COUNT(*) > rf.max_par_mois;

-- ── 5.3 Fréquence annuelle cumulée (MULTI-MOIS) ───────────────
-- Gravité : ÉLEVÉ — Requiert plusieurs mois dans la session
WITH fs AS (
    SELECT fichier_importe_id FROM sessions_audit_fichiers WHERE session_id = @session_id
)
SELECT
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.police, p.numero_college, p.college,
    p.code_acte, p.acte,
    YEAR(p.date_soins)  AS annee,
    COUNT(*)            AS nb_occurrences_annee,
    rf.max_par_an       AS limite_annuelle,
    COUNT(*) - rf.max_par_an AS depassement_annuel,
    ROUND(SUM(p.montant_paye), 2) AS montant_total,
    -- Détail mois par mois (JSON)
    JSON_OBJECTAGG(MONTH(p.date_soins), COUNT(p.id)) AS detail_par_mois,
    rf.action_depassement
FROM prestations p
JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
JOIN ref_frequences rf
  ON rf.compagnie_id   = p.compagnie_id
 AND rf.police         = p.police
 AND rf.numero_college = p.numero_college
 AND rf.type_reference = 'ACTE'
 AND rf.code_reference = p.code_acte
 AND rf.max_par_an     IS NOT NULL
 AND rf.actif          = 1
GROUP BY
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.police, p.numero_college, p.college, p.code_acte, p.acte,
    YEAR(p.date_soins), rf.max_par_an, rf.action_depassement
HAVING COUNT(*) > rf.max_par_an;

-- ── 5.4 Fréquence fenêtre glissante 30 jours (MULTI-MOIS) ────
-- Gravité : ÉLEVÉ
WITH fs AS (
    SELECT fichier_importe_id FROM sessions_audit_fichiers WHERE session_id = @session_id
)
SELECT
    p.id, p.fichier_importe_id, fi.mois_fichier, fi.annee_fichier,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.police, p.numero_college,
    p.code_acte, p.acte, p.date_soins,
    ROUND(p.montant_paye, 2)  AS montant_paye,
    rf.max_par_30_jours       AS limite_30j,
    COUNT(p2.id)              AS occurrences_30j,
    rf.action_depassement
FROM prestations p
JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
JOIN fichiers_importes fi ON fi.id = p.fichier_importe_id
JOIN ref_frequences rf
  ON rf.compagnie_id      = p.compagnie_id
 AND rf.police            = p.police
 AND rf.numero_college    = p.numero_college
 AND rf.type_reference    = 'ACTE'
 AND rf.code_reference    = p.code_acte
 AND rf.max_par_30_jours  IS NOT NULL
 AND rf.actif             = 1
-- Auto-jointure : cherche tous les actes identiques dans les 30 jours précédents
-- (multi-mois : sur l'ensemble des prestations du gestionnaire)
JOIN prestations p2
  ON p2.gestionnaire_id        = p.gestionnaire_id
 AND p2.matricule_beneficiaire = p.matricule_beneficiaire
 AND p2.code_acte              = p.code_acte
 AND p2.date_soins BETWEEN DATE_SUB(p.date_soins, INTERVAL 30 DAY) AND p.date_soins
GROUP BY
    p.id, p.fichier_importe_id, fi.mois_fichier, fi.annee_fichier,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.police, p.numero_college, p.code_acte, p.acte,
    p.date_soins, p.montant_paye, rf.max_par_30_jours, rf.action_depassement
HAVING COUNT(p2.id) > rf.max_par_30_jours;

-- ── 5.5 Multi-prestataires le même jour ──────────────────────
-- Gravité : ÉLEVÉ  (présence suspecte — multi-mois inclus)
WITH fs AS (
    SELECT fichier_importe_id FROM sessions_audit_fichiers WHERE session_id = @session_id
)
SELECT
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.police, p.numero_college,
    p.date_soins                                 AS jour_soins,
    COUNT(DISTINCT p.code_prestataire)           AS nb_prestataires_distincts,
    GROUP_CONCAT(DISTINCT p.code_prestataire SEPARATOR ', ')  AS codes_prestataires,
    GROUP_CONCAT(DISTINCT p.prestataire      SEPARATOR ' | ') AS noms_prestataires,
    ROUND(SUM(p.montant_paye), 2)                AS montant_total,
    GROUP_CONCAT(DISTINCT CONCAT(fi.mois_fichier,'/',fi.annee_fichier) SEPARATOR ', ') AS mois_concernes
FROM prestations p
JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
JOIN fichiers_importes fi ON fi.id = p.fichier_importe_id
GROUP BY
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.police, p.numero_college, p.date_soins
HAVING COUNT(DISTINCT p.code_prestataire) > 1
ORDER BY montant_total DESC;

-- ── 5.6 Volumétrie pharmaceutique anormale ────────────────────
-- Gravité : MOYEN
WITH fs AS (
    SELECT fichier_importe_id FROM sessions_audit_fichiers WHERE session_id = @session_id
)
SELECT
    p.id, p.numero_prestation, p.fichier_importe_id, fi.mois_fichier, fi.annee_fichier,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.police, p.numero_college,
    p.code_acte, p.acte, p.date_soins,
    ROUND(p.montant_paye, 2)              AS montant_paye,
    rf.max_quantite_par_ordonnance        AS limite_quantite
FROM prestations p
JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
JOIN fichiers_importes fi ON fi.id = p.fichier_importe_id
JOIN ref_frequences rf
  ON rf.compagnie_id                    = p.compagnie_id
 AND rf.police                          = p.police
 AND rf.numero_college                  = p.numero_college
 AND rf.type_reference                  = 'FAMILLE'
 AND rf.code_reference                  = p.code_famille_prestation
 AND rf.max_quantite_par_ordonnance     IS NOT NULL
 AND rf.actif                           = 1
WHERE UPPER(p.code_famille_prestation) LIKE '%PHARM%';

-- ── 5.7 Pic de consommation en fin de période ─────────────────
-- Gravité : MOYEN — Analyse le dernier fichier de la session
WITH dernier_fichier AS (
    SELECT saf.fichier_importe_id
    FROM sessions_audit_fichiers saf
    JOIN fichiers_importes fi ON fi.id = saf.fichier_importe_id
    WHERE saf.session_id = @session_id
    ORDER BY fi.annee_fichier DESC, fi.mois_fichier DESC
    LIMIT 1
),
total_mois AS (
    SELECT SUM(p.montant_paye) AS total
    FROM prestations p
    JOIN dernier_fichier df ON df.fichier_importe_id = p.fichier_importe_id
),
fin_mois AS (
    SELECT SUM(p.montant_paye) AS total_fin, COUNT(*) AS nb
    FROM prestations p
    JOIN dernier_fichier df ON df.fichier_importe_id = p.fichier_importe_id
    WHERE DAY(p.date_soins) >=
          DAY(LAST_DAY(p.date_soins)) - 4
)
SELECT
    t.total                                          AS total_mois,
    f.total_fin                                      AS montant_fin_periode,
    f.nb                                             AS nb_prestations_fin,
    ROUND(f.total_fin / NULLIF(t.total, 0) * 100, 2) AS pct_fin_periode,
    IF(f.total_fin / NULLIF(t.total, 0) > 0.40, 'ALERTE', 'NORMAL') AS statut
FROM total_mois t, fin_mois f;

-- ================================================================
-- CATEGORIE 6 — MONTANTS & PLAFONDS  (CONDITIONNEL)
-- ================================================================

-- ── 6.1 Montant réclamé hors tarif conventionné ───────────────
-- Gravité : ÉLEVÉ
WITH fs AS (
    SELECT fichier_importe_id FROM sessions_audit_fichiers WHERE session_id = @session_id
)
SELECT
    p.id, p.numero_prestation, p.fichier_importe_id, fi.mois_fichier, fi.annee_fichier,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.police, p.numero_college,
    p.code_acte, p.acte, p.date_soins,
    ROUND(p.montant_reclame, 2)          AS montant_reclame,
    ROUND(ra.tarif_conventionne, 2)      AS tarif_conventionne,
    ROUND(p.montant_reclame - ra.tarif_conventionne, 2) AS depassement,
    ROUND((p.montant_reclame - ra.tarif_conventionne)
        / NULLIF(ra.tarif_conventionne, 0) * 100, 1)    AS pct_depassement
FROM prestations p
JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
JOIN fichiers_importes fi ON fi.id = p.fichier_importe_id
JOIN ref_actes ra ON ra.code_acte = p.code_acte AND ra.compagnie_id = @compagnie_id
   AND ra.tarif_conventionne > 0
WHERE p.montant_reclame > ra.tarif_conventionne
ORDER BY depassement DESC;

-- ── 6.2 Ticket modérateur non appliqué ───────────────────────
-- Gravité : MOYEN  (priorité police+collège sur ref_actes)
WITH fs AS (
    SELECT fichier_importe_id FROM sessions_audit_fichiers WHERE session_id = @session_id
)
SELECT
    p.id, p.numero_prestation, p.fichier_importe_id, fi.mois_fichier, fi.annee_fichier,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.police, p.numero_college,
    p.code_acte, p.date_soins,
    ROUND(p.montant_paye, 2)       AS montant_paye,
    ROUND(p.montant_ticket_moderateur, 2) AS tm_facture,
    COALESCE(rp.taux_ticket_moderateur, ra.taux_ticket_moderateur, 0) AS taux_tm_attendu,
    ROUND(p.montant_paye * COALESCE(rp.taux_ticket_moderateur, ra.taux_ticket_moderateur, 0) / 100, 2) AS tm_attendu
FROM prestations p
JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
JOIN fichiers_importes fi ON fi.id = p.fichier_importe_id
JOIN ref_actes ra ON ra.code_acte = p.code_acte AND ra.compagnie_id = @compagnie_id
LEFT JOIN ref_plafonds rp
  ON rp.compagnie_id   = @compagnie_id
 AND rp.police         = p.police
 AND rp.numero_college = p.numero_college
 AND rp.actif          = 1
WHERE COALESCE(rp.taux_ticket_moderateur, ra.taux_ticket_moderateur, 0) > 0
  AND (p.montant_ticket_moderateur = 0 OR p.montant_ticket_moderateur IS NULL);

-- ── 6.3 Plafond par acte dépassé (police + collège ou global) ─
-- Gravité : ÉLEVÉ
WITH fs AS (
    SELECT fichier_importe_id FROM sessions_audit_fichiers WHERE session_id = @session_id
)
SELECT
    p.id, p.numero_prestation, p.fichier_importe_id, fi.mois_fichier, fi.annee_fichier,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.police, p.numero_college,
    p.code_acte, p.acte, p.date_soins,
    ROUND(p.montant_paye, 2) AS montant_paye,
    ROUND(COALESCE(rpf.plafond_par_acte, ra.plafond_unitaire_global), 2) AS plafond_unitaire,
    ROUND(p.montant_paye - COALESCE(rpf.plafond_par_acte, ra.plafond_unitaire_global), 2) AS depassement
FROM prestations p
JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
JOIN fichiers_importes fi ON fi.id = p.fichier_importe_id
JOIN ref_actes ra ON ra.code_acte = p.code_acte AND ra.compagnie_id = @compagnie_id
LEFT JOIN ref_plafonds_familles rpf
  ON rpf.compagnie_id            = @compagnie_id
 AND rpf.police                  = p.police
 AND rpf.numero_college          = p.numero_college
 AND rpf.code_famille_prestation = p.code_famille_prestation
 AND rpf.plafond_par_acte        > 0
 AND rpf.actif                   = 1
WHERE p.montant_paye > COALESCE(rpf.plafond_par_acte, ra.plafond_unitaire_global, 0)
  AND COALESCE(rpf.plafond_par_acte, ra.plafond_unitaire_global, 0) > 0;

-- ── 6.4 Plafond individuel MENSUEL dépassé (police + collège) ─
-- MULTI-MOIS : contrôle mois par mois
-- Gravité : ÉLEVÉ
WITH fs AS (
    SELECT fichier_importe_id FROM sessions_audit_fichiers WHERE session_id = @session_id
)
SELECT
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.police, p.numero_college, p.college,
    YEAR(p.date_soins)                 AS annee,
    MONTH(p.date_soins)                AS mois,
    fi.mois_fichier, fi.annee_fichier,
    ROUND(SUM(p.montant_paye), 2)      AS cumul_mensuel,
    ROUND(rp.plafond_individuel_mensuel, 2) AS plafond,
    ROUND(SUM(p.montant_paye) - rp.plafond_individuel_mensuel, 2) AS depassement,
    GROUP_CONCAT(p.id SEPARATOR ',')   AS ids
FROM prestations p
JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
JOIN fichiers_importes fi ON fi.id = p.fichier_importe_id
JOIN ref_plafonds rp
  ON rp.compagnie_id   = @compagnie_id
 AND rp.police         = p.police
 AND rp.numero_college = p.numero_college
 AND rp.plafond_individuel_mensuel > 0
 AND rp.actif          = 1
GROUP BY
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.police, p.numero_college, p.college,
    YEAR(p.date_soins), MONTH(p.date_soins),
    fi.mois_fichier, fi.annee_fichier,
    rp.plafond_individuel_mensuel
HAVING SUM(p.montant_paye) > rp.plafond_individuel_mensuel
ORDER BY depassement DESC;

-- ── 6.5 Plafond individuel ANNUEL dépassé (MULTI-MOIS) ────────
-- Gravité : CRITIQUE — Cumul sur tout l'exercice
WITH bens_session AS (
    SELECT DISTINCT p.matricule_beneficiaire
    FROM prestations p
    JOIN sessions_audit_fichiers saf ON saf.fichier_importe_id = p.fichier_importe_id
    WHERE saf.session_id = @session_id
),
exercice AS (
    SELECT ec.date_debut, ec.date_fin
    FROM sessions_audit sa
    JOIN exercices_comptables ec ON ec.id = sa.exercice_id
    WHERE sa.id = @session_id
)
SELECT
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.police, p.numero_college, p.college,
    YEAR(p.date_soins)                   AS annee,
    ROUND(SUM(p.montant_paye), 2)        AS cumul_annuel,
    ROUND(rp.plafond_individuel_annuel, 2) AS plafond,
    ROUND(SUM(p.montant_paye) - rp.plafond_individuel_annuel, 2) AS depassement,
    COUNT(*)                             AS nb_prestations,
    -- Détail mensuel en JSON
    JSON_OBJECTAGG(
        DATE_FORMAT(p.date_soins, '%m/%Y'),
        ROUND(SUM(p.montant_paye), 2)
    ) AS detail_mensuel
FROM prestations p
JOIN bens_session bs ON bs.matricule_beneficiaire = p.matricule_beneficiaire
JOIN exercice e ON p.date_soins BETWEEN e.date_debut AND e.date_fin
JOIN ref_plafonds rp
  ON rp.compagnie_id   = p.compagnie_id
 AND rp.police         = p.police
 AND rp.numero_college = p.numero_college
 AND rp.plafond_individuel_annuel > 0
 AND rp.actif          = 1
WHERE p.compagnie_id = @compagnie_id
GROUP BY
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.police, p.numero_college, p.college,
    YEAR(p.date_soins), rp.plafond_individuel_annuel
HAVING SUM(p.montant_paye) > rp.plafond_individuel_annuel
ORDER BY depassement DESC;

-- ── 6.6 Plafond par FAMILLE mensuel dépassé ───────────────────
-- Gravité : ÉLEVÉ
WITH fs AS (
    SELECT fichier_importe_id FROM sessions_audit_fichiers WHERE session_id = @session_id
)
SELECT
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.police, p.numero_college, p.college,
    p.code_famille_prestation, p.famille_prestation,
    YEAR(p.date_soins)                AS annee,
    MONTH(p.date_soins)               AS mois,
    ROUND(SUM(p.montant_paye), 2)     AS cumul_famille_mois,
    ROUND(rpf.plafond_mensuel, 2)     AS plafond,
    ROUND(SUM(p.montant_paye) - rpf.plafond_mensuel, 2) AS depassement,
    GROUP_CONCAT(p.id SEPARATOR ',')  AS ids
FROM prestations p
JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
JOIN ref_plafonds_familles rpf
  ON rpf.compagnie_id            = @compagnie_id
 AND rpf.police                  = p.police
 AND rpf.numero_college          = p.numero_college
 AND rpf.code_famille_prestation = p.code_famille_prestation
 AND rpf.plafond_mensuel         > 0
 AND rpf.actif                   = 1
GROUP BY
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.police, p.numero_college, p.college,
    p.code_famille_prestation, p.famille_prestation,
    YEAR(p.date_soins), MONTH(p.date_soins), rpf.plafond_mensuel
HAVING SUM(p.montant_paye) > rpf.plafond_mensuel;

-- ── 6.7 Plafond annuel par FAMILLE dépassé (MULTI-MOIS) ───────
-- Gravité : CRITIQUE
WITH bens_session AS (
    SELECT DISTINCT p.matricule_beneficiaire, p.police, p.numero_college
    FROM prestations p
    JOIN sessions_audit_fichiers saf ON saf.fichier_importe_id = p.fichier_importe_id
    WHERE saf.session_id = @session_id
),
exercice AS (
    SELECT ec.date_debut, ec.date_fin
    FROM sessions_audit sa
    JOIN exercices_comptables ec ON ec.id = sa.exercice_id
    WHERE sa.id = @session_id
)
SELECT
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.police, p.numero_college, p.college,
    p.code_famille_prestation, p.famille_prestation,
    ROUND(SUM(p.montant_paye), 2)     AS cumul_annuel_famille,
    ROUND(rpf.plafond_annuel, 2)      AS plafond,
    ROUND(SUM(p.montant_paye) - rpf.plafond_annuel, 2) AS depassement,
    JSON_OBJECTAGG(
        DATE_FORMAT(p.date_soins, '%m/%Y'),
        ROUND(SUM(p.montant_paye), 2)
    ) AS detail_mensuel
FROM prestations p
JOIN bens_session bs
  ON bs.matricule_beneficiaire = p.matricule_beneficiaire
 AND bs.police                 = p.police
 AND bs.numero_college         = p.numero_college
JOIN exercice e ON p.date_soins BETWEEN e.date_debut AND e.date_fin
JOIN ref_plafonds_familles rpf
  ON rpf.compagnie_id            = p.compagnie_id
 AND rpf.police                  = p.police
 AND rpf.numero_college          = p.numero_college
 AND rpf.code_famille_prestation = p.code_famille_prestation
 AND rpf.plafond_annuel          > 0
 AND rpf.actif                   = 1
WHERE p.compagnie_id = @compagnie_id
GROUP BY
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.police, p.numero_college, p.college,
    p.code_famille_prestation, p.famille_prestation, rpf.plafond_annuel
HAVING SUM(p.montant_paye) > rpf.plafond_annuel;

-- ================================================================
-- CATEGORIE 7 — ACTES MÉDICAUX  (CONDITIONNEL — ref_actes)
-- ================================================================

-- ── 7.1 Acte hors nomenclature ───────────────────────────────
-- Gravité : CRITIQUE
WITH fs AS (
    SELECT fichier_importe_id FROM sessions_audit_fichiers WHERE session_id = @session_id
)
SELECT
    p.code_acte, p.acte, p.code_famille_prestation,
    COUNT(*)                      AS nb_occurrences,
    ROUND(SUM(p.montant_paye), 2) AS montant_total,
    MIN(p.date_soins)             AS premiere_date,
    MAX(p.date_soins)             AS derniere_date
FROM prestations p
JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
LEFT JOIN ref_actes ra ON ra.code_acte = p.code_acte AND ra.compagnie_id = @compagnie_id
WHERE ra.code_acte IS NULL
  AND p.code_acte IS NOT NULL AND p.code_acte != ''
GROUP BY p.code_acte, p.acte, p.code_famille_prestation
ORDER BY montant_total DESC;

-- ── 7.2 Acte non couvert par le contrat ──────────────────────
-- Gravité : CRITIQUE
WITH fs AS (
    SELECT fichier_importe_id FROM sessions_audit_fichiers WHERE session_id = @session_id
)
SELECT
    p.id, p.numero_prestation, p.fichier_importe_id, fi.mois_fichier, fi.annee_fichier,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.code_acte, p.acte, ra.libelle AS libelle_ref, p.date_soins,
    ROUND(p.montant_paye, 2) AS montant_paye
FROM prestations p
JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
JOIN fichiers_importes fi ON fi.id = p.fichier_importe_id
JOIN ref_actes ra ON ra.code_acte = p.code_acte AND ra.compagnie_id = @compagnie_id
WHERE ra.couvert = 0;

-- ── 7.3 Acte incompatible avec profil bénéficiaire ───────────
-- Gravité : ÉLEVÉ  (sexe / âge)
WITH fs AS (
    SELECT fichier_importe_id FROM sessions_audit_fichiers WHERE session_id = @session_id
)
SELECT
    p.id, p.numero_prestation, p.fichier_importe_id, fi.mois_fichier, fi.annee_fichier,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.code_acte, p.acte,
    ra_ref.profil_beneficiaire   AS profil_requis,
    ra_ass.sexe                  AS sexe_beneficiaire,
    TIMESTAMPDIFF(YEAR, ra_ass.date_naissance, p.date_soins) AS age_beneficiaire,
    p.date_soins,
    ROUND(p.montant_paye, 2)     AS montant_paye
FROM prestations p
JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
JOIN fichiers_importes fi ON fi.id = p.fichier_importe_id
JOIN ref_actes ra_ref
  ON ra_ref.code_acte    = p.code_acte
 AND ra_ref.compagnie_id = @compagnie_id
 AND ra_ref.profil_beneficiaire != 'tous'
LEFT JOIN ref_assures ra_ass
  ON ra_ass.matricule    = p.matricule_beneficiaire
 AND ra_ass.compagnie_id = @compagnie_id
WHERE
    (ra_ref.profil_beneficiaire = 'femme'  AND LOWER(COALESCE(ra_ass.sexe,'')) = 'm')
 OR (ra_ref.profil_beneficiaire = 'homme'  AND LOWER(COALESCE(ra_ass.sexe,'')) = 'f')
 OR (ra_ref.profil_beneficiaire = 'enfant' AND TIMESTAMPDIFF(YEAR, ra_ass.date_naissance, p.date_soins) >= 18)
 OR (ra_ref.profil_beneficiaire = 'adulte' AND TIMESTAMPDIFF(YEAR, ra_ass.date_naissance, p.date_soins) < 18);

-- ── 7.4 Acte chirurgical sans hospitalisation correspondante ──
-- Gravité : ÉLEVÉ  (fenêtre ±7 jours, multi-mois)
WITH fs AS (
    SELECT fichier_importe_id FROM sessions_audit_fichiers WHERE session_id = @session_id
)
SELECT
    p.id, p.numero_prestation, p.fichier_importe_id, fi.mois_fichier, fi.annee_fichier,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.code_acte, p.acte, p.date_soins,
    ROUND(p.montant_paye, 2) AS montant_paye
FROM prestations p
JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
JOIN fichiers_importes fi ON fi.id = p.fichier_importe_id
JOIN ref_actes ra_ref
  ON ra_ref.code_acte                = p.code_acte
 AND ra_ref.compagnie_id             = @compagnie_id
 AND ra_ref.necessite_hospitalisation = 1
WHERE NOT EXISTS (
    SELECT 1 FROM prestations p2
    WHERE p2.gestionnaire_id        = p.gestionnaire_id
      AND p2.matricule_beneficiaire = p.matricule_beneficiaire
      AND UPPER(p2.code_famille_prestation) LIKE '%HOSPIT%'
      AND p2.date_soins BETWEEN DATE_SUB(p.date_soins, INTERVAL 7 DAY)
                            AND DATE_ADD(p.date_soins, INTERVAL 7 DAY)
);

-- ── 7.5 Répétition suspecte du même acte (fenêtre 30 jours) ──
-- Gravité : ÉLEVÉ  — Multi-mois nativement
WITH fs AS (
    SELECT fichier_importe_id FROM sessions_audit_fichiers WHERE session_id = @session_id
)
SELECT
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.police, p.numero_college,
    p.code_acte, p.acte,
    MIN(p.date_soins)                                  AS premiere_date,
    MAX(p.date_soins)                                  AS derniere_date,
    DATEDIFF(MAX(p.date_soins), MIN(p.date_soins))     AS fenetre_jours,
    COUNT(*)                                           AS nb_repetitions,
    ROUND(SUM(p.montant_paye), 2)                      AS montant_total,
    GROUP_CONCAT(p.id ORDER BY p.date_soins SEPARATOR ',') AS ids,
    GROUP_CONCAT(DISTINCT CONCAT(fi.mois_fichier,'/',fi.annee_fichier) SEPARATOR ', ') AS mois_concernes
FROM prestations p
JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
JOIN fichiers_importes fi ON fi.id = p.fichier_importe_id
GROUP BY
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.police, p.numero_college, p.code_acte, p.acte
HAVING COUNT(*) > 5
   AND DATEDIFF(MAX(p.date_soins), MIN(p.date_soins)) <= 30
ORDER BY nb_repetitions DESC;

-- ================================================================
-- CATEGORIE 8 — CONTRÔLES TEMPORELS  (INCONDITIONNEL)
-- ================================================================

-- ── 8.1 Date de soins dans le futur ──────────────────────────
-- Gravité : CRITIQUE
WITH fs AS (
    SELECT fichier_importe_id FROM sessions_audit_fichiers WHERE session_id = @session_id
)
SELECT
    p.id, p.numero_prestation, p.fichier_importe_id, fi.mois_fichier, fi.annee_fichier,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.date_soins, ROUND(p.montant_paye, 2) AS montant_paye,
    DATEDIFF(p.date_soins, CURDATE()) AS jours_dans_futur
FROM prestations p
JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
JOIN fichiers_importes fi ON fi.id = p.fichier_importe_id
WHERE p.date_soins > CURDATE()
ORDER BY jours_dans_futur DESC;

-- ── 8.2 Prestations hors exercice comptable (tardives) ────────
-- Gravité : CRITIQUE
WITH fs AS (
    SELECT fichier_importe_id FROM sessions_audit_fichiers WHERE session_id = @session_id
),
exercice AS (
    SELECT ec.date_debut, ec.date_fin
    FROM sessions_audit sa
    JOIN exercices_comptables ec ON ec.id = sa.exercice_id
    WHERE sa.id = @session_id
)
SELECT
    p.id, p.numero_prestation, p.fichier_importe_id, fi.mois_fichier, fi.annee_fichier,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.date_soins, ROUND(p.montant_paye, 2) AS montant_paye,
    e.date_debut AS debut_exercice, e.date_fin AS fin_exercice,
    IF(p.date_soins < e.date_debut, 'Avant exercice', 'Apres exercice') AS motif
FROM prestations p
JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
JOIN fichiers_importes fi ON fi.id = p.fichier_importe_id
JOIN exercice e ON p.date_soins < e.date_debut OR p.date_soins > e.date_fin;

-- Marquer les prestations tardives
UPDATE prestations p
JOIN sessions_audit_fichiers saf ON saf.fichier_importe_id = p.fichier_importe_id
JOIN sessions_audit sa ON sa.id = saf.session_id
JOIN exercices_comptables ec ON ec.id = sa.exercice_id
SET p.est_tardive = 1, p.est_rejetee = 1
WHERE saf.session_id = @session_id
  AND (p.date_soins < ec.date_debut OR p.date_soins > ec.date_fin);

-- ── 8.3 Écart excessif date_soins / date_comptable ───────────
-- Gravité : MOYEN  — @jours_max = 90 par défaut
WITH fs AS (
    SELECT fichier_importe_id FROM sessions_audit_fichiers WHERE session_id = @session_id
)
SELECT
    p.id, p.numero_prestation, p.fichier_importe_id, fi.mois_fichier, fi.annee_fichier,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.date_soins, p.date_comptable,
    ABS(DATEDIFF(p.date_comptable, p.date_soins)) AS ecart_jours,
    ROUND(p.montant_paye, 2) AS montant_paye
FROM prestations p
JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
JOIN fichiers_importes fi ON fi.id = p.fichier_importe_id
WHERE p.date_soins IS NOT NULL AND p.date_comptable IS NOT NULL
  AND ABS(DATEDIFF(p.date_comptable, p.date_soins)) > COALESCE(@jours_max, 90)
ORDER BY ecart_jours DESC;

-- ── 8.4 Soins antérieurs à la naissance ──────────────────────
-- Gravité : CRITIQUE
WITH fs AS (
    SELECT fichier_importe_id FROM sessions_audit_fichiers WHERE session_id = @session_id
)
SELECT
    p.id, p.numero_prestation, p.fichier_importe_id, fi.mois_fichier, fi.annee_fichier,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.date_soins, ROUND(p.montant_paye, 2) AS montant_paye,
    COALESCE(ra.date_naissance, p.date_naissance_beneficiaire) AS date_naissance
FROM prestations p
JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
JOIN fichiers_importes fi ON fi.id = p.fichier_importe_id
LEFT JOIN ref_assures ra ON ra.matricule = p.matricule_beneficiaire AND ra.compagnie_id = @compagnie_id
WHERE p.date_soins < COALESCE(ra.date_naissance, p.date_naissance_beneficiaire);

-- ── 8.5 Analyse temporelle MULTI-MOIS : évolution mensuelle ──
-- Gravité : INFO  — Utilise les window functions MySQL 8
WITH fs AS (
    SELECT saf.fichier_importe_id, fi.mois_fichier, fi.annee_fichier,
           fi.gestionnaire_id, g.nom AS gestionnaire_nom
    FROM sessions_audit_fichiers saf
    JOIN fichiers_importes fi ON fi.id = saf.fichier_importe_id
    JOIN gestionnaires g ON g.id = fi.gestionnaire_id
    WHERE saf.session_id = @session_id
),
stats_mensuelles AS (
    SELECT
        fs.gestionnaire_id, fs.gestionnaire_nom,
        fs.mois_fichier, fs.annee_fichier,
        COUNT(p.id)                          AS nb_prestations,
        ROUND(SUM(p.montant_reclame), 2)     AS total_reclame,
        ROUND(SUM(p.montant_paye), 2)        AS total_paye,
        COUNT(DISTINCT p.matricule_beneficiaire) AS nb_beneficiaires,
        COUNT(DISTINCT p.code_prestataire)       AS nb_prestataires
    FROM prestations p
    JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
    GROUP BY fs.gestionnaire_id, fs.gestionnaire_nom, fs.mois_fichier, fs.annee_fichier
)
SELECT
    sm.*,
    LAG(sm.total_paye) OVER (
        PARTITION BY sm.gestionnaire_id
        ORDER BY sm.annee_fichier, sm.mois_fichier
    ) AS montant_mois_precedent,
    ROUND(
        (sm.total_paye - LAG(sm.total_paye) OVER (
            PARTITION BY sm.gestionnaire_id
            ORDER BY sm.annee_fichier, sm.mois_fichier
        )) / NULLIF(LAG(sm.total_paye) OVER (
            PARTITION BY sm.gestionnaire_id
            ORDER BY sm.annee_fichier, sm.mois_fichier
        ), 0) * 100, 2
    ) AS variation_pct,
    CASE
        WHEN ABS((sm.total_paye - LAG(sm.total_paye) OVER (
            PARTITION BY sm.gestionnaire_id ORDER BY sm.annee_fichier, sm.mois_fichier
        )) / NULLIF(LAG(sm.total_paye) OVER (
            PARTITION BY sm.gestionnaire_id ORDER BY sm.annee_fichier, sm.mois_fichier
        ), 0) * 100) > 50 THEN 'ALERTE_VARIATION'
        ELSE 'NORMAL'
    END AS statut_variation
FROM stats_mensuelles sm
ORDER BY sm.gestionnaire_id, sm.annee_fichier, sm.mois_fichier;

-- ================================================================
-- CATEGORIE 9 — COHÉRENCE CONTRACTUELLE  (CONDITIONNEL — ref_contrats)
-- ================================================================

-- ── 9.1 Contrat inexistant ────────────────────────────────────
-- Gravité : CRITIQUE
WITH fs AS (
    SELECT fichier_importe_id FROM sessions_audit_fichiers WHERE session_id = @session_id
),
polices_distinctes AS (
    SELECT DISTINCT p.police, p.police_interne, p.code_souscripteur, p.souscripteur,
                    COUNT(*) AS nb_lignes, ROUND(SUM(p.montant_paye), 2) AS montant_total
    FROM prestations p
    JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
    WHERE p.police IS NOT NULL AND p.police != ''
    GROUP BY p.police, p.police_interne, p.code_souscripteur, p.souscripteur
)
SELECT pd.*
FROM polices_distinctes pd
LEFT JOIN ref_contrats rc ON rc.police = pd.police AND rc.compagnie_id = @compagnie_id
WHERE rc.police IS NULL
ORDER BY pd.montant_total DESC;

-- ── 9.2 Gestionnaire non mandaté ─────────────────────────────
-- Gravité : CRITIQUE
WITH fs AS (
    SELECT saf.fichier_importe_id, fi.gestionnaire_id
    FROM sessions_audit_fichiers saf
    JOIN fichiers_importes fi ON fi.id = saf.fichier_importe_id
    WHERE saf.session_id = @session_id
)
SELECT
    p.id, p.numero_prestation, p.fichier_importe_id, fi.mois_fichier, fi.annee_fichier,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.police, p.numero_college, p.date_soins, ROUND(p.montant_paye, 2) AS montant_paye,
    g.nom AS gestionnaire_mandate
FROM prestations p
JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
JOIN fichiers_importes fi ON fi.id = p.fichier_importe_id
JOIN ref_contrats rc ON rc.police = p.police AND rc.compagnie_id = @compagnie_id
JOIN gestionnaires g ON g.id = rc.gestionnaire_id
WHERE rc.gestionnaire_id != fs.gestionnaire_id;

-- ── 9.3 Contrat hors période de validité ─────────────────────
-- Gravité : CRITIQUE
WITH fs AS (
    SELECT fichier_importe_id FROM sessions_audit_fichiers WHERE session_id = @session_id
)
SELECT
    p.id, p.numero_prestation, p.fichier_importe_id, fi.mois_fichier, fi.annee_fichier,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.police, p.date_soins, ROUND(p.montant_paye, 2) AS montant_paye,
    rc.date_effet, rc.date_echeance,
    IF(p.date_soins < rc.date_effet, 'Avant effet', 'Apres echeance') AS motif
FROM prestations p
JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
JOIN fichiers_importes fi ON fi.id = p.fichier_importe_id
JOIN ref_contrats rc ON rc.police = p.police AND rc.compagnie_id = @compagnie_id
WHERE p.date_soins < rc.date_effet OR p.date_soins > rc.date_echeance;

-- ── 9.4 Souscripteur incohérent ───────────────────────────────
-- Gravité : ÉLEVÉ
WITH fs AS (
    SELECT fichier_importe_id FROM sessions_audit_fichiers WHERE session_id = @session_id
),
souscr_distincts AS (
    SELECT DISTINCT p.police, p.code_souscripteur, p.souscripteur
    FROM prestations p
    JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
    WHERE p.police IS NOT NULL
)
SELECT
    sd.police,
    sd.code_souscripteur,
    sd.souscripteur         AS souscripteur_fichier,
    rc.souscripteur         AS souscripteur_referentiel
FROM souscr_distincts sd
JOIN ref_contrats rc ON rc.police = sd.police AND rc.compagnie_id = @compagnie_id
WHERE rc.souscripteur IS NOT NULL
  AND LOWER(TRIM(sd.souscripteur)) != LOWER(TRIM(rc.souscripteur));

-- ================================================================
-- CATEGORIE 10 — ANALYSES STATISTIQUES  (INCONDITIONNEL)
-- ================================================================

-- ── 10.1 Score de risque par prestataire (MULTI-MOIS cumulé) ──
WITH fs AS (
    SELECT fichier_importe_id FROM sessions_audit_fichiers WHERE session_id = @session_id
),
moy_globale AS (
    SELECT AVG(p.montant_paye) AS moy
    FROM prestations p
    JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
),
stats_prest AS (
    SELECT
        p.code_prestataire, p.prestataire,
        COUNT(*)                               AS nb_actes,
        ROUND(SUM(p.montant_paye), 2)          AS montant_total,
        ROUND(AVG(p.montant_paye), 2)          AS montant_moyen,
        COUNT(DISTINCT p.matricule_beneficiaire) AS nb_beneficiaires,
        COUNT(DISTINCT p.code_acte)              AS nb_actes_distincts,
        COUNT(DISTINCT fi.mois_fichier)           AS nb_mois_actif,
        GROUP_CONCAT(DISTINCT CONCAT(fi.mois_fichier,'/',fi.annee_fichier) SEPARATOR ', ') AS mois_activite
    FROM prestations p
    JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
    JOIN fichiers_importes fi ON fi.id = p.fichier_importe_id
    GROUP BY p.code_prestataire, p.prestataire
)
SELECT
    sp.*,
    mg.moy                                              AS moy_globale,
    ROUND(sp.nb_actes / NULLIF(sp.nb_beneficiaires, 0), 2) AS ratio_actes_benef,
    -- Score de risque 0-100
    LEAST(100, GREATEST(0,
        -- Composante 1 : montant moyen vs moyenne globale (40 pts max)
        CASE WHEN mg.moy > 0
             THEN LEAST(40, ROUND((sp.montant_moyen / mg.moy - 1) * 20))
             ELSE 0 END
        +
        -- Composante 2 : ratio actes/bénéficiaires (30 pts max)
        CASE WHEN (sp.nb_actes / NULLIF(sp.nb_beneficiaires, 0)) > 3
             THEN LEAST(30, ROUND((sp.nb_actes / NULLIF(sp.nb_beneficiaires, 0) - 3) * 10))
             ELSE 0 END
        +
        -- Composante 3 : rang par montant (30 pts max — calculé ensuite en JS)
        0
    )) AS score_risque_partiel,
    RANK() OVER (ORDER BY sp.montant_total DESC) AS rang_montant
FROM stats_prest sp
CROSS JOIN moy_globale mg
ORDER BY score_risque_partiel DESC, montant_total DESC;

-- ── 10.2 Score de risque par bénéficiaire (MULTI-MOIS cumulé) ─
WITH fs AS (
    SELECT fichier_importe_id FROM sessions_audit_fichiers WHERE session_id = @session_id
)
SELECT
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.police, p.numero_college, p.college,
    COUNT(*)                               AS nb_actes,
    ROUND(SUM(p.montant_paye), 2)          AS montant_total,
    ROUND(AVG(p.montant_paye), 2)          AS montant_moyen,
    COUNT(DISTINCT p.code_prestataire)     AS nb_prestataires,
    COUNT(DISTINCT p.date_soins)           AS nb_jours_soins,
    COUNT(DISTINCT fi.mois_fichier)        AS nb_mois_actif,
    SUM(p.nb_anomalies)                    AS total_anomalies,
    GROUP_CONCAT(DISTINCT CONCAT(fi.mois_fichier,'/',fi.annee_fichier) SEPARATOR ', ') AS mois_activite,
    RANK() OVER (ORDER BY SUM(p.montant_paye) DESC) AS rang_montant
FROM prestations p
JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
JOIN fichiers_importes fi ON fi.id = p.fichier_importe_id
GROUP BY
    p.matricule_beneficiaire, p.nom_beneficiaire,
    p.matricule_assure_principal, p.nom_assure_principal, p.prenoms_assure_principal,
    p.police, p.numero_college, p.college
ORDER BY montant_total DESC;

-- ── 10.3 Comparaison mois par mois — variation >±50% ─────────
WITH fs AS (
    SELECT saf.fichier_importe_id, fi.gestionnaire_id, fi.mois_fichier, fi.annee_fichier
    FROM sessions_audit_fichiers saf
    JOIN fichiers_importes fi ON fi.id = saf.fichier_importe_id
    WHERE saf.session_id = @session_id
),
sm AS (
    SELECT
        fs.gestionnaire_id, g.nom AS gest_nom,
        fs.mois_fichier, fs.annee_fichier,
        ROUND(SUM(p.montant_paye), 2) AS total,
        COUNT(p.id)                   AS nb
    FROM prestations p
    JOIN fs ON fs.fichier_importe_id = p.fichier_importe_id
    JOIN gestionnaires g ON g.id = fs.gestionnaire_id
    GROUP BY fs.gestionnaire_id, g.nom, fs.mois_fichier, fs.annee_fichier
)
SELECT
    sm.gestionnaire_id, sm.gest_nom,
    sm.mois_fichier, sm.annee_fichier,
    sm.total        AS montant_mois,
    sm.nb           AS nb_prestations,
    LAG(sm.total) OVER (PARTITION BY sm.gestionnaire_id ORDER BY sm.annee_fichier, sm.mois_fichier) AS montant_precedent,
    ROUND(
        (sm.total - LAG(sm.total) OVER (PARTITION BY sm.gestionnaire_id ORDER BY sm.annee_fichier, sm.mois_fichier))
        / NULLIF(LAG(sm.total) OVER (PARTITION BY sm.gestionnaire_id ORDER BY sm.annee_fichier, sm.mois_fichier), 0) * 100
    , 2) AS variation_pct,
    CASE WHEN ABS(
        (sm.total - LAG(sm.total) OVER (PARTITION BY sm.gestionnaire_id ORDER BY sm.annee_fichier, sm.mois_fichier))
        / NULLIF(LAG(sm.total) OVER (PARTITION BY sm.gestionnaire_id ORDER BY sm.annee_fichier, sm.mois_fichier), 0)
        * 100
    ) > 50 THEN 'ALERTE' ELSE 'NORMAL' END AS statut
FROM sm
ORDER BY sm.gestionnaire_id, sm.annee_fichier, sm.mois_fichier;

-- ── 10.4 Loi de Benford sur les montants ─────────────────────
-- Gravité : ÉLEVÉ si écart > 5%
-- MySQL 8 : utilisation d'une CTE récursive pour générer les chiffres 1-9
WITH RECURSIVE chiffres AS (
    SELECT 1 AS d
    UNION ALL
    SELECT d + 1 FROM chiffres WHERE d < 9
),
premiers AS (
    SELECT
        LEFT(CAST(FLOOR(ABS(p.montant_paye)) AS CHAR), 1) AS premier_chiffre,
        COUNT(*) AS observes
    FROM prestations p
    JOIN sessions_audit_fichiers saf ON saf.fichier_importe_id = p.fichier_importe_id
    WHERE saf.session_id = @session_id
      AND p.montant_paye > 0
      AND FLOOR(ABS(p.montant_paye)) > 0
    GROUP BY LEFT(CAST(FLOOR(ABS(p.montant_paye)) AS CHAR), 1)
),
total AS (SELECT SUM(observes) AS n FROM premiers),
benford AS (
    SELECT
        CAST(d AS CHAR) AS premier_chiffre,
        ROUND(LOG10(1 + 1.0/d) * 100, 2) AS pct_benford
    FROM chiffres
)
SELECT
    b.premier_chiffre,
    COALESCE(p.observes, 0)               AS observes,
    t.n                                   AS total_montants,
    ROUND(COALESCE(p.observes, 0) / NULLIF(t.n, 0) * 100, 2) AS pct_observe,
    b.pct_benford,
    ROUND(ABS(COALESCE(p.observes, 0) / NULLIF(t.n, 0) * 100 - b.pct_benford), 2) AS ecart_pct,
    IF(ABS(COALESCE(p.observes, 0) / NULLIF(t.n, 0) * 100 - b.pct_benford) > 5, 'ANOMALIE', 'NORMAL') AS statut
FROM benford b
LEFT JOIN premiers p ON p.premier_chiffre = b.premier_chiffre
CROSS JOIN total t
ORDER BY CAST(b.premier_chiffre AS UNSIGNED);

-- ── 10.5 Clustering : prestataires avec ≥3 types d'anomalies ─
WITH fs AS (
    SELECT fichier_importe_id FROM sessions_audit_fichiers WHERE session_id = @session_id
)
SELECT
    p.code_prestataire, p.prestataire,
    COUNT(DISTINCT a.categorie)                        AS nb_types_anomalies,
    COUNT(DISTINCT a.code_anomalie)                    AS nb_codes_distincts,
    COUNT(a.id)                                        AS total_anomalies,
    ROUND(SUM(a.montant_impacte), 2)                   AS montant_impacte_total,
    GROUP_CONCAT(DISTINCT a.categorie    SEPARATOR ', ') AS categories_touchees,
    GROUP_CONCAT(DISTINCT a.code_anomalie SEPARATOR ', ') AS codes_anomalies
FROM anomalies a
JOIN prestations p ON p.id = a.prestation_id
JOIN fs ON fs.fichier_importe_id = a.fichier_importe_id
GROUP BY p.code_prestataire, p.prestataire
HAVING COUNT(DISTINCT a.categorie) >= 3
ORDER BY nb_types_anomalies DESC, montant_impacte_total DESC;

-- ================================================================
-- RAPPORT R01 — SYNTHÈSE GÉNÉRALE (mono ou multi-mois)
-- ================================================================
WITH fs AS (
    SELECT saf.fichier_importe_id, fi.mois_fichier, fi.annee_fichier,
           fi.gestionnaire_id, g.nom AS gestionnaire_nom
    FROM sessions_audit_fichiers saf
    JOIN fichiers_importes fi ON fi.id = saf.fichier_importe_id
    JOIN gestionnaires g ON g.id = fi.gestionnaire_id
    WHERE saf.session_id = @session_id
)
SELECT
    sa.libelle                                     AS session_libelle,
    sa.type_session,
    MIN(fs.mois_fichier)                           AS mois_debut,
    MAX(fs.mois_fichier)                           AS mois_fin,
    MIN(fs.annee_fichier)                          AS annee,
    COUNT(DISTINCT fs.fichier_importe_id)           AS nb_fichiers,
    GROUP_CONCAT(DISTINCT fs.gestionnaire_nom SEPARATOR ', ') AS gestionnaires,
    -- Totaux prestations
    COUNT(p.id)                                    AS nb_total_prestations,
    SUM(p.est_valide)                              AS nb_valides,
    SUM(p.est_tardive)                             AS nb_tardives,
    SUM(IF(p.est_rejetee = 1 AND p.est_tardive = 0, 1, 0)) AS nb_rejetes_hors_tardifs,
    SUM(IF(p.nb_anomalies > 0, 1, 0))             AS nb_avec_anomalies,
    -- Montants
    ROUND(SUM(p.montant_reclame), 2)               AS total_reclame,
    ROUND(SUM(p.montant_paye), 2)                  AS total_paye,
    ROUND(SUM(IF(p.est_tardive = 1, p.montant_paye, 0)), 2) AS montant_tardifs,
    ROUND(SUM(IF(p.est_rejetee = 1, p.montant_paye, 0)), 2) AS montant_rejetes,
    -- Taux
    ROUND(SUM(IF(p.nb_anomalies > 0, 1, 0)) / NULLIF(COUNT(p.id), 0) * 100, 2) AS taux_anomalie_pct,
    -- Acteurs
    COUNT(DISTINCT p.matricule_beneficiaire)        AS nb_beneficiaires_distincts,
    COUNT(DISTINCT p.code_prestataire)              AS nb_prestataires_distincts,
    -- Anomalies
    COUNT(a.id)                                    AS nb_anomalies_total,
    SUM(IF(a.gravite = 'critique', 1, 0))          AS nb_critique,
    SUM(IF(a.gravite = 'eleve',    1, 0))          AS nb_eleve,
    SUM(IF(a.gravite = 'moyen',    1, 0))          AS nb_moyen,
    SUM(IF(a.gravite = 'faible',   1, 0))          AS nb_faible,
    ROUND(SUM(a.montant_impacte), 2)               AS montant_anomalies,
    -- Recommandation paiement
    ROUND(
        SUM(p.montant_paye)
        - COALESCE(SUM(IF(p.est_rejetee = 1, p.montant_paye, 0)), 0)
        - COALESCE(SUM(IF(a.gravite = 'critique', a.montant_impacte, 0)), 0)
    , 2) AS montant_net_recommande
FROM sessions_audit sa
JOIN fs ON TRUE
JOIN prestations p ON p.fichier_importe_id = fs.fichier_importe_id
LEFT JOIN anomalies a ON a.fichier_importe_id = p.fichier_importe_id AND a.prestation_id = p.id
WHERE sa.id = @session_id
GROUP BY sa.libelle, sa.type_session;

-- ================================================================
-- FIN DES REQUÊTES CRYSTAL v2 — MySQL 8.0+
-- ================================================================
