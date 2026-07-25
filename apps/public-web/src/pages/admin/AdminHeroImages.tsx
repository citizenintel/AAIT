import { useState, useRef, useCallback } from 'react';
import {
  getConfig, saveConfig, uploadImage, removeImage, getThumbnail,
  getStorageUsage,
  type SlotImage, type SlotCategory,
} from '@/lib/services/hero-images';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ImageGrid({ category, label, description }: { category: SlotCategory; label: string; description: string }) {
  const [images, setImages] = useState(() => getConfig(category));
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => setImages(getConfig(category)), [category]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      await uploadImage(file, category);
      refresh();
    } catch (err: any) {
      setError(err.message ?? 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const toggleEnabled = (id: string) => {
    const updated = images.map(img =>
      img.id === id ? { ...img, enabled: !img.enabled } : img,
    );
    saveConfig(category, updated);
    setImages(updated);
  };

  const handleDelete = (id: string) => {
    removeImage(id, category);
    setConfirmDelete(null);
    refresh();
  };

  const moveUp = (id: string) => {
    const idx = images.findIndex(i => i.id === id);
    if (idx <= 0) return;
    const updated = [...images];
    [updated[idx - 1]!, updated[idx]!] = [updated[idx]!, updated[idx - 1]!];
    updated.forEach((img, i) => { img.order = i; });
    saveConfig(category, updated);
    setImages(updated);
  };

  const moveDown = (id: string) => {
    const idx = images.findIndex(i => i.id === id);
    if (idx < 0 || idx >= images.length - 1) return;
    const updated = [...images];
    [updated[idx]!, updated[idx + 1]!] = [updated[idx + 1]!, updated[idx]!];
    updated.forEach((img, i) => { img.order = i; });
    saveConfig(category, updated);
    setImages(updated);
  };

  const saveLabel = (id: string) => {
    const updated = images.map(img =>
      img.id === id ? { ...img, label: editValue.trim() || img.label } : img,
    );
    saveConfig(category, updated);
    setImages(updated);
    setEditLabel(null);
  };

  const enabledCount = images.filter(i => i.enabled).length;

  return (
    <div className="admin-card" style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>{label}</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>{description}</p>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
            {images.length} image{images.length !== 1 ? 's' : ''} &middot; {enabledCount} active
          </p>
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleUpload}
          />
          <button
            className="btn-primary"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{ fontSize: 12, padding: '6px 14px' }}
          >
            {uploading ? 'Uploading...' : '+ Upload image'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '8px 12px', background: '#c5303015', border: '1px solid #c5303040', borderRadius: 6, color: '#c53030', fontSize: 12, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {images.length === 0 && (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, border: '1px dashed var(--border-subtle)', borderRadius: 8 }}>
          No images yet. Upload one to get started.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {images.map((img, idx) => {
          const thumb = getThumbnail(img);
          return (
            <div
              key={img.id}
              style={{
                border: `1px solid ${img.enabled ? 'var(--accent)' : 'var(--border-subtle)'}`,
                borderRadius: 8,
                overflow: 'hidden',
                background: 'var(--bg-elevated)',
                opacity: img.enabled ? 1 : 0.5,
                transition: 'opacity 0.2s, border-color 0.2s',
              }}
            >
              {/* Thumbnail */}
              <div style={{ position: 'relative', height: 140, background: '#0a0f1a', overflow: 'hidden' }}>
                {thumb ? (
                  <img
                    src={thumb}
                    alt={img.alt}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 11 }}>
                    No preview
                  </div>
                )}
                {/* Order badge */}
                <div style={{
                  position: 'absolute', top: 6, left: 6,
                  width: 22, height: 22, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.7)', color: '#fff',
                  fontSize: 10, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {idx + 1}
                </div>
                {/* Type badge */}
                <div style={{
                  position: 'absolute', top: 6, right: 6,
                  padding: '2px 6px', borderRadius: 3,
                  background: img.type === 'builtin' ? '#3182ce30' : '#c9a84c30',
                  color: img.type === 'builtin' ? '#63b3ed' : '#c9a84c',
                  fontSize: 9, fontWeight: 600, textTransform: 'uppercase',
                }}>
                  {img.type === 'builtin' ? 'Built-in' : 'Uploaded'}
                </div>
              </div>

              {/* Info + controls */}
              <div style={{ padding: '8px 10px' }}>
                {/* Label */}
                {editLabel === img.id ? (
                  <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                    <input
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveLabel(img.id); if (e.key === 'Escape') setEditLabel(null); }}
                      autoFocus
                      style={{ flex: 1, fontSize: 12, padding: '3px 6px', background: 'var(--bg-base)', border: '1px solid var(--border-strong)', borderRadius: 4, color: 'var(--text-primary)' }}
                    />
                    <button onClick={() => saveLabel(img.id)} style={{ fontSize: 11, padding: '2px 8px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Save</button>
                  </div>
                ) : (
                  <div
                    style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6, cursor: 'pointer' }}
                    title="Click to rename"
                    onClick={() => { setEditLabel(img.id); setEditValue(img.label); }}
                  >
                    {img.label}
                  </div>
                )}

                {/* Controls */}
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <button
                    onClick={() => toggleEnabled(img.id)}
                    style={{
                      flex: 1, fontSize: 10, padding: '4px 0',
                      background: img.enabled ? '#38a16920' : 'var(--bg-base)',
                      color: img.enabled ? '#38a169' : 'var(--text-muted)',
                      border: `1px solid ${img.enabled ? '#38a16940' : 'var(--border-subtle)'}`,
                      borderRadius: 4, cursor: 'pointer', fontWeight: 600,
                    }}
                  >
                    {img.enabled ? 'Active' : 'Inactive'}
                  </button>
                  <button
                    onClick={() => moveUp(img.id)}
                    disabled={idx === 0}
                    title="Move up"
                    style={{ padding: '4px 6px', background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 4, cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.3 : 1, color: 'var(--text-secondary)', fontSize: 11 }}
                  >
                    &#9650;
                  </button>
                  <button
                    onClick={() => moveDown(img.id)}
                    disabled={idx === images.length - 1}
                    title="Move down"
                    style={{ padding: '4px 6px', background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 4, cursor: idx === images.length - 1 ? 'default' : 'pointer', opacity: idx === images.length - 1 ? 0.3 : 1, color: 'var(--text-secondary)', fontSize: 11 }}
                  >
                    &#9660;
                  </button>
                  {img.type === 'uploaded' && (
                    confirmDelete === img.id ? (
                      <div style={{ display: 'flex', gap: 2 }}>
                        <button
                          onClick={() => handleDelete(img.id)}
                          style={{ fontSize: 10, padding: '4px 8px', background: '#c53030', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          style={{ fontSize: 10, padding: '4px 6px', background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-muted)' }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(img.id)}
                        title="Delete"
                        style={{ padding: '4px 6px', background: 'none', border: '1px solid #c5303040', borderRadius: 4, cursor: 'pointer', color: '#c53030', fontSize: 11 }}
                      >
                        &#10005;
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AdminHeroImages() {
  const [storage] = useState(() => getStorageUsage());

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1>Image Manager</h1>
        <p>Manage paid ad images and hero images displayed in sponsor slots.</p>
      </div>

      <div className="admin-note" style={{ marginBottom: 20 }}>
        <strong>How it works.</strong> When sponsors are enabled, <strong>Paid Ad</strong> images fill the sidebar slots.
        When sponsors are disabled, <strong>Hero Images</strong> display as branded placeholders instead.
        Active images cycle through the available slots. Upload JPG/PNG/SVG up to 5 MB each.
        <br />
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Storage: {formatBytes(storage.used)} used across {storage.items} items
        </span>
      </div>

      <ImageGrid
        category="ad"
        label="Paid Ad Images"
        description="Displayed in sponsor slots when sponsors are enabled. Real sponsor ads from paying advertisers."
      />

      <ImageGrid
        category="hero"
        label="Hero Images"
        description="Shown when sponsors are disabled. Branding images for AAIT — farm scenes, command center, etc."
      />
    </div>
  );
}
