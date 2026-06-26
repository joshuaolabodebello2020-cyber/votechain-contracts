import React, { useState, useEffect } from "react";
import type { Proposal, ProposalState } from "../types";

// Mock admin address for demonstration - in production, fetch from contract
const ADMIN_ADDRESS = "GABC...ADMIN";

interface Props {
  connectedAddress: string | null;
  proposals: Proposal[];
  contractPaused: boolean;
  onPauseToggle: () => void;
  onCancelProposal: (id: string) => void;
  onExecuteProposal: (id: string) => void;
  onUpdateQuorum: (id: string, newQuorum: number) => void;
}

export default function AdminPanel({
  connectedAddress,
  proposals,
  contractPaused,
  onPauseToggle,
  onCancelProposal,
  onExecuteProposal,
  onUpdateQuorum,
}: Props) {
  const [newQuorumMap, setNewQuorumMap] = useState<Record<string, number>>({});

  if (connectedAddress !== ADMIN_ADDRESS) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
        <h2>Access Denied</h2>
        <p>This panel is only accessible to the contract administrator.</p>
        <p>Connected: {connectedAddress || "No wallet connected"}</p>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <section className="card" style={{ marginBottom: "2rem" }}>
        <div className="header">
          <h2>Contract Management</h2>
          <button
            onClick={onPauseToggle}
            className={contractPaused ? "btn-success" : "btn-danger"}
          >
            {contractPaused ? "Unpause Contract" : "Pause Contract"}
          </button>
        </div>
        <p>
          Status: <strong>{contractPaused ? "PAUSED" : "ACTIVE"}</strong>
        </p>
        <p className="hint">
          Pausing the contract blocks all state-changing operations (voting, creating proposals, etc.).
        </p>
      </section>

      <section className="card">
        <h2>Active & Passed Proposals</h2>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>State</th>
                <th>Quorum</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {proposals
                .filter((p) => ["Active", "Passed"].includes(p.state))
                .map((p) => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{p.title}</td>
                    <td>
                      <span className={`status-chip status-${p.state.toLowerCase()}`}>
                        {p.state}
                      </span>
                    </td>
                    <td>
                      {p.state === "Active" ? (
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                          <input
                            type="number"
                            value={newQuorumMap[p.id] ?? p.totalWeight} // Using totalWeight as proxy for current quorum in this mock
                            onChange={(e) =>
                              setNewQuorumMap({
                                ...newQuorumMap,
                                [p.id]: parseInt(e.target.value),
                              })
                            }
                            style={{ width: "100px" }}
                          />
                          <button
                            onClick={() => onUpdateQuorum(p.id, newQuorumMap[p.id])}
                            disabled={!newQuorumMap[p.id]}
                          >
                            Update
                          </button>
                        </div>
                      ) : (
                        "N/A"
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        {p.state === "Active" && (
                          <button
                            className="btn-danger btn-sm"
                            onClick={() => onCancelProposal(p.id)}
                          >
                            Cancel
                          </button>
                        )}
                        {p.state === "Passed" && (
                          <button
                            className="btn-success btn-sm"
                            onClick={() => onExecuteProposal(p.id)}
                          >
                            Execute
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
