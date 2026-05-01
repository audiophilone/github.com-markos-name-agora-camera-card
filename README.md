# Agora Camera Card

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)

Eine Home Assistant Lovelace Card für Kameras, die das **Agora RTC Protokoll** nutzen – insbesondere die **Yuka Mini** und ähnliche Tuya-Agora-Kameras.

> ⚠️ Die original Agora Card wird nicht mehr gepflegt. Diese Card ist ein vollständiger Nachbau mit Agora Web SDK 4.x.

---

## Unterstützte Geräte

- **Yuka Mini** (alle Modelle)
- Tuya-basierte Kameras mit Agora-Stream
- Alle anderen Kameras, die das Agora RTC Protokoll nutzen

---

## Installation via HACS

### 1. Repository hinzufügen

1. Gehe in HACS → Integrationen → Drei Punkte oben rechts → **Benutzerdefinierte Repositories**
2. URL eingeben: `https://github.com/hauck-hilbk/agora-camera-card`
3. Kategorie: **Lovelace**
4. **Hinzufügen** klicken

### 2. Card installieren

1. In HACS unter **Frontend** nach **Agora Camera Card** suchen
2. **Herunterladen** klicken
3. Home Assistant neu starten

### 3. Resource registrieren (falls nötig)

Falls die Card nicht automatisch erkannt wird:

```yaml
# configuration.yaml
lovelace:
  resources:
    - url: /hacsfiles/agora-camera-card/agora-camera-card.js
      type: module
```

---

## Konfiguration

### Agora Zugangsdaten ermitteln

Für die Yuka Mini benötigst du:

| Parameter | Beschreibung | Woher |
|-----------|-------------|-------|
| `app_id` | Agora App ID | Tuya Developer Console oder App-Traffic mitschneiden |
| `channel` | Kanal-Name | Meist die Geräte-ID der Kamera |
| `token` | RTC Token | Wird von Tuya-Backend generiert (kurzlebig!) |
| `uid` | User ID | 0 = zufällig |

#### Methode 1: Tuya Developer Console

1. Anmelden auf [iot.tuya.com](https://iot.tuya.com)
2. Projekt öffnen → Cloud-Entwicklung
3. Die Agora App ID steht unter **Audio/Video** Dienste

#### Methode 2: App-Traffic mitschneiden

Nutze einen MITM-Proxy (z.B. Charles, mitmproxy) während die offizielle App die Kamera öffnet. Die Parameter erscheinen in den API-Calls.

#### Methode 3: Home Assistant Tuya Integration

Die offizielle `tuya` Integration kann Agora-Credentials über den Cloud-API-Aufruf `POST /v1.0/rtc/agora/user/token` beziehen.

### Basis-Konfiguration

```yaml
type: custom:agora-camera-card
app_id: "DEINE_AGORA_APP_ID"
channel: "DEIN_KANAL"
token: "DEIN_RTC_TOKEN"  # optional bei Test-Modus
title: "Yuka Mini Eingang"
```

### Vollständige Konfiguration

```yaml
type: custom:agora-camera-card

# ── Pflichtfelder ─────────────────────────────────
app_id: "abc123def456"      # Agora App ID
channel: "camera_001"       # Kanal-Name

# ── Verbindung ────────────────────────────────────
token: null                 # null = Test-Modus (nur für lokale Tests!)
uid: 0                      # 0 = zufällige UID
codec: h264                 # h264 (Yuka Mini) oder vp8
remote_uid: ""              # UID des Kamera-Geräts (leer = erster Stream)

# ── Darstellung ───────────────────────────────────
title: "Yuka Mini"          # Titel (leer = kein Header)
width: "100%"               # Breite
height: "auto"              # Höhe
aspect_ratio: "16/9"        # 16/9, 4/3, 1/1 oder none

# ── Verhalten ─────────────────────────────────────
auto_connect: true          # Automatisch verbinden beim Laden
volume: 0                   # Audio-Lautstärke (0 = stumm)
```

### Beispiele

**Yuka Mini (typisch):**
```yaml
type: custom:agora-camera-card
app_id: "your_agora_app_id"
channel: "yuka_device_id_here"
codec: h264
title: "Haustür"
aspect_ratio: "16/9"
auto_connect: true
volume: 0
```

**Im Dashboard ohne Titel:**
```yaml
type: custom:agora-camera-card
app_id: "your_agora_app_id"
channel: "channel_name"
codec: h264
aspect_ratio: "4/3"
```

---

## Token-Erneuerung

Agora-Tokens laufen nach kurzer Zeit ab (typisch 24h). Für eine dauerhafte Lösung empfehle ich:

### Option A: Home Assistant Automation

```yaml
automation:
  - alias: "Agora Token erneuern"
    trigger:
      - platform: time_pattern
        hours: "/12"  # alle 12 Stunden
    action:
      - service: lovelace.reload_resources
```

### Option B: Token-Server

Setze einen kleinen Node.js-Server auf, der Tokens über die Agora Token-API generiert und regelmäßig erneuert.

### Option C: Tuya-API Integration

Nutze den HA-Befehl `rest_command` um über Tuyas Cloud-API einen frischen Token zu beziehen:

```yaml
rest_command:
  get_agora_token:
    url: "https://openapi.tuyaeu.com/v1.0/rtc/agora/user/token"
    method: POST
    headers:
      client_id: !secret tuya_client_id
      access_token: !secret tuya_access_token
    payload: >
      {"room_id": "{{ room_id }}", "user_id": "{{ user_id }}"}
```

---

## Technische Details

- **Agora Web SDK:** 4.20.1 (wird dynamisch geladen)
- **Modus:** Live Streaming (Audience-only, kein eigener Stream)
- **Codecs:** H.264 (Yuka Mini Standard), VP8
- **Reconnect:** Automatisch bis zu 3 Versuche mit steigendem Delay
- **Audio:** Standardmäßig stumm (volume: 0)

---

## Bekannte Probleme

| Problem | Lösung |
|---------|--------|
| "Verbindung fehlgeschlagen" | Token abgelaufen – neu generieren |
| Kein Video, aber verbunden | `remote_uid` des Kamera-Geräts angeben |
| Schwarzes Bild | Codec-Mismatch – `codec: vp8` versuchen |
| CORS-Fehler | Agora App-Domain-Whitelist prüfen |

---

## Datenschutz

Diese Card stellt eine direkte RTC-Verbindung über das Agora-Netzwerk her. Der Stream läuft über Agoras Edge-Server – nicht durch Home Assistant. Stelle sicher, dass deine Datenschutzanforderungen damit vereinbar sind.

---

## Lizenz

MIT License – Frei nutzbar, anpassbar, weitergeben erlaubt.
