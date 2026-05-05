"""Salida SMTP — verificación de email y reset de contraseña.

Si SMTP no está configurado en `.env` (típico en dev/CI), `_send` simplemente
loggea y vuelve sin lanzar. Esto evita romper el flujo de registro cuando se
prueba en local sin un servidor SMTP real. En producción es responsabilidad
del operador setear SMTP_USER/SMTP_PASS o el correo se omite silenciosamente.
"""
from __future__ import annotations

import os
import smtplib
from email.mime.text import MIMEText

from dotenv import load_dotenv

load_dotenv(override=True)


def _cfg():
    # Lectura perezosa: la primera request al servicio llega después de que
    # uvicorn ya cargó el .env, así que las env vars siempre están listas.
    return {
        "host": os.getenv("SMTP_HOST", "smtp.gmail.com"),
        "port": int(os.getenv("SMTP_PORT", "587")),
        "user": os.getenv("SMTP_USER", ""),
        "pw":   os.getenv("SMTP_PASS", ""),
        "frm":  os.getenv("SMTP_FROM", os.getenv("SMTP_USER", "")),
        "url":  os.getenv("APP_URL", "http://localhost:5173"),
    }


def _send(to: str, subject: str, body: str) -> None:
    c = _cfg()
    if not c["user"] or not c["pw"]:
        # Modo "sin SMTP": no abortamos el endpoint, solo dejamos rastro.
        print(f"[email] SMTP no configurado — correo a {to} omitido")
        return
    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"]    = c["frm"]
    msg["To"]      = to
    try:
        with smtplib.SMTP(c["host"], c["port"], timeout=10) as s:
            s.ehlo()
            # STARTTLS obligatorio: no mandamos credenciales SMTP en claro.
            s.starttls()
            s.login(c["user"], c["pw"])
            s.sendmail(c["frm"], [to], msg.as_string())
        print(f"[email] enviado a {to}: {subject}")
    except Exception as e:
        # Tampoco propagamos errores SMTP: el correo es secundario al flujo
        # principal (registro/reset). El usuario puede pedir reenvío después.
        print(f"[email] ERROR enviando a {to}: {e}")


def enviar_verificacion(to: str, username: str, token: str) -> None:
    url = f"{_cfg()['url']}/verificar-email?token={token}"
    body = (
        f"Hola {username},\n\n"
        "Verifica tu cuenta de SecureRx en el siguiente enlace:\n\n"
        f"  {url}\n\n"
        "Si no creaste esta cuenta, ignora este mensaje.\n\n"
        "— SecureRx"
    )
    _send(to, "Verifica tu cuenta · SecureRx", body)


def enviar_reset(to: str, username: str, token: str) -> None:
    url = f"{_cfg()['url']}/recuperar-password?token={token}"
    body = (
        f"Hola {username},\n\n"
        "Recibimos una solicitud para restablecer tu contraseña de SecureRx.\n\n"
        f"  {url}\n\n"
        "Este enlace expira en 1 hora. Si no lo solicitaste, ignora este mensaje.\n\n"
        "— SecureRx"
    )
    _send(to, "Restablece tu contraseña · SecureRx", body)
