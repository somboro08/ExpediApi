# ExpediApi

API NestJS pour une plateforme mettant en relation les Voyageurs/Conducteurs et les Expéditeurs afin de transporter des colis.

## État du dépôt

Le dépôt a été initialisé à partir des documents de spécification. Le contrat OpenAPI est un **brouillon** : il recense les opérations envisagées, mais plusieurs schémas de requête/réponse sont encore génériques et les règles métier restent à confirmer. Pour le moment, seul le point de santé est un endpoint métier opérationnel. Le socle inclut aussi une validation globale des DTO et un filtre d’erreurs commun.

## Documents

- [Inventaire des endpoints](docs/api-inventory.md)
- [Décisions à confirmer](docs/decisions-a-confirmer.md)
- [Contrat OpenAPI 3.1](openapi/openapi.yaml)

## Prérequis

- Node.js 20+
- npm
- Docker Desktop (pour lancer PostgreSQL localement) ou un serveur PostgreSQL accessible

## Installation et lancement

1. Créer le fichier d'environnement local :

```bash
cp .env.example .env
```

Sous PowerShell, si `cp` n'est pas disponible : `Copy-Item .env.example .env`.

2. Démarrer PostgreSQL localement :

```bash
docker compose up -d postgres
```

3. Installer les dépendances (le client Prisma est généré via `postinstall`) :

```bash
npm install
```

4. Créer et appliquer la migration initiale :

```bash
npx prisma migrate dev --name init
```

5. Démarrer l'API :

```bash
npm run start:dev
```

Pour ouvrir Prisma Studio : `npm run db:studio`. Pour arrêter PostgreSQL : `docker compose down` (les données persistent dans le volume Docker).

- API locale : `http://localhost:3000/v1`
- Swagger UI : `http://localhost:3000/docs`
- Point de santé : `http://localhost:3000/v1/health`

L'application lit le contrat depuis `openapi/openapi.yaml` au démarrage pour alimenter Swagger UI. Lancez-la depuis la racine du dépôt.

## Validation et format des erreurs

- `ValidationPipe` global : transformation des entrées, suppression interdite des champs inconnus et rejet des propriétés non déclarées dans les DTO.
- `ApiExceptionFilter` : enveloppe d’erreur commune avec `success: false`, `error.code`, `error.message`, `error.details` et des métadonnées de requête.
- Les erreurs internes renvoient un message générique au client ; les détails techniques sont consignés côté serveur.
- Les DTO doivent utiliser les décorateurs de `class-validator` pour activer la validation des propriétés.

## Tests

```bash
npm test
npm run build
npm run lint
```

## Base de données (Prisma + PostgreSQL)

- `prisma/schema.prisma` définit les modèles initiaux `User` et `Session`, les statuts de compte et les rôles provisoires.
- `src/prisma/prisma.module.ts` expose le service Prisma globalement ; `src/prisma/prisma.service.ts` gère la connexion et la déconnexion.
- `DATABASE_URL` est configurée dans `.env`. Ne jamais committer le fichier `.env` ou de vrais secrets.
- Le schéma initial est un point de départ. Les règles d'attribution des rôles, la vérification e-mail/téléphone et la politique de sessions restent à valider avant d'implémenter l'authentification.
- Après modification du schéma, utiliser `npx prisma migrate dev --name nom_de_migration` en développement et `npm run db:deploy` pour appliquer les migrations en déploiement.

## Architecture cible

Approche hybride : le contrat OpenAPI guide la conception, puis les modules NestJS et leurs DTO/guards/services implémentent les opérations. Les domaines prévus sont : Authentification, Utilisateurs, KYC, RBAC, Annonces d’espaces, Annonces de colis, Réservations, Suivi GPS, Messagerie, Notifications, Paiements, Avis, Modération, Litiges, Support, Statistiques, Administration, Fichiers et Métadonnées.

## À noter

- Les exemples et décisions provisoires ne constituent pas des règles confirmées.
- Ne pas connecter de vrais prestataires de paiement/KYC avant d'avoir validé leur contrat, les secrets et les scénarios de webhook.
- Les routes listées dans OpenAPI ne sont pas encore toutes opérationnelles : elles servent pour l'instant de contrat de travail.
