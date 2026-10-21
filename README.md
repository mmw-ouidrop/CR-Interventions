# OUIDROP Interventions — PWA hors ligne

Comptes rendus d'intervention remplis sans réseau, remontés dans Notion au retour du réseau.

```
gas/    Middleware Google Apps Script (Code.gs, Report.gs, appsscript.json, API.md, tests/)
web/    PWA Vue 3 + Vite + Dexie (charte graphique OUIDROP 2026)
```

Flux : **PWA ⇄ Google Apps Script ⇄ Notion**, avec Drive comme zone de transit des photos.

## 1. Notion

1. Créer une intégration interne (notion.so/my-integrations) → copier le secret.
2. Sur la base « Interventions » : `⋯ ▸ Connexions` → ajouter l'intégration.
3. La colonne d'ID court (ex. FI-252) est une propriété **ID unique** (nom par défaut : `ID`).
4. Le template du rapport se trouve dans la page de chaque mission : titres H1/H2/H3, cases à cocher
   et blocs de code `json` (un objet, ou un tableau d'objets).

## 2. Google Apps Script

1. Drive : créer le dossier racine des photos (aucun partage nécessaire) → copier son ID (fin de l'URL).
2. script.google.com ▸ nouveau projet avec **deux fichiers** : coller `gas/Code.gs` (fichier `Code`) et
   `gas/Report.gs` (nouveau fichier script `Report`). Afficher le manifeste
   (Paramètres du projet ▸ « Afficher le fichier appsscript.json ») et y coller `gas/appsscript.json`.
   Le contrat d'API (requêtes, fusion, codes d'erreur) est dans `gas/API.md`.
3. Paramètres du projet ▸ **Propriétés du script** :

   | Propriété | Valeur |
   |---|---|
   | `NOTION_TOKEN` | secret de l'intégration |
   | `NOTION_DB_ID` | ID de la base Interventions |
   | `DRIVE_FOLDER_ID` | ID du dossier racine Drive |
   | `APP_TOKEN` | chaîne aléatoire longue (la même ira dans la PWA) |
   | `REF_PROPERTY_NAME` | optionnel, défaut `ID` |
   | `REF_PROPERTY_TYPE` | optionnel, défaut `unique_id` |
   | `TEST_PAGE_ID` | optionnel : ID d'une page de test de la base (pour `testNotionCapabilities`) |

4. Exécuter **`testSetup`** (accorder les autorisations) : vérifie Drive et liste les colonnes Notion.
   Puis **`testNotionFileUpload`** (API d'envoi de fichiers), **`testNotionCapabilities`** (insertion à une
   position, mise à jour en place, bloc de données de 2000+ caractères : **à faire avant tout usage réel**,
   c'est la seule vérification contre le vrai Notion) et **`testGetIntervention`** (adapter l'ID).
5. Déployer ▸ Nouveau déploiement ▸ Application Web — *Exécuter en tant que : Moi*,
   *Accès : Tout le monde*. Copier l'URL `/exec`.
   Après chaque modification du code : *Gérer les déploiements ▸ Modifier ▸ Nouvelle version*.
6. Optionnel : déclencheur quotidien sur `purgeStaleTempFiles` (nettoie les photos jamais synchronisées après 14 jours).

Test hors Apps Script : `cd gas && node --test tests/sim.test.mjs` (32 scénarios sur un Notion et un Drive simulés :
fusion à deux techniciens, validation partagée, photos par lots, champs ajoutés, évolutions du template,
suppressions manuelles dans Notion, limites de l'API). Il vérifie la logique du script, pas le vrai Notion.

## 3. PWA

```bash
cd web
cp .env.example .env.local     # renseigner VITE_GAS_URL et VITE_APP_TOKEN
npm install
npm test                       # tests de la couche données
npm run dev                    # développement
npm run build && npm run preview
```

À héberger en HTTPS (obligatoire pour une PWA). Ouvrir une mission :
`https://votre-domaine/?id=FI-252` ou saisir l'ID dans l'app.

**Première visite en ligne obligatoire** (installation du cache). Sur iPhone : *Partager ▸ Sur l'écran d'accueil*
pour que les données ne soient pas purgées par Safari.

### Publication sur GitHub Pages

1. Créer un dépôt GitHub et y pousser **le contenu du dossier `ouidrop-interventions`** (`.github/`, `gas/`, `web/`, `README.md`) sur la branche `main`. Ne jamais commiter `.env.local`.
2. Settings ▸ Pages ▸ *Build and deployment* ▸ Source : **GitHub Actions**.
3. Settings ▸ Secrets and variables ▸ Actions : variable `VITE_GAS_URL` (URL `/exec`), secret `VITE_APP_TOKEN`.
4. Onglet Actions ▸ « Déployer la PWA » ▸ *Run workflow* (ou un push). L'adresse est
   `https://<compte>.github.io/<dépôt>/`. Ouvrir une mission : `…/?id=FI-252`.
5. Après un changement de code Apps Script, redéployer une **nouvelle version** du déploiement web (l'URL `/exec` reste la même).

Le jeton `APP_TOKEN` et l'URL du script sont intégrés au JavaScript publié : toute personne qui connaît l'adresse du site peut les lire.
Sur l'offre gratuite de GitHub, Pages exige un dépôt public (le code l'est donc aussi). À réserver à des données non sensibles.

## Versions de l'API Notion

`Code.gs` envoie `Notion-Version: 2022-06-28`. Dernière version publiée : `2026-03-11`
(https://developers.notion.com/reference/versioning). Notion ne prévoit pas de retirer les anciennes ;
les nouveaux endpoints (envoi de fichiers) fonctionnent sans changer de version. Ne pas passer à
`2025-09-03` ou plus sans adapter `findPageByReference_` (bases remplacées par des « data sources »).

## Comment fonctionne le rapport partagé

Le rapport est **un seul bloc 📋** en bas de la page Notion : titre « Rapport d'intervention — En cours | Validé »,
ligne grise « Dernière modification : Prénom Nom · date », un bloc par élément du template (mis à jour **en place**),
photos sous leur champ, et un bloc replié « Données de synchronisation » (JSON : c'est lui, pas le texte visible,
qui fait foi). Plusieurs techniciens écrivent dans le même rapport ; les saisies sont fusionnées champ par champ
(la plus récente gagne, la valeur écrasée est signalée à son auteur), les photos s'additionnent.
Les responsables peuvent ajouter des blocs au template à tout moment (même après le début du rapport) :
les techniciens les récupèrent avec « Actualiser » sans perdre leurs saisies.

**Ne pas modifier à la main** les blocs à l'intérieur du rapport : l'application ne les relit pas et les
écrase à la prochaine modification du champ concerné. Un bloc supprimé à la main est recréé ; un rapport
supprimé est reconstruit (le client renvoie alors tout ce qu'il a).

## Limites connues

- Écriture seule vers Notion : une correction faite à la main dans le rapport n'est pas reprise par l'application.
- Heure de saisie = horloge du téléphone corrigée du décalage mesuré avec le serveur (latence incluse, ~1 s) :
  deux saisies à moins d'une seconde d'écart sur le même champ peuvent se départager « à l'envers ».
- Pas de comptes : le nom est déclaré par l'utilisateur (non vérifié). `appToken` est embarqué dans la PWA : à
  réserver à un usage interne.
- Apps Script coupe une requête à 6 min : les photos sont transférées par lots de 6 par appel (durée par photo
  non mesurée sur le vrai système). Le verrou est unique pour tout le script : des synchronisations simultanées
  de fiches différentes s'exécutent l'une après l'autre (attente max. 30 s, puis `BUSY` et nouvel essai).
- Notion limite à ~3 requêtes/s ; une synchronisation de *k* champs modifiés coûte environ *k* + 3 appels Notion
  (estimation à partir du code, non mesurée). La relève des collègues (`getReport`) n'appelle pas Notion tant
  que rien n'a changé (cache 6 h). Quotas Apps Script (appels `UrlFetch` par jour, durée totale) : à vérifier
  pour votre type de compte avant le déploiement général.
- « Présence » (qui est sur la fiche) : en cache, volatile, jamais écrite dans Notion.
- Le rapport est limité à ~190 000 caractères de données de synchronisation (erreur `STATE_TOO_LARGE`).
- Notion refuse un fichier > 20 Mo (la PWA envoie des JPEG ≈ 300 Ko).
- Pas de synchronisation en arrière-plan fiable pour une PWA (iOS) : l'envoi a lieu quand l'application est ouverte.
- Mises à jour de l'API Notion : voir plus haut ; l'insertion « après un bloc » essaie la syntaxe actuelle puis
  l'ancienne, et à défaut ajoute en fin de rapport (avertissement `POSITION_UNSUPPORTED`).
