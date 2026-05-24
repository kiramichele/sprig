"use client"

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useDebouncedSave } from '@/lib/use-debounced-save'
import SaveStatus from './save-status'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024

interface InitialProfile {
  id?: string
  username?: string | null
  display_name?: string | null
  bio?: string | null
  city?: string | null
  photo_url?: string | null
}

interface Props {
  userId: string
  initialProfile: InitialProfile | null
}

export default function BasicInfoSection({ userId, initialProfile }: Props) {
  const [displayName, setDisplayName] = useState<string>(initialProfile?.display_name ?? '')
  const [bio, setBio] = useState<string>(initialProfile?.bio ?? '')
  const [city, setCity] = useState<string>(initialProfile?.city ?? '')
  const [photoUrl, setPhotoUrl] = useState<string | null>(initialProfile?.photo_url ?? null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const values = useMemo(
    () => ({
      display_name: displayName.slice(0, 40),
      bio: bio.slice(0, 280),
      city,
    }),
    [displayName, bio, city]
  )

  const { status, error } = useDebouncedSave(values, async (v) => {
    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ display_name: v.display_name, bio: v.bio, city: v.city })
      .eq('id', userId)
    if (updateError) throw new Error(updateError.message)
  })

  async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    setUploadError(null)
    const file = event.target.files?.[0]
    if (!file) return
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setUploadError('photo must be jpg, png, or webp')
      return
    }
    if (file.size > MAX_BYTES) {
      setUploadError('photo cannot be larger than 5 MB')
      return
    }

    setUploading(true)
    try {
      const supabase = createClient()
      const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
      const path = `${userId}/avatar-${Date.now()}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true })
      if (uploadErr) throw uploadErr

      const { data: urlData } = await supabase.storage.from('avatars').getPublicUrl(path)
      const newUrl = urlData.publicUrl

      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ photo_url: newUrl })
        .eq('id', userId)
      if (updateErr) throw updateErr

      setPhotoUrl(newUrl)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'could not upload photo')
    } finally {
      setUploading(false)
    }
  }

  const initial = (displayName || initialProfile?.username || '?').slice(0, 1).toUpperCase()

  return (
    <section className="chunky" style={{ background: 'white', borderRadius: 16, padding: 20 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <h2 className="display" style={{ fontSize: 24 }}>basic info</h2>
        <SaveStatus status={status} errorMessage={error} />
      </div>

      {/* photo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
        {photoUrl ? (
          <img
            src={photoUrl}
            alt="your photo"
            style={{
              width: 72,
              height: 72,
              borderRadius: 9999,
              objectFit: 'cover',
              border: '2.5px solid #1F1A3D',
            }}
          />
        ) : (
          <span
            style={{
              width: 72,
              height: 72,
              borderRadius: 9999,
              background: '#FFD23F',
              border: '2.5px solid #1F1A3D',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 28,
            }}
          >
            {initial}
          </span>
        )}
        <div>
          <label
            className="chunky"
            style={{
              display: 'inline-block',
              background: 'white',
              borderRadius: 12,
              padding: '8px 14px',
              fontWeight: 700,
              cursor: uploading ? 'not-allowed' : 'pointer',
              fontSize: 14,
            }}
          >
            {uploading ? 'uploading…' : 'change photo'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoChange}
              hidden
              disabled={uploading}
            />
          </label>
          <div style={{ fontSize: 12, opacity: 0.65, marginTop: 4 }}>
            jpg, png, or webp. up to 5mb.
          </div>
          {uploadError ? (
            <div style={{ fontSize: 12, color: '#B00020', marginTop: 4 }}>{uploadError}</div>
          ) : null}
        </div>
      </div>

      {/* display name */}
      <label className="block" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>display name</div>
        <input
          className="field"
          maxLength={40}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </label>

      {/* bio */}
      <label className="block" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>bio</span>
          <span style={{ fontSize: 12, opacity: 0.6 }}>{bio.length}/280</span>
        </div>
        <textarea
          className="field"
          maxLength={280}
          rows={3}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          style={{ resize: 'vertical' }}
        />
      </label>

      {/* city */}
      <label className="block" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>city</div>
        <input className="field" value={city} onChange={(e) => setCity(e.target.value)} />
      </label>

      {/* username (read-only) */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>username</div>
        <div className="field" style={{ background: '#FBF6EE', opacity: 0.75 }}>
          @{initialProfile?.username || '—'}
        </div>
        <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>
          username can&apos;t be changed.
        </div>
      </div>
    </section>
  )
}
