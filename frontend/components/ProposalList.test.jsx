/**
 * TEST-009: Unit tests for the ProposalList component.
 * Covers rendering, filtering, and pagination.
 *
 * Run with: npx jest frontend/components/ProposalList.test.jsx
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProposalList, PAGE_SIZE } from "./ProposalList";

// ── fixtures ──────────────────────────────────────────────────────────────────

function makeProposal(id, state = "Active") {
  return {
    id,
    title: `Proposal ${id}`,
    description: `Description ${id}`,
    state,
    votes_yes: 0,
    votes_no: 0,
    votes_abstain: 0,
    quorum: 100,
    end_time: 9999999999,
  };
}

const STATES = ["Active", "Passed", "Rejected", "Executed", "Cancelled"];

// ── rendering ─────────────────────────────────────────────────────────────────

test("renders without crashing with no proposals", () => {
  render(<ProposalList />);
  expect(screen.getByTestId("proposal-list")).toBeInTheDocument();
});

test("shows empty message when proposals array is empty", () => {
  render(<ProposalList proposals={[]} />);
  expect(screen.getByTestId("empty-message")).toBeInTheDocument();
});

test("renders all proposals when count is below page size", () => {
  const proposals = [1, 2, 3].map((i) => makeProposal(i));
  render(<ProposalList proposals={proposals} />);
  expect(screen.getByTestId("proposal-items").children).toHaveLength(3);
});

test("renders title and state for each visible proposal", () => {
  const proposals = [makeProposal(1, "Active"), makeProposal(2, "Passed")];
  render(<ProposalList proposals={proposals} />);
  expect(screen.getByTestId("proposal-1-title")).toHaveTextContent("Proposal 1");
  expect(screen.getByTestId("proposal-1-state")).toHaveTextContent("Active");
  expect(screen.getByTestId("proposal-2-state")).toHaveTextContent("Passed");
});

test("renders filter buttons for all states including All", () => {
  render(<ProposalList proposals={[]} />);
  ["All", ...STATES].forEach((s) => {
    expect(screen.getByTestId(`filter-${s}`)).toBeInTheDocument();
  });
});

// ── filtering ─────────────────────────────────────────────────────────────────

test("All filter shows every proposal", () => {
  const proposals = STATES.map((s, i) => makeProposal(i + 1, s));
  render(<ProposalList proposals={proposals} />);
  expect(screen.getByTestId("proposal-items").children).toHaveLength(STATES.length);
});

test("filtering by Active shows only Active proposals", () => {
  const proposals = [
    makeProposal(1, "Active"),
    makeProposal(2, "Passed"),
    makeProposal(3, "Active"),
  ];
  render(<ProposalList proposals={proposals} />);
  fireEvent.click(screen.getByTestId("filter-Active"));
  expect(screen.getByTestId("proposal-items").children).toHaveLength(2);
  expect(screen.getByTestId("proposal-1-state")).toBeInTheDocument();
  expect(screen.getByTestId("proposal-3-state")).toBeInTheDocument();
});

test("filtering by Passed shows only Passed proposals", () => {
  const proposals = [
    makeProposal(1, "Active"),
    makeProposal(2, "Passed"),
    makeProposal(3, "Rejected"),
  ];
  render(<ProposalList proposals={proposals} />);
  fireEvent.click(screen.getByTestId("filter-Passed"));
  expect(screen.getByTestId("proposal-items").children).toHaveLength(1);
  expect(screen.getByTestId("proposal-2-state")).toHaveTextContent("Passed");
});

test("filter with no matches shows empty message", () => {
  const proposals = [makeProposal(1, "Active")];
  render(<ProposalList proposals={proposals} />);
  fireEvent.click(screen.getByTestId("filter-Executed"));
  expect(screen.getByTestId("empty-message")).toBeInTheDocument();
});

test("active filter button has aria-pressed=true", () => {
  render(<ProposalList proposals={[]} />);
  fireEvent.click(screen.getByTestId("filter-Active"));
  expect(screen.getByTestId("filter-Active")).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByTestId("filter-All")).toHaveAttribute("aria-pressed", "false");
});

test("switching filter resets to first page", () => {
  const proposals = Array.from({ length: PAGE_SIZE + 2 }, (_, i) =>
    makeProposal(i + 1, "Active")
  );
  render(<ProposalList proposals={proposals} />);
  // go to page 2
  fireEvent.click(screen.getByTestId("next-page"));
  expect(screen.getByTestId("page-indicator")).toHaveTextContent("2 /");
  // switch filter — should reset to page 1
  fireEvent.click(screen.getByTestId("filter-Active"));
  expect(screen.getByTestId("page-indicator")).toHaveTextContent("1 /");
});

// ── pagination ────────────────────────────────────────────────────────────────

test("shows only PAGE_SIZE proposals on first page", () => {
  const proposals = Array.from({ length: PAGE_SIZE + 3 }, (_, i) =>
    makeProposal(i + 1)
  );
  render(<ProposalList proposals={proposals} />);
  expect(screen.getByTestId("proposal-items").children).toHaveLength(PAGE_SIZE);
});

test("Prev button is disabled on first page", () => {
  const proposals = Array.from({ length: PAGE_SIZE + 1 }, (_, i) =>
    makeProposal(i + 1)
  );
  render(<ProposalList proposals={proposals} />);
  expect(screen.getByTestId("prev-page")).toBeDisabled();
});

test("Next button is disabled on last page", () => {
  const proposals = Array.from({ length: PAGE_SIZE }, (_, i) =>
    makeProposal(i + 1)
  );
  render(<ProposalList proposals={proposals} />);
  expect(screen.getByTestId("next-page")).toBeDisabled();
});

test("clicking Next advances to page 2 and shows remaining proposals", () => {
  const total = PAGE_SIZE + 2;
  const proposals = Array.from({ length: total }, (_, i) => makeProposal(i + 1));
  render(<ProposalList proposals={proposals} />);
  fireEvent.click(screen.getByTestId("next-page"));
  expect(screen.getByTestId("proposal-items").children).toHaveLength(2);
  expect(screen.getByTestId("page-indicator")).toHaveTextContent("2 / 2");
});

test("clicking Prev returns to page 1", () => {
  const proposals = Array.from({ length: PAGE_SIZE + 1 }, (_, i) =>
    makeProposal(i + 1)
  );
  render(<ProposalList proposals={proposals} />);
  fireEvent.click(screen.getByTestId("next-page"));
  fireEvent.click(screen.getByTestId("prev-page"));
  expect(screen.getByTestId("page-indicator")).toHaveTextContent("1 / 2");
  expect(screen.getByTestId("proposal-items").children).toHaveLength(PAGE_SIZE);
});

test("page indicator shows correct total pages", () => {
  const proposals = Array.from({ length: PAGE_SIZE * 3 }, (_, i) =>
    makeProposal(i + 1)
  );
  render(<ProposalList proposals={proposals} />);
  expect(screen.getByTestId("page-indicator")).toHaveTextContent("1 / 3");
});

test("single proposal shows 1/1 page indicator", () => {
  render(<ProposalList proposals={[makeProposal(1)]} />);
  expect(screen.getByTestId("page-indicator")).toHaveTextContent("1 / 1");
});
