{{- define "superduper.host" -}}
{{ required "ingress_host is required" .Values.ingress_host }}
{{- end -}}

{{- define "superduper.secretStore" -}}
{{ required "secret_store_name is required" .Values.secret_store_name }}
{{- end -}}

{{- define "superduper.betterAuthUrl" -}}
{{ .Values.better_auth_url | default (printf "https://%s" (include "superduper.host" .)) }}
{{- end -}}

{{- define "superduper.podSecurity" -}}
automountServiceAccountToken: false
{{- with .Values.image_pull_secrets }}
imagePullSecrets:
  {{- toYaml . | nindent 2 }}
{{- end }}
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  runAsGroup: 1000
  seccompProfile:
    type: RuntimeDefault
{{- end -}}

{{- define "superduper.containerSecurity" -}}
securityContext:
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop: [ALL]
{{- end -}}
