import { useRef, useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { Button, Card, CardHeader } from '../components/ui.jsx'
import { GPBalance } from './ResidentView.jsx'
import { formatGP } from '../lib/engine.js'

const rowCls = 'flex items-center justify-between border-b border-slate-100 py-3 last:border-0'
const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500'

export default function ProfileTab() {
  const { state, dispatch } = useStore()
  const u = state.auth.session
  const acct = state.accounts[u.id]
  const [edit, setEdit] = useState(false)
  const [name, setName] = useState(u.name)
  const [addr, setAddr] = useState(u.address)
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [avatar, setAvatar] = useState(u.avatar)
  const [err, setErr] = useState('')
  const fileRef = useRef(null)

  const isTenant = u.role === 'tenant'

  function pickFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    const r = new FileReader()
    r.onload = () => setAvatar(r.result)
    r.readAsDataURL(f)
  }

  function save(e) {
    e.preventDefault()
    setErr('')
    if (pw1 && pw1.length < 6) return setErr('Password must be at least 6 characters.')
    if (pw1 && pw1 !== pw2) return setErr('Passwords do not match.')
    const patch = { name: name.trim(), address: addr.trim(), avatar }
    if (pw1) patch.password = pw1
    dispatch({ type: 'UPDATE_PROFILE', patch })
    setPw1(''); setPw2('')
    setEdit(false)
  }

  return (
    <div className="space-y-5">
      <GPBalance balance={acct?.tokenBalance ?? 0} />

      <Card>
        <CardHeader
          title={isTenant ? 'Tenant Profile' : 'User Profile'}
          subtitle="Your GreenLoop account details"
          right={
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-800">{u.name}</p>
                <p className="font-mono text-[11px] text-slate-400">{u.id}</p>
              </div>
              <button onClick={() => fileRef.current?.click()} title="Change profile picture">
                {avatar ? (
                  <img src={avatar} alt="avatar" className="h-11 w-11 rounded-full object-cover ring-2 ring-green-200" />
                ) : (
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-green-100 text-xl ring-2 ring-green-200">
                    {isTenant ? '🏬' : '🙋'}
                  </span>
                )}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickFile} />
            </div>
          }
        />
        <div className="px-5 py-4">
          <div className={rowCls}>
            <span className="text-sm text-slate-500">{isTenant ? 'Tenant ID' : 'User ID'}</span>
            <span className="font-mono text-sm font-semibold text-slate-800">{u.id}</span>
          </div>
          <div className={rowCls}>
            <span className="text-sm text-slate-500">Name</span>
            <span className="text-sm font-medium text-slate-800">{u.name}</span>
          </div>
          <div className={rowCls}>
            <span className="text-sm text-slate-500">Email</span>
            <span className="text-sm font-medium text-slate-800">{u.email}</span>
          </div>
          <div className={rowCls}>
            <span className="text-sm text-slate-500">Address</span>
            <span className="text-sm font-medium text-slate-800">{u.address}</span>
          </div>
          <div className={rowCls}>
            <span className="text-sm text-slate-500">Password</span>
            <span className="font-mono text-sm tracking-widest text-slate-800">••••••••</span>
          </div>
          <div className={rowCls}>
            <span className="text-sm text-slate-500">Green Point (GP) Balance</span>
            <span className="text-sm font-bold text-green-600">{formatGP(acct?.tokenBalance ?? 0)}</span>
          </div>
          <div className="pt-4">
            <Button variant="secondary" onClick={() => setEdit(true)}>✏️ Edit profile</Button>
          </div>
        </div>
      </Card>

      {edit && (
        <Card>
          <CardHeader title="Edit Profile" subtitle="Update your picture, details or password" />
          <form onSubmit={save} className="space-y-4 px-5 py-4">
            <div className="flex items-center gap-3">
              {avatar ? (
                <img src={avatar} className="h-14 w-14 rounded-full object-cover ring-2 ring-green-200" alt="" />
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl">{isTenant ? '🏬' : '🙋'}</span>
              )}
              <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>Change picture</Button>
            </div>
            <div><label className="mb-1 block text-xs font-semibold text-slate-600">Name</label>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><label className="mb-1 block text-xs font-semibold text-slate-600">Address</label>
              <input className={inputCls} value={addr} onChange={(e) => setAddr(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="mb-1 block text-xs font-semibold text-slate-600">New password</label>
                <input className={inputCls} type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} placeholder="leave blank to keep" /></div>
              <div><label className="mb-1 block text-xs font-semibold text-slate-600">Confirm password</label>
                <input className={inputCls} type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
            </div>
            {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 ring-1 ring-red-200">{err}</p>}
            <div className="flex gap-2">
              <Button type="submit">Save</Button>
              <Button type="button" variant="secondary" onClick={() => { setEdit(false); setAvatar(u.avatar); setName(u.name); setAddr(u.address) }}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  )
}