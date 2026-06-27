import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

const BASE_URL = __ENV.INDEXER_URL || 'http://localhost:4000';

export const options = {
  stages: [
    { duration: '1m', target: 50 },   // ramp up to 50 VUs
    { duration: '30s', target: 100 },  // ramp up to 100 VUs
    { duration: '2m', target: 100 },   // steady state
    { duration: '30s', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // p95 < 1000ms
    errors: ['rate<0.02'],             // error rate < 2%
  },
};

const PROPOSAL_IDS = [1, 2, 3, 4, 5];

export default function () {
  // GET /events
  const eventsRes = http.get(`${BASE_URL}/events`);
  const eventsOk = check(eventsRes, {
    'events list status 200': (r) => r.status === 200,
  });
  errorRate.add(!eventsOk);

  sleep(0.5);

  // GET /events/proposals/:id
  const id = PROPOSAL_IDS[Math.floor(Math.random() * PROPOSAL_IDS.length)];
  const proposalEventsRes = http.get(`${BASE_URL}/events/proposals/${id}`);
  const proposalEventsOk = check(proposalEventsRes, {
    'proposal events status 200 or 404': (r) => r.status === 200 || r.status === 404,
  });
  errorRate.add(!proposalEventsOk);

  sleep(0.5);

  // GET /stats/participation
  const statsRes = http.get(`${BASE_URL}/stats/participation`);
  const statsOk = check(statsRes, {
    'participation stats status 200': (r) => r.status === 200,
  });
  errorRate.add(!statsOk);

  sleep(1);
}
