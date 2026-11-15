# Deployment

Super Duper runs in Tiental's acceptance cluster next to `Tiental/vigil-next`, and deploys
the same way: CI builds images and proposes a rendered chart, and Argo CD deploys it. CI
never talks to the cluster.

The repository stays in a personal account, so two things differ from vigil-next:

- **The repository and its images are public.** Argo CD's credentials only cover the
  Tiental organisation, and the cluster's image pull credential only covers its packages.
  Public repositories and public packages need neither.
- **The pipeline is this repository's own** (`.github/workflows/deploy.yml`). Tiental's
  shared pipeline can only be called from organisation repositories.

## Environments

| Environment | Namespace        | Public origin                                      | Secret store                             |
| ----------- | ---------------- | -------------------------------------------------- | ---------------------------------------- |
| `acc`       | `superduper-acc` | `https://superduper.cluster.vigil-acc.tiental.net` | `namespace-vault-cluster-superduper-acc` |

There is no production environment. `acc` runs on the shared vigil-acc AKS cluster and
uses the `superduper` database on the managed Postgres 18 server
`vigil-acc-postgres.postgres.database.azure.com`, as the password role `superduper`.

## How it works

| Path                           | What                                                                   |
| ------------------------------ | ---------------------------------------------------------------------- |
| `.github/workflows/deploy.yml` | Builds and publishes both images, proposes the release                 |
| `apps/{api,web}/Dockerfile`    | Production images; the build context is the repository root            |
| `chart/`                       | Helm chart source: `values.yaml` defaults, `values-acc.yaml` overrides |
| `scripts/render-deployment.ts` | Writes `chart_deployment/<environment>` from `chart/`                  |
| `chart_deployment/acc`         | The chart Argo CD syncs. Written only by a release, never by hand      |
| `tests/chart/`                 | `helm template` tests, run by `bun run check:root`                     |

1. A push to `main` builds both images and pushes
   `ghcr.io/kobusvdwalt/superduper/<app>:<run>.<sha7>`.
2. The same run writes `chart_deployment/acc` (the chart, its merged values and both
   image versions) and opens or updates the pull request from `automation/deploy/acc`.
   Later pushes replace the proposal, so the open pull request is always the newest build.
3. Merging that pull request is the deployment. Argo CD (configured by Duplo from
   `Tiental/infra` `deployments/vigil-acc.yaml`) syncs `chart_deployment/acc` on `main`
   into `superduper-acc`. Merging it does not start another build.

The release run checks the commit it builds (`bun run check:ci`) before building, and
reports that as the `check` status on the release commit, which is what the `main` branch
rules require. GitHub holds `ci.yml` on a pull request opened by a workflow until someone
approves it ("1 workflow awaiting approval"); the release does not need it. Run **Deploy**
by hand (Actions → Deploy → Run workflow) to rebuild without a new commit.

The chart runs one `api` and one `web` pod and a public Traefik Ingress with a
`letsencrypt-prod` certificate: `/api` goes to the API, everything else to the web
server. There is no OIDC middleware, on purpose: the API does its own authentication
(owner-only Better Auth sign-up and per-client bearer tokens), and phones reach `/api`
from mobile networks. The API applies migrations at startup under an advisory lock; its
startup, readiness and liveness probes use `/api/healthz`.

An ExternalSecret reads three Key Vault secrets through the namespace's ClusterSecretStore
and writes the `superduper` Secret (`database-url`, `better-auth-secret`, `owner-email`):

| Key Vault secret                    | Set by                                                         |
| ----------------------------------- | -------------------------------------------------------------- |
| `postgres-superduper-password`      | Duplo, from the `passwordUsers` declaration in `Tiental/infra` |
| `acc-superduper-better-auth-secret` | A human, once: at least 32 random characters                   |
| `acc-superduper-owner-email`        | A human, once: the only address allowed to sign up             |

External Secrets fails the whole Secret when any key is missing, so the API pod stays in
`CreateContainerConfigError` until all three exist.

## One-time setup

In order:

1. **Make the repository public** (Settings → General → Change visibility). Issues, pull
   requests and workflow logs become public with it.
2. **Allow workflows to open pull requests:** Settings → Actions → General → _Allow GitHub
   Actions to create and approve pull requests_.
3. **Merge the infra pull request** that adds the `superduper-acc` namespace, the
   `superduper` database and the `superduper` password role to
   `deployments/vigil-acc.yaml`, and let Duplo Deploy apply it. It creates the namespace,
   its Key Vault and ClusterSecretStore, the Argo CD application, the database, the role
   and its grants, and copies `postgres-superduper-password` into the namespace vault.
4. **Set the two hand-made secrets** in the namespace vault. Duplo shortens long vault
   names, so look it up by tag:

   ```bash
   vault=$(az keyvault list --query "[?tags.namespace=='superduper-acc'].name" -o tsv)
   az keyvault secret set --vault-name "$vault" --name acc-superduper-better-auth-secret \
     --value "$(openssl rand -base64 48)" --output none
   read -r owner && az keyvault secret set --vault-name "$vault" \
     --name acc-superduper-owner-email --value "$owner" --output none
   ```

5. **First release.** The first push to `main` with `deploy.yml` publishes both images
   and opens the release pull request. Before merging it, check that both packages are
   public; GitHub creates packages private unless told otherwise. For `superduper/api`
   and `superduper/web` under the account's Packages: Package settings → Change
   visibility → Public. Then merge the release pull request.
6. **Create the owner account straight away** at the public origin. Sign-up is open to
   whoever enters the owner's email address first, and only until that account exists.

If pods show `ImagePullBackOff`, a package is still private.

## Verify

```bash
curl -fsS https://superduper.cluster.vigil-acc.tiental.net/api/healthz   # {"ok":true}
kubectl --context <acc cluster> -n superduper-acc get externalsecret,pods,ingress,certificate
```

- The `superduper` ExternalSecret is `SecretSynced`, both pods are Ready and the
  certificate is Ready.
- `kubectl --context <acc cluster> -n superduper-acc logs deploy/api` shows
  `Migrations up to date` and `API listening`.
- The owner can sign up once at the public origin, and any other address is refused.

## Operations

- **Database password rotation:** increment `passwordVersion` on the `superduper` user in
  `Tiental/infra`; Duplo updates the role and both vault copies, and External Secrets
  refreshes the Secret within an hour. Restart the `api` deployment to pick it up.
- **Backups (Platform follow-up):** the database relies on the server-level automated
  backups of `vigil-acc-postgres`. Point-in-time restore restores the whole shared server,
  not one database; confirm retention and a restore procedure with Platform.
- **Personal data:** the database holds the owner's personal health data. Tiental
  organisation administrators administer the shared server, and the namespace groups can
  read the namespace's Secrets and Key Vault.
