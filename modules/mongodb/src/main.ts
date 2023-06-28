import * as fdb from '@fastify/mongodb';
import type { Module } from 'servaljs';

export type MongoDBConfig = fdb.FastifyMongodbOptions;

export function createMongoDB(config: MongoDBConfig): Module {
  return {
    name: 'MongoDB',
    initialize({ next, fastify }) {
      async function init() {
        await fastify.register(fdb, {
          ...config,
        });
      }
      init()
        .then(() => next())
        .catch((err) => next(err));
    },
  };
}
