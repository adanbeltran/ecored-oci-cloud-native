# OCI API Gateway con Firebase

La plantilla `api-deployment.template.json` valida el ID token de Firebase en
OCI API Gateway y sobrescribe `X-User-Id` y `X-User-Email` antes de reenviar la
petición. Los microservicios autentican esa identidad y aplican sus reglas de
negocio; no validan Firebase de nuevo.

## Configuración

1. Reemplazar `FIREBASE_PROJECT_ID` por el ID exacto del proyecto Firebase.
2. Reemplazar `FRONTEND_ORIGIN` por el origen HTTPS del frontend.
3. Reemplazar `OKE_ENTRY` por el host alcanzable del balanceador o Ingress de
   OKE, sin `https://` y sin ruta.
4. Importar la especificación al crear el deployment de API Gateway.
5. Dar a la subred del gateway salida HTTPS hacia Google para descargar JWKS y
   conectividad privada hacia el punto de entrada de OKE.

La validación exige firma válida, expiración, `iss` igual a
`https://securetoken.google.com/FIREBASE_PROJECT_ID`, `aud` igual al Project ID
y la presencia de `sub`. Una petición sin token o con token inválido debe
recibir `401` sin llegar a OKE.

## Límite de confianza

Los servicios de OKE deben ser `ClusterIP` y solo el Ingress/balanceador usado
por API Gateway debe alcanzarlos. Nunca publique directamente los puertos
8001 o 8002: un cliente podría fabricar `X-User-Id`. API Gateway usa
`OVERWRITE`, por lo que reemplaza cualquier valor que intente enviar el cliente.
