export interface ProposalTemplate {
  id: string;
  label: string;
  title: string;
  description: string;
}

export const PROPOSAL_TEMPLATES: ProposalTemplate[] = [
  {
    id: 'treasury-allocation',
    label: 'Treasury Allocation',
    title: 'Allocate [AMOUNT] tokens from treasury to [PURPOSE]',
    description:
      'This proposal requests the allocation of [AMOUNT] governance tokens from the community treasury to [PURPOSE].\n\n' +
      'Rationale: [Explain why this allocation is needed and how it benefits the community.]\n\n' +
      'Requested amount: [AMOUNT] tokens\n' +
      'Recipient: [ADDRESS or ENTITY]\n' +
      'Timeline: [Expected completion date]',
  },
  {
    id: 'parameter-change',
    label: 'Parameter Change',
    title: 'Update [PARAMETER_NAME] from [OLD_VALUE] to [NEW_VALUE]',
    description:
      'This proposal requests a change to the governance parameter [PARAMETER_NAME].\n\n' +
      'Current value: [OLD_VALUE]\n' +
      'Proposed value: [NEW_VALUE]\n\n' +
      'Rationale: [Explain why this change improves the protocol and what risks have been considered.]\n\n' +
      'Expected impact: [Describe the effect on governance participants and the protocol.]',
  },
  {
    id: 'team-election',
    label: 'Team Election',
    title: 'Elect [CANDIDATE_NAME] as [ROLE]',
    description:
      'This proposal nominates [CANDIDATE_NAME] for the role of [ROLE] in the VoteChain governance team.\n\n' +
      'Candidate background: [Brief bio and relevant experience]\n\n' +
      'Responsibilities: [List key duties of the role]\n\n' +
      'Term length: [Duration]\n' +
      'Compensation: [If applicable]\n\n' +
      'Candidate statement: [Optional message from the candidate]',
  },
  {
    id: 'custom',
    label: 'Custom',
    title: '',
    description: '',
  },
];
