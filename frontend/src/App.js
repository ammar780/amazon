import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useParams, useNavigate } from 'react-router-dom';
import api from './api';

// ── Auth Context ──
const AuthCtx = createContext(null);
function useAuth() { return useContext(AuthCtx); }

function AuthProvider({ children }) {
  const [user, setUser] = useState(function() {
    try { return JSON.parse(localStorage.getItem('tvs_user')); } catch(e) { return null; }
  });

  function login(email, password) {
    return api.login({ email, password }).then(function(r) {
      if (r && r.error) throw new Error(r.error);
      if (r && r.token) {
        localStorage.setItem('tvs_token', r.token);
        localStorage.setItem('tvs_user', JSON.stringify(r.user));
        setUser(r.user);
      }
    });
  }

  function logout() {
    localStorage.removeItem('tvs_token');
    localStorage.removeItem('tvs_user');
    setUser(null);
  }

  return React.createElement(AuthCtx.Provider, { value: { user, login, logout } }, children);
}

// ── Icons ──
function Icon({ name, size }) {
  var s = size || 17;
  var props = { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
  var paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    zap: <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>,
    users: <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></>,
    lock: <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></>,
    clock: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    clip: <><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></>,
    check: <><polyline points="20 6 9 17 4 12"/></>,
    send: <><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    alert: <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>,
    out: <><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
    back: <><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></>,
    activity: <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></>,
  };
  return <svg {...props}>{paths[name]}</svg>;
}

// ── Helpers ──
function fd(d) { return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '\u2014'; }
function ft(d) { return d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '\u2014'; }
function timeLeft(deadline) {
  if (!deadline) return null;
  var ms = new Date(deadline) - new Date();
  if (ms < 0) return 'OVERDUE';
  var h = Math.floor(ms / 3600000);
  var m = Math.floor((ms % 3600000) / 60000);
  return h + 'h ' + m + 'm left';
}

// ── Login ──
function LoginPage() {
  var auth = useAuth();
  var [email, setEmail] = useState('');
  var [pass, setPass] = useState('');
  var [err, setErr] = useState('');
  var [loading, setLoading] = useState(false);

  function onSubmit(e) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    auth.login(email, pass).catch(function(e) { setErr(e.message); }).finally(function() { setLoading(false); });
  }

  return (
    <div className="login-wrap">
      <div className="login-box">
        <div className="login-card">
          <h1>The Vitamin Shots</h1>
          <p className="lsub">Incident Response System &middot; Amazon SP-API</p>
          {err && <div className="err">{err}</div>}
          <form onSubmit={onSubmit}>
            <div className="fg"><label>Email</label><input type="email" value={email} onChange={function(e){setEmail(e.target.value)}} required autoFocus /></div>
            <div className="fg"><label>Password</label><input type="password" value={pass} onChange={function(e){setPass(e.target.value)}} required /></div>
            <button className="btn btn-gold" type="submit" disabled={loading} style={{marginTop:8}}>{loading ? 'Signing in...' : 'Sign In'}</button>
          </form>
          <p style={{fontSize:10,color:'var(--t3)',marginTop:20}}>Credentials set via environment variables</p>
        </div>
      </div>
    </div>
  );
}

