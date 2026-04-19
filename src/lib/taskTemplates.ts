export type TaskTemplateShape = {
  key: string;
  title: string;
  description?: string;
  steps: string[];
  isSystem?: boolean;
};

export const SYSTEM_TASK_TEMPLATES: TaskTemplateShape[] = [
  {
    key: 'DATA_SCIENCE_PIPELINE',
    title: 'Data Science Pipeline',
    description: 'End-to-end analytics and model delivery workflow.',
    steps: ['Problem framing', 'Data collection', 'Model training', 'Validation', 'Deployment'],
    isSystem: true,
  },
  {
    key: 'PRODUCT_LAUNCH',
    title: 'Product Launch',
    description: 'Cross-functional release planning and rollout steps.',
    steps: ['Requirements', 'Build sprint', 'QA and UAT', 'Go-to-market', 'Post-launch review'],
    isSystem: true,
  },
  {
    key: 'CUSTOMER_ONBOARDING',
    title: 'Customer Onboarding',
    description: 'Standardized onboarding and enablement milestones.',
    steps: ['Kickoff call', 'Environment setup', 'Training', 'Pilot handover', 'Success checkpoint'],
    isSystem: true,
  },
  {
    key: 'NO_TEMPLATE',
    title: 'Blank Template',
    description: 'Create your own custom checklist from scratch.',
    steps: ['Create custom checklist', 'Define owner', 'Track progress'],
    isSystem: true,
  },
];

export function toTemplateKey(value: string) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_')
    .slice(0, 48);
}
