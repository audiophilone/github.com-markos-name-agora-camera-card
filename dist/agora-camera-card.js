/**
 * Agora Camera Card for Home Assistant
 * Streams cameras that use the Agora RTC protocol (Yuka Mini, Tuya Agora cameras)
 *
 * HACS Custom Card
 * Version: 1.0.0
 */

// Agora Web SDK 4.x – loaded dynamically to avoid bundling issues
const AGORA_SDK_URL = "https://download.agora.io/sdk/release/AgoraRTC_N-4.20.1.js";

const loadAgoraSDK = (() => {
  let promise = null;
  return () => {
    if (promise) return promise;
    promise = new Promise((resolve, reject) => {
      if (window.AgoraRTC) {
        resolve(window.AgoraRTC);
        return;
      }
      const script = document.createElement("script");
      script.src = AGORA_SDK_URL;
      script.onload = () => {
        if (window.AgoraRTC) {
          // Suppress Agora's verbose console output
          window.AgoraRTC.setLogLevel(4);
          resolve(window.AgoraRTC);
        } else {
          reject(new Error("AgoraRTC SDK failed to load"));
        }
      };
      script.onerror = () => reject(new Error("Failed to load Agora SDK from CDN"));
      document.head.appendChild(script);
    });
    return promise;
  };
})();

