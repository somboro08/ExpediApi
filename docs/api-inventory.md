# Inventaire de l’API ExpediApi

> Statut : inventaire initial issu des documents de spécification. Les routes et comportements doivent être confirmés avant d'être considérés comme définitifs.

Base proposée : `/v1`. Format JSON UTF-8 ; upload multipart ; Bearer JWT ; UUID ; dates ISO 8601 UTC ; pagination `page`, `limit` (max. 100). Les routes ci-dessous sont relatives à `/v1`.

## Authentification et sessions
- POST `/auth/register` — créer un compte
- POST `/auth/login` — connexion
- POST `/auth/logout` — révocation de session
- POST `/auth/refresh` — renouvellement de tokens
- POST `/auth/verify-email`, POST `/auth/verify-phone` — vérifications
- POST `/auth/resend-otp` — renvoyer un OTP
- POST `/auth/forgot-password`, POST `/auth/reset-password` — récupération du mot de passe
- POST `/auth/change-password` — changement de mot de passe
- GET `/auth/sessions`, DELETE `/auth/sessions/{id}` — sessions

## Utilisateurs et RBAC
- GET/PATCH/DELETE `/users/me` — lire, modifier, demander suppression/anonymisation
- POST `/users/me/avatar` — avatar
- POST `/users/me/roles` — rôle additionnel (règle à confirmer)
- GET `/users/{id}/public` — profil public
- GET `/users`, GET/PATCH/DELETE `/users/{id}` — administration
- POST `/users/{id}/suspend`, POST `/users/{id}/unsuspend`, POST `/users/{id}/ban`
- GET `/roles`, GET `/permissions`, PUT `/roles/{id}/permissions`
- POST `/users/{id}/roles`, DELETE `/users/{id}/roles/{roleId}`

## KYC
- POST `/kyc/submissions` — soumettre un dossier
- GET `/kyc/submissions/me` — son statut
- GET `/kyc/submissions`, GET `/kyc/submissions/{id}` — revue administrative
- POST `/kyc/submissions/{id}/approve`, POST `/kyc/submissions/{id}/reject`
- POST `/kyc/webhook` — callback fournisseur KYC

## Annonces d’espaces
- GET/POST `/space-listings`
- GET/PATCH/DELETE `/space-listings/{id}`
- POST `/space-listings/{id}/publish`, `/pause`, `/duplicate`, `/cancel`, `/hide`
- GET `/users/me/space-listings`
- POST `/space-listings/{id}/photos`
- Filtres documentés : `from_city`, `to_city`, `from_date`, `to_date`, `min_capacity_kg`, `max_price_per_kg`, `transport_type`, `min_rating`, `sort`.

## Annonces de colis
- GET/POST `/parcel-listings`
- GET/PATCH/DELETE `/parcel-listings/{id}`
- POST `/parcel-listings/{id}/publish`, `/cancel`, `/hide`
- GET `/users/me/parcel-listings`
- POST `/parcel-listings/{id}/photos`
- GET `/parcel-listings/{id}/matches`
- Les adresses précises et le téléphone du destinataire sont masqués avant acceptation.

## Demandes et réservations
- POST/GET `/booking-requests`; GET `/booking-requests/{id}`
- POST `/booking-requests/{id}/accept`, `/refuse`, `/counter`, `/withdraw`
- GET `/bookings`, GET `/bookings/{id}`
- POST `/bookings/{id}/cancel`, `/pickup`, `/start-transit`, `/deliver`, `/confirm`
- GET `/bookings/{id}/history`
- `GET /bookings` est une route unique : la vue admin dépend du rôle et des filtres, pour éviter une duplication de méthode/chemin.

## Suivi GPS
- POST `/bookings/{id}/tracking/points`
- GET `/bookings/{id}/tracking/last`, `/route`, `/milestones`
- POST `/bookings/{id}/tracking/milestones`, `/share`
- Le voyageur de la réservation envoie des positions uniquement pendant les états de transport autorisés.

