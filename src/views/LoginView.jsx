import { useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'

const DEMO = [
  { role: 'residence', label: 'User', id: 'fath', pass: 'greenloop' },
  { role: 'tenant', label: 'Tenant', id: 'kedai kopitiam', pass: 'greenloop' },
  { role: 'operation', label: 'Operation', id: 'Synkosys Operations', pass: 'synkosys123' },
]

function Field({ label, ...props }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <input
        {...props}
        className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:border-green-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-green-500"
      />
    </label>
  )
}

export default function LoginView() {
  const { state, dispatch } = useStore()
  const [tab, setTab] = useState('login') // 'login' | 'register'
  const [id, setId] = useState('')
  const [password, setPassword] = useState('')
  // register fields
  const [role, setRole] = useState('residence')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [rpass, setRpass] = useState('')

  const error = state.auth?.error

  function login(e) {
    e?.preventDefault()
    dispatch({ type: 'LOGIN', id, password })
  }
  function register(e) {
    e?.preventDefault()
    dispatch({ type: 'REGISTER', role, name, email, address, password: rpass || 'greenloop' })
  }
  function demoLogin(d) {
    setId(d.id)
    setPassword(d.pass)
    dispatch({ type: 'LOGIN', id: d.id, password: d.pass })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="mb-5 text-center">
          <div className="text-3xl">♻️</div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">GreenLoop</h1>
          <p className="text-sm text-slate-500">Smart Recycling Ecosystem — sign in to continue</p>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-sm font-semibold">
            <button
              onClick={() => setTab('login')}
              className={`rounded-md py-1.5 transition ${tab === 'login' ? 'bg-green-600 text-white shadow-sm' : 'text-slate-500'}`}
            >
              🔑 Login
            </button>
            <button
              onClick={() => setTab('register')}
              className={`rounded-md py-1.5 transition ${tab === 'register' ? 'bg-white text-green-700 shadow-sm ring-1 ring-slate-200' : 'text-slate-500'}`}
            >
              📝 Register
            </button>
          </div>

          {error && (
            <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600 ring-1 ring-red-200">
              {error}
            </div>
          )}

          {tab === 'login' ? (
            <form onSubmit={login} className="space-y-3">
              <Field
                label="User / Tenant / Operation ID"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="e.g. fath, kedai kopitiam, Synkosys Operations"
              />
              <Field
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button
                type="submit"
                className="w-full rounded-lg bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
              >
                Login
              </button>
            </form>
          ) : (
            <form onSubmit={register} className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Account type</span>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                >
                  <option value="residence">Resident (household)</option>
                  <option value="tenant">Mall Tenant (business)</option>
                  <option value="operation">Operations</option>
                </select>
              </label>
              <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name / business" />
              <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              <Field label="Address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Unit / lot, street, area" />
              <Field label="Password" type="password" value={rpass} onChange={(e) => setRpass(e.target.value)} placeholder="choose a password" />
              <button
                type="submit"
                className="w-full rounded-lg bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
              >
                Create account & sign in
              </button>
            </form>
          )}

          {/* Demo logins */}
          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="mb-2 text-center text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Demo accounts — one click
            </p>
            <div className="grid grid-cols-3 gap-2">
              {DEMO.map((d) => (
                <button
                  key={d.role}
                  onClick={() => demoLogin(d)}
                  className="rounded-lg bg-slate-50 px-2 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-green-50 hover:text-green-700 hover:ring-green-200"
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-3 text-center text-[11px] text-slate-400">
          Simulated local auth · no backend · data stored in your browser
        </p>
      </div>
    </div>
  )
}
