/**
 * Combined load test scenarios for backend and indexer.
 *
 * Select a scenario via the SCENARIO environment variable:
 *   k6 run --env SCENARIO=smoke   load-tests/scenarios.js
 *   k6 run --env SCENARIO=load    load-tests/scenarios.js
 *   k6 run --env SCENARIO=stress  load-tests/scenarios.js
 *   k6 run --env SCENARIO=soak    load-tests/scenarios.js
 *
 * Default: load
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

const BACKEND_URL = __ENV.BACKEND_URL || 'http://localhost:3001';
const INDEXER_URL = __ENV.INDEXER_URL || 'http://localhost:4000';

const SCENARIO_STAGES = {
  smoke: [
    { duration: '1m', target: 1 },
  ],
  load: [
    { duration: '1m', target: 50 },
    { duration: '1m', target: 100 },
    { duration: '3m', target: 100 },
    { duration: '1m', target: 0 },
  ],
  stress: [
    { duration: '2m', target: 100 },
    { duration: '3m', target: 300 },
    { duration: '3m', target: 300 },
    { duration: '2m', target: 0 },
  ],
  soak: [
    { duration: '2m', target: 50 },
    { duration: '56m', target: 50 },
    { duration: '2m', target: 0 },
  ],
};

const scenario = __ENV.SCENARIO || 'load';
const stages = SCENARIO_STAGES[scenario];
if (!stages) {
  throw new Error(`Unknown SCENARIO "${scenario}". Valid values: smoke, load, stress, soak`);
}

export const options = {
  stages,
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    errors: ['rate<0.02'],
  },
};

const PROPOSAL_IDS = [1, 2, 3, 4, 5];

function randomId() {
  return PROPOSAL_IDS[Math.floor(Math.random() * PROPOSAL_IDS.length)];
}

export default function () {
  const id = randomId();

  // Backend requests
  const listRes = http.get(`${BACKEND_URL}/api/proposals`);
  errorRate.add(!check(listRes, { 'backend proposals 200': (r) => r.status === 200 }));

  const detailRes = http.get(`${BACKEND_URL}/api/proposals/${id}`);
  errorRate.add(!check(detailRes, { 'backend proposal detail ok': (r) => r.status === 200 || r.status === 404 }));

  sleep(0.5);

  // Indexer requests
  const eventsRes = http.get(`${INDEXER_URL}/events`);
  errorRate.add(!check(eventsRes, { 'indexer events 200': (r) => r.status === 200 }));

  const propEventsRes = http.get(`${INDEXER_URL}/events/proposals/${id}`);
  errorRate.add(!check(propEventsRes, { 'indexer proposal events ok': (r) => r.status === 200 || r.status === 404 }));

  const statsRes = http.get(`${INDEXER_URL}/stats/participation`);
  errorRate.add(!check(statsRes, { 'indexer participation 200': (r) => r.status === 200 }));

  sleep(1);
}
