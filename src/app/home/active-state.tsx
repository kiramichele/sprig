"use client"

export default function ActiveState({ profile, pods, sessions, onJoin }: any) {
  const soon = sessions && sessions[0]

  return (
    <section>
      <h1 className="display text-4xl mb-3">your pods 🌿</h1>

      {soon ? (
        <div style={{ background: '#FFF8E6', padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <div>your next pod meets in <strong>{new Date(soon.scheduled_for).toLocaleString()}</strong></div>
          <a href={`/pods/${soon.pod_id}`} className="inline-block mt-2 px-4 py-2" style={{ background: 'white', border: '2.5px solid #1F1A3D', boxShadow: '4px 4px 0 0 #1F1A3D', borderRadius: 12 }}>join call</a>
        </div>
      ) : null}

      <div className="space-y-4">
        {pods.map((p: any) => (
          <div key={p.id} style={{ background: 'white', borderRadius: 8, padding: 12, border: '1px solid rgba(0,0,0,0.04)' }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold">{p.name || (p.primary_interest?.name ? `${p.primary_interest.name} pod` : 'pod')}</div>
                <div className="text-sm opacity-70">{p.members_count || '—'} members</div>
              </div>
              <div>
                <div className="text-sm">{p.status}</div>
                <a href={`/pods/${p.id}`} className="block mt-2 text-sm">open pod</a>
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
