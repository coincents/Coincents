// Real Bitcoin Transaction Implementation
// Multiple transfer options for production use

const API_BASE_URL = 'https://api.blockcypher.com/v1/btc/main';
const NETWORK = 'main'; // or 'test3' for testnet

// Configuration for different transfer methods
const TRANSFER_CONFIG = {
  // BlockCypher API (for transaction broadcasting)
  BLOCKCYPHER: {
    baseUrl: 'https://api.blockcypher.com/v1/btc/main',
    token: process.env.NEXT_PUBLIC_BLOCKCYPHER_TOKEN || ''
  },
  
  // Coinbase Commerce (for payment processing)
  COINBASE: {
    apiKey: process.env.NEXT_PUBLIC_COINBASE_API_KEY || '',
    webhookSecret: process.env.NEXT_PUBLIC_COINBASE_WEBHOOK_SECRET || ''
  },
  
  // BitGo (enterprise solution)
  BITGO: {
    apiKey: process.env.NEXT_PUBLIC_BITGO_API_KEY || '',
    walletId: process.env.NEXT_PUBLIC_BITGO_WALLET_ID || ''
  }
};

// ============================================================================
// OPTION 1: Server-Side Processing (Recommended for Production)
// ============================================================================

export const createServerSideTransfer = async (transferData) => {
  try {
    const response = await fetch('/api/bitcoin/transfer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fromAddress: transferData.fromAddress,
        toAddress: transferData.toAddress,
        amount: transferData.amount,
        feeRate: transferData.feeRate || 'medium', // low, medium, high
        network: transferData.network || 'main'
      })
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const result = await response.json();
    return {
      success: true,
      txHash: result.txHash,
      fee: result.fee,
      confirmations: 0,
      method: 'server-side'
    };
  } catch (error) {
    console.error('Server-side transfer failed:', error);
    throw new Error(`Transfer failed: ${error.message}`);
  }
};

// ============================================================================
// OPTION 2: BlockCypher Direct API (Limited but Real)
// ============================================================================

export const createBlockCypherTransfer = async (transferData) => {
  try {
    // Step 1: Get UTXOs for the source address
    const utxoResponse = await fetch(`${API_BASE_URL}/addrs/${transferData.fromAddress}?unspentOnly=true`);
    const utxoData = await utxoResponse.json();
    
    if (utxoData.error) {
      throw new Error(`UTXO fetch failed: ${utxoData.error}`);
    }

    const utxos = utxoData.txrefs || [];
    if (utxos.length === 0) {
      throw new Error('No unspent outputs found');
    }

    // Step 2: Calculate total available balance
    const totalBalance = utxos.reduce((sum, utxo) => sum + utxo.value, 0);
    const amountSatoshis = Math.floor(transferData.amount * 100000000);
    
    if (amountSatoshis > totalBalance) {
      throw new Error(`Insufficient balance. Available: ${totalBalance / 100000000} BTC`);
    }

    // Step 3: Create transaction
    const transaction = {
      inputs: utxos.map(utxo => ({
        addresses: [utxo.tx_output_n],
        script_type: 'pay-to-pubkey-hash',
        script: utxo.script
      })),
      outputs: [
        {
          addresses: [transferData.toAddress],
          value: amountSatoshis
        }
      ]
    };

    // Step 4: Estimate fee and add change output if needed
    const estimatedFee = estimateTransactionFee(utxos.length, 2); // 2 outputs (destination + change)
    const changeAmount = totalBalance - amountSatoshis - estimatedFee;
    
    if (changeAmount > 546) { // Dust threshold
      transaction.outputs.push({
        addresses: [transferData.fromAddress], // Change back to sender
        value: changeAmount
      });
    }

    // Step 5: Create and sign transaction (requires private key)
    const createResponse = await fetch(`${API_BASE_URL}/txs/new`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(transaction)
    });

    const createData = await createResponse.json();
    
    if (createData.error) {
      throw new Error(`Transaction creation failed: ${createData.error}`);
    }

    // Note: This requires the private key to sign the transaction
    // In a real implementation, this would be handled server-side
    return {
      success: false,
      error: 'Private key required for signing',
      method: 'blockcypher',
      unsignedTx: createData.tx
    };

  } catch (error) {
    console.error('BlockCypher transfer failed:', error);
    throw new Error(`Transfer failed: ${error.message}`);
  }
};

