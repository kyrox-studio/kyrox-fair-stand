// Live tab share is one browser tab captured with getDisplayMedia and sent
// over a single WebRTC video peer. It does not sync design state, audio, or input.
//
// Ofis ağı ↔ mobil internet acceptance testinde P2P bağlantısı kurulamıyorsa
// coturn/TURN eklenmelidir. Bu mevcut V1'in başarısızlığı sayılmaz. SFU kurulmaz.

export const LIVE_SHARE_LIMITS = Object.freeze({
  idealWidth: 854,
  idealHeight: 480,
  idealFrameRate: 18,
  maxFrameRate: 20,
  maxBitrate: 1_500_000,
  bitrateFloor: 700_000,
  bitrateCeiling: 1_500_000,
  heartbeatMs: 20_000,
  maxViewerReconnects: 3,
});

export const VIEWER_OCCUPIED_MESSAGE = 'Bu canlı paylaşım oturumunda zaten bir izleyici bağlı.';

const SURFACE_MESSAGE = 'Yalnız mevcut tarayıcı sekmesi paylaşılabilir. Tam ekran veya pencere kabul edilmez. Tekrar dene ve sekmeyi seç.';
const DENIED_MESSAGE = 'Sekme paylaşım izni verilmedi.';
const HOST_BROWSER_MESSAGE = 'Canlı paylaşım bu tarayıcıda sekme yakalayamaz. Chrome veya Edge kullan.';

