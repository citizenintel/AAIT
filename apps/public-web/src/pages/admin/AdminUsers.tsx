import { useState } from 'react';
import { MOCK_USERS, PERMISSIONS, type AppUser, type UserRole, type PermissionKey } from '../../data/mock-users';

const ROLE_LABEL: Record<UserRole, string> = { reader: 'Reader', moderator: 'Moderator', admin: 'Admin' };

export function AdminUsers() {
  const [users, setUsers] = useState<AppUser[]>(MOCK_USERS);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '' });

  const setRole = (id: string, role: UserRole) => {
    setUsers((prev) => prev.map((u) => {
      if (u.id !== id) return u;
      // Demotion to reader strips all privileges; promotion to moderator starts with NONE.
      if (role === 'reader' || role === 'moderator') return { ...u, role, permissions: [] };
      return { ...u, role };
    }));
    if (role === 'moderator') setExpanded(id);
  };

  const togglePermission = (id: string, perm: PermissionKey) => {
    setUsers((prev) => prev.map((u) => {
      if (u.id !== id) return u;
      const has = u.permissions.includes(perm);
      return { ...u, permissions: has ? u.permissions.filter((p) => p !== perm) : [...u.permissions, perm] };
    }));
  };

  const addUser = () => {
    if (!newUser.name.trim() || !newUser.email.trim()) return;
    setUsers((prev) => [
      { id: `usr-${Date.now().toString(36)}`, name: newUser.name.trim(), email: newUser.email.trim(), role: 'reader', permissions: [], registeredAt: new Date().toISOString().slice(0, 10), isDemo: false },
      ...prev,
    ]);
    setNewUser({ name: '', email: '' });
    setShowAdd(false);
  };

  const permCount = (u: AppUser) => (u.role === 'admin' ? PERMISSIONS.length : u.permissions.length);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>Users &amp; Permissions</h1>
        <p>Admins can do everything. Readers register themselves; you promote a reader to Moderator, then grant specific privileges one by one. Moderators have no privileges until you assign them.</p>
      </div>

      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card"><div className="stat-value">{users.filter((u) => u.role === 'admin').length}</div><div className="stat-label">Admins</div></div>
        <div className="stat-card"><div className="stat-value">{users.filter((u) => u.role === 'moderator').length}</div><div className="stat-label">Moderators</div></div>
        <div className="stat-card"><div className="stat-value">{users.filter((u) => u.role === 'reader').length}</div><div className="stat-label">Readers</div></div>
        <div className="stat-card"><div className="stat-value">{users.length}</div><div className="stat-label">Total users</div></div>
      </div>

      <div className="admin-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ margin: 0 }}>All users</h2>
          <button className="btn btn-primary" onClick={() => setShowAdd(!showAdd)}>{showAdd ? 'Cancel' : '+ Add user'}</button>
        </div>

        {showAdd && (
          <div className="user-add-form">
            <input className="form-input" placeholder="Full name" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} />
            <input className="form-input" type="email" placeholder="Email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} />
            <button className="btn btn-primary" onClick={addUser}>Add as reader</button>
          </div>
        )}

        <table className="admin-table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Privileges</th><th>Registered</th><th></th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <UserRows
                key={u.id}
                user={u}
                expanded={expanded === u.id}
                onToggleExpand={() => setExpanded(expanded === u.id ? null : u.id)}
                onSetRole={(r) => setRole(u.id, r)}
                onTogglePerm={(p) => togglePermission(u.id, p)}
                permCount={permCount(u)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="admin-note">
        Roles &amp; permissions are demonstrated locally. In production these are enforced by the database (row-level security) and every privileged action is checked server-side — the checkbox UI only reflects what the backend grants.
      </div>
    </div>
  );
}

function UserRows({ user, expanded, onToggleExpand, onSetRole, onTogglePerm, permCount }: {
  user: AppUser;
  expanded: boolean;
  onToggleExpand: () => void;
  onSetRole: (r: UserRole) => void;
  onTogglePerm: (p: PermissionKey) => void;
  permCount: number;
}) {
  const isAdmin = user.role === 'admin';
  const isMod = user.role === 'moderator';
  return (
    <>
      <tr>
        <td className="td-title">
          {user.name}
          {user.isDemo && <span className="demo-tag">DEMO</span>}
        </td>
        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{user.email}</td>
        <td>
          <select className="form-input role-select" value={user.role} onChange={(e) => onSetRole(e.target.value as UserRole)}>
            <option value="reader">Reader</option>
            <option value="moderator">Moderator</option>
            <option value="admin">Admin</option>
          </select>
        </td>
        <td>
          {isAdmin ? <span className="perm-count all">All ({permCount})</span>
            : isMod ? <span className={`perm-count${permCount === 0 ? ' none' : ''}`}>{permCount} of {PERMISSIONS.length}</span>
            : <span className="perm-count none">None (reader)</span>}
        </td>
        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{user.registeredAt}</td>
        <td>
          {isMod && <button className="btn btn-small" onClick={onToggleExpand}>{expanded ? 'Hide' : 'Permissions'}</button>}
        </td>
      </tr>
      {isMod && expanded && (
        <tr className="perm-editor-row">
          <td colSpan={6}>
            <div className="perm-editor">
              <div className="perm-editor-title">Grant privileges to <strong>{user.name}</strong> — tick only what this moderator may do</div>
              <div className="perm-grid">
                {PERMISSIONS.map((p) => (
                  <label key={p.key} className="perm-item">
                    <input type="checkbox" checked={user.permissions.includes(p.key)} onChange={() => onTogglePerm(p.key)} />
                    <span>
                      <span className="perm-item-label">{p.label}</span>
                      <span className="perm-item-desc">{p.desc}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
