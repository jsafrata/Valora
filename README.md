# Valora — Commodity Trading Game

A finite-round commodity trading game where you compete as a reseller against 3 AI opponents. Buy from producers, sell to consumers, and negotiate trades with rival resellers across different market regions.

## Quick Start

```bash
npm install
npm run dev
```

Then open the localhost URL shown in your terminal.

## Deploy to Vercel (free)

1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com), sign in with GitHub
3. Click "New Project" → import your repo
4. Vercel auto-detects Vite — just click "Deploy"
5. Share the URL with friends!

## How to Play

- **Phase 1**: Buy units from producers (prices increase with each purchase)
- **Phase 2**: Sell units to your region's consumers (prices decrease with each sale)
- **Phase 3**: Trade with other resellers — buy low, sell high across regions
- **Phase 4**: Sell again to consumers (continues from Phase 2 prices)
- **End of round**: Pay holding costs on unsold inventory

After 6 rounds, the reseller with the most cash wins. Leftover inventory is worthless!
