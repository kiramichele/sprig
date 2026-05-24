import { redirect } from 'next/navigation'

// Profile editing moved to /settings; profile-viewing lives at /profile/[username].
// Anyone landing on the bare /profile route gets sent to settings.
export default function ProfileIndexPage() {
  redirect('/settings')
}
