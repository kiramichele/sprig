'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'

type Props = {
  userId: string
  onComplete: () => void
}

type ProfileRow = Database['public']['Tables']['profiles']['Row']

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024

export default function Step5Photo({ userId, onComplete }: Props) {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [existingPhoto, setExistingPhoto] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      const supabase = createClient()
      const { data, error } = await supabase
        .from('profiles')
        .select('photo_url')
        .eq('id', userId)
        .maybeSingle()

      if (!mounted) return
      setLoading(false)

      if (error) {
        setError('could not load your profile photo')
        return
      }

      if (data?.photo_url) {
        setExistingPhoto(data.photo_url)
      }
    }

    load()
    return () => {
      mounted = false
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [userId, previewUrl])

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const nextFile = event.target.files?.[0] ?? null
    if (!nextFile) {
      setFile(null)
      setPreviewUrl(null)
      return
    }

    if (!ACCEPTED_TYPES.includes(nextFile.type)) {
      setError('photo must be a jpg, png, or webp image')
      return
    }

    if (nextFile.size > MAX_BYTES) {
      setError('photo cannot be larger than 5 MB')
      return
    }

    setFile(nextFile)
    const objectUrl = URL.createObjectURL(nextFile)
    setPreviewUrl(objectUrl)
  }

  const saveProfile = async (photoUrl: string | null) => {
    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ photo_url: photoUrl, onboarding_completed: true })
      .eq('id', userId)

    return updateError
  }

  const handleFinish = async () => {
    setError(null)
    setSaving(true)

    try {
      let photoUrl = existingPhoto
      if (file) {
        const extension = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
        const path = `${userId}/avatar-${Date.now()}.${extension}`
        const supabase = createClient()
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, file, { upsert: true })

        if (uploadError) {
          setError('could not upload your photo')
          return
        }

        const { data: urlData } = await supabase.storage
          .from('avatars')
          .getPublicUrl(path)

        photoUrl = urlData.publicUrl
      }

      const updateError = await saveProfile(photoUrl)
      if (updateError) {
        setError('could not finish onboarding')
        return
      }

      onComplete()
      router.push('/home')
      router.refresh()
    } catch {
      setError('something went wrong while finishing onboarding')
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = async () => {
    setError(null)
    setSaving(true)

    try {
      const updateError = await saveProfile(existingPhoto)
      if (updateError) {
        setError('could not finish onboarding')
        return
      }
      onComplete()
      router.push('/home')
      router.refresh()
    } catch {
      setError('something went wrong while finishing onboarding')
    } finally {
      setSaving(false)
    }
  }

  const previewSource = previewUrl || existingPhoto

  return (
    <div>
      <div className="mb-8">
        <div className="display text-4xl mb-2" style={{ color: '#1F1A3D' }}>step 5: photo</div>
        <p className="text-sm opacity-80" style={{ color: '#1F1A3D' }}>
          an optional photo helps people feel more comfortable before they match with you.
        </p>
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: '#1F1A3D' }}>loading your photo…</p>
      ) : (
        <div className="space-y-6">
          <div className="rounded-[28px] border border-[#DDD4C6] bg-white p-6 text-center">
            <div className="mx-auto mb-4 h-40 w-40 overflow-hidden rounded-full border-4 border-[#E7E0D5] bg-[#FBF6EE]">
              {previewSource ? (
                <img src={previewSource} alt="photo preview" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-[#1F1A3D] opacity-70">
                  preview will show here
                </div>
              )}
            </div>
            <label className="chunky inline-flex cursor-pointer items-center justify-center rounded-full px-6 py-3 text-sm font-bold"
              style={{ background: 'white', color: '#1F1A3D', borderRadius: '14px' }}>
              choose photo
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                hidden
              />
            </label>
            <div className="mt-3 text-xs opacity-80" style={{ color: '#1F1A3D' }}>
              jpg, png, or webp. up to 5mb.
            </div>
          </div>

          {error && (
            <div className="text-sm p-3 rounded-lg" style={{ background: '#FFE3EE', color: '#1F1A3D' }}>
              {error}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleSkip}
              disabled={saving}
              className="chunky w-full py-3 font-bold text-lg"
              style={{ background: 'white', borderRadius: '14px', color: '#1F1A3D' }}
            >
              {saving ? 'saving…' : 'skip for now'}
            </button>
            <button
              type="button"
              onClick={handleFinish}
              disabled={saving}
              className="chunky w-full py-3 font-bold text-lg"
              style={{ background: '#6BCB77', borderRadius: '14px', color: 'white' }}
            >
              {saving ? 'finishing…' : 'finish onboarding'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
