# WeWallet - Crypto Wallet Interface

A modern, secure crypto wallet interface that supports multiple wallet providers including MetaMask and WalletConnect.

## Features

- 🔗 **Multi-Wallet Support**: Connect with MetaMask, Trust Wallet, or any WalletConnect-compatible wallet
- 🔐 **SIWE Authentication**: Sign-In With Ethereum (ERC-4361) for secure wallet-based auth
- 💰 **Live Crypto Prices**: Real-time price updates for Bitcoin, Ethereum, and BNB
- 🔒 **Non-Custodial**: You own your keys - no third-party custody
- 🚀 **No KYC Required**: 100% crypto-focused with no fiat integration
- 📱 **Mobile Friendly**: Works on desktop and mobile devices
- 👥 **Unified Auth**: Single session for both wallet and email/password users

## Getting Started

### Prerequisites

- Node.js 18+ installed
- A crypto wallet (MetaMask, Trust Wallet, etc.)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd wewallet
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:3001](http://localhost:3001) in your browser

### Environment Variables

Create a `.env` file with:

```
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB
BETTER_AUTH_SECRET=replace-with-strong-secret
NEXT_PUBLIC_SIWE_DOMAIN=localhost
SIWE_STATEMENT=Sign in to Coincents
COINGECKO_API_KEY= # optional
COINBASE_COMMERCE_API_KEY= # optional
COINBASE_COMMERCE_WEBHOOK_SECRET= # if using webhooks
ADMIN_EMAIL= # admin email for initial seed
ADMIN_PASSWORD= # admin password for initial seed
ADMIN_USERNAME= # optional username for initial seed
ADMIN_WALLET= # optional ethereum address for admin
```

Notes:
- Admin access is derived from the `role` field on `User`. Seed an admin user with your wallet address.
- Admin pages require sending `x-wallet-address` and `x-user-role: ADMIN` headers during development.

### Admin Accounts

- End users sign in with wallet (SIWE) only.
- Admins sign in with email/username + password.
- To create the first admin:
  1. Start the server (e.g., `npm run dev`)
  2. Set `ADMIN_EMAIL`, `ADMIN_PASSWORD` (and optional `ADMIN_USERNAME`, `ADMIN_WALLET`)
  3. Run Prisma seed: `npx prisma db seed`
  4. Sign in at `/admin/sign-in`

### Managing Deposit Addresses

Deposit addresses are now stored in the database and can be managed through the admin dashboard:

1. **Initial Setup**: Run `npm run seed` to populate deposit addresses from environment variables
2. **Admin Dashboard**: Navigate to `/admin` → Settings tab
3. **Edit Addresses**: Update BTC, ETH, USDT, and USDC deposit addresses
4. **Save Changes**: Click "Save Changes" to update the database

**Benefits:**
- ✅ No server restart required when changing addresses
- ✅ Audit trail of all changes via `AuditLog` table
- ✅ Addresses fetched dynamically by frontend
- ✅ Fallback to env variables if database is empty

**Environment Variables (Fallback):**
```
NEXT_PUBLIC_BTC_ADDRESS=your_btc_address
NEXT_PUBLIC_ETH_ADDRESS=your_eth_address
NEXT_PUBLIC_USDT_ADDRESS=your_usdt_address
```

Note: The frontend will automatically fetch addresses from `/api/deposit-addresses` on page load.

## Authentication

### Wallet Authentication (SIWE)

This app uses **Sign-In With Ethereum (SIWE)** following the [ERC-4361 standard](https://eips.ethereum.org/EIPS/eip-4361) for secure, decentralized authentication.

**How it works:**
1. Connect your wallet (MetaMask, WalletConnect, etc.)
2. Sign a message to prove wallet ownership
3. Authenticated! Your session is created automatically

**Benefits:**
- 🔐 **Secure** - No passwords, just cryptographic signatures
- 🌐 **Standard** - ERC-4361 compliant, works with all wallets
- 🚀 **Automatic** - Sign once when connecting, that's it!
- 💾 **Persistent** - Session saved, no need to re-sign on refresh

### How to Connect Your Wallet

#### Option 1: MetaMask (Recommended)
1. Install [MetaMask](https://metamask.io/) browser extension
2. Create or import a wallet
3. Navigate to `/portfolio`
4. Click "Connect Wallet"
5. Approve the connection in MetaMask
6. **Sign the SIWE message** when prompted
7. ✅ You're authenticated!

#### Option 2: Mobile Wallets (Trust Wallet, etc.)
1. Install a WalletConnect-compatible wallet on your mobile device
2. Navigate to `/portfolio`
3. Click "Connect Wallet"
4. Scan the QR code with your mobile wallet
5. Approve the connection in your wallet app
6. **Sign the SIWE message** when prompted
7. ✅ You're authenticated!

**Note:** You'll need to sign a message each time you connect a different wallet. This is a security feature to prove you own the wallet.

## Supported Networks

- Ethereum Mainnet
- Binance Smart Chain (BSC)
- Polygon

## Development

### Project Structure
```
src/
├── app/           # Next.js app directory
├── components/    # React components
├── lib/          # Utility functions (wallet.js)
└── styles/       # CSS modules
```

### Key Files
- `src/app/page.js` - Main homepage with wallet connection
- `src/lib/wallet.js` - Wallet connection logic
- `src/styles/Landing.module.css` - Styling

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Troubleshooting

### Wallet Connection Issues

1. **"No wallet detected"**: Install MetaMask or another wallet extension
2. **"User rejected connection"**: Make sure to approve the connection in your wallet
3. **"Connection failed"**: Check your internet connection and try again

### Common Issues

- **Metamask not appearing**: Make sure MetaMask is installed and unlocked
- **QR code not working**: Ensure your mobile wallet supports WalletConnect
- **Network errors**: Check if you're on a supported network (Ethereum Mainnet by default)

## Security

- This is a frontend-only application
- No private keys are stored or transmitted
- All wallet interactions happen locally in your browser
- Always verify transactions in your wallet before confirming

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is open source and available under the [MIT License](LICENSE).