// ── Card Editor ──────────────────────────────────────────────────────────────
class AgoraCameraCardEditor extends HTMLElement {
  constructor() {
    super();
    this._config = {};
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  _render() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        .form { display: flex; flex-direction: column; gap: 16px; padding: 16px; }
        .field { display: flex; flex-direction: column; gap: 4px; }
        label { font-size: 12px; font-weight: 500; color: var(--secondary-text-color); text-transform: uppercase; letter-spacing: 0.5px; }
        input, select { padding: 8px 12px; border: 1px solid var(--divider-color); border-radius: 4px; background: var(--card-background-color); color: var(--primary-text-color); font-size: 14px; }
        input:focus, select:focus { outline: none; border-color: var(--primary-color); }
        .hint { font-size: 11px; color: var(--secondary-text-color); margin-top: 2px; }
        .section-title { font-size: 13px; font-weight: 600; color: var(--primary-text-color); margin-top: 8px; border-bottom: 1px solid var(--divider-color); padding-bottom: 8px; }
        .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      </style>
      <div class="form">
        <div class="section-title">📡 Agora Verbindung</div>
        <div class="field">
          <label>App ID *</label>
          <input id="app_id" value="${this._config.app_id || ""}" placeholder="Agora App ID" />
          <span class="hint">Deine Agora App ID (aus Tuya/Agora Developer Console)</span>
        </div>
        <div class="field">
          <label>Kanal *</label>
          <input id="channel" value="${this._config.channel || ""}" placeholder="Kanal-Name" />
          <span class="hint">Kanal-Name der Kamera (meist Geräte-ID oder custom)</span>
        </div>
        <div class="field">
          <label>Token</label>
          <input id="token" value="${this._config.token || ""}" placeholder="RTC Token (optional bei Test-Modus)" />
          <span class="hint">Leer lassen für temporären Test-Modus (nicht für Produktion!)</span>
        </div>
        <div class="row">
          <div class="field">
            <label>UID</label>
            <input id="uid" type="number" value="${this._config.uid || "0"}" placeholder="0" />
            <span class="hint">0 = zufällig</span>
          </div>
          <div class="field">
            <label>Codec</label>
            <select id="codec">
              <option value="vp8" ${this._config.codec === "vp8" ? "selected" : ""}>VP8 (Standard)</option>
              <option value="h264" ${this._config.codec === "h264" ? "selected" : ""}>H.264 (Yuka Mini)</option>
            </select>
          </div>
        </div>

        <div class="section-title">🎥 Darstellung</div>
        <div class="field">
          <label>Titel (optional)</label>
          <input id="title" value="${this._config.title || ""}" placeholder="z.B. Eingangskamera" />
        </div>
        <div class="row">
          <div class="field">
            <label>Breite</label>
            <input id="width" value="${this._config.width || "100%"}" placeholder="100%" />
          </div>
          <div class="field">
            <label>Höhe</label>
            <input id="height" value="${this._config.height || "auto"}" placeholder="auto" />
          </div>
        </div>
        <div class="field">
          <label>Seitenverhältnis</label>
          <select id="aspect_ratio">
            <option value="16/9" ${this._config.aspect_ratio === "16/9" ? "selected" : ""}>16:9 (Standard)</option>
            <option value="4/3" ${this._config.aspect_ratio === "4/3" ? "selected" : ""}>4:3</option>
            <option value="1/1" ${this._config.aspect_ratio === "1/1" ? "selected" : ""}>1:1</option>
            <option value="none" ${this._config.aspect_ratio === "none" ? "selected" : ""}>Kein Seitenverhältnis</option>
          </select>
        </div>

        <div class="section-title">⚙️ Optionen</div>
        <div class="row">
          <div class="field">
            <label>Auto-Verbinden</label>
            <select id="auto_connect">
              <option value="true" ${this._config.auto_connect !== false ? "selected" : ""}>Ja</option>
              <option value="false" ${this._config.auto_connect === false ? "selected" : ""}>Nein</option>
            </select>
          </div>
          <div class="field">
            <label>Lautstärke (1-100)</label>
            <input id="volume" type="number" min="0" max="100" value="${this._config.volume ?? 0}" placeholder="0 = stumm" />
          </div>
        </div>
        <div class="field">
          <label>Remote User ID Filter</label>
          <input id="remote_uid" value="${this._config.remote_uid || ""}" placeholder="Leer = erster verfügbarer Stream" />
          <span class="hint">Optionale UID des Kamera-Geräts (wenn mehrere im Kanal)</span>
        </div>
      </div>
    `;

    // Event listeners für alle Felder
    const fields = ["app_id", "channel", "token", "uid", "codec", "title", "width", "height", "aspect_ratio", "auto_connect", "volume", "remote_uid"];
    fields.forEach(field => {
      const el = this.shadowRoot.getElementById(field);
      if (el) {
        el.addEventListener("change", () => this._valueChanged());
      }
    });
  }

  _valueChanged() {
    const config = {
      ...this._config,
      app_id: this.shadowRoot.getElementById("app_id").value,
      channel: this.shadowRoot.getElementById("channel").value,
      token: this.shadowRoot.getElementById("token").value || null,
      uid: parseInt(this.shadowRoot.getElementById("uid").value) || 0,
      codec: this.shadowRoot.getElementById("codec").value,
      title: this.shadowRoot.getElementById("title").value || null,
      width: this.shadowRoot.getElementById("width").value || "100%",
      height: this.shadowRoot.getElementById("height").value || "auto",
      aspect_ratio: this.shadowRoot.getElementById("aspect_ratio").value,
      auto_connect: this.shadowRoot.getElementById("auto_connect").value === "true",
      volume: parseInt(this.shadowRoot.getElementById("volume").value) ?? 0,
      remote_uid: this.shadowRoot.getElementById("remote_uid").value || null,
    };
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
  }
}
customElements.define("agora-camera-card-editor", AgoraCameraCardEditor);

// ── Main Card ────────────────────────────────────────────────────────────────
class AgoraCameraCard extends HTMLElement {
  constructor() {
    super();
    this._config = {};
    this._client = null;
    this._remoteVideoTrack = null;
    this._remoteAudioTrack = null;
    this._connected = false;
    this._connecting = false;
    this._error = null;
    this._retryCount = 0;
    this._maxRetries = 3;
    this._retryDelay = 3000;
    this._playerDiv = null;
    this.attachShadow({ mode: "open" });
  }

  // ── Config ────────────────────────────────────────────────────────────────
  setConfig(config) {
    if (!config.app_id) throw new Error("app_id ist erforderlich");
    if (!config.channel) throw new Error("channel ist erforderlich");

    const changed = JSON.stringify(config) !== JSON.stringify(this._config);
    this._config = {
      codec: "h264",
      auto_connect: true,
      volume: 0,
      aspect_ratio: "16/9",
      width: "100%",
      height: "auto",
      ...config,
    };

    if (changed) {
      this._render();
      if (this._config.auto_connect) {
        this._scheduleConnect();
      }
    }
  }

  static getConfigElement() {
    return document.createElement("agora-camera-card-editor");
  }

  static getStubConfig() {
    return {
      app_id: "",
      channel: "",
      token: null,
      uid: 0,
      codec: "h264",
      title: "Kamera",
      auto_connect: true,
      volume: 0,
      aspect_ratio: "16/9",
    };
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  connectedCallback() {
    if (this._config.auto_connect && !this._connected && !this._connecting) {
      this._scheduleConnect();
    }
  }

  disconnectedCallback() {
    this._disconnect();
  }

  _scheduleConnect() {
    clearTimeout(this._connectTimer);
    this._connectTimer = setTimeout(() => this._connect(), 100);
  }

  // ── Agora Connection ──────────────────────────────────────────────────────
  async _connect() {
    if (this._connecting || this._connected) return;
    this._connecting = true;
    this._error = null;
    this._updateStatus("Verbinde…");

    try {
      const AgoraRTC = await loadAgoraSDK();

      // Cleanup existing client
      if (this._client) {
        await this._disconnect();
      }

      // Create client – Yuka Mini uses "live" mode for viewing
      this._client = AgoraRTC.createClient({
        mode: "live",
        codec: this._config.codec,
      });

      // Audience role – we only receive, never send
      await this._client.setClientRole("audience");

      // Event: remote user published a track
      this._client.on("user-published", async (user, mediaType) => {
        // Filter by remote_uid if configured
        if (this._config.remote_uid && String(user.uid) !== String(this._config.remote_uid)) {
          return;
        }
        await this._client.subscribe(user, mediaType);

        if (mediaType === "video") {
          this._remoteVideoTrack = user.videoTrack;
          this._playVideo();
        }
        if (mediaType === "audio") {
          this._remoteAudioTrack = user.audioTrack;
          const vol = this._config.volume || 0;
          this._remoteAudioTrack.setVolume(vol);
          if (vol > 0) this._remoteAudioTrack.play();
        }
      });

      this._client.on("user-unpublished", (user, mediaType) => {
        if (mediaType === "video") {
          this._remoteVideoTrack = null;
          this._updateStatus("Stream unterbrochen", "warning");
        }
      });

      this._client.on("user-left", () => {
        this._remoteVideoTrack = null;
        this._updateStatus("Gerät getrennt", "warning");
        if (this._config.auto_connect) {
          this._scheduleRetry();
        }
      });

      this._client.on("connection-state-change", (state) => {
        if (state === "DISCONNECTED") {
          this._connected = false;
          if (this._config.auto_connect) this._scheduleRetry();
        }
      });

      // Join channel
      const uid = await this._client.join(
        this._config.app_id,
        this._config.channel,
        this._config.token || null,
        this._config.uid || null
      );

      this._connected = true;
      this._connecting = false;
      this._retryCount = 0;
      this._updateStatus("Verbunden", "ok");

    } catch (err) {
      this._connecting = false;
      this._connected = false;
      this._error = err.message || "Verbindungsfehler";
      console.error("[AgoraCard]", err);
      this._updateStatus(`Fehler: ${this._error}`, "error");
      this._scheduleRetry();
    }
  }

  _scheduleRetry() {
    if (this._retryCount >= this._maxRetries) {
      this._updateStatus(`Verbindung fehlgeschlagen nach ${this._maxRetries} Versuchen`, "error");
      return;
    }
    this._retryCount++;
    const delay = this._retryDelay * this._retryCount;
    this._updateStatus(`Wiederverbinde in ${delay / 1000}s… (${this._retryCount}/${this._maxRetries})`, "warning");
    clearTimeout(this._retryTimer);
    this._retryTimer = setTimeout(() => this._connect(), delay);
  }

  async _disconnect() {
    clearTimeout(this._connectTimer);
    clearTimeout(this._retryTimer);

    if (this._remoteVideoTrack) {
      this._remoteVideoTrack.stop();
      this._remoteVideoTrack = null;
    }
    if (this._remoteAudioTrack) {
      this._remoteAudioTrack.stop();
      this._remoteAudioTrack = null;
    }
    if (this._client) {
      try {
        await this._client.leave();
      } catch (e) {
        // Ignore errors on disconnect
      }
      this._client = null;
    }
    this._connected = false;
    this._connecting = false;
  }

  _playVideo() {
    if (!this._remoteVideoTrack || !this._playerDiv) return;
    // Clear any old video
    this._playerDiv.innerHTML = "";
    this._remoteVideoTrack.play(this._playerDiv, { fit: "contain", mirror: false });
    this._updateStatus("Live", "live");
  }

  // ── Rendering ─────────────────────────────────────────────────────────────
  _render() {
    const { title, width, height, aspect_ratio } = this._config;
    const aspectStyle = aspect_ratio && aspect_ratio !== "none"
      ? `aspect-ratio: ${aspect_ratio};`
      : "";

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: ${width};
          height: ${height !== "auto" ? height : "auto"};
        }
        ha-card {
          overflow: hidden;
          position: relative;
          background: #000;
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px 8px;
          background: var(--ha-card-background, var(--card-background-color));
          border-bottom: 1px solid rgba(255,255,255,0.05);
          flex-shrink: 0;
        }
        .card-header.hidden { display: none; }
        .title {
          font-size: 14px;
          font-weight: 600;
          color: var(--primary-text-color);
        }
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
        }
        .status-badge.live { background: rgba(34,197,94,0.15); color: #22c55e; }
        .status-badge.ok   { background: rgba(34,197,94,0.10); color: #22c55e; }
        .status-badge.warning { background: rgba(245,158,11,0.15); color: #f59e0b; }
        .status-badge.error { background: rgba(239,68,68,0.15); color: #ef4444; }
        .status-badge.loading { background: rgba(59,130,246,0.15); color: #3b82f6; }
        .status-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: currentColor;
        }
        .status-badge.live .status-dot {
          animation: blink 1.5s ease-in-out infinite;
        }
        @keyframes blink {
          0%,100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        .player-wrap {
          position: relative;
          width: 100%;
          ${aspectStyle}
          flex: 1;
          background: #0a0a0a;
          overflow: hidden;
        }
        .player {
          width: 100%;
          height: 100%;
          position: absolute;
          inset: 0;
        }
        /* Agora injects a video element into player div */
        .player video {
          width: 100% !important;
          height: 100% !important;
          object-fit: contain !important;
        }

        .overlay-status {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: rgba(255,255,255,0.6);
          font-size: 13px;
          text-align: center;
          padding: 20px;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(4px);
        }
        .overlay-status.hidden { display: none; }
        .overlay-icon {
          font-size: 32px;
          opacity: 0.7;
        }
        .spinner {
          width: 28px; height: 28px;
          border: 2px solid rgba(255,255,255,0.15);
          border-top-color: rgba(255,255,255,0.7);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .controls {
          display: flex;
          gap: 8px;
          padding: 8px 12px;
          background: var(--ha-card-background, var(--card-background-color));
          border-top: 1px solid rgba(255,255,255,0.05);
          flex-shrink: 0;
        }
        .ctrl-btn {
          flex: 1;
          padding: 6px 12px;
          border: none;
          border-radius: 6px;
          background: rgba(var(--rgb-primary-color, 3,169,244),0.10);
          color: var(--primary-color);
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
        }
        .ctrl-btn:hover {
          background: rgba(var(--rgb-primary-color, 3,169,244),0.20);
        }
        .ctrl-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .ctrl-btn.danger {
          background: rgba(239,68,68,0.10);
          color: #ef4444;
        }
        .ctrl-btn.danger:hover {
          background: rgba(239,68,68,0.20);
        }

        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1px;
          background: var(--divider-color);
          border-top: 1px solid var(--divider-color);
          flex-shrink: 0;
        }
        .info-cell {
          background: var(--ha-card-background, var(--card-background-color));
          padding: 6px 10px;
          font-size: 11px;
        }
        .info-label {
          color: var(--secondary-text-color);
          text-transform: uppercase;
          letter-spacing: 0.4px;
          font-size: 10px;
        }
        .info-value {
          color: var(--primary-text-color);
          font-weight: 500;
          margin-top: 1px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .fullscreen-btn {
          background: none;
          border: none;
          color: rgba(255,255,255,0.6);
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          font-size: 16px;
          line-height: 1;
          transition: color 0.15s ease;
        }
        .fullscreen-btn:hover { color: rgba(255,255,255,0.95); }
      </style>

      <ha-card>
        <div class="card-header ${title ? "" : "hidden"}">
          <span class="title">${title || ""}</span>
          <div style="display:flex; align-items:center; gap:8px;">
            <div id="status-badge" class="status-badge loading">
              <div class="status-dot"></div>
              <span id="status-text">Initialisiere…</span>
            </div>
            <button class="fullscreen-btn" id="fullscreen-btn" title="Vollbild">⛶</button>
          </div>
        </div>

        <div class="player-wrap" id="player-wrap">
          <div class="player" id="player"></div>
          <div class="overlay-status" id="overlay">
            <div class="spinner" id="spinner"></div>
            <span id="overlay-text">Verbinde mit Kamera…</span>
          </div>
        </div>

        <div class="controls">
          <button class="ctrl-btn" id="connect-btn" disabled>
            <span>▶</span> Verbinden
          </button>
          <button class="ctrl-btn danger" id="disconnect-btn" disabled>
            <span>■</span> Trennen
          </button>
          <button class="ctrl-btn" id="reload-btn">
            <span>↺</span> Neu laden
          </button>
        </div>

        <div class="info-grid">
          <div class="info-cell">
            <div class="info-label">Kanal</div>
            <div class="info-value" title="${this._config.channel || ""}">${this._config.channel || "—"}</div>
          </div>
          <div class="info-cell">
            <div class="info-label">Codec</div>
            <div class="info-value">${(this._config.codec || "h264").toUpperCase()}</div>
          </div>
        </div>
      </ha-card>
    `;

    this._playerDiv = this.shadowRoot.getElementById("player");

    // Button events
    this.shadowRoot.getElementById("connect-btn").addEventListener("click", () => {
      this._retryCount = 0;
      this._connect();
    });
    this.shadowRoot.getElementById("disconnect-btn").addEventListener("click", () => {
      this._disconnect();
      this._updateStatus("Getrennt", "warning");
    });
    this.shadowRoot.getElementById("reload-btn").addEventListener("click", () => {
      this._retryCount = 0;
      this._disconnect().then(() => this._connect());
    });
    this.shadowRoot.getElementById("fullscreen-btn").addEventListener("click", () => {
      const wrap = this.shadowRoot.getElementById("player-wrap");
      if (wrap.requestFullscreen) wrap.requestFullscreen();
      else if (wrap.webkitRequestFullscreen) wrap.webkitRequestFullscreen();
    });

    this._updateStatus("Initialisiere…", "loading");
  }