## Messagerie
- GET/POST `/conversations`
- GET/POST `/conversations/{id}/messages`
- POST `/conversations/{id}/read`, `/mute`
- DELETE `/messages/{id}`

## Notifications et appareils
- GET `/notifications`, GET `/notifications/unread-count`
- POST `/notifications/{id}/read`, `/notifications/read-all`
- GET/PUT `/notifications/preferences`
- POST `/devices`, DELETE `/devices/{id}`
- POST `/notifications/broadcast` — diffusion admin

## Paiements
- POST `/bookings/{id}/pay`
- GET `/payments/transactions`, GET `/payments/transactions/{id}`
- GET `/payments/wallet`
- POST/GET `/payments/payouts`
- GET/POST `/payment-methods`, DELETE `/payment-methods/{id}`
- POST `/payments/{transactionId}/refund`
- GET `/payments/invoices/{bookingId}`
- POST `/payments/webhook/{provider}`
- GET `/admin/payments`
- Paiement avec `Idempotency-Key` ; séquestre, commissions et délai de libération à confirmer.

## Avis
- POST `/bookings/{id}/reviews`
- GET `/users/{id}/reviews`
- DELETE `/reviews/{id}`

## Signalements et modération
- POST/GET `/reports`, GET `/reports/{id}`
- POST `/reports/{id}/assign`, `/resolve`, `/dismiss`, `/escalate`

## Litiges
- POST `/bookings/{id}/disputes`
- GET `/disputes`, GET `/disputes/{id}`
- POST `/disputes/{id}/evidence`, `/decision`

## Service client
- POST/GET `/support/tickets`, GET `/support/tickets/{id}`
- POST `/support/tickets/{id}/messages`, `/assign`
- PATCH `/support/tickets/{id}/status`
- POST `/support/chat/sessions`
- GET `/support/faq`, POST/PATCH/DELETE `/support/faq`

## Statistiques
- GET `/stats/me`, `/stats/moderation`, `/stats/admin`, `/stats/global`, `/stats/export`

## Administration et audit
- GET `/admin/audit-logs`, GET `/admin/settings`
- PUT `/admin/settings/{key}`
- GET `/admin/modules`, POST `/admin/modules/{name}/enable`, `/disable`
- POST `/admin/users/{id}/impersonate`
- DELETE `/admin/listings/{type}/{id}`
- PATCH `/admin/bookings/{id}`

## Fichiers et utilitaires
- POST `/files`, GET/DELETE `/files/{id}`
- GET `/health`, GET `/meta/enums`

## WebSocket et événements
Connexion proposée : `/v1/ws`, access token requis. Canaux : `user:{id}`, `conversation:{id}`, `booking:{id}:tracking`, `support:{sessionId}`.
- Client → serveur : `message.send`, `message.typing`, `message.read`, `tracking.position`, `presence.ping`.
- Serveur → client : `message.new`, `message.delivered`, `message.read`, `typing`, `tracking.updated`, `booking.status_changed`, `notification.new`, `presence.changed`.
- Événements internes : `user.registered`, `kyc.submitted/approved/rejected`, `listing.published`, `request.created/accepted`, `booking.created/status_changed`, `payment.succeeded/failed`, `delivery.confirmed`, `dispute.opened/resolved`, `report.created`, `user.suspended`.

## Décisions à confirmer
1. Fournisseurs/moyens de paiement, commission, séquestre, remboursement et versements.
2. Inscription, OTP, durée et rotation des tokens, révocation de sessions.
3. États/transitions de réservation, annulation, collecte, livraison et litiges.
4. Auto-attribution des rôles et hiérarchie RBAC.
5. Fournisseur, pièces et expiration KYC.
6. Fournisseurs et règles des notifications.
7. Stockage de fichiers, bus d’événements et reprise WebSocket.
8. Conservation/anonymisation des données et exigences d’audit.
9. Filtres, exports, codes d’erreur et permissions détaillées.
10. Webhooks sortants : phase ultérieure ou v1.

Les routes présentes dans ce document ne prouvent pas que les fonctionnalités sont déjà implémentées.
