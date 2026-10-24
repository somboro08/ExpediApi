# Journal des décisions à confirmer

| ID | Sujet | État | Décision nécessaire |
|---|---|---|---|
| D-001 | Paiements | À confirmer | Prestataires, moyens acceptés, frais, commission, séquestre et versements. |
| D-002 | Authentification | À confirmer | E-mail/téléphone, OTP, durée et rotation des refresh tokens, révocation de sessions. |
| D-003 | Réservations | À confirmer | États, transitions, annulation, codes de collecte/livraison et libération du séquestre. |
| D-004 | Rôles | À confirmer | Auto-attribution sender/traveler versus attribution admin et hiérarchie RBAC. |
| D-005 | KYC | À confirmer | Fournisseur, pièces requises, expiration et renouvellement. |
| D-006 | Suppression des comptes | À confirmer | Anonymisation, suppression admin, conservation et audit. |
| D-007 | Notifications | À confirmer | Fournisseurs push/SMS/e-mail, préférences et retries. |
| D-008 | Temps réel | À confirmer | Socket.IO ou WebSocket natif, reprise et persistance des événements. |
| D-009 | Événements internes | À confirmer | Bus, retry, livraison au moins une fois et idempotence. |
| D-010 | Fichiers | À confirmer | Stockage, tailles, types MIME, antivirus et URLs signées. |
| D-011 | Erreurs et pagination | À confirmer | Enveloppe commune, codes HTTP, filtres et tri définitifs. |
| D-012 | Administration | À confirmer | Permissions fines, durée d’impersonation et audit obligatoire. |
| D-013 | Webhooks sortants | Optionnel | Confirmer l’inclusion en v1 ou le report. |
| D-014 | Environnements | À confirmer | Domaine API, staging et production. |

## Règle

Une décision non confirmée ne doit pas être transformée silencieusement en exigence définitive. Le contrat OpenAPI reste un brouillon tant que les règles métier et les schémas propres à chaque opération ne sont pas validés.
