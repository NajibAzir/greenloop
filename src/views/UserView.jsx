import ProfileTab from './ProfileTab.jsx'
import HubScanTab from './HubScanTab.jsx'
import { RedeemVouchers, OffsetFee, MyActivity } from './ResidentView.jsx'

export default function UserView({ page, role }) {
  switch (page) {
    case 'scan':
      return <HubScanTab />
    case 'redeem':
      return role === 'tenant' ? <OffsetFee /> : <RedeemVouchers />
    case 'offset':
      return <OffsetFee />
    case 'activity':
      return <MyActivity />
    case 'profile':
    default:
      return <ProfileTab />
  }
}