# Criptografía del proyecto — referencia rápida

> Este documento resume **qué primitivas se usan**, **dónde están**, **cómo se
> componen**, y **por qué se eligieron**. Es la guía mínima para defender el
> proyecto en una materia de criptografía.

---

## 1. Primitivas

| Primitiva           | Algoritmo concreto                          | Archivo                          | ¿Por qué esta elección? |
|---------------------|---------------------------------------------|----------------------------------|--------------------------|
| Firma digital       | ECDSA · curva NIST P-256 (SecP256r1) · SHA3-256 | `services/crypto/signatures.py` | Curva estándar, llaves cortas (256 bits ≈ seguridad de RSA-3072), SHA3 evita ataques teóricos contra SHA2. |
| Cifrado simétrico   | AES-128-GCM (clave 128 bits, IV 96 bits, TAG 128 bits) | `services/crypto/aes_gcm.py` | Cifrado autenticado en una sola pasada (AEAD). 128 bits es suficiente, hay aceleración hardware. |
| Envoltura de clave  | RSA-2048-OAEP (SHA-256, MGF1-SHA-256)        | `services/crypto/rsa_oaep.py`    | OAEP es CCA-seguro; PKCS#1 v1.5 NO lo es (oráculo de Bleichenbacher). |
| Hash de password    | Argon2id                                    | `services/crypto/argon2_pw.py`   | Memory-hard → resistente a GPU/ASIC. Ganador del Password Hashing Competition. |
| Hash de mensaje     | SHA3-256 (huella en BD `hash_sha3_hex`)     | `services/canonical_receta.py`   | Familia diferente a SHA-2; sin extensión de longitud. |
| Sesión              | JWT firmado (HS256)                         | `services/crypto/jwt_service.py` | Stateless, expira a los 60 min. |

---

## 2. Esquema híbrido — el corazón del sistema

El cuerpo de la receta `R` se cifra **una sola vez** con AES-128-GCM, y la
clave simétrica `DEK` se envuelve **N veces** con RSA-OAEP, una por
destinatario autorizado (paciente + cada farmacia).

```
                  ┌───────────────────────────────┐
                  │  R (JSON canónico de receta)  │
                  └───────────────┬───────────────┘
                                  │
                       AES-128-GCM(DEK, IV, R, AAD)
                                  │
                                  ▼
                   (C, TAG)   ←  se persisten en BD
                       ▲          junto a IV y AAD
                       │
                       │  TAG de 128 bits autentica
                       │  plaintext + AAD
                       ▼
              ┌──────────────────────┐
              │   DEK (128 bits)     │  ← efímera, se borra
              └─────────┬────────────┘    tras envolverla
                        │
       ┌────────────────┼─────────────────┬────────────────┐
       │                │                 │                │
RSA-OAEP(pub_pac)  RSA-OAEP(pub_F1)  RSA-OAEP(pub_F2)  RSA-OAEP(pub_Fn)
       │                │                 │                │
       ▼                ▼                 ▼                ▼
  C_wrap_pac       C_wrap_far_1      C_wrap_far_2     C_wrap_far_n

         (cualquiera de ellos, con su privada,
          recupera la MISMA DEK y descifra R)
```

**Ventajas:**

* La receta se cifra una sola vez, no N veces.
* Sumar farmacias autorizadas es solo añadir filas en `RecetaAccesoFarmacia`,
  no recifrar nada.
* La integridad la garantiza el TAG de GCM **una sola vez** para todos los
  destinatarios.

---

## 3. Flujo cripto por caso de uso

### §4 — EMISIÓN (médico crea receta)

