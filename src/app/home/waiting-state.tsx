"use client"

export default function WaitingState({ profile, availability, onCancel, onJoin }: any) {
  const signal = (availability && availability[0]) || null

  return (
    <section>
      <h1 className="display text-4xl mb-3">we're looking for your pod 🔎</h1>
      <p className="mb-4">we're matching you with 2-4 other people around your interests. this can take anywhere from a few hours to a few days depending on who's available.</p>

      {signal ? (
        <div style={{ borderRadius: 12, padding: 16, background: 'white', border: '1px solid rgba(0,0,0,0.04)' }}>
          <div>you're available until <strong>{new Date(signal.available_until).toLocaleString()}</strong></div>
          <div>matching on <strong>{(signal.preferred_interests && signal.preferred_interests.length) ? 'selected interests' : 'all your interests'}</strong></div>
          <div>preferred group size: <strong>{signal.preferred_pod_size || 4}</strong></div>
          <div className="mt-3">
            <button onClick={onCancel} className="px-4 py-2 font-bold" style={{ background: 'white', border: '2.5px solid #1F1A3D', boxShadow: '4px 4px 0 0 #1F1A3D', borderRadius: 12 }}>cancel matching</button>
          </div>
        </div>
      ) : null}

      <div className="mt-6">
        <h4>while you wait</h4>
        <ul className="list-disc ml-6 text-sm">
          <li>upload a profile photo</li>
          <li>add or tidy your interests</li>
          <li>invite a friend</li>
        </ul>
      </div>
    </section>
  )
}
