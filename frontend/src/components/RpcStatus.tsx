import React from 'react';
import { useNetworkStore, type NetworkConfig, NETWORK_CONFIGS } from '../store';

export const RpcStatus: React.FC = () => {
  const { config, rpcValidation, rpcHealthy, rpcLoading, setNetwork, setCustomRpc } = useNetworkStore();

  const [showCustom, setShowCustom] = React.useState(false);
  const [customUrl, setCustomUrl] = React.useState(config.rpcUrl);
  const [customPassphrase, setCustomPassphrase] = React.useState(config.passphrase);

  // Validate on mount
  React.useEffect(() => {
    const initialConfig = useNetworkStore.getState().config;
    useNetworkStore.getState().validateAndCheckRpc(initialConfig);
  }, []);

  const handleSaveCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    const customConfig: NetworkConfig = {
      network: config.network,
      rpcUrl: customUrl,
      passphrase: customPassphrase,
    };
    await setCustomRpc(customConfig);
    setShowCustom(false);
  };

  return (
    <div style={{
      padding: '1rem',
      marginBottom: '1rem',
      borderRadius: '0.5rem',
      border: '1px solid var(--color-border)',
      background: 'var(--color-surface-2)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <div>
          <h3 style={{ margin: 0, color: 'var(--color-text)' }}>Network Status</h3>
          <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            Current: {config.network} ({config.rpcUrl})
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => setShowCustom(!showCustom)}
            style={{ padding: '0.25rem 0.5rem', borderRadius: '0.25rem', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', cursor: 'pointer' }}
          >
            {showCustom ? 'Hide Custom' : 'Custom RPC'}
          </button>
          {Object.keys(NETWORK_CONFIGS).map((net) => (
            <button
              key={net}
              type="button"
              onClick={() => setNetwork(net as keyof typeof NETWORK_CONFIGS)}
              style={{ padding: '0.25rem 0.5rem', borderRadius: '0.25rem', border: config.network === net ? '2px solid var(--color-primary)' : '1px solid var(--color-border)', background: config.network === net ? 'var(--color-primary)' : 'var(--color-surface)', color: config.network === net ? 'var(--color-primary-text)' : 'var(--color-text)', cursor: 'pointer' }}
            >
              {net}
            </button>
          ))}
        </div>
      </div>

      {showCustom && (
        <form onSubmit={handleSaveCustom} style={{ marginBottom: '1rem', padding: '0.5rem 0', borderTop: '1px solid var(--color-border)' }}>
          <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <label>
              RPC URL
              <input
                type="url"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
              />
            </label>
            <label>
              Network Passphrase
              <input
                type="text"
                value={customPassphrase}
                onChange={(e) => setCustomPassphrase(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
              />
            </label>
            <button type="submit" style={{ padding: '0.5rem 1rem', background: 'var(--color-primary)', color: 'var(--color-primary-text)', border: 'none', borderRadius: '0.25rem', cursor: 'pointer' }}>
              Save Custom Config
            </button>
          </div>
        </form>
      )}

      {rpcLoading && (
        <div style={{ padding: '0.5rem', color: 'var(--color-text)', background: 'var(--color-surface)', borderRadius: '0.25rem' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="spinner" /> Validating and checking RPC health...
          </span>
        </div>
      )}

      {rpcValidation && (
        <div style={{
          padding: '0.5rem',
          borderRadius: '0.25rem',
          background:
            rpcValidation.isValid && rpcHealthy
              ? 'var(--badge-active-bg)'
              : 'var(--badge-rejected-bg)',
          color:
            rpcValidation.isValid && rpcHealthy
              ? 'var(--badge-active-fg)'
              : 'var(--badge-rejected-fg)',
        }}>
          <strong>
            {rpcValidation.isValid && rpcHealthy
              ? '✓ RPC valid, healthy, and secure'
              : '⚠️ RPC Issue'}
          </strong>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem' }}>
            {rpcValidation.error || `RPC health: ${rpcHealthy ? 'healthy' : 'unhealthy'}`}
          </p>
        </div>
      )}
    </div>
  );
};
