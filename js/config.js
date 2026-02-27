// Configuration module - API key and settings management
// This file reads configuration from multiple secure sources

/**
 * Get API Key from secure sources (priority order)
 * 1. localStorage (user manually saved)
 * 2. window.__ENV__ (from .env.local, dev environment)
 * 3. undefined (not set)
 *
 * Never stores plaintext API key in code
 */
function getApiKeyFromSecureSources() {
  // Source 1: Browser localStorage (user manually set)
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem('openrouter_api_key');
    if (stored) {
      console.log('✅ API Key loaded from browser storage');
      return stored;
    }
  }

  // Source 2: Environment variable (development)
  if (typeof window !== 'undefined' && window.__ENV__) {
    const envKey = window.__ENV__.OPENROUTER_API_KEY;
    if (envKey) {
      console.log('✅ API Key loaded from environment');
      return envKey;
    }
  }

  // Source 3: Not set
  console.warn('⚠️ API Key not configured - AI will use local fallback strategy');
  return null;
}

/**
 * Save API Key to localStorage for persistence
 * @param {string} apiKey - The API key to save
 */
function saveApiKeyToStorage(apiKey) {
  if (typeof localStorage !== 'undefined' && apiKey) {
    localStorage.setItem('openrouter_api_key', apiKey);
    console.log('💾 API Key saved to browser storage');
  }
}

/**
 * Clear API Key from localStorage
 */
function clearApiKeyFromStorage() {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('openrouter_api_key');
    console.log('🗑️ API Key cleared from browser storage');
  }
}

/**
 * Check if API Key is configured
 * @returns {boolean} True if API key is available
 */
function isApiKeyConfigured() {
  return !!getApiKeyFromSecureSources();
}

// Export for Node.js (testing)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getApiKeyFromSecureSources,
    saveApiKeyToStorage,
    clearApiKeyFromStorage,
    isApiKeyConfigured
  };
}
