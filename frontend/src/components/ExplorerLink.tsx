import React from 'react';
import { explorerLinkProps, getAddressUrl, getTxUrl } from '../utils/stellarExplorer';

type Network = 'testnet' | 'mainnet';

interface ExplorerLinkProps {
  value: string;
  type: 'tx' | 'address';
  network?: Network;
  children?: React.ReactNode;
}

export function ExplorerLink({ value, type, network = 'testnet', children }: ExplorerLinkProps) {
  const url = type === 'tx' ? getTxUrl(value, network) : getAddressUrl(value, network);
  return (
    <a {...explorerLinkProps(url)}>
      {children ?? value}
    </a>
  );
}
