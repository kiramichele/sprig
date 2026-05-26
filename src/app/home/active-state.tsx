"use client"

export default function ActiveState({ profile, pods, sessions, onJoin }: any) {
  const soon = sessions && sessions[0]

  const safePods = Array.isArray(pods) ? pods : []

  return (
    <section>
      <h1 className="display text-3xl sm:text-4xl mb-3">your pods 🌿</h1>

      {soon ? (
        <div className="mb-3 px-4 py-3 sm:p-3" style={{ background: '#FFF8E6', borderRadius: 8 }}>
          <div className="text-sm sm:text-base">your next pod meets in <strong suppressHydrationWarning>{new Date(soon.scheduled_for).toLocaleString()}</strong></div>
          <a
            href={`/pods/${soon.pod_id}`}
            className="inline-flex items-center justify-center mt-2 px-4 font-bold w-full sm:w-auto"
            style={{ background: 'white', border: '2.5px solid #1F1A3D', boxShadow: '4px 4px 0 0 #1F1A3D', borderRadius: 12, minHeight: 44 }}
          >
            join call
          </a>
        </div>
      ) : safePods.length > 0 ? (
        <div
          style={{
            background: '#FFF8E6',
            border: '2px dashed rgba(31,26,61,0.18)',
            padding: 14,
            borderRadius: 12,
            marginBottom: 12,
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          no sessions on your calendar — propose one in any of your pods to get something going 🌱
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {safePods.map((p: any) => (
          <div
            key={String(p.id)}
            className="px-4 py-3"
            style={{ background: 'white', borderRadius: 8, border: '1px solid rgba(0,0,0,0.04)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-bold truncate">{String(p.name || (p.primary_interest?.name ? `${p.primary_interest.name} pod` : 'pod'))}</div>
                <div className="text-sm opacity-70">{String(p.members_count || '—')} members</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm">{String(p.status || '')}</div>
                <a href={`/pods/${String(p.id)}`} className="block mt-2 text-sm font-bold underline">open pod</a>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <button onClick={onJoin} className="px-4 py-2 font-bold" style={{ background: 'white', border: '2.5px solid #1F1A3D', boxShadow: '4px 4px 0 0 #1F1A3D', borderRadius: 12 }}>join another pool</button>
      </div>
    </section>
  )
}
