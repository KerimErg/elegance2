# Elegance Strasbourg — Design system

Direction : **éditorial nocturne**. Le site se lit comme le salon se vit : une pièce noire,
une lumière blanche géométrique (le plafond en nid d'abeille), un filet violet. Peu
d'éléments, beaucoup d'air, une typographie qui porte tout. Références : les sites
fournis par le salon (Siteo, Ace Barber, Kanto, Premium Barber UI) — on reprend leur
exigence (grands blancs, hiérarchie forte, photos plein cadre), pas leur look.

## Couleur

| Token | Valeur | Rôle |
|---|---|---|
| `--bg` | `#09090a` | Fond de page |
| `--surface` | `#121214` | Fonds de blocs (rare : réservation, admin) |
| `--surface-2` | `#1b1b1e` | Champs, puces, boutons secondaires dans le téléphone |
| `--white` | `#f3f3f1` | Texte principal, bouton principal (fond) |
| `--mute` | `#a4a4ab` | Texte secondaire (contraste 8,1:1 sur `--bg`) |
| `--faint` | `rgba(243,243,241,.42)` | Légendes, numéros inactifs, texte décoratif uniquement |
| `--line` | `rgba(243,243,241,.12)` | Filets, séparateurs, bordures |
| `--led` | `#9b4dff` | Accent unique : numéros de section, état actif, focus, filet lumineux. Jamais en fond de grande surface ni en dégradé de titre. |
| `--danger` | `#ff8a8a` | Erreurs de formulaire |
| `--ok` | `#8fe3a7` | Confirmations (admin) |

Pas de mode clair : le site assume un seul univers sombre, comme le salon.

## Typographie

- **Michroma** — titres et chiffres forts, toujours en capitales, interlettrage +0.02 à +0.06em.
- **Allura** — un seul mot manuscrit par écran au maximum (« Strasbourg », « au millimètre »).
- **Inter Tight** — tout le reste. Graisses : 300, 400, 500, 600.

Échelle (fluide, `clamp`) :

| Rôle | Taille | Interligne |
|---|---|---|
| Display (accueil) | 48 → 96 px | 1.0 |
| H1 de section | 36 → 72 px | 1.05 |
| H2 | 24 → 36 px | 1.15 |
| H3 / prix | 18 → 22 px | 1.2 |
| Texte courant | 17 px | 1.6 (60–70 caractères) |
| Petit | 14 px | 1.5 |
| Surtitre | 12 px, capitales, +0.28em | 1 |

## Espacement et grille

- Base 8 px : 8, 16, 24, 32, 48, 64, 96, 128, 176.
- Sections : 128–176 px de marge verticale (96 sur mobile).
- Grille 12 colonnes, largeur max 1320 px, gouttière 24 px, marges latérales ≥ 16 px.
- Mise en page asymétrique : titres sur les colonnes 1–7, contenu décalé ; jamais trois cartes identiques centrées.

## Forme et profondeur

- Rayon : 0 partout (angles vifs, comme les néons). Exceptions : téléphone de réservation (50 px), puces du téléphone (10 px), pilules d'état (999 px).
- Ombres : aucune ombre portée décorative. La profondeur vient de la **lumière** : `--glow-white` (0 0 1px #fff, 0 0 24px rgba(255,255,255,.18)) et `--glow-led` (0 0 18px rgba(155,77,255,.55)).
- L'hexagone est la seule forme signature : photos clés, monogrammes, note Google.

## Composants

- **Bouton principal** : fond `--white`, texte `--bg`, 600, padding 16×28, angles vifs. Survol : halo blanc. Focus : contour 2px `--led`. Désactivé : `--surface-2` / `--mute`.
- **Bouton secondaire** : filet 1px `rgba(243,243,241,.35)`, texte `--white`. Survol : filet `--white`.
- **Lien** : soulignement 1px `--line` qui passe à `--white` au survol.
- **Champ** : fond `--surface-2`, sans bordure, focus filet `--led`.
- **Navigation** : logo à gauche, liens numérotés (numéro en `--led`), téléphone + bouton à droite ; fond flouté après 30 px de défilement.
- **Pied de page** : grand mot ELEGANCE en filigrane, infos pratiques, liens légaux.

## Mouvement

- Une seule séquence forte : l'allumage du plafond à l'ouverture.
- Ailleurs : apparitions courtes (≤ 0,9 s) à l'entrée dans l'écran, survols nets. Pas d'effet de profondeur au défilement.
- Tout est désactivé si l'appareil demande moins d'animations.

## Images

- Photos réelles du salon et des coupes uniquement, jamais d'images de banque.
- Traitement : légère désaturation (grayscale 0.15), contraste +5 %, couleur pleine au survol.
- Icônes : aucune bibliothèque ; filets et formes géométriques dessinés en CSS/SVG.