  _updateStatus(text, type = "loading") {
    const badge = this.shadowRoot?.getElementById("status-badge");
    const statusText = this.shadowRoot?.getElementById("status-text");
    const overlay = this.shadowRoot?.getElementById("overlay");
    const overlayText = this.shadowRoot?.getElementById("overlay-text");
    const spinner = this.shadowRoot?.getElementById("spinner");
    const connectBtn = this.shadowRoot?.getElementById("connect-btn");
    const disconnectBtn = this.shadowRoot?.getElementById("disconnect-btn");

    if (!badge) return;

    // Update badge
    badge.className = `status-badge ${type}`;
    if (statusText) statusText.textContent = text;

    // Update overlay + spinner
    const isLive = type === "live";
    const isError = type === "error";
    const isLoading = type === "loading";

    if (overlay) {
      overlay.className = isLive ? "overlay-status hidden" : "overlay-status";
    }
    if (overlayText) overlayText.textContent = text;
    if (spinner) spinner.style.display = isLoading ? "block" : "none";

    // Update buttons
    if (connectBtn) connectBtn.disabled = this._connected || this._connecting;
    if (disconnectBtn) disconnectBtn.disabled = !this._connected && !this._connecting;
  }
}

// Register the card
customElements.define("agora-camera-card", AgoraCameraCard);

// Register with Home Assistant card registry
window.customCards = window.customCards || [];
window.customCards.push({
  type: "agora-camera-card",
  name: "Agora Camera Card",
  description: "Live-Stream für Agora-basierte Kameras (Yuka Mini, Tuya Agora)",
  preview: false,
  documentationURL: "https://github.com/hauck-hilbk/agora-camera-card",
});

console.info(
  "%c AGORA-CAMERA-CARD %c v1.0.0 ",
  "color: #21B573; background: #1a2234; padding: 2px 4px; border-radius: 3px 0 0 3px; font-weight: bold;",
  "color: #fff; background: #21759B; padding: 2px 4px; border-radius: 0 3px 3px 0;"
);
