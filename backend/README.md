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

**Conséquence assumée : un mot de passe perdu = des données perdues.** Il n'y a
pas de réinitialisation possible, et c'est le prix du chiffrement bout-en-bout.

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

## Variables d'environnement

Voir `.env.example` à la racine. `SECRET_KEY` est obligatoire dès
`ENVIRONMENT=production` : l'application refuse de démarrer sans.