export function isSupportedHostBrowser(userAgent) {
  const ua = String(userAgent || '');
  if (/Edg\//.test(ua)) return true;
  if (/Chrome\//.test(ua) && !/OPR\//.test(ua) && !/Firefox\//.test(ua)) return true;
  return false;
}

export function canStartLiveShare(capabilities) {
  if (!capabilities) return true;
  return Boolean(capabilities.canUpdate || capabilities.canCreate);
}

export function displayMediaAttempts() {
  const video = {
    width: { ideal: LIVE_SHARE_LIMITS.idealWidth },
    height: { ideal: LIVE_SHARE_LIMITS.idealHeight },
    frameRate: { ideal: LIVE_SHARE_LIMITS.idealFrameRate, max: LIVE_SHARE_LIMITS.maxFrameRate },
    cursor: 'always',
  };
  return [
    {
      audio: false,
      video,
      preferCurrentTab: true,
      selfBrowserSurface: 'include',
      monitorTypeSurfaces: 'exclude',
      surfaceSwitching: 'exclude',
    },
    {
      audio: false,
      video,
      preferCurrentTab: true,
    },
  ];
}

export function stopMediaStream(stream) {
  stream?.getTracks?.().forEach((track) => track.stop?.());
}

export async function captureBrowserTab(mediaDevices, attempts = displayMediaAttempts()) {
  let lastError = null;
  for (const constraints of attempts) {
    try {
      const stream = await mediaDevices.getDisplayMedia(constraints);
      const track = stream.getVideoTracks?.()[0];
      const surface = track?.getSettings?.().displaySurface;
      if (!track || surface !== 'browser') {
        stopMediaStream(stream);
        return { ok: false, code: 'surface', message: SURFACE_MESSAGE };
      }
      applyCaptureContentHint(track);
      return { ok: true, stream, track };
    } catch (error) {
      lastError = error;
      if (error?.name === 'NotAllowedError' || error?.name === 'AbortError') {
        return { ok: false, code: 'denied', message: DENIED_MESSAGE };
      }
    }
  }
  return {
    ok: false,
    code: 'unsupported',
    message: lastError?.message || HOST_BROWSER_MESSAGE,
  };
}

export function applyCaptureContentHint(track) {
  if (!track) return 'unchanged';
  try {
    track.contentHint = 'detail';
    if (track.contentHint === 'detail') return 'detail';
  } catch {
    // Browsers that reject the hint must keep the capture running.
  }
  try {
    track.contentHint = 'motion';
    return track.contentHint === 'motion' ? 'motion' : 'unchanged';
  } catch {
    return 'unchanged';
  }
}

export async function applySenderBitrate(sender, maxBitrate = LIVE_SHARE_LIMITS.maxBitrate) {
  if (!sender?.getParameters || !sender.setParameters) return false;
  let parameters;
  try {
    parameters = sender.getParameters() || {};
  } catch {
    return false;
  }
  const encodings = Array.isArray(parameters.encodings) && parameters.encodings.length
    ? parameters.encodings.map((item) => ({ ...item }))
    : [{}];
  encodings[0].maxBitrate = maxBitrate;
  parameters.encodings = encodings;
  try {
    parameters.degradationPreference = 'maintain-resolution';
    await sender.setParameters(parameters);
    return true;
  } catch {
    try {
      delete parameters.degradationPreference;
      await sender.setParameters(parameters);
      return true;
    } catch {
      return false;
    }
  }
}

export function viewerStatusCopy(status) {
  switch (status) {
    case 'waiting':
      return 'Canlı bağlantı bekleniyor';
    case 'disconnected':
      return 'Bağlantı kesildi';
    case 'ended':
      return 'Yayın sona erdi';
    case 'invalid':
      return 'Bu canlı paylaşım linki geçersiz.';
    case 'expired':
      return 'Bu canlı paylaşımın süresi doldu.';
    case 'occupied':
      return VIEWER_OCCUPIED_MESSAGE;
    default:
      return '';
  }
}

export function viewerStatusForError(code) {
  if (code === 'invalid') return 'invalid';
  if (code === 'expired') return 'expired';
  if (code === 'occupied') return 'occupied';
  return 'ended';
}

export function liveShareButtonLabel(state) {
  if (state.phase !== 'live') return 'Ekranı paylaş';
  return `● CANLI · ${state.viewerCount || 0}`;
}

export function applyLiveShareControls(controls, state) {
  const live = state.phase === 'live';
  const count = state.viewerCount || 0;
  const popoverOpen = Boolean(state.popoverOpen);
  if (controls.start) {
    controls.start.hidden = false;
    controls.start.textContent = liveShareButtonLabel(state);
    controls.start.classList?.toggle?.('is-live', live);
    controls.start.setAttribute?.('aria-pressed', live ? 'true' : 'false');
    controls.start.setAttribute?.('aria-expanded', popoverOpen ? 'true' : 'false');
  }
  setHidden(controls.popover, !popoverOpen);
  if (controls.status) controls.status.textContent = live ? 'Durum: ● CANLI' : 'Durum: Hazır';
  setHidden(controls.viewers, !live);
  if (controls.viewers) controls.viewers.textContent = `İzleyici: ${count} / 1`;
  setHidden(controls.link, !live);
  if (controls.link) controls.link.textContent = state.watchUrl || '';
  setHidden(controls.copy, !live);
  setHidden(controls.stop, !live);
  setHidden(controls.error, !state.error);
  if (controls.error) controls.error.textContent = state.error || '';
}

export function createIceBuffer() {
  const pending = [];
  return {
    async add(peer, candidate) {
      if (!candidate) return;
      if (!peer?.remoteDescription) {
        pending.push(candidate);
        return;
      }
      await peer.addIceCandidate(candidate);
    },
    async flush(peer) {
      while (pending.length && peer?.remoteDescription) {
        await peer.addIceCandidate(pending.shift());
      }
    },
    clear() {
      pending.length = 0;
    },
  };
}

export function hostSocketUrl(location, token, hostKey) {
  return socketUrl(location, token, 'host', hostKey);
}

export function viewerSocketUrl(location, token) {
  return socketUrl(location, token, 'viewer');
}

export function createHostController(deps) {
  const limits = LIVE_SHARE_LIMITS;
  let phase = 'idle';
  let viewerCount = 0;
  let watchUrl = '';
  let token = '';
  let hostKey = '';
  let iceServers = [];
  let stream = null;
  let socket = null;
  let peer = null;
  let heartbeat = null;
  let stopped = false;
  const ice = createIceBuffer();

  function publish(error = '') {
    deps.onState?.({
      phase,
      viewerCount,
      error,
      watchUrl,
    });
  }

  function closePeer() {
    ice.clear();
    if (!peer) return;
    const current = peer;
    peer = null;
    current.onicecandidate = null;
    current.onconnectionstatechange = null;
    current.close?.();
  }

  function closeSocket() {
    if (heartbeat) deps.clearInterval?.(heartbeat);
    heartbeat = null;
    if (!socket) return;
    const current = socket;
    socket = null;
    current.onmessage = null;
    current.onclose = null;
    current.onerror = null;
    current.close?.();
  }

  async function openPeer() {
    closePeer();
    const track = stream?.getVideoTracks?.()[0];
    if (!track) return;
    peer = new deps.RTCPeerConnection({ iceServers });
    const sender = peer.addTrack(track, stream);
    try {
      await applySenderBitrate(sender, limits.maxBitrate);
    } catch {
      // Some browsers reject bitrate changes before negotiation. The capture
      // constraints still cap frame size and frame rate.
    }
    peer.onicecandidate = (event) => {
      if (!event.candidate || !socket) return;
      const candidate = event.candidate.toJSON?.() ?? event.candidate;
      socket.send(JSON.stringify({ type: 'ice', candidate }));
    };
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    socket?.send(JSON.stringify({ type: 'offer', sdp: peer.localDescription.sdp }));
  }

  async function onMessage(event) {
    const message = JSON.parse(event.data);
    if (message.type === 'joined') {
      iceServers = message.iceServers || iceServers;
      return;
    }
    if (message.type === 'viewer-joined') {
      viewerCount = 1;
      publish('');
      await openPeer();
      return;
    }
    if (message.type === 'viewer-left') {
      viewerCount = 0;
      closePeer();
      publish('');
      return;
    }
    if (message.type === 'answer' && peer) {
      await peer.setRemoteDescription({ type: 'answer', sdp: message.sdp });
      await ice.flush(peer);
      return;
    }
    if (message.type === 'ice') {
      await ice.add(peer, message.candidate);
      return;
    }
    if (message.type === 'ended') {
      await stop('remote', { notify: false });
    }
  }

  async function start() {
    if (phase === 'live') return;
    stopped = false;
    if (!isSupportedHostBrowser(deps.userAgent)) {
      publish(HOST_BROWSER_MESSAGE);
      return;
    }
    const captured = await captureBrowserTab(deps.mediaDevices);
    if (!captured.ok) {
      publish(captured.message);
      return;
    }
    stream = captured.stream;
    captured.track.addEventListener?.('ended', () => {
      void stop('track-ended');
    });
    const created = await deps.createSession();
    if (!created?.ok) {
      stopMediaStream(stream);
      stream = null;
      publish(created?.message || 'Canlı paylaşım oturumu açılamadı.');
      return;
    }
    token = created.token;
    hostKey = created.hostKey;
    watchUrl = created.watchUrl;
    iceServers = created.iceServers || [];
    socket = deps.connectSocket(created.socketUrl);
    socket.onmessage = (event) => onMessage(event);
    socket.onclose = () => {
      if (!stopped) void stop('socket', { notify: false });
    };
    heartbeat = deps.setInterval?.(() => {
      if (socket) socket.send(JSON.stringify({ type: 'heartbeat' }));
    }, limits.heartbeatMs);
    phase = 'live';
    viewerCount = 0;
    publish('');
  }

  async function stop(reason = 'user', options = {}) {
    if (stopped && phase === 'idle') return;
    stopped = true;
    const notify = options.notify !== false && token && hostKey;
    if (notify) {
      try {
        socket?.send?.(JSON.stringify({ type: 'stop' }));
      } catch {
        // The socket may already be closing. The beacon still revokes the session.
      }
      deps.signalStop?.(token, hostKey);
    }
    closePeer();
    closeSocket();
    stopMediaStream(stream);
    stream = null;
    phase = 'idle';
    viewerCount = 0;
    watchUrl = '';
    token = '';
    hostKey = '';
    publish('');
    void reason;
  }

  async function copyLink() {
    if (!watchUrl) return;
    await deps.clipboard?.writeText?.(watchUrl);
  }

  return {
    start,
    stop,
    copyLink,
    peerCount: () => (peer ? 1 : 0),
  };
}

export function startViewerSession(deps) {
  const limits = LIVE_SHARE_LIMITS;
  let stopped = false;
  let attempts = 0;
  let socket = null;
  let peer = null;
  let heartbeat = null;
  let reconnectTimer = null;
  let iceServers = [];
  const ice = createIceBuffer();

  function publish(status, message) {
    deps.onStatus?.({ status, message: message ?? viewerStatusCopy(status) });
  }

  function closePeer() {
    ice.clear();
    if (!peer) return;
    const current = peer;
    peer = null;
    current.ontrack = null;
    current.onicecandidate = null;
    current.onconnectionstatechange = null;
    current.close?.();
  }

  function closeSocket() {
    if (heartbeat) deps.clearInterval?.(heartbeat);
    heartbeat = null;
    if (!socket) return;
    const current = socket;
    socket = null;
    current.onmessage = null;
    current.onclose = null;
    current.onerror = null;
    current.close?.();
  }

  function ensurePeer() {
    if (peer) return peer;
    peer = new deps.RTCPeerConnection({ iceServers });
    peer.addTransceiver('video', { direction: 'recvonly' });
    peer.ontrack = (event) => {
      const [remoteStream] = event.streams || [];
      if (deps.videoElement) {
        deps.videoElement.srcObject = remoteStream || new deps.MediaStream([event.track]);
      }
      attempts = 0;
      publish('connected', '');
    };
    peer.onicecandidate = (event) => {
      if (!event.candidate || !socket) return;
      const candidate = event.candidate.toJSON?.() ?? event.candidate;
      socket.send(JSON.stringify({ type: 'ice', candidate }));
    };
    peer.onconnectionstatechange = () => {
      if (stopped || !peer) return;
      if (peer.connectionState === 'connected') {
        attempts = 0;
        publish('connected', '');
      }
      if (peer.connectionState === 'failed') scheduleReconnect();
    };
    return peer;
  }

  function scheduleReconnect() {
    if (stopped) return;
    attempts += 1;
    closePeer();
    closeSocket();
    if (attempts > limits.maxViewerReconnects) {
      publish('disconnected');
      return;
    }
    publish('waiting');
    reconnectTimer = deps.setTimeout?.(() => connect(), attempts * 1000);
  }

  async function onMessage(event) {
    const message = JSON.parse(event.data);
    if (message.type === 'error') {
      stopped = true;
      const status = viewerStatusForError(message.code);
      closePeer();
      closeSocket();
      publish(status, message.message || viewerStatusCopy(status));
      return;
    }
    if (message.type === 'ended') {
      stopped = true;
      const status = message.reason === 'expired' ? 'expired' : 'ended';
      closePeer();
      closeSocket();
      publish(status);
      return;
    }
    if (message.type === 'joined') {
      iceServers = message.iceServers || [];
      ensurePeer();
      return;
    }
    if (message.type === 'offer') {
      const connection = ensurePeer();
      await connection.setRemoteDescription({ type: 'offer', sdp: message.sdp });
      await ice.flush(connection);
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      socket?.send(JSON.stringify({ type: 'answer', sdp: connection.localDescription.sdp }));
      return;
    }
    if (message.type === 'ice') {
      await ice.add(peer, message.candidate);
    }
  }

  function connect() {
    if (stopped) return;
    publish('waiting');
    socket = new deps.WebSocket(viewerSocketUrl(deps.location, deps.token));
    socket.onmessage = (event) => onMessage(event);
    socket.onclose = () => {
      if (!stopped) scheduleReconnect();
    };
    heartbeat = deps.setInterval?.(() => {
      if (socket) socket.send(JSON.stringify({ type: 'heartbeat' }));
    }, limits.heartbeatMs);
  }

  connect();

  return function stopViewer() {
    stopped = true;
    if (reconnectTimer) deps.clearTimeout?.(reconnectTimer);
    closePeer();
    closeSocket();
  };
}

export function bindLiveTabShare(documentRef, options = {}) {
  const start = documentRef?.getElementById?.('live-share-start');
  if (!start || start.dataset?.bound === 'true') return () => {};
  if (!start.dataset) start.dataset = {};
  start.dataset.bound = 'true';
  const controls = {
    root: documentRef.getElementById('live-share'),
    start,
    popover: documentRef.getElementById('live-share-popover'),
    status: documentRef.getElementById('live-share-status'),
    viewers: documentRef.getElementById('live-share-viewers'),
    link: documentRef.getElementById('live-share-link'),
    copy: documentRef.getElementById('live-share-copy'),
    stop: documentRef.getElementById('live-share-stop'),
    error: documentRef.getElementById('live-share-error'),
  };
  if (options.capabilities && !canStartLiveShare(options.capabilities)) {
    setHidden(controls.root, true);
    return () => {};
  }
  const view = documentRef.defaultView || globalThis;
  const location = options.location || view.location;
  const fetchImpl = options.fetch || view.fetch?.bind?.(view) || globalThis.fetch?.bind?.(globalThis);
  const Socket = options.WebSocket || view.WebSocket;
  let open = false;
  let wasLive = false;
  let latest = { phase: 'idle', viewerCount: 0, error: '', watchUrl: '' };
  const paint = (state) => {
    latest = state;
    applyLiveShareControls(controls, { ...state, popoverOpen: open });
  };
  const controller = createHostController({
    userAgent: options.userAgent || view.navigator?.userAgent || '',
    mediaDevices: options.mediaDevices || view.navigator?.mediaDevices,
    RTCPeerConnection: options.RTCPeerConnection || view.RTCPeerConnection,
    setInterval: options.setInterval || view.setInterval?.bind(view),
    clearInterval: options.clearInterval || view.clearInterval?.bind(view),
    clipboard: options.clipboard || view.navigator?.clipboard,
    createSession: options.createSession || (() => createLiveShareSession(options.headers, location, fetchImpl)),
    connectSocket: options.connectSocket || ((url) => new Socket(url)),
    signalStop: options.signalStop || ((shareToken, shareHostKey) => signalLiveShareStop(shareToken, shareHostKey, fetchImpl)),
    onState: (state) => {
      const becameLive = state.phase === 'live' && !wasLive;
      wasLive = state.phase === 'live';
      if (becameLive || state.error) open = true;
      if (state.phase !== 'live' && !state.error) open = false;
      paint(state);
    },
  });
  const onStart = (event) => {
    event?.stopPropagation?.();
    if (latest.phase === 'live') {
      open = !open;
      paint(latest);
      return;
    }
    return controller.start();
  };
  const onStop = (event) => {
    event?.stopPropagation?.();
    return controller.stop('user');
  };
  const onCopy = (event) => {
    event?.stopPropagation?.();
    void controller.copyLink();
  };
  const onHide = () => {
    void controller.stop('pagehide');
  };
  const onPointerDown = (event) => {
    if (!open) return;
    if (controls.root?.contains?.(event.target)) return;
    open = false;
    paint(latest);
  };
  const onKeyDown = (event) => {
    if (event.key !== 'Escape' || !open) return;
    open = false;
    paint(latest);
  };
  start.addEventListener?.('click', onStart);
  controls.stop?.addEventListener?.('click', onStop);
  controls.copy?.addEventListener?.('click', onCopy);
  view.addEventListener?.('pagehide', onHide);
  view.addEventListener?.('pointerdown', onPointerDown);
  view.addEventListener?.('keydown', onKeyDown);
  paint(latest);
  return function unbindLiveTabShare() {
    start.removeEventListener?.('click', onStart);
    controls.stop?.removeEventListener?.('click', onStop);
    controls.copy?.removeEventListener?.('click', onCopy);
    view.removeEventListener?.('pagehide', onHide);
    view.removeEventListener?.('pointerdown', onPointerDown);
    view.removeEventListener?.('keydown', onKeyDown);
    void controller.stop('unmount');
  };
}

export async function createLiveShareSession(headersSource, location, fetchImpl = globalThis.fetch) {
  const headers = typeof headersSource === 'function' ? headersSource() : (headersSource || {});
  const response = await fetchImpl('/api/v1/fair-stand/live-shares', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
  if (!response.ok) {
    return { ok: false, message: 'Canlı paylaşım oturumu açılamadı.' };
  }
  const body = await response.json();
  const watchUrl = `${location?.origin || ''}${body.watchPath}`;
  return {
    ok: true,
    token: body.token,
    hostKey: body.hostKey,
    watchUrl,
    iceServers: [],
    socketUrl: hostSocketUrl(location, body.token, body.hostKey),
  };
}

export function signalLiveShareStop(token, hostKey, fetchImpl = globalThis.fetch) {
  const body = JSON.stringify({ hostKey });
  const url = `/api/v1/fair-stand/live-shares/${encodeURIComponent(token)}/stop`;
  try {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(url, blob)) return;
    }
  } catch {
    // Beacon can fail while the document is going away. keepalive fetch follows.
  }
  fetchImpl(url, {
    method: 'POST',
    body,
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
  }).catch(() => {});
}

function socketUrl(location, token, role, hostKey) {
  const protocol = location?.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = location?.host || '';
  const key = hostKey ? `&hostKey=${encodeURIComponent(hostKey)}` : '';
  return `${protocol}//${host}/api/v1/fair-stand/live-shares/${encodeURIComponent(token)}/ws?role=${role}${key}`;
}

function setHidden(element, hidden) {
  if (!element) return;
  element.hidden = hidden;
}

function bootLiveTabShare() {
  const root = globalThis.document;
  if (!root?.getElementById?.('live-share-start')) return;
  bindLiveTabShare(root);
}

bootLiveTabShare();
