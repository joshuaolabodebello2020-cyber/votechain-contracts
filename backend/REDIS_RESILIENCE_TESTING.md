# Redis Resilience Testing Documentation

## Overview

This document describes the Redis resilience testing approach for the VoteChain backend, validating behavior during Redis outages and recovery scenarios.

## Test Coverage

### 1. Connection Failure During Startup

**Scenario**: Redis is unavailable when the backend starts.

**Expected Behavior**:
- Health check endpoint returns 503 with `redis: "down"`
- Backend continues serving requests in degraded mode
- No crash or startup failure
- Cache operations are gracefully skipped

**Test Cases**:
- `health check returns 503 when Redis is unavailable`
- `health check returns 200 when Redis is available`
- `backend continues serving requests when Redis fails during startup`

---

### 2. Degraded Mode Operation

**Scenario**: Redis becomes unavailable during normal operation.

**Expected Behavior**:
- All endpoints continue to respond
- Cache misses are logged appropriately
- No data corruption occurs
- Cache metrics reflect misses

**Test Cases**:
- `serves proposal data without cache when Redis is down`
- `cache metrics show misses when Redis is unavailable`
- `does not crash when attempting to cache during outage`

---

### 3. Redis Outage During Active Operations

**Scenario**: Redis fails while cache operations are in progress.

**Expected Behavior**:
- Cache read failures are handled gracefully
- Cache write failures don't affect response delivery
- Cache invalidation failures don't block operations
- Errors are logged but don't propagate to clients

**Test Cases**:
- `handles cache read failure gracefully`
- `handles cache write failure gracefully`
- `handles cache invalidation failure gracefully`

---

### 4. Redis Recovery and State Validation

**Scenario**: Redis reconnects after an outage.

**Expected Behavior**:
- Health check detects recovery
- Cache operations resume normally
- No state corruption occurs
- Previous cache state is preserved
- New cache entries can be written

**Test Cases**:
- `successfully reconnects after outage`
- `cache operations work correctly after recovery`
- `state is not corrupted after recovery`
- `can write new cache entries after recovery`

---

### 5. Concurrent Operations During Outage

**Scenario**: Multiple requests arrive during a Redis outage.

**Expected Behavior**:
- All requests are handled without race conditions
- No request starvation occurs
- System remains stable under load
- Cache operations are safely skipped

**Test Cases**:
- `handles concurrent requests during outage`
- `handles mixed read/write operations during outage`

---

### 6. Edge Cases

#### Rapid Connect/Disconnect Cycles
**Scenario**: Redis connection state changes rapidly.

**Expected Behavior**:
- System handles state transitions correctly
- No memory leaks or resource exhaustion
- Consistent health check responses

**Test Case**: `handles rapid connect/disconnect cycles`

#### Partial Failures
**Scenario**: Some Redis operations fail while others succeed.

**Expected Behavior**:
- System continues operating
- Failed operations are logged
- Successful operations complete

**Test Case**: `handles partial failure (some operations succeed, others fail)`

#### Timeout Scenarios
**Scenario**: Redis operations timeout.

**Expected Behavior**:
- Requests don't hang indefinitely
- Timeout errors are handled gracefully
- Backend continues serving other requests

**Test Case**: `handles timeout scenarios`

#### Cache Metrics Accuracy
**Scenario**: Cache metrics must remain accurate across outages.

**Expected Behavior**:
- Metrics increment correctly during outage
- Metrics reflect actual cache behavior
- No metric corruption occurs

**Test Case**: `cache metrics remain accurate after outage`

---

### 7. Redis Client Retry Behavior

**Scenario**: Redis client attempts to reconnect with retry strategy.

**Expected Behavior**:
- Connection attempts are tracked
- Retry delays follow exponential backoff
- Max retries are respected
- Retry strategy eventually gives up

**Test Cases**:
- `tracks connection attempts during retry`
- `stops retrying after max attempts`

---

## Current Redis Implementation Details

### Retry Strategy
- **Max Retries**: 5 attempts
- **Retry Delays**: [100ms, 200ms, 400ms, 800ms, 1600ms] (exponential backoff)
- **Behavior**: Stops retrying after max attempts, logs error

### Error Handling
- Connection errors are logged to console
- Cache operations wrap errors in try-catch
- Failed operations don't crash the server
- Health check reflects Redis status

### Health Check
- **Endpoint**: `GET /health`
- **Healthy**: Redis responds to PING (status 200)
- **Unhealthy**: Redis unavailable (status 503)
- **Response Body**: `{ status: "healthy"|"unhealthy", redis: "up"|"down" }`

---

## Running the Tests

```bash
# Run all Redis resilience tests
cd backend
npm test -- redisResilience.test.ts

# Run with coverage
npm test -- --coverage redisResilience.test.ts

# Run in watch mode
npm test -- --watch redisResilience.test.ts
```

---

## Test Infrastructure

The tests use a sophisticated mock that simulates:

- **Connection State**: `isOpen` property reflects connection status
- **Outage Simulation**: `shouldFail` flag triggers errors
- **Data Store**: In-memory Map simulates Redis key-value storage
- **Connection Tracking**: Counts connection attempts for retry validation
- **Event Simulation**: Emits error events when appropriate

### Mock Functions

- `get(key)`: Simulates Redis GET, throws if `shouldFail` is true
- `setEx(key, ttl, value)`: Simulates Redis SETEX, throws if `shouldFail` is true
- `del(keys)`: Simulates Redis DEL, throws if `shouldFail` is true
- `keys(pattern)`: Simulates Redis KEYS, throws if `shouldFail` is true
- `ping()`: Simulates Redis PING, throws if `shouldFail` is true
- `connect()`: Simulates connection, throws if `shouldFail` is true
- `disconnect()` / `quit()`: Simulates disconnection

---

## Acceptance Criteria Coverage

✅ **Tests simulate Redis outage and recovery**
- All outage scenarios are simulated via mock
- Recovery scenarios test state validation

✅ **Backend responds with appropriate errors or degraded mode**
- Health check returns 503 during outage
- Endpoints continue serving in degraded mode
- Errors are logged but not propagated

✅ **Recovery does not corrupt state**
- State validation tests verify data integrity
- Cache metrics remain accurate
- Previous cache entries are preserved

✅ **Edge cases are documented**
- All edge cases are documented in this file
- Each edge case has corresponding test coverage

---

## Known Limitations

1. **Mock vs Real Redis**: Tests use mocks, not actual Redis instances. For integration testing with real Redis, consider using Docker Compose setup.

2. **Network Latency**: Mock doesn't simulate network latency or partial packet loss.

3. **Redis Cluster**: Current implementation uses single Redis instance. Cluster behavior is not tested.

4. **Persistence**: Redis persistence (RDB/AOF) behavior is not tested.

---

## Future Enhancements

1. **Integration Tests**: Add tests with actual Redis instance using Docker Compose
2. **Chaos Engineering**: Implement chaos testing with random outages
3. **Performance Tests**: Measure performance impact of degraded mode
4. **Monitoring**: Add metrics for Redis connection state and retry attempts
5. **Circuit Breaker**: Consider implementing circuit breaker pattern for Redis
6. **Fallback Cache**: Consider in-memory fallback cache during outages

---

## Related Files

- `backend/src/redis.ts`: ioredis client implementation
- `backend/src/middleware/redisCache.ts`: Redis cache middleware
- `backend/src/cache.ts`: Cache operations using ioredis
- `backend/src/index.ts`: Health check endpoint
- `backend/src/test/redisResilience.test.ts`: Test implementation
- `docker-compose.yml`: Redis service definition
