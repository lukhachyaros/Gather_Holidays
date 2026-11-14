const TOKEN_PREFIX = 'gh_authority_session_v1:';

export class SeasonalAuthorityClient {
  constructor({ baseUrl, onState = () => {}, onStatus = () => {}, storage = globalThis.localStorage, fetcher = globalThis.fetch, getPosition } = {}) {
    this.baseUrl = String(baseUrl || '').replace(/\/+$/, '');
    this.onState = onState;
    this.onStatus = onStatus;
    this.storage = storage;
    this.fetcher = fetcher;
    this.getPosition = getPosition;
    this.roomId = '';
    this.userId = '';
    this.token = '';
    this.sequence = -1;
    this.timer = 0;
    this.pollIntervalMs = 1500;
    this.positionTimer = 0;
    this.positionFlight = null;
    this.stopped = false;
    this.inFlight = false;
    this.serverOffsetMs = 0;
    this.hasServerClock = false;
  }

  get enabled() { return !!this.baseUrl && typeof this.fetcher === 'function'; }
  get connected() { return !!this.token && !this.stopped; }
  serverNow() { return Date.now() + this.serverOffsetMs; }
  storageKey(roomId) { return TOKEN_PREFIX + roomId; }

  async request(path, { method = 'GET', body, token = this.token } = {}) {
    const sentAt = Date.now();
    const response = await this.fetcher(this.baseUrl + path, {
      method,
      headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const receivedAt = Date.now();
    const data = await response.json().catch(() => ({}));
    if (Number.isFinite(data.serverNow)) {
      const measuredOffset = data.serverNow - (sentAt + receivedAt) / 2;
      this.serverOffsetMs = this.hasServerClock ? this.serverOffsetMs * 0.75 + measuredOffset * 0.25 : measuredOffset;
      this.hasServerClock = true;
    }
    if (!response.ok) { const error = new Error(data.error || `Authority request failed (${response.status})`); error.status = response.status; throw error; }
    return data;
  }

  async connect({ roomId, theme, name, memberId, host = false }) {
    if (!this.enabled) return false;
    clearInterval(this.timer);
    this.timer = 0;
    this.token = '';
    this.userId = '';
    this.sequence = -1;
    this.roomId = String(roomId || '').toLowerCase();
    if (!/^[a-z0-9_-]{2,48}$/.test(this.roomId)) throw new Error('Room ID is not valid for persistent sessions.');
    this.stopped = false;
    const key = this.storageKey(this.roomId);
    try {
      const saved = JSON.parse(this.storage?.getItem(key) || 'null');
      if (saved?.token) {
        this.token = saved.token;
        this.userId = saved.userId || memberId;
        const current = await this.request(`/v1/rooms/${encodeURIComponent(this.roomId)}/state`);
        this.acceptState(current);
        this.beginPolling();
        this.onStatus('connected');
        return true;
      }
    } catch (error) {
      this.token = '';
      try { this.storage?.removeItem(key); } catch {}
      if (error.status !== 401 && error.status !== 404) throw error;
    }

    const payload = { memberId, name };
    let session;
    for (let attempt = 0; attempt < 8 && !session; attempt++) {
      if (host) {
        try { session = await this.request('/v1/rooms', { method: 'POST', body: { ...payload, roomId: this.roomId, theme }, token: '' }); }
        catch (error) { if (error.status !== 409) throw error; }
      }
      if (!session) {
        try { session = await this.request(`/v1/rooms/${encodeURIComponent(this.roomId)}/join`, { method: 'POST', body: payload, token: '' }); }
        catch (error) { if (error.status !== 404 || attempt === 7) throw error; await new Promise(resolve => setTimeout(resolve, 500)); }
      }
    }
    this.token = session.token;
    this.userId = session.userId;
    try { this.storage?.setItem(key, JSON.stringify({ token: session.token, userId: session.userId })); } catch {}
    this.acceptState(session.state);
    this.beginPolling();
    this.onStatus('connected');
    return true;
  }

  acceptState(state, refresh = false) {
    if (!state || !Number.isFinite(state.seq) || state.seq < this.sequence) return false;
    if (state.seq === this.sequence) {
      if (!refresh) return false;
      const now = state.serverNow || Date.now();
      const activeDance = state.seasonalEvents?.valentine?.dance?.runs?.some(run => run.active || (run.endAt && now <= run.endAt + 3000));
      const team = state.seasonalEvents?.valentine?.dance?.teamSession;
      const activeTeam = !!team?.id && now <= team.endAt + 3000;
      const round = state.seasonalEvents?.halloween?.costume?.round;
      const activeRunway = !!round?.id && now <= round.endAt + 3000;
      if (!activeDance && !activeTeam && !activeRunway) return false;
    }
    this.sequence = Math.max(this.sequence, state.seq);
    this.onState(state);
    return true;
  }

  async submit(operation) {
    if (!this.connected) return false;
    if (operation?.k === 'seasonal_event' && this.getPosition) await this.reportPosition();
    const result = await this.request(`/v1/rooms/${encodeURIComponent(this.roomId)}/events`, { method: 'POST', body: { operation } });
    this.acceptState(result);
    return true;
  }

  async changeTheme(theme) {
    if (!this.connected) throw new Error('Authority session is offline.');
    const result = await this.request(`/v1/rooms/${encodeURIComponent(this.roomId)}/theme`, { method: 'POST', body: { theme } });
    this.acceptState(result);
    return true;
  }

  beginPolling() {
    clearInterval(this.timer);
    this.pollIntervalMs = 1500;
    this.timer = setInterval(() => this.poll(), 1500);
    if (this.getPosition) {
      clearInterval(this.positionTimer);
      this.positionTimer = setInterval(() => this.reportPosition().catch(() => {}), 750);
      this.reportPosition().catch(() => {});
    }
    this.poll();
  }

  async reportPosition() {
    if (!this.connected || typeof this.getPosition !== 'function') return false;
    if (this.positionFlight) return this.positionFlight;
    const position = this.getPosition();
    if (!Number.isFinite(position?.x) || !Number.isFinite(position?.y)) return false;
    this.positionFlight = this.request(`/v1/rooms/${encodeURIComponent(this.roomId)}/position`, {
      method: 'POST', body: { x: position.x, y: position.y },
    }).then(result => !!result.accepted).finally(() => { this.positionFlight = null; });
    return this.positionFlight;
  }

  async poll() {
    if (!this.connected || this.inFlight) return;
    this.inFlight = true;
    try {
      const state = await this.request(`/v1/rooms/${encodeURIComponent(this.roomId)}/state`);
      this.acceptState(state, true);
      const dance = state.seasonalEvents?.valentine?.dance;
      const teamSession = dance?.teamSession;
      const runway = state.seasonalEvents?.halloween?.costume?.round;
      const now = state.serverNow || this.serverNow();
      const fireworks = state.seasonalEvents?.tet?.fireworks?.events || [];
      const needsFastRefresh = dance?.runs?.some(run => run.active || (run.endAt && now <= run.endAt + 3000)) ||
        (teamSession?.id && now <= teamSession.endAt + 3000) || (runway?.id && now <= runway.endAt + 3000) ||
        fireworks.some(event => now >= event.startAt && now <= event.startAt + 9000);
      this.setPollInterval(needsFastRefresh ? 250 : 1500);
      this.onStatus('connected');
    } catch { this.onStatus('reconnecting'); }
    finally { this.inFlight = false; }
  }

  setPollInterval(ms) {
    if (this.pollIntervalMs === ms || !this.connected) return;
    this.pollIntervalMs = ms;
    clearInterval(this.timer);
    this.timer = setInterval(() => this.poll(), ms);
  }

  destroy() {
    this.stopped = true;
    clearInterval(this.timer);
    clearInterval(this.positionTimer);
    this.timer = 0;
    this.positionTimer = 0;
    this.onStatus('offline');
  }
}
