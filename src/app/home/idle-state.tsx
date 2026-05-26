"use client"

export default function IdleState({ profile, onJoin }: any) {
  const name = profile.display_name || 'friend'

  return (
    <section>
      <h1 className="display text-3xl sm:text-5xl mb-3">hey {name} 🌱</h1>
      <p className="mb-6 text-base sm:text-lg">ready to meet some new humans?</p>

      <div className="px-5 py-5 sm:px-6 sm:py-6" style={{ background: '#FFD23F', borderRadius: 12, border: '2.5px solid #1F1A3D', boxShadow: '4px 4px 0 0 #1F1A3D' }}>
        <h2 className="text-xl sm:text-2xl mb-2 font-bold">join the pool</h2>
        <p className="mb-4 text-sm sm:text-base">tell us when you&apos;re free and we&apos;ll match you into a tiny group around your interests.</p>
        <button
          onClick={onJoin}
          className="w-full sm:w-auto px-6 font-bold"
          style={{ background: 'white', border: '2.5px solid #1F1A3D', boxShadow: '4px 4px 0 0 #1F1A3D', borderRadius: 12, minHeight: 48 }}
        >
          join the pool
        </button>
      </div>

      <div className="mt-8">
        <h3 className="text-lg mb-2 font-bold">how it works</h3>
        <ol className="list-decimal ml-6 space-y-2 text-sm sm:text-base">
          <li>🌱 join the pool with your availability</li>
          <li>🪴 we form a small group (3-5 people) around shared interests</li>
          <li>✨ meet on a guided 30-min video call with prompt cards</li>
        </ol>
      </div>

      <div className="mt-8 text-sm opacity-80">
        <strong>your stats</strong>
        <div className="mt-2">reliability score: <strong>—</strong></div>
        <div>pods completed: <strong>0</strong></div>
      </div>
    </section>
  )
}
