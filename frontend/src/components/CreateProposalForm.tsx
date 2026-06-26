import { useState } from 'react';
import { PROPOSAL_TEMPLATES, type ProposalTemplate } from '../utils/proposalTemplates';

interface FormValues {
  title: string;
  description: string;
  quorum: string;
  duration: string;
}

interface Props {
  /** Called with form values when the user submits. */
  onSubmit?: (values: FormValues) => void;
}

const EMPTY: FormValues = { title: '', description: '', quorum: '', duration: '' };

/**
 * Proposal creation form with pre-filled templates.
 *
 * Templates pre-fill title and description; users can then customise freely.
 * Selecting "Custom" clears both fields for a blank start.
 */
export default function CreateProposalForm({ onSubmit }: Props) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('custom');
  const [values, setValues] = useState<FormValues>(EMPTY);

  function applyTemplate(template: ProposalTemplate) {
    setSelectedTemplateId(template.id);
    setValues((prev) => ({
      ...prev,
      title: template.title,
      description: template.description,
    }));
  }

  function handleTemplateChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const template = PROPOSAL_TEMPLATES.find((t) => t.id === e.target.value);
    if (template) applyTemplate(template);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit?.(values);
  }

  return (
    <section aria-labelledby="create-proposal-heading" className="card">
      <div className="header">
        <div>
          <h2 id="create-proposal-heading">Create Proposal</h2>
          <p>Select a template to pre-fill common governance actions, or start from scratch.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {/* Template selector */}
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="template-select" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>
            Template
          </label>
          <select
            id="template-select"
            value={selectedTemplateId}
            onChange={handleTemplateChange}
            aria-describedby="template-help"
          >
            {PROPOSAL_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <p id="template-help" style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.25rem' }}>
            Templates pre-fill the title and description. You can edit them freely.
          </p>
        </div>

        {/* Quick-select template buttons */}
        <div className="nav-buttons" role="group" aria-label="Quick-select template" style={{ marginBottom: '1.25rem' }}>
          {PROPOSAL_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={selectedTemplateId === t.id ? 'active-tab' : ''}
              aria-pressed={selectedTemplateId === t.id}
              onClick={() => applyTemplate(t)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Title */}
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="proposal-title" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>
            Title <span aria-hidden="true">*</span>
          </label>
          <input
            id="proposal-title"
            name="title"
            type="text"
            value={values.title}
            onChange={handleChange}
            placeholder="Proposal title (max 128 characters)"
            maxLength={128}
            required
            aria-required="true"
            style={{ width: '100%' }}
          />
        </div>

        {/* Description */}
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="proposal-description" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>
            Description <span aria-hidden="true">*</span>
          </label>
          <textarea
            id="proposal-description"
            name="description"
            value={values.description}
            onChange={handleChange}
            placeholder="Describe the proposal (max 1024 characters)"
            maxLength={1024}
            required
            aria-required="true"
            rows={6}
            style={{ width: '100%', resize: 'vertical', background: '#0f172a', color: '#f8fafc', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.75rem', font: 'inherit' }}
          />
        </div>

        {/* Quorum */}
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="proposal-quorum" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>
            Quorum (minimum votes) <span aria-hidden="true">*</span>
          </label>
          <input
            id="proposal-quorum"
            name="quorum"
            type="number"
            value={values.quorum}
            onChange={handleChange}
            placeholder="e.g. 5000000"
            min={1}
            required
            aria-required="true"
          />
        </div>

        {/* Duration */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label htmlFor="proposal-duration" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>
            Voting duration (seconds) <span aria-hidden="true">*</span>
          </label>
          <input
            id="proposal-duration"
            name="duration"
            type="number"
            value={values.duration}
            onChange={handleChange}
            placeholder="e.g. 604800 (7 days)"
            min={60}
            required
            aria-required="true"
          />
        </div>

        <button type="submit" aria-label="Submit governance proposal">Submit Proposal</button>
      </form>
    </section>
  );
}
