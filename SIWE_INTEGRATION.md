# SIWE (Sign-In With Ethereum) Integration

## Overview

This document describes the complete SIWE authentication flow integrated with Better Auth in the Coincents application.

## Architecture

### Unified Authentication System

We now have **one unified authentication system** powered by Better Auth that handles:

1. **Wallet Authentication** (SIWE) - for regular users
2. **Email/Password Authentication** - for admin users
3. **Session Management** - single session type for all users

### Key Components

#### 1. Server-Side (`src/lib/auth-server.js`)

```javascript
siwe({
  domain: process.env.NEXT_PUBLIC_SIWE_DOMAIN || "localhost",
  anonymous: true, // Auto-create users on wallet sign-in
  getNonce: async () => generateRandomString(32),
  verifyMessage: async ({ message, signature, address }) => {
    // Verify signature using viem
    const isValid = await verifyMessage({ address, message, signature });
    return Boolean(isValid);
  },
  onSuccess: async ({ user, walletAddress }) => {
    // Sync wallet address to user.ethereumAddress
    await prisma.user.update({
      where: { id: user.id },
      data: { ethereumAddress: walletAddress.address },
    });
  },
})
```

#### 2. Client Hook (`src/hooks/useSIWE.js`)

Custom React hook that handles the complete SIWE flow:

```javascript
const { signIn, signOut, isAuthenticating, error } = useSIWE();
```

**Flow:**
1. Get nonce from Better Auth
2. Create SIWE message with nonce
3. Sign message with user's wallet (via wagmi)
4. Verify signature with Better Auth
5. Return authenticated session

#### 3. Frontend Integration (`src/components/portfolio/PortfolioApp.js`)

```javascript
const { data: session } = useSession(); // Better Auth session
const { signIn: siweSignIn } = useSIWE();

// Auto-trigger SIWE when wallet connects
useEffect(() => {
  if (isConnected && !session) {
    siweSignIn();
  }
}, [isConnected, session]);
```

## Authentication Flow

### Wallet User Flow

```
1. User clicks "Connect Wallet" (RainbowKit)
   ↓
2. Wallet connects (MetaMask, WalletConnect, etc.)
   ↓
3. PortfolioApp detects connection
   ↓
4. useSIWE.signIn() is triggered:
   a. Generate nonce from Better Auth
   b. Create SIWE message
   c. Prompt user to sign message
   d. Verify signature with Better Auth
   ↓
5. Better Auth creates session + user record
   ↓
6. onSuccess hook syncs wallet address to User.ethereumAddress
   ↓
7. Frontend loads user data from database
   ↓
8. User is authenticated ✅
```

### Email/Password User Flow (Admin)

```
1. User navigates to /admin/sign-in
   ↓
2. Enters email + password
   ↓
3. Better Auth validates credentials
   ↓
4. Session created
   ↓
5. User redirected to admin dashboard
   ↓
6. Same session works in portfolio ✅
```

## Database Schema

### User Table
```prisma
model User {
  id              String   @id @default(cuid())
  email           String?  @unique
  ethereumAddress String?  @unique  // Synced from SIWE
  role            Role     @default(USER)
  balance         Float    @default(1000.0)
  // ... other fields
  wallets         WalletAddress[]
}
```

### WalletAddress Table (SIWE Plugin)
```prisma
model WalletAddress {
  id        String   @id @default(cuid())
  userId    String
  address   String
  chainId   Int
  isPrimary Boolean  @default(false)
  user      User     @relation(fields: [userId], references: [id])
  
  @@unique([userId, address, chainId])
}
```

## API Endpoints

All Better Auth endpoints are available at `/api/auth/*`:

- `POST /api/auth/siwe/nonce` - Generate SIWE nonce
- `POST /api/auth/siwe/verify` - Verify SIWE signature
- `POST /api/auth/sign-in/email` - Email/password sign-in
- `POST /api/auth/sign-out` - Sign out
- `GET /api/auth/session` - Get current session

## Environment Variables

```bash
# Required for SIWE
NEXT_PUBLIC_SIWE_DOMAIN=localhost  # or your domain
NEXT_PUBLIC_SIWE_STATEMENT="Sign in to Coincents"

# Better Auth
BETTER_AUTH_SECRET=your-secret-key
DATABASE_URL=postgresql://...
```

## Benefits of This Approach

### ✅ Single Session System
- No more dual auth contexts
- One session works for wallet AND email/password users
- Cleaner code, easier to maintain

### ✅ Standard SIWE Implementation
- Follows ERC-4361 standard
- Compatible with all Ethereum wallets
- Industry-standard security

### ✅ Better Auth Integration
- Automatic user creation
- Built-in session management
- Role-based access control (RBAC)
- Admin plugin support

### ✅ Multi-Chain Support
- Works with any EVM chain (Ethereum, Polygon, Arbitrum, Base, etc.)
- ChainId validation
- Easy to extend to non-EVM chains

## Testing the Flow

### 1. Test Wallet Authentication

```javascript
// In browser console on /portfolio
const { signIn } = useSIWE();
const result = await signIn();
console.log(result); // { success: true, user: {...}, session: {...} }
```

### 2. Test Session Persistence

```javascript
// Check session
const { data } = await authClient.getSession();
console.log(data.user); // Should show wallet address
```

### 3. Test Multi-Wallet Support

1. Connect with Wallet A
2. Sign SIWE message
3. Disconnect
4. Connect with Wallet B
5. Sign SIWE message (creates new session)

## Migration from Old System

### Removed Components
- ❌ `UserContext` - custom wallet context
- ❌ Dual session state management
- ❌ Manual wallet address syncing
- ❌ Custom nonce generation

### New Components
- ✅ `useSIWE` hook - complete SIWE flow
- ✅ Better Auth SIWE plugin
- ✅ Unified session with `useSession()`
- ✅ Automatic wallet address syncing

## Troubleshooting

### Issue: "Failed to get nonce"
**Solution:** Check that Better Auth server is running and SIWE plugin is configured.

### Issue: "Verification failed"
**Solution:** Ensure the chainId matches between the SIWE message and verification request.

### Issue: "User not found after sign-in"
**Solution:** Check that `anonymous: true` is set in SIWE config and `onSuccess` hook is syncing the address.

### Issue: "Different wallet detected"
**Solution:** This is expected behavior. The system will prompt for re-authentication when a different wallet connects.

## Future Enhancements

- [ ] ENS name resolution
- [ ] Multi-wallet support per user
- [ ] Wallet switching without re-auth
- [ ] Non-EVM chain support (Solana, etc.)
- [ ] Hardware wallet support
- [ ] Session expiry notifications

## References

- [Better Auth SIWE Plugin](https://www.better-auth.com/docs/plugins/siwe)
- [ERC-4361: Sign-In with Ethereum](https://eips.ethereum.org/EIPS/eip-4361)
- [SIWE Library](https://github.com/spruceid/siwe)
- [Viem Message Signing](https://viem.sh/docs/actions/wallet/signMessage.html)

