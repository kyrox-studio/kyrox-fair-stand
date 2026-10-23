import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LIVE_SHARE_LIMITS,
  VIEWER_OCCUPIED_MESSAGE,
  applyCaptureContentHint,
  applyLiveShareControls,
  applySenderBitrate,
  bindLiveTabShare,
  canStartLiveShare,
  captureBrowserTab,
  createHostController,
  displayMediaAttempts,
  isSupportedHostBrowser,
  startViewerSession,
  viewerStatusCopy,
  viewerStatusForError,
} from '../src/liveTabShare.js';

const CHROME = 'Mozilla/5.0 Chrome/128.0.0.0 Safari/537.36';
const EDGE = 'Mozilla/5.0 Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0';
const FIREFOX = 'Mozilla/5.0 Firefox/130.0';
const SAFARI = 'Mozilla/5.0 Version/17.0 Safari/605.1.15';

function track(surface, { failStop = false } = {}) {
  const listeners = {};
  return {
    kind: 'video',
    contentHint: '',
    stopped: false,
    getSettings: () => ({ displaySurface: surface }),
    stop() {
      this.stopped = true;
    },
    addEventListener(name, fn) {
      listeners[name] = fn;
    },
    emit(name) {
      listeners[name]?.();
    },
  };
}

function streamFrom(videoTrack) {
  return {
    getVideoTracks: () => [videoTrack],
    getTracks: () => [videoTrack],
  };
}

function controls() {
  const element = () => ({ hidden: false, textContent: '', dataset: {} });
  return {
    root: element(),
    start: element(),
    badge: element(),
    viewers: element(),
    link: element(),
    copy: element(),
    stop: element(),
    error: element(),
  };
}

test('capture limits stay at 480p with a 1.5 Mbps cap', () => {
  assert.equal(LIVE_SHARE_LIMITS.idealWidth, 854);
  assert.equal(LIVE_SHARE_LIMITS.idealHeight, 480);
  assert.equal(LIVE_SHARE_LIMITS.idealFrameRate, 18);
  assert.equal(LIVE_SHARE_LIMITS.maxFrameRate, 20);
  assert.equal(LIVE_SHARE_LIMITS.maxBitrate, 1_500_000);
  assert.ok(LIVE_SHARE_LIMITS.maxBitrate <= LIVE_SHARE_LIMITS.bitrateCeiling);
  assert.equal(VIEWER_OCCUPIED_MESSAGE.includes('bir izleyici'), true);
  for (const attempt of displayMediaAttempts()) {
    assert.equal(attempt.audio, false);
    assert.equal(attempt.video.frameRate.ideal, 18);
    assert.equal(attempt.video.frameRate.max, 20);
    assert.equal(attempt.video.width.ideal, 854);
    assert.equal(attempt.video.height.ideal, 480);
    assert.equal(attempt.video.width.max, undefined);
    assert.equal(attempt.video.height.max, undefined);
    assert.equal(attempt.video.cursor, 'always');
  }
  assert.equal(displayMediaAttempts()[0].preferCurrentTab, true);
  assert.equal(displayMediaAttempts()[0].monitorTypeSurfaces, 'exclude');
});

test('host browser gate accepts Chrome and Edge only', () => {
  assert.equal(isSupportedHostBrowser(CHROME), true);
  assert.equal(isSupportedHostBrowser(EDGE), true);
  assert.equal(isSupportedHostBrowser(FIREFOX), false);
  assert.equal(isSupportedHostBrowser(SAFARI), false);
});

