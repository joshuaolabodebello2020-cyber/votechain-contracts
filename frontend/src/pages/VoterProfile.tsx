import React from "react";
import type { Proposal, VoteRecord } from "../types";

interface Props {
  address: string;
  votes: { proposalId: string; voteType: string; weight: number; date: string }[];
  proposals: Proposal[];
}

export default function VoterProfile({ address, votes, proposals }: Props) {
  const participationRate = proposals.length > 0 ? (votes.length / proposals.length) * 100 : 0;
  
  // Simple streak calculation: how many of the last N proposals did they vote on?
  // For demonstration, let's say it's just the count of votes if they are recent.
  const streak = votes.length; 

  return (
    <div className="voter-profile">
      <section className="card" style={{ marginBottom: "2rem" }}>
        <h2>Voter Profile</h2>
        <p style={{ fontSize: "1.1rem", fontFamily: "monospace", color: "#42a5f5" }}>{address}</p>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
          <div className="stat-box" style={statBoxStyle}>
            <span style={statLabelStyle}>Participation Rate</span>
            <span style={statValueStyle}>{participationRate.toFixed(1)}%</span>
          </div>
          <div className="stat-box" style={statBoxStyle}>
            <span style={statLabelStyle}>Voting Streak</span>
            <span style={statValueStyle}>{streak} 🔥</span>
          </div>
        </div>
      </section>

      <section className="card">
        <h3>Participation History</h3>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Proposal ID</th>
                <th>Title</th>
                <th>Your Vote</th>
                <th>Weight</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {votes.map((v) => {
                const p = proposals.find((prop) => prop.id === v.proposalId);
                return (
                  <tr key={v.proposalId}>
                    <td>{v.proposalId}</td>
                    <td>{p?.title || "Unknown Proposal"}</td>
                    <td>
                      <span className={`status-chip status-${v.voteType.toLowerCase()}`}>
                        {v.voteType}
                      </span>
                    </td>
                    <td>{v.weight.toLocaleString()}</td>
                    <td>{v.date}</td>
                  </tr>
                );
              })}
              {votes.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center" }}>No voting history found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const statBoxStyle: React.CSSProperties = {
  background: "#2a2a2a",
  padding: "1rem",
  borderRadius: "8px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};

const statLabelStyle: React.CSSProperties = {
  fontSize: "0.9rem",
  color: "#888",
  marginBottom: "0.5rem",
};

const statValueStyle: React.CSSProperties = {
  fontSize: "1.5rem",
  fontWeight: "bold",
  color: "#fff",
};
