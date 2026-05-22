import { redirect } from 'next/navigation'

// /admin has no page of its own yet — send it to the matcher admin.
export default function AdminIndexPage() {
  redirect('/admin/matcher')
}