test('permission rejection does not open a session', async () => {
  let created = false;
  const result = await captureBrowserTab({
    getDisplayMedia() {
      const error = new Error('denied');
      error.name = 'NotAllowedError';
      throw error;
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'denied');
  const controller = createHostController({
    userAgent: CHROME,
    mediaDevices: {
      getDisplayMedia() {
        const error = new Error('denied');
        error.name = 'NotAllowedError';
        throw error;
      },
    },
    createSession() {
      created = true;
      return { ok: true };
    },
    onState() {},
  });
  await controller.start();
  assert.equal(created, false);
});

test('non-browser display surface is rejected and stopped', async () => {
  const video = track('monitor');
  const result = await captureBrowserTab({
    async getDisplayMedia() {
      return streamFrom(video);
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'surface');
  assert.equal(video.stopped, true);
});

test('idle, zero viewers, one viewer, and stop cleanup', async () => {
  const ui = controls();
  applyLiveShareControls(ui, { phase: 'idle', viewerCount: 0, error: '', watchUrl: '', popoverOpen: false });
  assert.equal(ui.start.hidden, false);
  assert.equal(ui.start.textContent, 'Ekranı paylaş');
  assert.equal(ui.stop.hidden, true);
  assert.equal(ui.link.hidden, true);

  const video = track('browser');
  const peers = [];
  const sockets = [];
  let stopped = 0;
  const controller = createHostController({
    userAgent: CHROME,
    mediaDevices: { async getDisplayMedia() { return streamFrom(video); } },
    async createSession() {
      return {
        ok: true,
        token: 'token-1',
        hostKey: 'host-key',
        watchUrl: 'https://example.test/stand/watch/token-1',
        socketUrl: 'ws://example.test/ws',
        iceServers: [{ urls: ['stun:example.test:19302'] }],
      };
    },
    connectSocket() {
      const socket = {
        send() {},
        close() { this.closed = true; },
        onmessage: null,
      };
      sockets.push(socket);
      return socket;
    },
    RTCPeerConnection: class {
      constructor(config) {
        this.config = config;
        this.senders = [];
        this.localDescription = null;
        this.closed = false;
        peers.push(this);
      }
      addTrack(mediaTrack) {
        const sender = {
          track: mediaTrack,
          getParameters: () => ({ encodings: [] }),
          async setParameters(parameters) { this.parameters = parameters; },
        };
        this.senders.push(sender);
        return sender;
      }
      createOffer() { return { type: 'offer', sdp: 'offer' }; }
      async setLocalDescription(description) { this.localDescription = description; }
      async setRemoteDescription(description) { this.remoteDescription = description; }
      async addIceCandidate() {}
      close() { this.closed = true; }
      createDataChannel() { throw new Error('datachannel'); }
    },
    setInterval() { return 1; },
    clearInterval() {},
    signalStop() { stopped += 1; },
    onState(state) { applyLiveShareControls(ui, state); },
  });

  await controller.start();
  assert.equal(ui.start.hidden, false);
  assert.equal(ui.start.textContent, '● CANLI · 0');
  assert.equal(ui.start.textContent.includes('http'), false);
  assert.equal(ui.viewers.textContent, 'İzleyici: 0 / 1');
  assert.equal(ui.link.textContent, 'https://example.test/stand/watch/token-1');
  assert.equal(controller.peerCount(), 0);

  await sockets[0].onmessage({ data: JSON.stringify({ type: 'joined', iceServers: [{ urls: ['stun:example.test:19302'] }] }) });
  await sockets[0].onmessage({ data: JSON.stringify({ type: 'viewer-joined', viewerCount: 1 }) });
  assert.equal(ui.viewers.textContent, 'İzleyici: 1 / 1');
  assert.equal(ui.start.textContent, '● CANLI · 1');
  assert.equal(peers.length, 1);
  assert.equal(peers[0].senders[0].parameters.encodings[0].maxBitrate, 1_500_000);
  assert.equal(peers[0].senders[0].parameters.degradationPreference, 'maintain-resolution');
  assert.equal(peers[0].config.iceServers[0].urls[0], 'stun:example.test:19302');
  assert.equal(video.contentHint, 'detail');

  await sockets[0].onmessage({ data: JSON.stringify({ type: 'viewer-left', viewerCount: 0 }) });
  assert.equal(ui.viewers.textContent, 'İzleyici: 0 / 1');
  assert.equal(ui.start.textContent, '● CANLI · 0');
  assert.equal(peers[0].closed, true);
  assert.equal(controller.peerCount(), 0);

  await controller.stop('user');
  assert.equal(ui.start.hidden, false);
  assert.equal(ui.start.textContent, 'Ekranı paylaş');
  assert.equal(ui.stop.hidden, true);
  assert.equal(video.stopped, true);
  assert.equal(stopped, 1);
});

test('track ended returns the editor to idle', async () => {
  const video = track('browser');
  const states = [];
  const controller = createHostController({
    userAgent: CHROME,
    mediaDevices: { async getDisplayMedia() { return streamFrom(video); } },
    async createSession() {
      return { ok: true, token: 't', hostKey: 'h', watchUrl: 'https://example.test/stand/watch/t', socketUrl: 'ws://x' };
    },
    connectSocket() {
      return { send() {}, close() {}, onmessage: null };
    },
    RTCPeerConnection: class { close() {} },
    setInterval() { return 1; },
    clearInterval() {},
    signalStop() {},
    onState(state) { states.push(state.phase); },
  });
  await controller.start();
  video.emit('ended');
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(states.at(-1), 'idle');
  assert.equal(video.stopped, true);
});

test('viewer states and limited reconnect', async () => {
  assert.equal(viewerStatusCopy('waiting'), 'Canlı bağlantı bekleniyor');
  assert.equal(viewerStatusCopy('disconnected'), 'Bağlantı kesildi');
  assert.equal(viewerStatusCopy('ended'), 'Yayın sona erdi');
  assert.equal(viewerStatusCopy('invalid'), 'Bu canlı paylaşım linki geçersiz.');
  assert.equal(viewerStatusCopy('expired'), 'Bu canlı paylaşımın süresi doldu.');
  assert.equal(viewerStatusCopy('occupied'), VIEWER_OCCUPIED_MESSAGE);
  assert.equal(viewerStatusForError('invalid'), 'invalid');
  assert.equal(viewerStatusForError('expired'), 'expired');
  assert.equal(viewerStatusForError('occupied'), 'occupied');

  const statuses = [];
  const sockets = [];
  const peers = [];
  const timers = [];
  const video = { srcObject: null };
  const stop = startViewerSession({
    token: 'abc',
    videoElement: video,
    location: { protocol: 'https:', host: 'example.test' },
    WebSocket: class {
      constructor(url) {
        this.url = url;
        sockets.push(this);
      }
      send() {}
      close() { this.closed = true; }
    },
    RTCPeerConnection: class {
      constructor() { peers.push(this); this.connectionState = 'new'; }
      addTransceiver(kind, init) { this.transceiver = { kind, init }; }
      addTrack() { throw new Error('viewer must not send'); }
      createDataChannel() { throw new Error('datachannel'); }
      async setRemoteDescription() { this.remoteDescription = true; }
      async createAnswer() { return { type: 'answer', sdp: 'answer' }; }
      async setLocalDescription(description) { this.localDescription = description; }
      async addIceCandidate() {}
      close() { this.closed = true; }
    },
    MediaStream: class { constructor(tracks) { this.tracks = tracks; } },
    setInterval() { return 1; },
    clearInterval() {},
    setTimeout(fn) { timers.push(fn); return timers.length; },
    clearTimeout() {},
    onStatus(status) { statuses.push(status); },
  });

  assert.equal(statuses[0].status, 'waiting');
  assert.match(sockets[0].url, /role=viewer/);
  assert.doesNotMatch(sockets[0].url, /hostKey=/);
  await sockets[0].onmessage({ data: JSON.stringify({ type: 'error', code: 'invalid', message: viewerStatusCopy('invalid') }) });
  assert.equal(statuses.at(-1).status, 'invalid');

  const connected = [];
  const liveSockets = [];
  startViewerSession({
    token: 'live',
    videoElement: video,
    location: { protocol: 'http:', host: 'localhost:5173' },
    WebSocket: class {
      constructor() { liveSockets.push(this); }
      send(body) { this.sent = JSON.parse(body); }
      close() {}
    },
    RTCPeerConnection: class {
      constructor() { peers.push(this); }
      addTransceiver(kind, init) { this.transceiver = { kind, init }; }
      async setRemoteDescription() { this.remoteDescription = true; }
      async createAnswer() { return { type: 'answer', sdp: 'answer-sdp' }; }
      async setLocalDescription(description) { this.localDescription = description; }
      async addIceCandidate() {}
      close() {}
    },
    setInterval() { return 1; },
    clearInterval() {},
    onStatus(status) { connected.push(status.status); },
  });
  await liveSockets[0].onmessage({ data: JSON.stringify({ type: 'joined', iceServers: [] }) });
  await liveSockets[0].onmessage({ data: JSON.stringify({ type: 'offer', sdp: 'offer-sdp' }) });
  const peer = peers.at(-1);
  assert.equal(peer.transceiver.kind, 'video');
  assert.equal(peer.transceiver.init.direction, 'recvonly');
  assert.equal(liveSockets[0].sent.type, 'answer');
  peer.ontrack({ streams: [{ id: 'remote' }], track: { kind: 'video' } });
  assert.equal(video.srcObject.id, 'remote');
  assert.equal(connected.includes('connected'), true);

  const ended = [];
  const endedSockets = [];
  startViewerSession({
    token: 'done',
    location: { protocol: 'https:', host: 'example.test' },
    WebSocket: class {
      constructor() { endedSockets.push(this); }
      send() {}
      close() {}
    },
    RTCPeerConnection: class { close() {} addTransceiver() {} },
    setInterval() { return 1; },
    clearInterval() {},
    onStatus(status) { ended.push(status.status); },
  });
  await endedSockets[0].onmessage({ data: JSON.stringify({ type: 'ended', reason: 'stopped' }) });
  assert.equal(ended.at(-1), 'ended');
  await endedSockets[0].onmessage?.({ data: JSON.stringify({ type: 'ended', reason: 'expired' }) });

  const expired = [];
  const expiredSockets = [];
  startViewerSession({
    token: 'old',
    location: { protocol: 'https:', host: 'example.test' },
    WebSocket: class {
      constructor() { expiredSockets.push(this); }
      send() {}
      close() {}
    },
    RTCPeerConnection: class { close() {} addTransceiver() {} },
    setInterval() { return 1; },
    clearInterval() {},
    onStatus(status) { expired.push(status.status); },
  });
  await expiredSockets[0].onmessage({ data: JSON.stringify({ type: 'ended', reason: 'expired' }) });
  assert.equal(expired.at(-1), 'expired');

  const occupied = [];
  const occupiedSockets = [];
  startViewerSession({
    token: 'full',
    location: { protocol: 'https:', host: 'example.test' },
    WebSocket: class {
      constructor() { occupiedSockets.push(this); }
      send() {}
      close() {}
    },
    RTCPeerConnection: class { close() {} addTransceiver() {} },
    setInterval() { return 1; },
    clearInterval() {},
    onStatus(status) { occupied.push(status); },
  });
  await occupiedSockets[0].onmessage({ data: JSON.stringify({ type: 'error', code: 'occupied', message: VIEWER_OCCUPIED_MESSAGE }) });
  assert.equal(occupied.at(-1).status, 'occupied');
  assert.equal(occupied.at(-1).message, VIEWER_OCCUPIED_MESSAGE);

  stop();
  void timers;
});

test('sender bitrate caps at 1.5 Mbps and prefers resolution', async () => {
  const sender = {
    parameters: null,
    getParameters() { return { encodings: [{}] }; },
    async setParameters(parameters) { this.parameters = parameters; },
  };
  const applied = await applySenderBitrate(sender);
  assert.equal(applied, true);
  assert.equal(sender.parameters.encodings[0].maxBitrate, 1_500_000);
  assert.equal(sender.parameters.degradationPreference, 'maintain-resolution');

  const empty = {
    parameters: null,
    getParameters() { return {}; },
    async setParameters(parameters) { this.parameters = parameters; },
  };
  await applySenderBitrate(empty);
  assert.equal(empty.parameters.encodings.length, 1);
  assert.equal(empty.parameters.encodings[0].maxBitrate, 1_500_000);

  let calls = 0;
  const fallback = {
    parameters: null,
    getParameters() { return { encodings: [{}] }; },
    async setParameters(parameters) {
      calls += 1;
      if (parameters.degradationPreference) throw new Error('unsupported preference');
      this.parameters = parameters;
    },
  };
  assert.equal(await applySenderBitrate(fallback), true);
  assert.equal(calls, 2);
  assert.equal(fallback.parameters.encodings[0].maxBitrate, 1_500_000);
  assert.equal(fallback.parameters.degradationPreference, undefined);
});

test('unsupported contentHint and setParameters keep the broadcast alive', async () => {
  const video = track('browser');
  let writes = 0;
  Object.defineProperty(video, 'contentHint', {
    configurable: true,
    get() { return this.hintValue || ''; },
    set(value) {
      writes += 1;
      if (value === 'detail') throw new Error('unsupported hint');
      this.hintValue = value;
    },
  });
  const captured = await captureBrowserTab({
    async getDisplayMedia() { return streamFrom(video); },
  });
  assert.equal(captured.ok, true);
  assert.equal(video.contentHint, 'motion');
  assert.ok(writes >= 2);

  const rejected = track('browser');
  Object.defineProperty(rejected, 'contentHint', {
    configurable: true,
    get() { return ''; },
    set() { throw new Error('no contentHint'); },
  });
  const stillLive = await captureBrowserTab({
    async getDisplayMedia() { return streamFrom(rejected); },
  });
  assert.equal(stillLive.ok, true);
  assert.equal(rejected.stopped, false);

  const sender = {
    getParameters() { return { encodings: [{}] }; },
    async setParameters() { throw new Error('unsupported'); },
  };
  assert.equal(await applySenderBitrate(sender), false);
  assert.equal(applyCaptureContentHint(null), 'unchanged');
});

test('live share details stay in a popover and closing it keeps the stream', async () => {
  const nodes = new Map();
  const make = (id, text = '') => {
    const node = {
      id,
      hidden: id !== 'live-share-start',
      textContent: text,
      dataset: {},
      classNames: new Set(),
      attributes: new Map(),
      listeners: {},
      children: [],
      classList: {
        toggle(name, on) {
          if (on) node.classNames.add(name);
          else node.classNames.delete(name);
        },
      },
      setAttribute(name, value) { node.attributes.set(name, String(value)); },
      getAttribute(name) { return node.attributes.get(name); },
      addEventListener(type, fn) { node.listeners[type] = fn; },
      removeEventListener(type) { delete node.listeners[type]; },
      contains(target) {
        return target === node || node.children.some((child) => child === target || child.contains?.(target));
      },
    };
    nodes.set(id, node);
    return node;
  };
  const root = make('live-share');
  const start = make('live-share-start', 'Ekranı paylaş');
  start.hidden = false;
  const popover = make('live-share-popover');
  popover.hidden = true;
  const status = make('live-share-status', 'Durum: Hazır');
  const viewers = make('live-share-viewers');
  const link = make('live-share-link');
  const copy = make('live-share-copy');
  const stop = make('live-share-stop');
  const error = make('live-share-error');
  popover.children.push(status, viewers, link, copy, stop, error);
  root.children.push(start, popover);
  const view = {
    listeners: {},
    navigator: { userAgent: CHROME, clipboard: { async writeText(value) { this.written = value; } } },
    location: { origin: 'https://example.test', protocol: 'https:', host: 'example.test' },
    addEventListener(type, fn) { this.listeners[type] = fn; },
    removeEventListener(type) { delete this.listeners[type]; },
  };
  const documentRef = {
    defaultView: view,
    getElementById(id) { return nodes.get(id) || null; },
  };
  const video = track('browser');
  const sockets = [];
  let sessions = 0;
  let stopped = 0;
  bindLiveTabShare(documentRef, {
    userAgent: CHROME,
    mediaDevices: { async getDisplayMedia() { return streamFrom(video); } },
    async createSession() {
      sessions += 1;
      return {
        ok: true,
        token: 'token-1',
        hostKey: 'host-key',
        watchUrl: 'https://example.test/stand/watch/token-1',
        socketUrl: 'ws://example.test/ws',
        iceServers: [],
      };
    },
    connectSocket() {
      const socket = { send() {}, close() {}, onmessage: null };
      sockets.push(socket);
      return socket;
    },
    RTCPeerConnection: class {
      addTrack() { return { getParameters: () => ({ encodings: [] }), async setParameters() {} }; }
      createOffer() { return { type: 'offer', sdp: 'offer' }; }
      async setLocalDescription(description) { this.localDescription = description; }
      async setRemoteDescription() {}
      async addIceCandidate() {}
      close() {}
    },
    setInterval() { return 1; },
    clearInterval() {},
    signalStop() { stopped += 1; },
    clipboard: view.navigator.clipboard,
  });

  assert.equal(start.textContent, 'Ekranı paylaş');
  assert.equal(popover.hidden, true);
  assert.equal(stop.hidden, true);
  assert.equal(link.hidden, true);

  await start.listeners.click({ stopPropagation() {} });
  assert.equal(sessions, 1);
  assert.equal(start.textContent, '● CANLI · 0');
  assert.equal(start.textContent.includes('http'), false);
  assert.equal(start.classNames.has('is-live'), true);
  assert.equal(popover.hidden, false);
  assert.equal(link.hidden, false);
  assert.equal(link.textContent, 'https://example.test/stand/watch/token-1');
  assert.equal(viewers.textContent, 'İzleyici: 0 / 1');
  assert.equal(stop.hidden, false);

  view.listeners.pointerdown({ target: { id: 'scene' } });
  assert.equal(popover.hidden, true);
  assert.equal(start.textContent, '● CANLI · 0');
  assert.equal(stopped, 0);
  assert.equal(video.stopped, false);

  await start.listeners.click({ stopPropagation() {} });
  assert.equal(sessions, 1);
  assert.equal(popover.hidden, false);

  view.listeners.keydown({ key: 'Escape' });
  assert.equal(popover.hidden, true);
  assert.equal(video.stopped, false);

  await start.listeners.click({ stopPropagation() {} });
  await sockets[0].onmessage({ data: JSON.stringify({ type: 'viewer-joined' }) });
  assert.equal(popover.hidden, false);
  assert.equal(start.textContent, '● CANLI · 1');
  assert.equal(viewers.textContent, 'İzleyici: 1 / 1');

  await copy.listeners.click({ stopPropagation() {} });
  assert.equal(view.navigator.clipboard.written, 'https://example.test/stand/watch/token-1');

  await stop.listeners.click({ stopPropagation() {} });
  assert.equal(stopped, 1);
  assert.equal(video.stopped, true);
  assert.equal(start.textContent, 'Ekranı paylaş');
  assert.equal(popover.hidden, true);
  assert.equal(stop.hidden, true);
});

test('read-only capabilities hide the share control', () => {
  assert.equal(canStartLiveShare(undefined), true);
  assert.equal(canStartLiveShare({ canUpdate: true }), true);
  assert.equal(canStartLiveShare({ canCreate: true }), true);
  assert.equal(canStartLiveShare({ canUpdate: false, canCreate: false }), false);
  const root = { hidden: false };
  const documentRef = {
    getElementById(id) {
      if (id === 'live-share-start') return { dataset: {}, addEventListener() {} };
      if (id === 'live-share') return root;
      return { dataset: {}, hidden: false, textContent: '', addEventListener() {} };
    },
  };
  bindLiveTabShare(documentRef, { capabilities: { canUpdate: false, canCreate: false } });
  assert.equal(root.hidden, true);
});
