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

## Installation et lancement

```bash
npm install
npm run start:dev
```

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

## Architecture cible

Approche hybride : le contrat OpenAPI guide la conception, puis les modules NestJS et leurs DTO/guards/services implémentent les opérations. Les domaines prévus sont : Authentification, Utilisateurs, KYC, RBAC, Annonces d’espaces, Annonces de colis, Réservations, Suivi GPS, Messagerie, Notifications, Paiements, Avis, Modération, Litiges, Support, Statistiques, Administration, Fichiers et Métadonnées.

## À noter

- Les exemples et décisions provisoires ne constituent pas des règles confirmées.
- Ne pas connecter de vrais prestataires de paiement/KYC avant d'avoir validé leur contrat, les secrets et les scénarios de webhook.
- Les routes listées dans OpenAPI ne sont pas encore toutes opérationnelles : elles servent pour l'instant de contrat de travail.