```
1.  R         = canonical_bytes({id, doctor, paciente, medicamento, ...})
2.  S_D       = ECDSA-Sign(priv_ec_doctor, R)              ← firma del médico
3.  AAD       = canonical_bytes({id, doctor, paciente, fecha, version})
4.  DEK       = random(128 bits)
5.  IV        = random( 96 bits)
6.  C, TAG    = AES-128-GCM-Encrypt(DEK, IV, R, AAD)
7.  C_wrap_p  = RSA-OAEP-Encrypt(pub_rsa_paciente,  DEK)
8.  ∀ Fᵢ:  C_wrap_Fᵢ = RSA-OAEP-Encrypt(pub_rsa_Fᵢ, DEK)
9.  scrub(DEK)
10. PERSIST   = (C, TAG, IV, AAD, S_D, hash_sha3(R), C_wrap_p, [C_wrap_Fᵢ])
```

### §5 — CONSULTA (paciente o farmacia descifran)

```
1.  DEK = RSA-OAEP-Decrypt(priv_rsa_propia, C_wrap)
2.  R   = AES-128-GCM-Decrypt(DEK, IV, C, TAG, AAD)        ← TAG falla → rechazo
3.  scrub(DEK)
```

Cualquier fallo cripto → mensaje genérico `"INTEGRIDAD comprometida o firma
inválida"` (anti-oráculo de padding).

### §6 — DISPENSACIÓN (farmacia entrega medicamento)

```
1.  DEK    = RSA-OAEP-Decrypt(priv_rsa_farmacia, C_wrap_far)
2.  R      = AES-128-GCM-Decrypt(DEK, IV, C, TAG, AAD)     ← integridad
3.  ECDSA-Verify(pub_ec_doctor, R, S_D)                    ← AUTENTICIDAD
                                                              ★ control crítico ★
4.  Sello  = canonical_bytes({farmaceutico, receta, num_dispensacion, ts})
5.  S_F    = ECDSA-Sign(priv_ec_farmaceutico, Sello)       ← firma del sello
6.  PERSIST EventoDispensacion(manifiesto_sello, S_F)
```

### §6.b — ACUSE DEL PACIENTE

```
1.  firma_pac = ECDSA-Sign(priv_ec_paciente, manifiesto_sello)
2.  ECDSA-Verify(pub_ec_paciente, manifiesto_sello, firma_pac)  ← anti-mismatch
```

### §8 — CANCELACIÓN

```
1.  M_cancel = canonical_bytes({receta, doctor, motivo, ts, dispensaciones_realizadas})
2.  S_cancel = ECDSA-Sign(priv_ec_doctor, M_cancel)
3.  PERSIST  Cancelacion(manifiesto, S_cancel)
```

### §9 — SUSTITUCIÓN

= §8 (cancelación con motivo `"sustituida_por_nueva_version"`) + §4 (nueva
receta con `parent_id` apuntando a la original, DEK / IV / firma frescas).

---

## 4. Controles criptográficos críticos

Estos son los puntos donde la cripto **decide** si una operación es legítima.
Si cualquiera de ellos pasa cuando no debería, el sistema está roto.

| ★ | Control | Dónde | Qué garantiza |
|---|---------|-------|---------------|
| 1 | TAG de AES-GCM al descifrar | `aes_gcm_decrypt` | Que `(C, AAD, IV)` no fueron alterados desde la emisión. |
| 2 | `ecdsa_verify` de la firma del médico al dispensar | `recetas_dispensar.py` §6.5 | Que la receta la emitió **el médico autorizado** y nadie la modificó. |
| 3 | Pertenencia de llaves (priv → pub registrada) | `services/bundle.py` | Que quien manda una privada es realmente el dueño de esa cuenta — bloquea login con sólo password. |
| 4 | TAG vincula `AAD` al cuerpo cifrado | construcción de `AAD` | Que `id_receta`, `id_doctor`, `id_paciente`, `fecha` no se pueden cambiar tras la emisión sin invalidar el TAG. |
| 5 | `ecdsa_verify` del sello al verificar dispensación | endpoint público `/verificar` | Que el sello digital es auténtico (equivalente al sello en papel). |

---

## 5. Decisiones de diseño justificadas

