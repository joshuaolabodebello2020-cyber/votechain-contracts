/**
 * Utilities for validating and checking Stellar RPC endpoints.
 */

import type { Network } from '../store';

export interface RpcValidationResult {
  isValid: boolean;
  isSecure: boolean;
  error?: string;
}

/**
 * Validate an RPC URL for basic validity and security.
 */
export function validateRpcUrl(url: string): RpcValidationResult {
  try {
    const parsedUrl = new URL(url);
    const isSecure = parsedUrl.protocol === 'https:';
    const isValidHost = !!parsedUrl.hostname.length > 0;

    if (!isValidHost) {
      return {
        isValid: false,
        isSecure: false,
        error: 'Invalid URL must have a valid hostname',
      };
    }

    // In production, enforce HTTPS except for localhost in development
    const isLocalhost =
      parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1';
    const isDev = import.meta.env.DEV;

    if (!isSecure && !(isLocalhost && isDev)) {
      return {
        isValid: true,
        isSecure: false,
        error: 'Insecure connection: please use HTTPS for production environments',
      };
    }

    return { isValid: true, isSecure: true };
  } catch (e) {
    return {
      isValid: false, isSecure: false, error: 'Invalid URL format' };
  }
}

/**
 * Check if an RPC endpoint is reachable.
 */
export async function checkRpcHealth(rpcUrl: string): Promise<boolean> {
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getHealth',
        params: {},
      }),
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export { Network }
