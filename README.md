# ParkSmart Pro - Borne de Parking Automatique

Application frontend complète en Next.js pour une borne automatique de parking avec interface kiosk moderne et immersive.

## 🚀 Fonctionnalités

### État de la borne
- **idle** : Attente de présentation de carte
- **scanning** : Lecture de la carte en cours
- **processing** : Vérification des données
- **success** : Accès autorisé, ouverture barrière
- **error** : Accès refusé avec message clair
- **cooldown** : Réinitialisation automatique

### Gestion des cartes
- Scan automatique via input caché (simule lecteur RFID/clavier)
- Recherche dans Supabase par `card_number` ou `rfid_code`
- Validation : existence, activation, expiration, solde

### Actions automatiques
- Création transaction dans `gopass_transactions`
- Logging dans `activity_logs`
- Ouverture barrière via API `/api/barrier/open`
- Impression ticket thermique 80mm

### Interface utilisateur
- Design futuriste avec gradients indigo/cyan
- Animations fluides (pulse, glow, fade-in, slide-up)
- Icônes Lucide React
- Mode plein écran kiosk
- Horloge temps réel avec date-fns (locale française)

### Statistiques et monitoring
- Affichage passages du jour
- Rafraîchissement automatique toutes les 30 secondes
- Détection connectivité online/offline

## 🛠 Tech Stack

- **Next.js 14** (App Router)
- **React 18** avec TypeScript
- **Tailwind CSS** avec animations personnalisées
- **Supabase** (base de données + client)
- **date-fns** (gestion dates, locale fr)
- **lucide-react** (icônes)

## 📦 Installation

```bash
# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.local.example .env.local
# Éditer .env.local avec vos clés Supabase

# Démarrer le serveur de développement
npm run dev
```

## ⚙️ Configuration Supabase

### Tables requises

#### gopass_cards
```sql
CREATE TABLE gopass_cards (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  card_number text UNIQUE NOT NULL,
  rfid_code text UNIQUE,
  holder_name text NOT NULL,
  category text NOT NULL,
  subscription_type text CHECK (subscription_type IN ('unlimited', 'credits')) NOT NULL,
  balance integer DEFAULT 0,
  is_active boolean DEFAULT true,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

#### gopass_transactions
```sql
CREATE TABLE gopass_transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id uuid REFERENCES gopass_cards(id) NOT NULL,
  transaction_type text CHECK (transaction_type IN ('entry', 'exit')) NOT NULL,
  amount integer DEFAULT 0,
  barrier_id text,
  created_at timestamp with time zone DEFAULT now()
);
```

#### activity_logs
```sql
CREATE TABLE activity_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  action text NOT NULL,
  details text NOT NULL,
  card_number text,
  holder_name text,
  success boolean NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);
```

## 🎯 Utilisation

### Mode Kiosk
Pour un véritable déploiement kiosk :

```bash
# Chrome en mode kiosk
google-chrome --kiosk --disable-infobars http://localhost:3000

# Firefox en mode kiosk  
firefox -kiosk http://localhost:3000
```

### Test de scan carte
L'application écoute sur un input caché. Pour tester :

1. Tapez un numéro de carte dans le champ (invisible)
2. Appuyez sur "Enter" ou incluez "\n" dans le texte
3. L'application traitera automatiquement le scan

### Exemples de cartes de test
```javascript
// Carte valide
"1234567890123456"

// Carte expirée
"1111111111111111" 

// Carte désactivée
"2222222222222222"

// Solde insuffisant
"3333333333333333"
```

## 🎨 Personnalisation

### Thème couleurs
Les couleurs sont définies dans `tailwind.config.js` et utilisent :
- `indigo-500` à `indigo-900` pour les tons principaux
- `cyan-400` à `cyan-500` pour les accents
- `slate-900` pour le fond

### Animations
Animations personnalisées dans `tailwind.config.js` :
- `pulse-glow` : Effet de pulsation lumineuse
- `spin-slow` : Rotation lente (3s)
- `fade-in` : Apparition en fondu
- `slide-up` : Glissement vers le haut
- `glow` : Effet de lueur animée

## 🔧 API Routes

### POST /api/barrier/open
Simule l'ouverture de la barrière physique.

```json
// Réponse succès
{
  "success": true,
  "message": "Barrière ouverte avec succès",
  "opened_at": "2024-03-30T10:30:00.000Z"
}
```

## 🖨️ Impression Ticket

L'impression utilise un iframe caché avec `window.print()`. Le format est optimisé pour imprimante thermique 80mm avec :

- En-tête PARKSMART PRO
- Date/heure du passage
- Informations titulaire
- Numéro de carte
- Catégorie et abonnement
- Solde restant si applicable

## 📊 Monitoring

### Statistiques en temps réel
- Compteur passages du jour (mis à jour toutes les 30s)
- Indicateur de connectivité (online/offline)
- Horloge temps réel

### Logs d'activité
Toutes les interactions sont loggées dans `activity_logs` avec :
- Type d'action
- Détails de l'opération
- Numéro de carte et titulaire
- Succès/échec

## 🚀 Déploiement

### Build production
```bash
npm run build
npm start
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## 🔒 Sécurité

- Variables d'environnement pour clés Supabase
- Validation côté serveur dans API routes
- Protection XSS avec React/Next.js
- Input caché pour éviter manipulation UI

## 📝 License

MIT License - ParkSmart Pro © 2024
