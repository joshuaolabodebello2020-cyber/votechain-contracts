import { useState } from 'react';
import ProposalList from './components/ProposalList';
import VoteHistory from './components/VoteHistory';
import { sampleProposals } from './data';

const pages = [
  { key: 'proposals', label: 'Proposal listing' },
  { key: 'votes', label: 'Vote history' }
] as const;

export default function App() {
  const [page, setPage] = useState<(typeof pages)[number]['key']>('proposals');

  return (
    <main className="container" aria-label="VoteChain governance dashboard">
      <header className="header">
        <div>
          <p>VoteChain governance dashboard</p>
          <h1>Proposal search, vote history, and accessibility-ready UI</h1>
        </div>
        <nav className="nav-buttons" aria-label="Main navigation">
          {pages.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={page === tab.key ? 'active-tab' : ''}
              onClick={() => setPage(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>
      {page === 'proposals' ? <ProposalList proposals={sampleProposals} /> : <VoteHistory proposals={sampleProposals} />}
    </main>
  );
}
