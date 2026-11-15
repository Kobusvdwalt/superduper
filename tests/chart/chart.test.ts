import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { renderDeployment } from "../../scripts/render-deployment";

type Manifest = { kind: string; metadata: { name: string }; spec: any };

const chart = resolve(import.meta.dir, "../../chart");

function render(environment: string, settings: string[] = []) {
  return Bun.spawnSync(
    [
      "helm",
      "template",
      "superduper",
      chart,
      "--namespace",
      `superduper-${environment}`,
      "-f",
      `${chart}/values-${environment}.yaml`,
      ...settings,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
}

function documents(environment: string): Manifest[] {
  const result = render(environment);
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
  return result.stdout
    .toString()
    .split(/^---\s*$/m)
    .map((document) => Bun.YAML.parse(document) as Manifest | null)
    .filter((document): document is Manifest => document !== null);
}

function resource(manifests: Manifest[], kind: string, name: string) {
  const found = manifests.find((item) => item.kind === kind && item.metadata.name === name);
  expect(found).toBeDefined();
  return found!;
}

function env(container: any, name: string) {
  return container.env.find((entry: any) => entry.name === name);
}

test("acceptance serves the web app on / and the API on /api over TLS", () => {
  const ingress = resource(documents("acc"), "Ingress", "superduper");
  const host = "superduper.cluster.vigil-acc.tiental.net";
  expect(ingress.metadata).toMatchObject({
    annotations: { "cert-manager.io/cluster-issuer": "letsencrypt-prod" },
  });
  expect(ingress.spec.tls).toEqual([
    { hosts: [host], secretName: "superduper-ingress-certificate" },
  ]);
  expect(ingress.spec.rules[0].host).toBe(host);
  expect(
    ingress.spec.rules[0].http.paths.map((path: any) => [path.path, path.backend.service.name]),
  ).toEqual([
    ["/api", "api"],
    ["/", "web"],
  ]);
});

test("acceptance configures the API for its public origin and vault secrets", () => {
  const manifests = documents("acc");
  const pod = resource(manifests, "Deployment", "api").spec.template.spec;
  const api = pod.containers[0];
  expect(api.image).toBe("ghcr.io/kobusvdwalt/superduper/api:latest");
  expect(env(api, "BETTER_AUTH_URL").value).toBe(
    "https://superduper.cluster.vigil-acc.tiental.net",
  );
  expect(env(api, "AUTH_TRUSTED_ORIGINS").value).toBe(
    "https://superduper.cluster.vigil-acc.tiental.net",
  );
  for (const [name, key] of [
    ["DATABASE_URL", "database-url"],
    ["BETTER_AUTH_SECRET", "better-auth-secret"],
    ["OWNER_EMAIL", "owner-email"],
  ]) {
    expect(env(api, name).valueFrom.secretKeyRef).toEqual({ name: "superduper", key });
  }
  for (const probe of ["startupProbe", "readinessProbe", "livenessProbe"]) {
    expect(api[probe].httpGet.path).toBe("/api/healthz");
  }

  const secret = resource(manifests, "ExternalSecret", "superduper");
  expect(secret.spec.secretStoreRef).toEqual({
    kind: "ClusterSecretStore",
    name: "namespace-vault-cluster-superduper-acc",
  });
  expect(secret.spec.data.map((entry: any) => entry.remoteRef.key)).toEqual([
    "postgres-superduper-password",
    "acc-superduper-better-auth-secret",
    "acc-superduper-owner-email",
  ]);
  expect(secret.spec.target.template.data["database-url"]).toBe(
    "postgres://superduper:{{ .postgresPassword | trim | urlquery }}@vigil-acc-postgres.postgres.database.azure.com:5432/superduper?sslmode=verify-full",
  );
});

test("a release is a self-contained chart with the environment's values and pinned images", async () => {
  const output = await mkdtemp(`${tmpdir()}/superduper-deployment-`);
  try {
    await renderDeployment("acc", "7.abc1234", output);
    const result = Bun.spawnSync(
      ["helm", "template", "superduper", output, "--namespace", "superduper-acc"],
      { stdout: "pipe", stderr: "pipe" },
    );
    expect(result.stderr.toString()).toBe("");
    expect(result.exitCode).toBe(0);
    const rendered = result.stdout.toString();
    expect(rendered).toContain("ghcr.io/kobusvdwalt/superduper/api:7.abc1234");
    expect(rendered).toContain("ghcr.io/kobusvdwalt/superduper/web:7.abc1234");
    expect(rendered).toContain("host: superduper.cluster.vigil-acc.tiental.net");
    expect(rendered).toBe(
      render("acc", ["--set", "version_api=7.abc1234", "--set", "version_web=7.abc1234"])
        .stdout.toString()
        .replaceAll(`${chart}/`, `${output}/`),
    );
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

test("a missing host fails the render instead of producing an ingress without one", () => {
  const result = render("acc", ["--set", "ingress_host="]);
  expect(result.exitCode).not.toBe(0);
  expect(result.stderr.toString()).toContain("ingress_host is required");
});
