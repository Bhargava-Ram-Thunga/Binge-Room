import { describe, it, expect } from 'vitest';
import { createPrismaClient } from './index.js';

describe('@huddly/database', () => {
  it('instantiates PrismaClient factory function', () => {
    const client = createPrismaClient('postgresql://user:pass@localhost:5432/testdb');
    expect(client).toBeDefined();
    expect(typeof client.$connect).toBe('function');
    expect(typeof client.$disconnect).toBe('function');
  });
});
