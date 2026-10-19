import { useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { Button, Card } from '../components/ui.jsx'

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500'
const labelCls = 'mb-1 block text-xs font-semibold text-slate-600'

export default function AuthView() {
  const { state, dispatch } = useStore()
  const [tab, setTab] = useState('login')
  const [err, setErr] = useState('')

  // login
  const [lid, setLid] = useState('')
  const [lpw, setLpw] = useState('')

  // register
  const [role, setRole] = useState('user')
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [email, setEmail] = useState('')
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')

  function doLogin(e) {
    e.preventDefault()
    setErr('')
    const id = lid.trim()
    if (id === 'synkosys' && lpw === 'synkosys123') {
      dispatch({ type: 'LOGIN', ops: true })
      return
    }
    const u = state.auth.users.find((x) => x.id === id && x.password === lpw)
    if (!u) {
      setErr('Invalid ID or password. New here? Register first — the system issues your ID.')
      return
    }
    dispatch({ type: 'LOGIN', id: u.id })
  }

  function doRegister(e) {
    e.preventDefault()
    setErr('')
    if (!name.trim() || !address.trim() || !email.trim() || !pw1) return setErr('All fields are required.')
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr('Enter a valid email address.')
    if (pw1.length < 6) return setErr('Password must be at least 6 characters.')
    if (pw1 !== pw2) return setErr('Passwords do not match.')
    const n = state.auth.users.filter((u) => u.role === role).length + 1
    const newId = `${role === 'tenant' ? 'TENT' : 'USER'}-${String(n).padStart(9, '0')}`
    dispatch({
      type: 'REGISTER',
      role,
      id: newId,
      name: name.trim(),
      address: address.trim(),
      email: email.trim(),
      password: pw1,
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 via-white to-emerald-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <span className="text-4xl">♻️</span>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">GreenLoop</h1>
          <p className="text-sm text-slate-500">Smart Recycling Ecosystem — sign in to continue</p>
        </div>

        <Card>
          <div className="grid grid-cols-2 gap-1 border-b border-slate-100 p-2">
            {[
              { id: 'login', label: '🔑 Login' },
              { id: 'register', label: '📝 Register' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setErr('') }}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  tab === t.id ? 'bg-green-600 text-white' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'login' ? (
            <form onSubmit={doLogin} className="space-y-4 p-5">
              <div>
                <label className={labelCls}>User / Tenant / Operation ID</label>
                <input className={inputCls} value={lid} onChange={(e) => setLid(e.target.value)} placeholder="USER-000000001" />
              </div>
              <div>
                <label className={labelCls}>Password</label>
                <input className={inputCls} type="password" value={lpw} onChange={(e) => setLpw(e.target.value)} placeholder="••••••••" />
              </div>
              {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 ring-1 ring-red-200">{err}</p>}
              <Button type="submit" className="w-full">Login</Button>
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-center text-[11px] text-slate-500 ring-1 ring-slate-100">
                Operation demo → ID <b className="font-mono">synkosys</b> · PASS <b className="font-mono">synkosys123</b>
              </p>
            </form>
          ) : (
            <form onSubmit={doRegister} className="space-y-4 p-5">
              <div>
                <label className={labelCls}>Account type</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'user', label: '🙋 User', hint: 'Resident' },
                    { id: 'tenant', label: '🏬 Tenant', hint: 'Mall business' },
                  ].map((r) => (
                    <label
                      key={r.id}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                        role === r.id
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      <input type="radio" name="role" className="accent-green-600" checked={role === r.id} onChange={() => setRole(r.id)} />
                      <span>{r.label}<span className="block text-[10px] text-slate-400">{r.hint}</span></span>
                    </label>
                  ))}
                </div>
              </div>
              <div><label className={labelCls}>Name</label>
                <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Aisyah Rahman" /></div>
              <div><label className={labelCls}>Address</label>
                <input className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Greenview Residence · A-12-3" /></div>
              <div><label className={labelCls}>Email</label>
                <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Password</label>
                  <input className={inputCls} type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} /></div>
                <div><label className={labelCls}>Confirm password</label>
                  <input className={inputCls} type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
              </div>
              {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 ring-1 ring-red-200">{err}</p>}
              <Button type="submit" className="w-full">Create account</Button>
              <p className="text-center text-[11px] text-slate-400">
                Your ID is generated on create, e.g. <span className="font-mono">USER-000000001</span> or <span className="font-mono">TENT-000000001</span>.
              </p>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}