// ── Layout ──
function Layout({ children, active }) {
  var auth = useAuth();
  var [overdueCount, setOverdueCount] = useState(0);

  useEffect(function() {
    api.stats().then(function(s) { if (s && s.incidents) setOverdueCount(s.incidents.overdue); }).catch(function(){});
  }, []);

  var navItems = [
    { to: '/', icon: 'grid', label: 'Dashboard', key: 'dash' },
    { to: '/incidents', icon: 'zap', label: 'Incidents', key: 'inc' },
    { to: '/team', icon: 'users', label: 'IRT Roles', key: 'team' },
    { to: '/audits', icon: 'lock', label: 'Encryption Audit', key: 'audit' },
    { to: '/reviews', icon: 'clock', label: '6-Month Reviews', key: 'review' },
    { to: '/compliance', icon: 'clip', label: 'Compliance', key: 'comp' },
    { to: '/activity', icon: 'activity', label: 'Activity Log', key: 'log' },
  ];

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sb-hd"><h2>Vitamin Shots</h2><p>Incident Response v2.0</p></div>
        <nav className="sb-nav">
          {navItems.map(function(n) {
            return (
              <Link key={n.key} to={n.to} className={'sb-it' + (active === n.key ? ' active' : '')}>
                <Icon name={n.icon} /> {n.label}
                {n.key === 'inc' && overdueCount > 0 && <span className="sb-badge">{overdueCount}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="sb-ft"><button onClick={auth.logout}>Sign Out</button></div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

// ── Dashboard ──
function Dashboard() {
  var [s, setS] = useState(null);
  useEffect(function() { api.stats().then(setS); }, []);
  if (!s) return <Layout active="dash"><p style={{color:'var(--t3)'}}>Loading...</p></Layout>;

  return (
    <Layout active="dash">
      <h1 className="pg-t">Dashboard</h1>
      <p className="pg-s">Amazon SP-API compliance overview</p>
      <div className="stats">
        <div className={'st ' + (s.incidents.open > 0 ? 'org' : 'grn')}><div className="lbl">Open Incidents</div><div className="val">{s.incidents.open}</div><div className="sub">{s.incidents.total} total</div></div>
        <div className={'st ' + (s.incidents.overdue > 0 ? 'red' : 'grn')}><div className="lbl">Overdue Notifications</div><div className="val">{s.incidents.overdue}</div><div className="sub">24-hour Amazon requirement</div></div>
        <div className="st gld"><div className="lbl">Compliance Score</div><div className="val">{s.compliance.score}%</div><div className="sub">{s.compliance.met}/{s.compliance.total} requirements</div></div>
        <div className={'st ' + (s.team.count >= 5 ? 'grn' : 'red')}><div className="lbl">IRT Members</div><div className="val">{s.team.count}</div><div className="sub">{s.team.count >= 5 ? 'All roles filled' : 'Need 5 roles'}</div></div>
        <div className="st blu"><div className="lbl">Amazon Incidents</div><div className="val">{s.incidents.amazon}</div><div className="sub">{s.incidents.notified} notified</div></div>
        <div className={'st ' + (s.nextReview ? 'grn' : 'org')}><div className="lbl">Next Plan Review</div><div className="val" style={{fontSize:14}}>{s.nextReview ? fd(s.nextReview) : 'Not Scheduled'}</div><div className="sub">6-month cycle</div></div>
      </div>
      <div className="card">
        <div className="card-h"><h3>Recent Activity</h3><Link to="/activity" className="btn btn-ghost btn-sm">View All</Link></div>
        {s.activity && s.activity.length > 0 ? (
          <div className="tw"><table><thead><tr><th>Action</th><th>Category</th><th>Details</th><th>By</th><th>Time</th></tr></thead>
          <tbody>{s.activity.map(function(a) { return (
            <tr key={a.id}><td style={{color:'var(--t)'}}>{a.action}</td><td><span className="b b-medium">{a.category}</span></td><td>{a.details}</td><td>{a.user_name}</td><td className="mono">{ft(a.created_at)}</td></tr>
          );})}</tbody></table></div>
        ) : <p style={{fontSize:12,color:'var(--t3)'}}>No activity yet. Add team members and run an encryption audit to get started.</p>}
      </div>
    </Layout>
  );
}

// ── Incidents ──
function Incidents() {
  var [items, setItems] = useState([]);
  var [show, setShow] = useState(false);
  var [members, setMembers] = useState([]);
  var [form, setForm] = useState({ title:'', description:'', severity:'medium', involves_amazon_data:false, amazon_data_types:'', affected_systems:'', detection_method:'internal_monitoring', incident_commander:null, security_lead:null });

  var load = useCallback(function() { api.incidents().then(function(d){setItems(d||[])}); }, []);
  useEffect(function() { load(); api.team().then(function(d){setMembers(d||[])}); }, [load]);

  function create(e) {
    e.preventDefault();
    api.createIncident(form).then(function() { setShow(false); setForm({title:'',description:'',severity:'medium',involves_amazon_data:false,amazon_data_types:'',affected_systems:'',detection_method:'internal_monitoring',incident_commander:null,security_lead:null}); load(); });
  }

  function uf(key, val) { var n = Object.assign({}, form); n[key] = val; setForm(n); }

  return (
    <Layout active="inc">
      <h1 className="pg-t">Security Incidents</h1>
      <p className="pg-s">Track, manage, and report incidents involving Amazon Information</p>
      <div style={{marginBottom:16}}><button className="btn btn-gold" onClick={function(){setShow(true)}}><Icon name="plus" size={15}/> Report Incident</button></div>
      <div className="card"><div className="tw"><table>
        <thead><tr><th>ID</th><th>Title</th><th>Severity</th><th>Phase</th><th>Amazon</th><th>Notified</th><th>Deadline</th><th>Detected</th></tr></thead>
        <tbody>
          {items.map(function(i) { return (
            <tr key={i.id}>
              <td><Link to={'/incidents/'+i.id} style={{color:'var(--gold)'}} className="mono">{i.incident_id}</Link></td>
              <td style={{color:'var(--t)',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{i.title}</td>
              <td><span className={'b b-'+i.severity}>{i.severity}</span></td>
              <td><span className={'b b-'+i.status}>{i.phase}</span></td>
              <td>{i.involves_amazon_data ? <span className="b b-amazon">YES</span> : <span style={{color:'var(--t3)'}}>No</span>}</td>
              <td>{i.notification_sent ? <span className="b b-pass">Sent</span> : i.involves_amazon_data ? <span className="b b-pending">Pending</span> : '\u2014'}</td>
              <td className="mono" style={{fontSize:11,color:i.involves_amazon_data && !i.amazon_notified_at && i.amazon_notification_deadline && new Date(i.amazon_notification_deadline)<new Date() ? 'var(--red)' : 'var(--t3)'}}>{i.involves_amazon_data ? (i.amazon_notified_at ? '\u2713 Done' : timeLeft(i.amazon_notification_deadline)) : '\u2014'}</td>
              <td className="mono" style={{fontSize:11}}>{ft(i.detected_at)}</td>
            </tr>
          );})}
          {items.length===0 && <tr><td colSpan="8" style={{textAlign:'center',color:'var(--t3)',padding:30}}>No incidents recorded</td></tr>}
        </tbody>
      </table></div></div>

      {show && <div className="overlay" onClick={function(){setShow(false)}}><div className="modal" onClick={function(e){e.stopPropagation()}}>
        <h2>Report Security Incident</h2>
        <form onSubmit={create}>
          <div className="fg"><label>Title</label><input value={form.title} onChange={function(e){uf('title',e.target.value)}} required placeholder="Brief incident description" /></div>
          <div className="fg"><label>Description</label><textarea value={form.description} onChange={function(e){uf('description',e.target.value)}} required placeholder="Full details..." /></div>
          <div className="fr">
            <div className="fg"><label>Severity</label><select value={form.severity} onChange={function(e){uf('severity',e.target.value)}}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></div>
            <div className="fg"><label>Involves Amazon Data?</label><select value={String(form.involves_amazon_data)} onChange={function(e){uf('involves_amazon_data',e.target.value==='true')}}><option value="false">No</option><option value="true">Yes - triggers 24h notification</option></select></div>
          </div>
          {form.involves_amazon_data && <div className="fg"><label>Amazon Data Types</label><input value={form.amazon_data_types} onChange={function(e){uf('amazon_data_types',e.target.value)}} placeholder="e.g. Order data, Customer PII" /></div>}
          <div className="fr">
            <div className="fg"><label>Affected Systems</label><input value={form.affected_systems} onChange={function(e){uf('affected_systems',e.target.value)}} placeholder="e.g. WooCommerce, SP-API" /></div>
            <div className="fg"><label>Detection Method</label><select value={form.detection_method} onChange={function(e){uf('detection_method',e.target.value)}}><option value="internal_monitoring">Internal Monitoring</option><option value="log_review">Log Review</option><option value="employee_report">Employee Report</option><option value="automated_alert">Automated Alert</option></select></div>
          </div>
          <div className="fr">
            <div className="fg"><label>Incident Commander</label><select value={form.incident_commander||''} onChange={function(e){uf('incident_commander',e.target.value||null)}}><option value="">Select...</option>{members.map(function(m){return <option key={m.id} value={m.id}>{m.name} - {m.irt_role}</option>})}</select></div>
            <div className="fg"><label>Security Lead</label><select value={form.security_lead||''} onChange={function(e){uf('security_lead',e.target.value||null)}}><option value="">Select...</option>{members.map(function(m){return <option key={m.id} value={m.id}>{m.name} - {m.irt_role}</option>})}</select></div>
          </div>
          <div className="modal-act"><button type="button" className="btn btn-ghost" onClick={function(){setShow(false)}}>Cancel</button><button type="submit" className="btn btn-gold">Create Incident</button></div>
        </form>
      </div></div>}
    </Layout>
  );
}

// ── Incident Detail ──
function IncidentDetail() {
  var params = useParams();
  var nav = useNavigate();
  var [inc, setInc] = useState(null);
  var [sending, setSending] = useState(false);

  var load = useCallback(function() { api.incident(params.id).then(setInc); }, [params.id]);
  useEffect(function() { load(); }, [load]);

  function doPhase(p) { api.phaseIncident(params.id, { phase: p }).then(load); }
  function doNotify() { setSending(true); api.notify(params.id).then(function() { setSending(false); load(); }); }

  if (!inc) return <Layout active="inc"><p style={{color:'var(--t3)'}}>Loading...</p></Layout>;
  var dl = timeLeft(inc.amazon_notification_deadline);

  return (
    <Layout active="inc">
      <div style={{marginBottom:14}}><button className="btn btn-ghost btn-sm" onClick={function(){nav('/incidents')}}><Icon name="back" size={14}/> Incidents</button></div>
      <h1 className="pg-t" style={{fontFamily:'IBM Plex Mono'}}>{inc.incident_id}</h1>
      <p className="pg-s">{inc.title}</p>

      {inc.involves_amazon_data && !inc.amazon_notified_at && (
        <div className="alert alert-red"><Icon name="alert" size={20}/>
          <div style={{flex:1}}><div className="at at-red">Amazon Notification Required - {dl}</div><div className="as">Must report to security@amazon.com within 24 hours</div></div>
          <button className="btn btn-red" onClick={doNotify} disabled={sending}><Icon name="send" size={14}/> {sending ? 'Sending...' : 'Notify Amazon Now'}</button>
        </div>
      )}
      {inc.amazon_notified_at && (
        <div className="alert alert-grn"><Icon name="check" size={20}/><div><div className="at at-grn">Amazon Notified - {ft(inc.amazon_notified_at)}</div><div className="as">Sent to security@amazon.com</div></div></div>
      )}

      <div className="dg">
        <div>
          <div className="card">
            <h3 style={{fontSize:13,marginBottom:14,fontWeight:700}}>Incident Details</h3>
            <div className="df"><div className="dl">Description</div><div className="dv" style={{whiteSpace:'pre-wrap'}}>{inc.description}</div></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginTop:10}}>
              <div className="df"><div className="dl">Severity</div><div className="dv"><span className={'b b-'+inc.severity}>{inc.severity}</span></div></div>
              <div className="df"><div className="dl">Phase</div><div className="dv"><span className={'b b-'+inc.status}>{inc.phase}</span></div></div>
              <div className="df"><div className="dl">Amazon Data</div><div className="dv">{inc.involves_amazon_data ? <span className="b b-amazon">YES</span> : 'No'}</div></div>
            </div>
            {inc.amazon_data_types && <div className="df"><div className="dl">Amazon Data Types</div><div className="dv">{inc.amazon_data_types}</div></div>}
            {inc.root_cause && <div className="df"><div className="dl">Root Cause</div><div className="dv">{inc.root_cause}</div></div>}
          </div>
          <div className="card">
            <h3 style={{fontSize:13,marginBottom:10,fontWeight:700}}>Phase Progression</h3>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              {inc.phase==='detection' && <button className="btn btn-ghost btn-sm" onClick={function(){doPhase('containment')}}>Containment</button>}
              {inc.phase==='containment' && <button className="btn btn-ghost btn-sm" onClick={function(){doPhase('eradication')}}>Eradication</button>}
              {inc.phase==='eradication' && <button className="btn btn-ghost btn-sm" onClick={function(){doPhase('recovery')}}>Recovery</button>}
              {(inc.phase==='recovery'||inc.phase==='eradication') && <button className="btn btn-grn btn-sm" onClick={function(){doPhase('resolved')}}>Resolved</button>}
              {inc.phase==='resolved' && <button className="btn btn-ghost btn-sm" onClick={function(){doPhase('closed')}}>Close</button>}
              {inc.involves_amazon_data && !inc.amazon_notified_at && <button className="btn btn-red btn-sm" onClick={doNotify} disabled={sending}><Icon name="send" size={13}/> Notify Amazon</button>}
            </div>
          </div>
          {inc.notifications && inc.notifications.length > 0 && (
            <div className="card">
              <h3 style={{fontSize:13,marginBottom:10,fontWeight:700}}>Amazon Notifications</h3>
              {inc.notifications.map(function(n) { return (
                <div key={n.id} style={{padding:'10px 0',borderBottom:'1px solid var(--bg3)'}}>
                  <div style={{fontSize:12,fontWeight:600,color:'var(--t)'}}>{n.notification_type.toUpperCase()} - {n.delivery_status}</div>
                  <div style={{fontSize:11,color:'var(--t3)',marginTop:2}}>To: {n.sent_to} - {ft(n.sent_at)}</div>
                  <details style={{marginTop:6}}><summary style={{fontSize:11,color:'var(--gold)',cursor:'pointer'}}>View body</summary>
                    <pre style={{fontSize:10,color:'var(--t2)',marginTop:6,whiteSpace:'pre-wrap',background:'var(--bg3)',padding:10,borderRadius:6,maxHeight:300,overflow:'auto'}}>{n.body}</pre>
                  </details>
                </div>
              );})}
            </div>
          )}
        </div>
        <div>
          <div className="card">
            <h3 style={{fontSize:13,marginBottom:10,fontWeight:700}}>Key Dates</h3>
            <div className="df"><div className="dl">Detected</div><div className="dv mono" style={{fontSize:11}}>{ft(inc.detected_at)}</div></div>
            {inc.contained_at && <div className="df"><div className="dl">Contained</div><div className="dv mono" style={{fontSize:11}}>{ft(inc.contained_at)}</div></div>}
            {inc.resolved_at && <div className="df"><div className="dl">Resolved</div><div className="dv mono" style={{fontSize:11}}>{ft(inc.resolved_at)}</div></div>}
            {inc.amazon_notification_deadline && <div className="df"><div className="dl">Amazon Deadline</div><div className="dv mono" style={{fontSize:11,color:inc.amazon_notified_at?'var(--grn)':'var(--red)'}}>{ft(inc.amazon_notification_deadline)}</div></div>}
            <hr style={{border:'none',borderTop:'1px solid var(--bg3)',margin:'10px 0'}}/>
            <div className="df"><div className="dl">Commander</div><div className="dv">{inc.commander_name||'\u2014'}</div></div>
            <div className="df"><div className="dl">Security Lead</div><div className="dv">{inc.security_lead_name||'\u2014'}</div></div>
          </div>
          <div className="card">
            <h3 style={{fontSize:13,marginBottom:10,fontWeight:700}}>Timeline</h3>
            {(inc.timeline||[]).map(function(t) { return (
              <div key={t.id} className="tl-item"><div className="tl-dot"/><div><div className="tl-act">{t.action}</div>{t.details && <div className="tl-det">{t.details}</div>}<div className="tl-time">{ft(t.created_at)}</div></div></div>
            );})}
            {(!inc.timeline||inc.timeline.length===0) && <p style={{fontSize:11,color:'var(--t3)'}}>No timeline entries</p>}
          </div>
        </div>
      </div>
    </Layout>
  );
}

// ── Team ──
function TeamPage() {
  var ROLES = ['Incident Commander','Security Lead','Communications Lead','Operations Lead','Compliance Officer'];
  var [items, setItems] = useState([]);
  var [show, setShow] = useState(false);
  var [form, setForm] = useState({name:'',email:'',irt_role:ROLES[0],job_title:'',phone:'',responsibilities:''});

  var load = useCallback(function(){api.team().then(function(d){setItems(d||[])})}, []);
  useEffect(function(){load()}, [load]);

  function create(e) {
    e.preventDefault();
    api.addMember(form).then(function(){setShow(false);setForm({name:'',email:'',irt_role:ROLES[0],job_title:'',phone:'',responsibilities:''});load()});
  }
  function uf(k,v){var n=Object.assign({},form);n[k]=v;setForm(n)}

  return (
    <Layout active="team">
      <h1 className="pg-t">Incident Response Team</h1>
      <p className="pg-s">Defined IRT roles per Amazon SP-API Data Protection Policy</p>
      <div style={{marginBottom:16}}><button className="btn btn-gold" onClick={function(){setShow(true)}}><Icon name="plus" size={15}/> Add Member</button></div>
      {items.length<5 && <div className="alert alert-org"><Icon name="alert" size={18}/><div><div className="at" style={{color:'var(--org)'}}>Amazon requires defined roles</div><div className="as">Add: Incident Commander, Security Lead, Communications Lead, Operations Lead, Compliance Officer</div></div></div>}
      <div className="card"><div className="tw"><table>
        <thead><tr><th>Name</th><th>IRT Role</th><th>Title</th><th>Email</th><th>Phone</th><th></th></tr></thead>
        <tbody>{items.map(function(m){return(
          <tr key={m.id}><td style={{color:'var(--t)',fontWeight:600}}>{m.name}</td><td><span className="b b-medium">{m.irt_role}</span></td><td>{m.job_title||'\u2014'}</td><td className="mono">{m.email}</td><td>{m.phone||'\u2014'}</td><td><button className="btn btn-red btn-sm" onClick={function(){api.removeMember(m.id).then(load)}}>Remove</button></td></tr>
        )})}{items.length===0&&<tr><td colSpan="6" style={{textAlign:'center',color:'var(--t3)',padding:30}}>No team members added yet</td></tr>}</tbody>
      </table></div></div>
      {show&&<div className="overlay" onClick={function(){setShow(false)}}><div className="modal" onClick={function(e){e.stopPropagation()}}>
        <h2>Add IRT Member</h2>
        <form onSubmit={create}>
          <div className="fr"><div className="fg"><label>Name</label><input value={form.name} onChange={function(e){uf('name',e.target.value)}} required/></div><div className="fg"><label>Email</label><input type="email" value={form.email} onChange={function(e){uf('email',e.target.value)}} required/></div></div>
          <div className="fr"><div className="fg"><label>IRT Role</label><select value={form.irt_role} onChange={function(e){uf('irt_role',e.target.value)}}>{ROLES.map(function(r){return<option key={r}>{r}</option>})}</select></div><div className="fg"><label>Job Title</label><input value={form.job_title} onChange={function(e){uf('job_title',e.target.value)}} placeholder="e.g. CTO"/></div></div>
          <div className="fg"><label>Phone</label><input value={form.phone} onChange={function(e){uf('phone',e.target.value)}}/></div>
          <div className="fg"><label>Responsibilities</label><textarea value={form.responsibilities} onChange={function(e){uf('responsibilities',e.target.value)}} style={{minHeight:60}}/></div>
          <div className="modal-act"><button type="button" className="btn btn-ghost" onClick={function(){setShow(false)}}>Cancel</button><button type="submit" className="btn btn-gold">Add Member</button></div>
        </form>
      </div></div>}
    </Layout>
  );
}

// ── Audits ──
function AuditsPage() {
  var [items, setItems] = useState([]);
  var [scanning, setScanning] = useState(false);
  var [custom, setCustom] = useState('');
  var load = useCallback(function(){api.audits().then(function(d){setItems(d||[])})}, []);
  useEffect(function(){load()}, [load]);

  function scanAll(){setScanning(true);api.scanAll().then(function(){setScanning(false);load()})}
  function scanOne(e){e.preventDefault();if(!custom)return;setScanning(true);api.scan({hostname:custom}).then(function(){setScanning(false);setCustom('');load()})}

  return (
    <Layout active="audit">
      <h1 className="pg-t">Encryption Audit</h1>
      <p className="pg-s">Verify TLS 1.2+ on all endpoints handling Amazon Information</p>
      <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
        <button className="btn btn-gold" onClick={scanAll} disabled={scanning}><Icon name="shield" size={15}/> {scanning?'Scanning...':'Scan All Endpoints'}</button>
        <form onSubmit={scanOne} style={{display:'flex',gap:6}}>
          <input value={custom} onChange={function(e){setCustom(e.target.value)}} placeholder="Custom hostname..." style={{padding:'8px 12px',background:'var(--bg3)',border:'1px solid var(--bdr)',borderRadius:6,color:'var(--t)',fontSize:13,width:220,fontFamily:'inherit',outline:'none'}}/>
          <button type="submit" className="btn btn-ghost" disabled={scanning}>Scan</button>
        </form>
      </div>
      <div className="card"><div className="tw"><table>
        <thead><tr><th>Endpoint</th><th>TLS</th><th>Cipher</th><th>Bits</th><th>Issuer</th><th>Expiry</th><th>Status</th><th>Scanned</th></tr></thead>
        <tbody>{items.map(function(r){return(
          <tr key={r.id}><td className="mono" style={{color:'var(--t)'}}>{r.endpoint}</td><td><span className={'b '+(['TLSv1.2','TLSv1.3'].indexOf(r.tls_version)>=0?'b-pass':'b-fail')}>{r.tls_version||'N/A'}</span></td><td className="mono" style={{fontSize:10,maxWidth:150,overflow:'hidden',textOverflow:'ellipsis'}}>{r.cipher_suite||'\u2014'}</td><td>{r.cipher_bits||'\u2014'}</td><td>{r.certificate_issuer||'\u2014'}</td><td className="mono" style={{fontSize:11}}>{fd(r.certificate_expiry)}</td><td><span className={'b '+(r.is_compliant?'b-pass':'b-fail')}>{r.is_compliant?'COMPLIANT':'ISSUE'}</span></td><td className="mono" style={{fontSize:11}}>{ft(r.audited_at)}</td></tr>
        )})}{items.length===0&&<tr><td colSpan="8" style={{textAlign:'center',color:'var(--t3)',padding:30}}>No audits yet - click Scan All Endpoints</td></tr>}</tbody>
      </table></div></div>
    </Layout>
  );
}

// ── Reviews ──
function ReviewsPage() {
  var [items, setItems] = useState([]);
  var [show, setShow] = useState(false);
  var [form, setForm] = useState({plan_version:'',reviewer_name:'',approver_name:'',changes_summary:'',roles_current:false,encryption_verified:false,notification_tested:false,amazon_policy_checked:false,incidents_reviewed:false,training_completed:false,sign_off_notes:''});
  var load = useCallback(function(){api.reviews().then(function(d){setItems(d||[])})}, []);
  useEffect(function(){load()}, [load]);
  function create(e){e.preventDefault();api.addReview(form).then(function(){setShow(false);load()})}
  function uf(k,v){var n=Object.assign({},form);n[k]=v;setForm(n)}
  var checks=[['roles_current','IRT roles verified'],['encryption_verified','Encryption verified'],['notification_tested','Notification tested'],['amazon_policy_checked','Amazon policy reviewed'],['incidents_reviewed','Incidents reviewed'],['training_completed','Training completed']];

  return (
    <Layout active="review">
      <h1 className="pg-t">6-Month Plan Reviews</h1>
      <p className="pg-s">Semi-annual review cycle per Amazon requirement</p>
      <div style={{marginBottom:16}}><button className="btn btn-gold" onClick={function(){setShow(true)}}><Icon name="plus" size={15}/> Record Review</button></div>
      <div className="card"><div className="tw"><table>
        <thead><tr><th>Date</th><th>Version</th><th>Reviewer</th><th>Roles</th><th>Encryption</th><th>Notification</th><th>Policy</th><th>Next Review</th></tr></thead>
        <tbody>{items.map(function(r){return(
          <tr key={r.id}><td style={{color:'var(--t)'}}>{fd(r.review_date)}</td><td className="mono">{r.plan_version}</td><td>{r.reviewer_name||'\u2014'}</td><td>{r.roles_current?<span className="b b-pass">Yes</span>:<span className="b b-fail">No</span>}</td><td>{r.encryption_verified?<span className="b b-pass">Yes</span>:<span className="b b-fail">No</span>}</td><td>{r.notification_tested?<span className="b b-pass">Yes</span>:<span className="b b-fail">No</span>}</td><td>{r.amazon_policy_checked?<span className="b b-pass">Yes</span>:<span className="b b-fail">No</span>}</td><td className="mono" style={{fontSize:11}}>{fd(r.next_review_date)}</td></tr>
        )})}{items.length===0&&<tr><td colSpan="8" style={{textAlign:'center',color:'var(--t3)',padding:30}}>No reviews yet</td></tr>}</tbody>
      </table></div></div>
      {show&&<div className="overlay" onClick={function(){setShow(false)}}><div className="modal" onClick={function(e){e.stopPropagation()}}>
        <h2>Record Plan Review</h2>
        <form onSubmit={create}>
          <div className="fr"><div className="fg"><label>Version</label><input value={form.plan_version} onChange={function(e){uf('plan_version',e.target.value)}} required placeholder="e.g. 1.0"/></div><div className="fg"><label>Reviewer</label><input value={form.reviewer_name} onChange={function(e){uf('reviewer_name',e.target.value)}} required/></div></div>
          <div className="fg"><label>Approver</label><input value={form.approver_name} onChange={function(e){uf('approver_name',e.target.value)}}/></div>
          <div className="fg"><label>Changes</label><textarea value={form.changes_summary} onChange={function(e){uf('changes_summary',e.target.value)}} style={{minHeight:60}}/></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
            {checks.map(function(c){return(<label key={c[0]} style={{display:'flex',alignItems:'center',gap:8,fontSize:12,color:'var(--t2)',cursor:'pointer'}}><input type="checkbox" checked={form[c[0]]} onChange={function(e){uf(c[0],e.target.checked)}}/>{c[1]}</label>)})}
          </div>
          <div className="modal-act"><button type="button" className="btn btn-ghost" onClick={function(){setShow(false)}}>Cancel</button><button type="submit" className="btn btn-gold">Save Review</button></div>
        </form>
      </div></div>}
    </Layout>
  );
}

// ── Compliance ──
function CompliancePage() {
  var [items, setItems] = useState([]);
  var load = useCallback(function(){api.compliance().then(function(d){setItems(d||[])})}, []);
  useEffect(function(){load()}, [load]);
  function toggle(item){api.updateComp(item.id,{is_met:!item.is_met}).then(load)}
  var grouped={};
  items.forEach(function(i){if(!grouped[i.category])grouped[i.category]=[];grouped[i.category].push(i)});
  var met=items.filter(function(i){return i.is_met}).length;
  var total=items.length;
  var score=total>0?Math.round((met/total)*100):0;

  return (
    <Layout active="comp">
      <h1 className="pg-t">Compliance Checklist</h1>
      <p className="pg-s">Amazon SP-API Data Protection Policy - {met}/{total} met ({score}%)</p>
      <div className="stats" style={{gridTemplateColumns:'repeat(3,1fr)',marginBottom:20}}>
        <div className={'st '+(score===100?'grn':'org')}><div className="lbl">Score</div><div className="val">{score}%</div></div>
        <div className="st grn"><div className="lbl">Met</div><div className="val">{met}</div></div>
        <div className={'st '+(total-met>0?'red':'grn')}><div className="lbl">Outstanding</div><div className="val">{total-met}</div></div>
      </div>
      {Object.keys(grouped).map(function(cat){return(
        <div key={cat} className="card">
          <h3 style={{fontSize:13,fontWeight:700,color:'var(--gold)',marginBottom:8}}>{cat}</h3>
          {grouped[cat].map(function(item){return(
            <div key={item.id} className="ci">
              <div className={'cb'+(item.is_met?' on':'')} onClick={function(){toggle(item)}}>{item.is_met&&<Icon name="check" size={13}/>}</div>
              <div><div className="ci-req">{item.requirement}</div><div className="ci-meta">{item.amazon_reference} - {item.plan_section||'\u2014'} {item.last_verified&&(' - Verified: '+fd(item.last_verified))} <span className={'b b-'+(item.priority==='critical'?'critical':item.priority==='high'?'high':'medium')}>{item.priority}</span></div></div>
            </div>
          )})}
        </div>
      )})}
    </Layout>
  );
}

// ── Activity Log ──
function ActivityPage() {
  var [items, setItems] = useState([]);
  useEffect(function(){api.activity().then(function(d){setItems(d||[])})}, []);
  return (
    <Layout active="log">
      <h1 className="pg-t">Activity Log</h1>
      <p className="pg-s">Complete audit trail</p>
      <div className="card"><div className="tw"><table>
        <thead><tr><th>Action</th><th>Category</th><th>Details</th><th>User</th><th>Time</th></tr></thead>
        <tbody>{items.map(function(a){return(
          <tr key={a.id}><td style={{color:'var(--t)',fontWeight:500}}>{a.action}</td><td><span className="b b-medium">{a.category}</span></td><td>{a.details}</td><td>{a.user_name||'System'}</td><td className="mono" style={{fontSize:11}}>{ft(a.created_at)}</td></tr>
        )})}{items.length===0&&<tr><td colSpan="5" style={{textAlign:'center',color:'var(--t3)',padding:30}}>No activity yet</td></tr>}</tbody>
      </table></div></div>
    </Layout>
  );
}

// ── App ──
function AppRoutes() {
  var auth = useAuth();
  if (!auth.user) return <Routes><Route path="*" element={<LoginPage/>}/></Routes>;
  return (
    <Routes>
      <Route path="/" element={<Dashboard/>}/>
      <Route path="/incidents" element={<Incidents/>}/>
      <Route path="/incidents/:id" element={<IncidentDetail/>}/>
      <Route path="/team" element={<TeamPage/>}/>
      <Route path="/audits" element={<AuditsPage/>}/>
      <Route path="/reviews" element={<ReviewsPage/>}/>
      <Route path="/compliance" element={<CompliancePage/>}/>
      <Route path="/activity" element={<ActivityPage/>}/>
      <Route path="*" element={<Navigate to="/"/>}/>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes/>
      </AuthProvider>
    </BrowserRouter>
  );
}
