export const kpis = [{label:"Lignes importées", value:"12 485", sub:"Fichier Janv."},{label:"Anomalies", value:"1 247", sub:"10.0% total"},{label:"Montant réclamé", value:"248.5 M", sub:"FCFA ce mois"},{label:"Mnt recommandé", value:"231.2 M", sub:"FCFA à payer"}];
export const nav = [
  {href:"/dashboard",label:"Tableau de bord",icon:"DB",group:"RAPPORTS",color:"#38bdf8"},
  {href:"/import",label:"Importer fichier",icon:"IM",group:"RAPPORTS",color:"#10b981"},
  {href:"/synthese",label:"Synthèse audit",icon:"SY",group:"RAPPORTS",color:"#8b5cf6"},
  {href:"/rapports/audit",label:"Générer rapport",icon:"GR",group:"RAPPORTS",color:"#0898d0"},
  {href:"/rapports/comparatif",label:"Comparatif filiales",icon:"CF",group:"RAPPORTS",color:"#0ea5e9"},
  {href:"/rapports/tardifs",label:"Tardifs",icon:"TD",group:"RAPPORTS",color:"#f97316"},
  {href:"/rapports/doublons",label:"Doublons",icon:"DO",group:"RAPPORTS",color:"#ef4444"},
  {href:"/rapports/beneficiaires",label:"Bénéficiaires",icon:"BE",group:"RAPPORTS",color:"#a855f7"},
  {href:"/rapports/prestataires",label:"Prestataires",icon:"PR",group:"RAPPORTS",color:"#22c55e"},
  {href:"/rapports/montants",label:"Montants",icon:"MO",group:"RAPPORTS",color:"#f59e0b"},
  {href:"/rapports/frequence",label:"Fréquence",icon:"FR",group:"ANALYSE",color:"#14b8a6"},
  {href:"/rapports/actes",label:"Actes",icon:"AC",group:"ANALYSE",color:"#0ea5e9"},
  {href:"/rapports/temporel",label:"Temporel",icon:"TM",group:"ANALYSE",color:"#ef4444"},
  {href:"/scores",label:"Scores risque",icon:"SC",group:"ANALYSE",color:"#8b5cf6"},
  {href:"/recommandation",label:"Recommandation",icon:"RE",group:"ANALYSE",color:"#22c55e"},
  {href:"/bi",label:"BI & Analytics",icon:"BI",group:"ANALYSE",color:"#38bdf8"},
  {href:"/parametres",label:"Paramètres",icon:"PA",group:"CONFIG.",color:"#94a3b8"},
  {href:"/utilisateurs",label:"Utilisateurs",icon:"US",group:"CONFIG.",color:"#0ea5e9",roles:["super_admin","admin_compagnie"]},
  {href:"/administration",label:"Admin CRYSTAL",icon:"CR",group:"ADMINISTRATION",color:"#ef4444",roles:["super_admin"]},
  {href:"/organisation",label:"Compagnies & filiales",icon:"OR",group:"ADMINISTRATION",color:"#10b981",roles:["super_admin","admin_compagnie"]},
  {href:"/exercices",label:"Exercices comptables",icon:"EX",group:"ADMINISTRATION",color:"#f59e0b",roles:["super_admin","admin_compagnie"]},
  {href:"/gestionnaires",label:"Gestionnaires",icon:"GE",group:"ADMINISTRATION",color:"#0ea5e9",roles:["super_admin","admin_compagnie"]}
];
export const riskRows = ["CLINIQUE ST-JEAN COCODY|487|18.2M FCFA|87/100|Critique","PHARMACIE DU PLATEAU|312|9.8M FCFA|74/100|Élevé","CHU ANGRE SPÉCIALITÉS|198|14.1M FCFA|68/100|Élevé","LABO BIOMEDICAL EXPRESS|267|5.3M FCFA|61/100|Élevé","CLINIQUE LES ACACIAS|143|7.9M FCFA|55/100|Moyen"].map((r,i)=>{const [p,a,m,s,st]=r.split('|'); return {code:['CL-0023','PH-0891','CL-0156','LA-0047','CL-0089'][i], prestataire:p, actes:a, montant:m, score:s, statut:st}});
export const anomalyRows = ["Prestations tardives|198|8 745 200 F|Critique","Doublons fonctionnels|58|3 400 000 F|Critique","Bénéficiaires radiés|8|1 245 000 F|Critique","Montants hors tarif|87|2 100 000 F|Élevé","Actes hors nomenclature|3|85 000 F|Critique"].map(x=>{const [type,nb,montant,gravite]=x.split('|');return {type,nb,montant,gravite}})
export const chartData = [{name:'Jan',value:210},{name:'Fév',value:230},{name:'Mar',value:225},{name:'Avr',value:248},{name:'Mai',value:231},{name:'Juin',value:265}];
export const barData = [{name:'Consult.',value:234},{name:'Pharma',value:189},{name:'Hospit.',value:87},{name:'Bio',value:65},{name:'Spé.',value:43}];
