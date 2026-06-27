import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

const BASE_URL = __ENV.BACKEND_URL || 'http://localhost:3001';

export const options = {
  stages: [
    { duration: '1m', target: 50 },   // ramp up to 50 VUs
    { duration: '30s', target: 100 },  // ramp up to 100 VUs
    { duration: '2m', target: 100 },   // steady state
    { duration: '30s', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // p95 < 500ms
    errors: ['rate<0.01'],             // error rate < 1%
  },
};

// Proposal IDs to exercise the detail endpoint
const PROPOSAL_IDS = [1, 2, 3, 4, 5];

export default function () {
  // GET /api/proposals
  const listRes = http.get(`${BASE_URL}/api/proposals`);
  const listOk = check(listRes, {
    'proposals list status 200': (r) => r.status === 200,
    'proposals list has body': (r) => r.body && r.body.length > 0,
  });
  errorRate.add(!listOk);

  sleep(0.5);

  // GET /api/proposals/:id  — pick a random ID from the set
  const id = PROPOSAL_IDS[Math.floor(Math.random() * PROPOSAL_IDS.length)];
  const detailRes = http.get(`${BASE_URL}/api/proposals/${id}`);
  const detailOk = check(detailRes, {
    'proposal detail status 200 or 404': (r) => r.status === 200 || r.status === 404,
  });
  errorRate.add(!detailOk);

  sleep(1);
}