// ============================================================================
// OPTION 3: Hardware Wallet Integration
// ============================================================================

export const createHardwareWalletTransfer = async (transferData) => {
  try {
    // Check if WebUSB is available
    if (!navigator.usb) {
      throw new Error('WebUSB not supported. Please use a compatible browser.');
    }

    // Try to connect to hardware wallet
    const device = await connectHardwareWallet();
    
    if (!device) {
      throw new Error('No hardware wallet detected. Please connect your Ledger or Trezor.');
    }

    // Create transaction for hardware wallet
    const transaction = {
      to: transferData.toAddress,
      value: transferData.amount,
      data: '0x', // No data for simple transfers
      gasLimit: 21000,
      gasPrice: await estimateGasPrice()
    };

    // Send to hardware wallet for signing
    const signedTx = await device.signTransaction(transaction);
    
    // Broadcast the signed transaction
    const broadcastResult = await broadcastTransaction(signedTx);
    
    return {
      success: true,
      txHash: broadcastResult.txHash,
      method: 'hardware-wallet',
      device: device.name
    };

  } catch (error) {
    console.error('Hardware wallet transfer failed:', error);
    throw new Error(`Hardware wallet transfer failed: ${error.message}`);
  }
};

// Hardware wallet connection helper
const connectHardwareWallet = async () => {
  try {
    // This is a simplified version - in reality you'd need specific libraries
    // for Ledger (ledgerjs) or Trezor (trezor-connect)
    
    // For Ledger
    if (window.ledger) {
      const transport = await window.ledger.transports.create();
      const app = new window.ledger.apps.Bitcoin(transport);
      return app;
    }
    
    // For Trezor
    if (window.TrezorConnect) {
      const result = await window.TrezorConnect.init({
        manifest: {
          email: 'admin@wewallet.com',
          appUrl: window.location.origin
        }
      });
      return result.success ? window.TrezorConnect : null;
    }
    
    throw new Error('No hardware wallet library detected');
  } catch (error) {
    console.error('Hardware wallet connection failed:', error);
    return null;
  }
};

// ============================================================================
// OPTION 4: Third-Party Payment Processing (Coinbase Commerce)
// ============================================================================

export const createCoinbaseCommerceTransfer = async (transferData) => {
  try {
    const response = await fetch('/api/coinbase/create-charge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: transferData.amount,
        currency: 'BTC',
        destinationAddress: transferData.toAddress,
        description: `BTC Transfer to ${transferData.toAddress}`,
        metadata: {
          fromAddress: transferData.fromAddress,
          transferType: 'withdrawal'
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Coinbase API error: ${response.status}`);
    }

    const result = await response.json();
    
    return {
      success: true,
      chargeId: result.chargeId,
      paymentUrl: result.hostedUrl,
      method: 'coinbase-commerce',
      status: 'pending'
    };

  } catch (error) {
    console.error('Coinbase Commerce transfer failed:', error);
    throw new Error(`Payment processing failed: ${error.message}`);
  }
};

// ============================================================================
// OPTION 5: BitGo Enterprise Solution
// ============================================================================

export const createBitGoTransfer = async (transferData) => {
  try {
    const response = await fetch('/api/bitgo/transfer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletId: TRANSFER_CONFIG.BITGO.walletId,
        toAddress: transferData.toAddress,
        amount: transferData.amount,
        passphrase: transferData.passphrase, // Encrypted
        feeRate: transferData.feeRate || 10000 // satoshis per KB
      })
    });

    if (!response.ok) {
      throw new Error(`BitGo API error: ${response.status}`);
    }

    const result = await response.json();
    
    return {
      success: true,
      txHash: result.txid,
      fee: result.fee,
      method: 'bitgo',
      status: 'confirmed'
    };

  } catch (error) {
    console.error('BitGo transfer failed:', error);
    throw new Error(`Enterprise transfer failed: ${error.message}`);
  }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Estimate transaction fee
export const estimateTransactionFee = (inputCount, outputCount, feeRate = 'medium') => {
  const feeRates = {
    low: 5,      // 5 satoshis per byte
    medium: 10,  // 10 satoshis per byte
    high: 20     // 20 satoshis per byte
  };
  
  const rate = feeRates[feeRate] || feeRates.medium;
  const estimatedSize = (inputCount * 148) + (outputCount * 34) + 10;
  return estimatedSize * rate;
};

// Get current network fee rates
export const getNetworkFeeRates = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}`);
    const data = await response.json();
    
    return {
      low: data.low_fee_per_kb,
      medium: data.medium_fee_per_kb,
      high: data.high_fee_per_kb
    };
  } catch (error) {
    console.error('Failed to fetch fee rates:', error);
    return {
      low: 5000,
      medium: 10000,
      high: 20000
    };
  }
};

// Broadcast a signed transaction
export const broadcastTransaction = async (signedTx) => {
  try {
    const response = await fetch(`${API_BASE_URL}/txs/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tx: signedTx
      })
    });

    const result = await response.json();
    
    if (result.error) {
      throw new Error(`Broadcast failed: ${result.error}`);
    }

    return {
      success: true,
      txHash: result.tx.hash,
      confirmations: 0
    };
  } catch (error) {
    console.error('Transaction broadcast failed:', error);
    throw new Error(`Broadcast failed: ${error.message}`);
  }
};

// Get transaction status
export const getTransactionStatus = async (txHash) => {
  try {
    const response = await fetch(`${API_BASE_URL}/txs/${txHash}`);
    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Transaction not found: ${data.error}`);
    }

    return {
      txHash: data.hash,
      confirmations: data.confirmations,
      blockHeight: data.block_height,
      total: data.total / 100000000,
      fees: data.fees / 100000000,
      status: data.confirmations > 0 ? 'confirmed' : 'pending'
    };
  } catch (error) {
    console.error('Failed to get transaction status:', error);
    throw new Error(`Status check failed: ${error.message}`);
  }
};

