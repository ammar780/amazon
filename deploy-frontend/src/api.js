const BASE = '/api';

function getToken() {
  return localStorage.getItem('tvs_token');
}

async function request(path, options) {
  const token = getToken();
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
  };
  if (options && options.body) {
    config.body = JSON.stringify(options.body);
  }
  const res = await fetch(BASE + path, config);
  if (res.status === 401) {
    localStorage.removeItem('tvs_token');
    localStorage.removeItem('tvs_user');
    window.location.href = '/';
    return null;
  }
  return res.json();
}

function POST(body) { return { method: 'POST', body: body }; }
function PUT(body) { return { method: 'PUT', body: body }; }
function PATCH(body) { return { method: 'PATCH', body: body }; }
function DELETE() { return { method: 'DELETE' }; }

const api = {
  login: (b) => request('/auth/login', POST(b)),
  stats: () => request('/stats'),
  incidents: () => request('/incidents'),
  incident: (id) => request('/incidents/' + id),
  createIncident: (b) => request('/incidents', POST(b)),
  updateIncident: (id, b) => request('/incidents/' + id, PUT(b)),
  phaseIncident: (id, b) => request('/incidents/' + id + '/phase', PATCH(b)),
  addTimeline: (id, b) => request('/incidents/' + id + '/timeline', POST(b)),
  notify: (id, b) => request('/incidents/' + id + '/notify', POST(b || {})),
  team: () => request('/team'),
  addMember: (b) => request('/team', POST(b)),
  updateMember: (id, b) => request('/team/' + id, PUT(b)),
  removeMember: (id) => request('/team/' + id, DELETE()),
  audits: () => request('/audits'),
  scan: (b) => request('/audits/scan', POST(b)),
  scanAll: (b) => request('/audits/scan-all', POST(b || {})),
  reviews: () => request('/reviews'),
  addReview: (b) => request('/reviews', POST(b)),
  compliance: () => request('/compliance'),
  updateComp: (id, b) => request('/compliance/' + id, PATCH(b)),
  activity: () => request('/activity'),
  mfaSetup: (b) => request('/auth/mfa/setup', POST(b)),
  mfaVerify: (b) => request('/auth/mfa/verify', POST(b)),
  changePassword: (b) => request('/auth/change-password', POST(b)),
  passwordStatus: () => request('/auth/password-status'),
};

export default api;
