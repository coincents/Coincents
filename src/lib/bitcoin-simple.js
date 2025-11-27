// Simplified Bitcoin implementation for production deployment
// This avoids WebAssembly issues while still providing core functionality

const API_BASE_URL = 'https://api.blockcypher.com/v1/btc/main';

// Get Bitcoin balance for an address
export const getBitcoinBalance = async (address) => {
  try {
    const response = await fetch(`${API_BASE_URL}/addrs/${address}/balance`);
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    return data.balance / 100000000; // Convert satoshis to BTC
  } catch (error) {
    console.error('Error fetching Bitcoin balance:', error);
    throw new Error('Failed to fetch Bitcoin balance');
  }
};

// Get UTXOs for a Bitcoin address
export const getUTXOs = async (address) => {
  try {
    const response = await fetch(`${API_BASE_URL}/addrs/${address}?unspentOnly=true`);
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    return data.txrefs || [];
  } catch (error) {
    console.error('Error fetching UTXOs:', error);
    throw new Error('Failed to fetch UTXOs');
  }
};

// Validate Bitcoin address format (improved validation)
export const isValidBitcoinAddress = (address) => {
  try {
    if (!address || typeof address !== 'string') {
      return false;
    }

    const trimmedAddress = address.trim();

    // Check for valid Bitcoin address prefixes
    const validPrefixes = ['1', '3', 'bc1'];
    const hasValidPrefix = validPrefixes.some(prefix => trimmedAddress && typeof trimmedAddress === 'string' && trimmedAddress.startsWith(prefix));

    if (!hasValidPrefix) {
      return false;
    }

    // Check length (basic validation)
    if (trimmedAddress.length < 26 || trimmedAddress.length > 90) {
      return false;
    }

    // Legacy and P2SH addresses
    if (trimmedAddress && typeof trimmedAddress === 'string' && (trimmedAddress.startsWith('1') || trimmedAddress.startsWith('3'))) {
      const legacyPattern = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
      return legacyPattern.test(trimmedAddress);
    }

    // Bech32 addresses
    if (trimmedAddress && typeof trimmedAddress === 'string' && trimmedAddress.startsWith('bc1')) {
      const bech32Pattern = /^bc1[a-z0-9]{39,59}$/;
      return bech32Pattern.test(trimmedAddress);
    }

    return false;
  } catch (error) {
    return false;
  }
};

// Get transaction details
export const getTransactionDetails = async (txid) => {
  try {
    const response = await fetch(`${API_BASE_URL}/txs/${txid}`);
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }
    
    return {
      txid: data.hash,
      confirmations: data.confirmations,
      block_height: data.block_height,
      total: data.total / 100000000,
      fees: data.fees / 100000000,
      inputs: data.inputs,
      outputs: data.outputs
    };
  } catch (error) {
    console.error('Error fetching transaction details:', error);
    throw new Error('Failed to fetch transaction details');
  }
};

// Estimate transaction fee
export const estimateTransactionFee = (inputCount, outputCount) => {
  // Rough estimation: 1 input = 148 bytes, 1 output = 34 bytes
  const estimatedSize = (inputCount * 148) + (outputCount * 34) + 10;
  const feeRate = 10; // satoshis per byte (adjust based on network conditions)
  return estimatedSize * feeRate;
};

// Generate a mock Bitcoin address (for demonstration)
export const generateMockBitcoinAddress = () => {
  const prefixes = ['bc1', '1', '3'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let address = prefix;
  
  for (let i = 0; i < 30; i++) {
    address += chars[Math.floor(Math.random() * chars.length)];
  }
  
  return address;
};

// Test Bitcoin address validation
export const testBitcoinAddress = (address) => {
  return isValidBitcoinAddress(address);
};

// More lenient validation for testing purposes
export const isValidBitcoinAddressLenient = (address) => {
  try {
    if (!address || typeof address !== 'string') {
      return false;
    }
    
    const trimmedAddress = address.trim();
    
    // Just check for valid prefixes and reasonable length
    const validPrefixes = ['1', '3', 'bc1'];
    const hasValidPrefix = validPrefixes.some(prefix => trimmedAddress && typeof trimmedAddress === 'string' && trimmedAddress.startsWith(prefix));
    
    if (!hasValidPrefix) {
      return false;
    }
    
    // More lenient length check
    if (trimmedAddress.length < 20 || trimmedAddress.length > 100) {
      return false;
    }
    
    // Basic character check - allow most alphanumeric characters
    const basicPattern = /^[13][a-zA-Z0-9]{20,}$|^bc1[a-z0-9]{20,}$/;
    return basicPattern.test(trimmedAddress);
  } catch (error) {
    return false;
  }
};
