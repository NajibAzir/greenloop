# GreenLoop — Smart Recycling Ecosystem (Prototype)

A dual-sided web simulation for Sime Darby Property townships. Residents recycle
at a Smart Hub to earn **Green Tokens**; the developer earns **bulk commodity
revenue** that funds the token economy and cuts logistics costs with route
optimization. All data is simulated client-side — no backend, no API keys.

## Run it

```bash
cd greenloop
npm install
npm run dev     # http://localhost:5173
```

Other commands:

```bash
npm run build   # production build into dist/
npm test        # run the Vitest unit tests
```

## Navigation

A **mode switch** at the top of the sidebar toggles between the two personas,
and the sidebar then shows only that persona's menu. **Load Demo Data** and
**Reset** live at the bottom of the sidebar.

- Resident & Tenant: Scan & Drop-off · Redeem Vouchers · Offset Maintenance Fee · My Activity
- Sime Darby Operations: Diversion Metrics · Financial Ledger · Logistics & Dispatch

## How Green Points are granted

Points follow the model real schemes use (reverse vending machines, Malaysia's
KITARecycle): **by material and weight**. Each material has a GP-per-kg rate in
`src/data/catalog.js` (`MATERIAL_RATES`), and a drop-off earns
`round(gpPerKg × weight)`. Bulk sale prices (`bulkRmPerKg`) are tuned to
indicative Malaysian buyback ranges — aluminium and e-waste highest, then PET,
then paper/cardboard. The Scan & Drop-off page shows the GP/kg table so the
logic is transparent, not a magic number. Crucially, the resident reward per kg
is kept to roughly a third of the hub's total benefit per kg, so rewarding
residents never makes the operation lose money.

## How the hub makes money (ROI model)

The management return is **not** scrap sales alone. The economics in
`src/data/catalog.js` (`ECONOMICS`) and `src/lib/finance.js` combine:

- **Avoided landfill & haulage** — the township already pays a contractor to
  haul and tip waste, so every kg diverted is a cost avoided (the biggest and
  most defensible driver).
- **Bulk commodity sales** — pre-sorted material sold direct to recyclers.
- **Carbon / ESG value** — value of avoided CO₂ toward Net Zero targets.

minus **hub operating cost** and only the **Green Points residents actually
redeem** (unredeemed GP is shown separately as an outstanding liability). The
result is a monthly operating surplus that pays back the one-time setup
(`hubCapex`) in a few months and compounds as engagement grows — proving this is
a continuous operation, not a one-off campaign. The Financial Ledger forecasts
this over the next 3 months, 12 months, or 2 years.

## Demo flow (for judges)

1. Click **Load Demo Data** (sidebar footer) to populate township-wide numbers.
2. **Scan & Drop-off** (resident):
   - Step 1 — the recyclability check has two modes (toggle, top right of the card):
     - **Simulated** (default) — pick what you're holding and press **Scan Item**.
       A mock model returns a verdict + confidence. Recyclable items unlock
       drop-off; non-recyclable items (greasy container, foam, film, mixed
       pouch) are rejected with a reason.
     - **Simulated** has two sources: **Example Photo** (generated inline-SVG
       photos analysed with a scan line + detection box) and **Upload Image**
       (upload a real photo — it is classified for real with COCO-SSD in the
       browser and recyclable detections tally into drop-off quantities).
     - **Live Camera** — real webcam detection via TensorFlow.js COCO-SSD,
       running fully in the browser (nothing uploaded). It **lists every
       detected object** with its own verdict (recyclable → which material, or
       not accepted) and draws boxes on the video. Recyclable detections are
       **tallied into per-material quantities** automatically (no fixed default).
       Point it at a bottle, cup, or phone. Needs camera permission; if denied
       or unavailable it falls back gracefully and Simulated mode still works.
       Note: the camera only works in a secure context — `http://localhost` is
       fine, but a plain-HTTP LAN IP is not (browsers block `getUserMedia`).
   - Step 2 — review the detected materials (adjust quantities if needed) and
     **Drop at Smart Hub** to earn **Green Points (GP)**. Your drop-offs fill
     your local hub (Elmina Central), which the Operations capacity prediction
     reacts to live.
3. **Offset Maintenance Fee** — choose how many GP to apply with the **slider or
   by typing a value** (the two stay in sync; Half / Max shortcuts included),
   shown live in RM, then **Apply to fee**. The progress bar fills.
4. **Redeem Vouchers** — spend GP like cash (e.g. RM 10 café voucher). Redeemed
   vouchers appear under **My Vouchers**; tap one to open its **QR code,
   barcode and redemption code** and **Mark as Used** (used vouchers grey out).
5. **My Activity** — see every drop-off, redemption and fee offset.
6. **Logistics & Dispatch** (operations) — a **live, automatic simulation**:
   - A **simulated operations clock** (Play/Pause + speed 0.5×–10×) advances
     through the working day. Hub bins fill in **real time** during operating
     hours (09:00–17:00).
   - When a hub reaches the **80% threshold**, the AI **auto-schedules** a
     pickup — no button. If it crosses **before the 15:00 cutoff** the truck
     goes **today**; **after 15:00** the pickup rolls to **next morning 09:00**.
   - A **4-lorry fleet** (Alpha/Bravo/Charlie/Delta) is assigned by nearest
     idle truck. Trucks have a **1,000 kg capacity**, so a run covering multiple
     heavy hubs inserts **depot return trips to unload** between stops.
   - A **flight-board schedule** per truck lists every leg with **depart/arrive
     times**, delay and next-day markers, and depot unloads. The **map** draws
     each fleet's route in its colour with a legend.
   - Config (hours, cutoff, capacity, speeds, fleet) lives in
     `DISPATCH_CONFIG` / `TRUCKS` in `src/data/catalog.js`.
7. **Reset** clears everything for the next run. State persists across refresh
   via `localStorage`.

## Concept pillars

- **Hybrid Smart Hub** — AI stream (PET, aluminum, paper) + Human stream
  (cardboard, e-waste, appliances), gated by an AI recyclability check.
- **Gamified incentives** — Green Points spendable at township outlets or
  against maintenance fees.
- **Zero-cost setup** — bulk material sales fund the hub, app, and operators.
- **Predictive operations** — forecast hub capacity and dispatch the collection
  fleet only where it's needed.

## Stack

React 18 + Vite 5, Tailwind CSS v4 (`@tailwindcss/vite`), Recharts for charts,
React Leaflet + OpenStreetMap for the logistics map. Shared state lives in a
React context + reducer persisted to `localStorage`.

All figures (weights, Green Point values, RM commodity prices, conversion rate,
hub fill rates, truck fleet) live in `src/data/catalog.js` so they can be tuned
live during a demo. The AI recyclability check is simulated in
`src/components/ScanItem.jsx` against the targets in `SCAN_TARGETS`.
