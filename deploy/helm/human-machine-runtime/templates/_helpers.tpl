{{- define "dcf-light-bot.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "dcf-light-bot.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- include "dcf-light-bot.name" . -}}
{{- end -}}
{{- end -}}

{{- define "dcf-light-bot.labels" -}}
app.kubernetes.io/name: {{ include "dcf-light-bot.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: dcf-platform
{{- end -}}

{{- define "dcf-light-bot.serverLabels" -}}
{{ include "dcf-light-bot.labels" . }}
app.kubernetes.io/component: server
{{- end -}}

{{- define "dcf-light-bot.clientLabels" -}}
{{ include "dcf-light-bot.labels" . }}
app.kubernetes.io/component: client
{{- end -}}

{{- define "dcf-light-bot.serverSelector" -}}
app.kubernetes.io/name: {{ include "dcf-light-bot.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: server
{{- end -}}

{{- define "dcf-light-bot.clientSelector" -}}
app.kubernetes.io/name: {{ include "dcf-light-bot.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: client
{{- end -}}

{{- define "dcf-light-bot.namespace" -}}
{{- .Values.namespace.name -}}
{{- end -}}

{{- define "dcf-light-bot.secretName" -}}
{{- if .Values.secrets.name -}}
{{- .Values.secrets.name -}}
{{- else -}}
{{ include "dcf-light-bot.fullname" . }}-secret
{{- end -}}
{{- end -}}
