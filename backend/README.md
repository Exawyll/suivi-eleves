# Backend Carnet

API FastAPI (async, SQLAlchemy 2 + Postgres) qui sert aussi le frontend compilé
(`static/`, alimenté par l'étape node du `Dockerfile`).

## Lancer en local

```bash
docker run -d --name carnet-pg -e POSTGRES_USER=carnet -e POSTGRES_DB=carnet \
  -e POSTGRES_HOST_AUTH_METHOD=trust -p 5432:5432 postgres:17
pip install -r requirements-dev.txt
alembic upgrade head
uvicorn main:app --reload
```

Les tests créent leur **propre** base (`<database>_test`) et y appliquent les
migrations Alembic, jamais `create_all` : chaque exécution vérifie donc que les
révisions produisent bien le schéma attendu. Sans Postgres joignable, les tests
qui en dépendent sont ignorés (`skip`) — la CI, elle, en a toujours un.

```bash
pytest -v          # depuis la racine du dépôt
```

## Modèle d'authentification

Le serveur **ne voit jamais le mot de passe**. Le client en dérive localement
(PBKDF2-SHA256, 600 000 itérations) une clé maîtresse, puis deux valeurs
distinctes par HKDF :

- `authSecret`, envoyé au serveur et re-haché en **argon2id** avant stockage ;
- une **KEK** qui ne quitte jamais le navigateur et qui déchiffre la clé de
  données (`wrappedDek`).

Le serveur conserve les paramètres de dérivation et le `wrappedDek` pour qu'un
nouvel appareil puisse se déverrouiller avec le seul mot de passe — sans que
cela lui donne le moindre moyen de lire un carnet.

**Conséquence assumée : sans mot de passe ni clé de récupération, les données
sont perdues.** C'est le prix du chiffrement bout-en-bout — le serveur ne peut
jamais réinitialiser un accès dont il ne détient aucune des deux clés.

### Clé de récupération

Un second secret, généré côté client et affiché **une seule fois**, wrappe le
même DEK sous une clé dérivée par HKDF (pas de PBKDF2 : la clé a déjà 256 bits
d'entropie, rien à ralentir). Le serveur stocke ce second enveloppe
(`wrapped_dek_recovery`/`dek_nonce_recovery`) et le hash argon2id du secret
(`recovery_auth_hash`) — jamais la clé elle-même.

C'est délibérément **la seule alternative à un lien de réinitialisation par
email** : un tel lien supposerait que le serveur puisse rendre le carnet
accessible sans le mot de passe, donc sans jamais avoir eu besoin de le
connaître — exactement ce que le chiffrement bout-en-bout interdit.

- `POST /auth/recovery/setup` (authentifié) crée ou remplace la clé — il faut
  déjà avoir déverrouillé le DEK, donc reposer sur `CurrentUser` plutôt que sur
  un nouvel échange de mot de passe.
- `POST /auth/recovery/start` (public, throttlé) échange le secret contre
  l'enveloppe chiffrée, pour que le client déballe le DEK localement avant de
  demander un nouveau mot de passe.
- `POST /auth/recovery/complete` (public, throttlé) revérifie le secret,
  remplace le mot de passe **et** fait tourner la clé de récupération en un
  seul appel, puis révoque toutes les sessions ouvertes.
- Pas de table de jetons dédiée : chaque appel public revérifie
  indépendamment `recovery_auth_hash`, avec le même sel factice qu'à la
  connexion pour rester indistinguable d'une adresse ou d'une clé inconnue.
- Les compteurs de throttle sont **namespacés par action** (`login:` /
  `recovery:`) : rater sa clé de récupération ne doit pas verrouiller le mot
  de passe du même coup, et inversement.

### Détails qui comptent

- `GET /auth/kdf-params` répond aussi pour une adresse sans compte, avec un sel
  factice déterministe dérivé de `SECRET_KEY` : sinon l'endpoint permettrait de
  tester si un collègue a un compte.
- « Adresse inconnue » et « mot de passe faux » renvoient la même réponse, et
  argon2 tourne une fois dans les deux cas pour que le temps de réponse ne
  distingue pas non plus les deux situations.
- Les refresh tokens sont stockés en SHA-256 et **tournés à chaque usage** : une
  copie volée n'est rejouable qu'une fois, et jusqu'au prochain refresh du vrai
  appareil.
- Changer de mot de passe re-chiffre uniquement la clé de données et révoque
  toutes les sessions ouvertes.

### Limite connue du throttling

`app/core/throttle.py` compte les échecs **en mémoire du processus**. Le service
tourne aujourd'hui en une seule réplique, donc la limite est réelle ; le jour où
le déploiement passe à plusieurs instances, il faudra un stockage partagé
(Redis ou une table). C'est un ralentisseur contre le devinage en ligne, pas une
défense contre une attaque distribuée.

## Synchronisation

Le serveur range des **enveloppes opaques** `(user_id, entity_type, entity_id) → ciphertext` et
n'arbitre que sur des métadonnées en clair : révision, horodatage client, tombstone. Il ne déchiffre
jamais rien.

- **Granularité par enregistrement**, pas par instantané : un instantané rendrait la fusion
  multi-appareil impossible et re-téléverserait tout le carnet à chaque note.
- **Le curseur n'avance que par un pull.** `POST /sync/changes` ne renvoie délibérément aucun
  curseur : rendre la révision de tête après un push serait un piège à perte de données — un
  appareil resté à la révision 5 pendant qu'un autre a poussé jusqu'à 20 se verrait remettre 21, et
  tous ses pulls suivants démarreraient au-dessus des quinze enregistrements qu'il n'a jamais vus.
- **Curseur** = dernière `revision` vue. La séquence est globale et strictement croissante, donc
  utilisable telle quelle. Elle peut comporter des trous : une tentative d'écriture perdue en
  arbitrage consomme quand même un numéro.
- **Conflits** : le client envoie la `baseRevision` qu'il connaît. Si elle correspond, il écrase.
  Sinon, arbitrage *last-write-wins* sur `clientUpdatedAt`, et l'enveloppe qui reste en place repart
  dans `conflicts[]` pour que le client l'applique. À horodatage égal, le serveur garde la sienne :
  le résultat ne dépend pas de l'ordre d'arrivée.
- **Suppressions** par tombstone (`deleted = true`, `ciphertext = NULL`), jamais de DELETE physique —
  sinon un appareil hors-ligne ressusciterait l'enregistrement.
- **Garde-fous** : 64 Kio par enveloppe, 500 enveloppes par push, 500 par page de pull, et
  `entity_type` restreint aux sept types du domaine.

### L'isolation, concrètement

`SyncRepository` reçoit le compte à la construction, depuis le jeton d'accès. **Aucune de ses
méthodes ne prend d'identifiant d'utilisateur**, donc il n'existe pas de signature dans laquelle
une valeur venue du corps d'une requête pourrait se glisser. Le compte fait partie de la clé
primaire : deux enseignants peuvent porter le même `entityId` sans jamais se voir.

### Ce qui fuit malgré tout

Le serveur connaît le **nombre** d'enregistrements par compte et **l'horodatage de chaque saisie**,
soit un profil d'activité (« 12 saisies le 3 mars à 9 h »). Aucun nom, aucun texte, aucun tag.

S'y ajoute une fuite **entre comptes**, plus ténue : la séquence `seq_sync_records_revision` est
globale, donc les trous entre deux révisions successives d'un même compte révèlent le **volume**
d'écritures des autres comptes dans l'intervalle. Ni qui, ni quoi, ni quand précisément — un simple
compteur d'activité globale.

C'est un choix, pas un oubli. Une séquence par compte imposerait de lire le maximum du compte puis
de l'incrémenter, ce qui remplacerait l'upsert atomique et sans verrou par une lecture-écriture à
sérialiser, avec sa boucle de reprise en cas de collision entre deux appareils. Le renseignement
gagné — « il s'est passé quelque chose ailleurs » — est strictement moins précis que ce que le
serveur sait déjà de chaque compte pris isolément, et qui est assumé plus haut.

Durcissements possibles, hors périmètre : chiffrer `entity_type`, arrondir `clientUpdatedAt`,
padder les enveloppes, et donc une séquence par compte.

## Variables d'environnement

Voir `.env.example` à la racine. `SECRET_KEY` est obligatoire dès
`ENVIRONMENT=production` : l'application refuse de démarrer sans.
