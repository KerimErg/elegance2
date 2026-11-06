# Elegance Strasbourg — site du salon

Site statique (HTML / CSS / JS) avec réservation en ligne.

| Fichier | Rôle |
|---|---|
| `index.html`, `styles.css`, `script.js` | Le site public |
| `config.js` | **À remplir** : prestations, horaires, clés Supabase |
| `admin.html`, `admin.js` | Espace salon : rendez-vous, annulations, jours fermés |
| `supabase/schema.sql` | Base de données et règles de sécurité (installation complète) |
| `supabase/mise-a-jour.sql` | Mises à jour pour une base déjà installée |
| `images/` | Photos du salon |

Tant que `config.js` n’a pas ses clés, la réservation fonctionne en **mode démonstration** (rien n’est enregistré).

## Activer la réservation (10 minutes)

### 1. Créer la base (gratuit)
1. Créez un compte sur **supabase.com**, puis **New project** (région : *Paris* ou *Frankfurt*). Notez le mot de passe de la base.
2. Dans le projet : **SQL Editor → New query**, collez tout le contenu de `supabase/schema.sql`, cliquez **Run**.

### 2. Créer votre accès admin
1. **Authentication → Users → Add user → Create new user** : votre e-mail + un mot de passe solide (cochez *Auto Confirm User*).
2. **SQL Editor**, exécutez (avec votre e-mail) :
   ```sql
   insert into public.admins (user_id) select id from auth.users where email = 'votre-email@exemple.fr';
   ```
3. **Authentication → Sign In / Providers** : désactivez *Allow new users to sign up* (personne d’autre ne pourra créer de compte).

### 3. Brancher le site
**Project Settings → API** : copiez *Project URL* et la clé *anon public* dans `config.js` :
```js
supabaseUrl: "https://xxxxxxxx.supabase.co",
supabaseAnonKey: "eyJhbGciOi...",
```
La clé *anon* est faite pour être publique : la sécurité est assurée par les règles de la base. **Ne mettez jamais la clé `service_role` dans le site.**

### 4. Mettre en ligne
Hébergez le dossier tel quel (GitHub Pages, Netlify ou Cloudflare Pages, gratuits). La page de gestion sera à l’adresse `votre-site/admin.html`.

## Ce que garantit la base
- Un créneau ne peut être réservé qu’une fois, même si deux clients cliquent en même temps.
- Impossible de réserver un jour fermé, un dimanche/lundi, hors horaires, dans le passé ou à plus de 60 jours.
- Le public ne peut **que** créer un rendez-vous : il ne voit jamais les noms ni les numéros des autres clients.
- Seuls les comptes listés dans `admins` voient et gèrent les rendez-vous.

## Modifier les horaires
Changez-les à **deux** endroits : `config.js` (affichage) et la fonction `is_bookable` dans `supabase/mise-a-jour.sql` (à ré-exécuter dans Supabase).
