// Automatisch erzeugt aus license-client.ts (npm run build:sdk) – nicht von Hand ändern.
/**
 * Lizenz-Client für das Lizenzportal (Lukas Dröger).
 *
 * Quelle für alle Varianten: sdk/node/license-client.ts
 *   npm run build:sdk  →  license-client.mjs (ESM) und license-client.cjs (CommonJS)
 * In die Projekte wird die passende Datei kopiert; keine Abhängigkeiten außer Node ≥ 18.
 *
 * Ablauf:
 *  1. activate(key) meldet die Installation an und speichert ein signiertes Token in stateFile.
 *  2. Das Token wird bei jedem Start offline mit dem öffentlichen Schlüssel geprüft (Ed25519).
 *  3. Alle refreshHours wird es beim Server erneuert. Ist der Server nicht erreichbar,
 *     gilt das Token bis leaseUntil weiter (Standard: 14 Tage Offline-Toleranz).
 *  4. hasFeature('code') / limit('users') steuern einzelne Funktionen – inkl. gebuchter Zusatzmodule.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

                                                                                                   

                                                                                              
                    
                                                                                                      

                                                            

// Antworten des Servers, die eine Lizenz endgültig ungültig machen (im Gegensatz zu Netzwerkfehlern)
const FINAL_CODES = new Set(['invalid_key', 'wrong_product', 'revoked', 'suspended', 'expired', 'not_activated', 'activation_limit', 'pending']);

class LicenseError extends Error {
  code        ;
  constructor(code        , message        ) {
    super(message);
    this.code = code;
  }
}

class LicenseClient {
          opts                      ;
          state             ;
          current               ;
          timer                        = null;
          listeners                                    = [];

  constructor(opts                      ) {
    this.opts = { refreshHours: 24, ...opts, serverUrl: opts.serverUrl.replace(/\/+$/, '') };
    this.state = this.load();
    this.current = { state: 'unlicensed', instanceId: this.state.instanceId };
  }

  /** Beim Start aufrufen: prüft das gespeicherte Token und gleicht (falls fällig) mit dem Server ab. */
  async init()                         {
    this.evaluate();
    const due = !this.state.lastCheck || Date.now() - Date.parse(this.state.lastCheck) > this.refreshMs();
    if (this.state.key && due) await this.refresh().catch(() => undefined);
    this.schedule();
    return this.current;
  }

  /** Lizenzschlüssel eintragen und diese Installation aktivieren. */
  async activate(key        )                         {
    const res = await this.call('/api/v1/licenses/activate', key.trim().toUpperCase());
    this.state.key = res.license.key;
    this.state.token = res.token;
    this.state.lastCheck = new Date().toISOString();
    delete this.state.lastError;
    this.save();
    this.evaluate();
    this.schedule();
    return this.current;
  }

  /** Token beim Server erneuern (Heartbeat). Netzwerkfehler lassen das vorhandene Token unangetastet. */
  async refresh()                         {
    if (!this.state.key) return this.evaluate();
    try {
      const res = await this.call('/api/v1/licenses/validate', this.state.key);
      this.state.token = res.token;
      this.state.lastCheck = new Date().toISOString();
      delete this.state.lastError;
    } catch (err) {
      const e = err                ;
      this.state.lastError = e.message;
      if (FINAL_CODES.has(e.code)) {
        delete this.state.token;
        this.state.lastCheck = new Date().toISOString();
        this.save();
        return this.set({ state: 'invalid', reason: e.code, message: e.message, instanceId: this.state.instanceId, lastCheck: this.state.lastCheck });
      }
      this.opts.logger?.warn(`Lizenzserver nicht erreichbar: ${e.message}`);
    }
    this.save();
    return this.evaluate();
  }

  /** Installation beim Server abmelden (z. B. vor Serverumzug) und Lizenz lokal entfernen. */
  async deactivate()                {
    if (this.state.key) {
      await fetch(`${this.opts.serverUrl}/api/v1/licenses/deactivate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: this.state.key, instanceId: this.state.instanceId }),
      }).catch(() => undefined);
    }
    delete this.state.key;
    delete this.state.token;
    delete this.state.lastCheck;
    this.save();
    this.evaluate();
  }

  /** Offline-Lizenz (Token aus dem Admin-Portal) für Installationen ohne Internet einspielen. */
  importOfflineToken(token        )                {
    const payload = this.verify(token.trim());
    if (!payload) throw new LicenseError('bad_token', 'Lizenzdatei ist ungültig oder beschädigt');
    this.state.token = token.trim();
    this.state.key = payload.key;
    this.save();
    return this.evaluate();
  }

  status()                {
    // Ablauf während der Laufzeit berücksichtigen, ohne auf den nächsten Abgleich zu warten
    if (this.current.state === 'valid') this.evaluate();
    return this.current;
  }

  isValid()          {
    return this.status().state === 'valid';
  }

  /** Ist eine Funktion (aus Tarif oder Zusatzmodul) freigeschaltet? */
  hasFeature(feature        )          {
    const s = this.status();
    return s.state === 'valid' && !!s.license?.features.includes(feature);
  }

  /** Grenzwert, z. B. limit('users'). undefined = unbegrenzt bzw. keine gültige Lizenz → mit isValid() kombinieren. */
  limit(name        )                     {
    const s = this.status();
    return s.state === 'valid' ? s.license?.limits[name] : undefined;
  }

  onChange(listener                            )             {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter((l) => l !== listener); };
  }

  stop()       {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  // ---------- intern ----------

          refreshMs()         {
    return (this.opts.refreshHours ?? 24) * 3600000;
  }

          schedule()       {
    this.stop();
    if (!this.state.key) return;
    this.timer = setInterval(() => { void this.refresh().catch(() => undefined); }, Math.min(this.refreshMs(), 6 * 3600000));
    this.timer.unref?.();
  }

          evaluate()                {
    const base = { instanceId: this.state.instanceId, lastCheck: this.state.lastCheck, offline: !!this.state.lastError };
    if (!this.state.token) return this.set({ ...base, state: 'unlicensed' });
    const p = this.verify(this.state.token);
    const now = Date.now();
    const invalid = (reason        , message        ) => this.set({ ...base, state: 'invalid', reason, message, license: p ?? undefined });
    if (!p) return invalid('bad_signature', 'Lizenz-Token ist ungültig (Signatur)');
    if (p.product !== this.opts.product) return invalid('wrong_product', `Lizenz gilt für „${p.product}“`);
    if (p.instance !== '*' && p.instance !== this.state.instanceId) return invalid('wrong_instance', 'Lizenz gehört zu einer anderen Installation');
    if (p.validUntil && Date.parse(p.validUntil) < now) return invalid('expired', 'Lizenz ist abgelaufen');
    if (p.leaseUntil && Date.parse(p.leaseUntil) < now) return invalid('lease_expired', 'Lizenz konnte zu lange nicht beim Lizenzserver geprüft werden');
    return this.set({ ...base, state: 'valid', license: p });
  }

          set(next               )                {
    const changed = next.state !== this.current.state || next.license?.issuedAt !== this.current.license?.issuedAt;
    this.current = next;
    if (changed) for (const l of this.listeners) l(next);
    return next;
  }

          verify(token        )                        {
    const key = this.opts.publicKey || process.env.LICENSE_PUBLIC_KEY || this.state.publicKey;
    if (!key) return null;
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== 'LIC1' || !parts[1] || !parts[2]) return null;
    try {
      const ok = crypto.verify(null, Buffer.from(`LIC1.${parts[1]}`), crypto.createPublicKey(key.replace(/\\n/g, '\n')), Buffer.from(parts[2], 'base64url'));
      return ok ? (JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))                  ) : null;
    } catch {
      return null;
    }
  }

          async call(endpoint        , key        )                                                       {
    await this.ensurePublicKey();
    let res          ;
    try {
      res = await fetch(`${this.opts.serverUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, product: this.opts.product, instanceId: this.state.instanceId, hostname: os.hostname(), version: this.opts.version }),
        signal: AbortSignal.timeout(15000),
      });
    } catch (err) {
      throw new LicenseError('network', `Lizenzserver nicht erreichbar (${(err         ).message})`);
    }
    const body = (await res.json().catch(() => ({})))                                                                                              ;
    if (!res.ok || !body.ok || !body.token || !body.license) {
      throw new LicenseError(body.code ?? (res.status >= 500 ? 'server' : 'unknown'), body.error ?? `Lizenzserver antwortet mit ${res.status}`);
    }
    if (!this.verify(body.token)) throw new LicenseError('bad_signature', 'Antwort des Lizenzservers hat keine gültige Signatur');
    return { license: body.license, token: body.token };
  }

  // Ohne fest eingebauten Schlüssel: beim ersten Kontakt holen und danach nur noch diesen akzeptieren
          async ensurePublicKey()                {
    if (this.opts.publicKey || process.env.LICENSE_PUBLIC_KEY || this.state.publicKey) return;
    try {
      const res = await fetch(`${this.opts.serverUrl}/api/v1/public-key`, { signal: AbortSignal.timeout(15000) });
      const body = (await res.json())                          ;
      if (body.publicKey) {
        this.state.publicKey = body.publicKey;
        this.save();
        this.opts.logger?.warn('Öffentlicher Lizenzschlüssel vom Server übernommen – für Produktion LICENSE_PUBLIC_KEY fest hinterlegen.');
      }
    } catch (err) {
      throw new LicenseError('network', `Lizenzserver nicht erreichbar (${(err         ).message})`);
    }
  }

          load()              {
    try {
      const s = JSON.parse(fs.readFileSync(this.opts.stateFile, 'utf8'))               ;
      if (s.instanceId) return s;
    } catch { /* noch keine Datei */ }
    const fresh              = { instanceId: crypto.randomUUID() };
    this.state = fresh;
    this.save();
    return fresh;
  }

          save()       {
    try {
      fs.mkdirSync(path.dirname(this.opts.stateFile), { recursive: true });
      fs.writeFileSync(this.opts.stateFile, JSON.stringify(this.state, null, 2), { mode: 0o600 });
    } catch (err) {
      this.opts.logger?.warn(`Lizenzstatus konnte nicht gespeichert werden: ${(err         ).message}`);
    }
  }
}

module.exports = { LicenseClient, LicenseError };