* **Esquema híbrido en vez de RSA puro**: RSA-OAEP solo puede cifrar mensajes
  cortos (≈ 190 B con 2048 bits) → cifrar la receta entera con RSA es
  inviable. Se cifra con AES (rápido, sin límite de tamaño) y se envuelve
  solo la DEK con RSA.

* **AES-GCM en vez de CBC**: GCM es AEAD (cifra **y** autentica en una
  pasada). CBC requiere un MAC aparte (encrypt-then-MAC) y la composición es
  fácil de equivocar.

* **AAD obligatorio y canónico**: vincula la receta cifrada con metadatos
  públicos (`id_receta`, `id_doctor`, ...). Si alguien intenta "mover" una
  receta cifrada a otra fila, el TAG falla aunque `(C, IV)` sean válidos.

* **IV de 96 bits aleatorio**: es el tamaño nativo de GCM. Reusar `(K, IV)`
  rompe GCM totalmente, por eso `new_iv()` lo genera con CSPRNG y nunca se
  reutiliza.

* **DEK efímera con scrub**: la DEK se borra tras envolverla. El servidor
  **no la retiene** — sin la priv RSA del destinatario, ni el propio admin de
  BD puede leer la receta.

* **SHA3-256 dentro de ECDSA**: librería estándar permitía SHA-256, pero SHA3
  pertenece a una familia distinta y evita preocupaciones por ataques de
  longitud-extensión y por las críticas teóricas sobre SHA2.

* **Argon2id para passwords**: bcrypt y PBKDF2 son CPU-hard pero no
  memory-hard → atacante con GPU las rompe rápido. Argon2id es el estándar
  actual.

* **JSON canónico determinista** (`canonical.canonical_bytes`): `sort_keys=True`
  + `separators=(',', ':')`. Sin esto, dos serializaciones del mismo dict
  producirían bytes distintos y la firma fallaría aunque el contenido fuera
  idéntico.

* **Mensaje genérico en errores cripto**: si el servidor distinguiera "TAG
  falló" vs "padding RSA falló", un atacante construiría oráculos. Un único
  `INTEGRIDAD comprometida o firma inválida` cierra ese canal.

---

## 6. Lo que NO toca el servidor (regla de oro)

* Las llaves privadas EC y RSA del usuario.
* La password en claro (solo el hash Argon2id).
* La DEK más allá de la operación (scrub inmediato).

Lo que sí persiste: pubs, X.509, criptogramas (`C`, `TAG`, `IV`, `AAD`),
firmas (`S_D`, `S_F`, `S_cancel`, acuse), envolturas (`C_wrap_*`), audit log.

---

## 7. Mapa de archivos cripto-relevantes

```
services/crypto/
├── aes_gcm.py        ← AES-128-GCM
├── rsa_oaep.py       ← RSA-OAEP-SHA256
├── signatures.py     ← ECDSA P-256 + SHA3-256
├── keys.py           ← gen / parse / rechazo de curvas inválidas
├── argon2_pw.py      ← password hashing
├── jwt_service.py    ← sesión
├── canonical.py      ← JSON canónico determinista
└── crypto_log.py     ← logger visual de cada operación

services/
├── canonical_receta.py    ← bytes firmables (R, AAD, sello, M_cancel)
├── receta_cifrado.py      ← compone DEK + AES-GCM + N×RSA-OAEP
├── receta_descifrado.py   ← compone RSA-OAEP-unwrap + AES-GCM-decrypt
└── bundle.py              ← valida pertenencia priv ↔ pub

routers/
├── recetas_crear.py        ← §4 emisión
├── recetas_consulta.py     ← §5 consulta + verificación pública
├── recetas_dispensar.py    ← §6 dispensación + acuse
├── recetas_cancelar.py     ← §8 cancelación
└── recetas_nueva_version.py ← §9 sustitución
```

Para ver el flujo en vivo: `uvicorn main:app --reload`. Cada operación
cripto imprime un banner por stderr. Para silenciar: `CRYPTO_LOG=0`.