// ============================================================================
// MAIN TRANSFER FUNCTION (Unified Interface)
// ============================================================================

export const executeBitcoinTransfer = async (transferData, method = 'server-side') => {
  try {
    let result;
    
    switch (method) {
      case 'server-side':
        result = await createServerSideTransfer(transferData);
        break;
        
      case 'blockcypher':
        result = await createBlockCypherTransfer(transferData);
        break;
        
      case 'hardware-wallet':
        result = await createHardwareWalletTransfer(transferData);
        break;
        
      case 'coinbase-commerce':
        result = await createCoinbaseCommerceTransfer(transferData);
        break;
        
      case 'bitgo':
        result = await createBitGoTransfer(transferData);
        break;
        
      default:
        throw new Error(`Unknown transfer method: ${method}`);
    }
    
    return result;
  } catch (error) {
    throw error;
  }
};

// ============================================================================
// TRANSFER METHOD SELECTOR
// ============================================================================

export const getAvailableTransferMethods = () => {
  const methods = [
    {
      id: 'server-side',
      name: 'Server-Side Processing',
      description: 'Secure server-side transaction processing',
      requires: ['server-api'],
      recommended: true
    },
    {
      id: 'hardware-wallet',
      name: 'Hardware Wallet',
      description: 'Direct hardware wallet integration (Ledger/Trezor)',
      requires: ['hardware-wallet', 'webusb'],
      recommended: false
    },
    {
      id: 'coinbase-commerce',
      name: 'Coinbase Commerce',
      description: 'Third-party payment processing',
      requires: ['coinbase-api'],
      recommended: false
    },
    {
      id: 'bitgo',
      name: 'BitGo Enterprise',
      description: 'Enterprise-grade Bitcoin wallet service',
      requires: ['bitgo-api'],
      recommended: false
    }
  ];
  
  return methods.filter(method => {
    // Check if requirements are met
    if (method.requires.includes('server-api')) {
      // Check if server API is available
      return true; // Assume available for now
    }
    
    if (method.requires.includes('hardware-wallet')) {
      // Check if hardware wallet is connected
      return navigator.usb !== undefined;
    }
    
    if (method.requires.includes('coinbase-api')) {
      // Check if Coinbase API key is configured
      return !!TRANSFER_CONFIG.COINBASE.apiKey;
    }
    
    if (method.requires.includes('bitgo-api')) {
      // Check if BitGo API key is configured
      return !!TRANSFER_CONFIG.BITGO.apiKey;
    }
    
    return false;
  });
};
