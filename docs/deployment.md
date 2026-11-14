# Deployment

Super Duper deploys the same way as `Tiental/vigil-next`: Tiental's shared pipeline
builds images and proposes a rendered chart, and Argo CD deploys it. CI never talks to
the cluster.

> **Not active yet.** The shared pipeline (`Tiental/workflows`, private, Actions access
> limited to the organisation) and Argo CD's repository credentials (scoped to
> `https://github.com/Tiental`) only work for repositories in the Tiental organisation.
> Until this repository moves to `Tiental/superduper`, the pipeline caller is parked at
> `.github/pending-workflows/pipeline.yml`, where GitHub does not run it, and only
> `.github/workflows/ci.yml` runs.

## Environments

| Environment | Namespace        | Public origin                                      | Secret store                             |
| ----------- | ---------------- | -------------------------------------------------- | ---------------------------------------- |
| `acc`       | `superduper-acc` | `https://superduper.cluster.vigil-acc.tiental.net` | `namespace-vault-cluster-superduper-acc` |

There is no production environment. `acc` runs on the shared vigil-acc AKS cluster and
uses the `superduper` database on the managed Postgres 18 server
`vigil-acc-postgres.postgres.database.azure.com`, as the password role `superduper`.

## How it works

| Path                                      | What                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------- |
| `.github/project-config.yaml`             | Apps and environments for the shared pipeline                             |
| `.github/pending-workflows/pipeline.yml`  | Unchanged copy of vigil-next's pipeline caller (`@v3.0.0`), parked        |
| `apps/{api,web}/{check,build,publish}.sh` | What the pipeline runs per changed app                                    |
| `apps/api/Dockerfile`                     | Production API image; build context is the repository root                |
| `chart/`                                  | Helm chart source: `values.yaml` defaults, `values-acc.yaml` overrides    |
| `chart_deployment/acc`                    | Rendered chart Argo CD syncs. Written only by the pipeline, never by hand |
| `tests/chart/`                            | `helm template` tests, run by `bun run check:root`                        |

1. A push to `main` runs `check.sh`, `build.sh` and `publish.sh` for each changed app and
   pushes `ghcr.io/tiental/superduper/<app>:<n>.<sha7>`.
2. The release job renders `chart/` with `values-acc.yaml` into `chart_deployment/acc`,
   pins `version_api` / `version_web`, and opens or updates the `automation/deploy/acc`
   pull request.
3. A human approves the workflow runs on that pull request, reviews it and merges it.
   Argo CD (configured by Duplo from `Tiental/infra` `deployments/vigil-acc.yaml`) syncs
   `chart_deployment/acc` on `main` into `superduper-acc`.

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

1. **Transfer the repository** from `Kobusvdwalt/superduper` to `Tiental/superduper`
   (Settings → General → Transfer ownership). Update local remotes afterwards.
2. **Allow Argo CD to read it.** Argo CD authenticates to `https://github.com/Tiental`
   with the organisation's GitHub App. If the app is installed on selected repositories,
   add `superduper` to it (Organisation settings → GitHub Apps → Configure).
3. **Repository settings for the v3 pipeline**, per the
   [workflows docs](https://github.com/Tiental/workflows/blob/main/docs/portal/deploying.md#required-repository-settings-v3):
   enable Settings → Actions → General → _Allow GitHub Actions to create and approve pull
   requests_, and protect `main` with a pull request, one approval, dismissal of stale
   approvals and the required `pipeline / deployment` check (the importable
   `templates/rulesets/reviewed-deployments.json` ruleset does this; enable it once the
   pipeline below is active).
4. **Merge the infra pull request** that adds the `superduper-acc` namespace, the
   `superduper` database and the `superduper` password role to
   `deployments/vigil-acc.yaml`, and let Duplo Deploy apply it. It creates the namespace,
   its Key Vault and ClusterSecretStore, the Argo CD application, the database, the role
   and its grants, and copies `postgres-superduper-password` into the namespace vault.
5. **Set the two hand-made secrets** in the namespace vault. Duplo shortens long vault
   names, so look it up by tag:

   ```bash
   vault=$(az keyvault list --query "[?tags.namespace=='superduper-acc'].name" -o tsv)
   az keyvault secret set --vault-name "$vault" --name acc-superduper-better-auth-secret \
     --value "$(openssl rand -base64 48)" --output none
   read -r owner && az keyvault secret set --vault-name "$vault" \
     --name acc-superduper-owner-email --value "$owner" --output none
   ```

6. **Activate the pipeline** in a pull request:
   `git mv .github/pending-workflows/pipeline.yml .github/workflows/pipeline.yml`.
   Keep `ci.yml` until the pipeline has run green, then decide whether to drop it.
7. **First release.** Merging that pull request publishes both images and opens
   `automation/deploy/acc`. Approve its workflow runs, review it and merge it.

The GHCR pull secret Duplo puts in every namespace (`tiental-images`) must be able to
read the new `ghcr.io/tiental/superduper/*` packages; if pods show `ImagePullBackOff`
with a 401, grant that credential access to the packages.

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
