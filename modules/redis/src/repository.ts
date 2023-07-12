import * as crypto from 'crypto';
import { ObjectUtility } from '@banez/object-utility';
import { ObjectSchema, ObjectUtilityError } from '@banez/object-utility/types';
import { Logger, Module } from 'servaljs';
import type { RedisEntity } from './entry';
import {
  RedisIndexingHelper,
  RedisIndexingHelperKeyType,
} from './indexing-helper';
import { Redis, useRedis } from './main';

export interface RedisRepositoryConfig<
  Model extends RedisEntity = RedisEntity,
  Methods = unknown,
> {
  name: string;
  collection: string;
  schema: ObjectSchema;
  methods?: (config: {
    redis: Redis;
    indexingHelper: RedisIndexingHelper;
    collection: string;
    name: string;
    repo: RedisRepository<Model, Methods>;
  }) => Promise<Methods>;
}

export interface RedisRepository<
  Model extends RedisEntity = RedisEntity,
  Methods = unknown,
> {
  name: string;
  collection: string;
  schema: ObjectSchema;
  methods: Methods;
  indexingHelper: RedisIndexingHelper;

  init(): Module;
  findById(id: string): Promise<Model | null>;
  findAll(): Promise<Model[]>;
  findAllById(ids: string[]): Promise<Model[]>;
  find(
    indexingKey: string,
    query: (item: Model) => boolean,
    type?: RedisIndexingHelperKeyType,
  ): Promise<Model[]>;
  findOne(
    indexingKey: string,
    query: (item: Model) => boolean,
    type?: RedisIndexingHelperKeyType,
  ): Promise<Model | null>;
  findByIndexingKey(
    indexingKey: string,
    type?: RedisIndexingHelperKeyType,
  ): Promise<Model[] | null>;
  findOneByIndexingKey(
    indexingKey: string,
    type?: RedisIndexingHelperKeyType,
  ): Promise<Model | null>;
  set(entity: Model): Promise<Model>;
  setMany(entities: Model[]): Promise<Model[]>;
  deleteById(id: string): Promise<void>;
  deleteAllById(ids: string[]): Promise<void>;
  count(): Promise<number>;
}

export function createRedisRepository<
  Model extends RedisEntity,
  Methods = unknown,
>(
  config: RedisRepositoryConfig<Model, Methods>,
): RedisRepository<Model, Methods> {
  const indexesCollection = `${config.collection}:indexes`;
  const logger = new Logger(config.name);
  let redis: Redis;

  function checkSchema(entity: Model) {
    const result = ObjectUtility.compareWithSchema(
      entity,
      config.schema,
      `${config.collection}`,
    );
    if (result instanceof ObjectUtilityError) {
      throw new Error(`Invalid Entity schema: ${result.message}`);
    }
  }

  async function addIndex(id: string) {
    if (id) {
      await redis.client.lPush(indexesCollection, id);
    }
  }

  async function removeIndex(id: string) {
    await redis.client.lRem(indexesCollection, 0, id);
  }

  let indexingHelper: RedisIndexingHelper;

  const repo: RedisRepository<Model, Methods> = {
    name: config.name,
    collection: config.collection,
    schema: config.schema,
    methods: {} as never,
    indexingHelper: null as never,

    init() {
      return {
        name: config.name,
        initialize({ next }) {
          async function init() {
            redis = useRedis();
            indexingHelper = new RedisIndexingHelper(config.collection, redis);
            if (config.methods) {
              repo.methods = await config.methods({
                repo,
                redis,
                indexingHelper,
                collection: config.collection,
                name: config.name,
              });
            }
          }
          init()
            .then(() => next())
            .catch((err) => next(err));
        },
      };
    },

    async findById(id) {
      const result = await redis.client.hGetAll(`${config.collection}:${id}`);
      if (JSON.stringify(result) === '{}') {
        return null;
      }
      const output = redis.remakeH<Model>(config.schema, result);
      output._id = id;
      return output;
    },

    async findAll() {
      const output: Model[] = [];
      const indexes = await redis.client.lRange(
        indexesCollection,
        0,
        await redis.client.lLen(indexesCollection),
      );
      for (let i = 0; i < indexes.length; i++) {
        const id = indexes[i];
        const entity = await repo.findById(id);
        if (entity) {
          output.push(entity);
        } else {
          removeIndex(id);
        }
      }
      return output;
    },

    async findAllById(ids) {
      const output: Model[] = [];
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        const entity = await repo.findById(id);
        if (entity) {
          output.push(entity);
        } else {
          removeIndex(id);
        }
      }
      return output;
    },

    async findOne(indexingKey, query, type) {
      const result = await repo.findOneByIndexingKey(indexingKey, type);
      if (result) {
        return result;
      }
      const allEntityIndexes = await redis.client.lRange(
        indexesCollection,
        0,
        await redis.client.lLen(indexesCollection),
      );
      for (let i = 0; i < allEntityIndexes.length; i++) {
        const id = allEntityIndexes[i];
        const entity = await repo.findById(id);
        if (entity) {
          if (query(entity)) {
            await indexingHelper.addIds(indexingKey, entity._id);
            await indexingHelper.setQueryState(indexingKey, true);
            await indexingHelper.addQueryKey(indexingKey);
            return entity;
          }
        } else {
          removeIndex(id);
        }
      }
      return null;
    },

    async find(indexingKey, query, type) {
      const result = await repo.findByIndexingKey(indexingKey, type);
      if (result) {
        return result;
      }
      const allEntityIndexes = await redis.client.lRange(
        indexesCollection,
        0,
        await redis.client.lLen(indexesCollection),
      );
      const output: Model[] = [];
      for (let i = 0; i < allEntityIndexes.length; i++) {
        const id = allEntityIndexes[i];
        const entity = await repo.findById(id);
        if (entity) {
          if (query(entity)) {
            output.push(entity);
          }
        } else {
          removeIndex(id);
        }
      }
      await indexingHelper.addIds(
        indexingKey,
        output.map((e) => e._id),
      );
      await indexingHelper.setQueryState(indexingKey, true);
      await indexingHelper.addQueryKey(indexingKey);
      return output;
    },

    async findByIndexingKey(indexingKey) {
      if (!(await indexingHelper.getQueryState(indexingKey))) {
        return null;
      }
      const output: Model[] = [];
      const indexes = await indexingHelper.getIndexes(indexingKey);
      for (let i = 0; i < indexes.length; i++) {
        const id = indexes[i];
        const entity = await repo.findById(id);
        if (entity) {
          output.push(entity);
        } else {
          removeIndex(id);
        }
      }
      return output;
    },

    async findOneByIndexingKey(indexingKey) {
      if (!(await indexingHelper.getQueryState(indexingKey))) {
        return null;
      }
      const indexes = await indexingHelper.getIndexes(indexingKey);
      return await repo.findById(indexes[0]);
    },

    async set(entity) {
      if (!entity._id) {
        entity._id = crypto
          .createHash('sha1')
          .update(Date.now() + crypto.randomBytes(8).toString('hex'))
          .digest('hex');
      }
      try {
        checkSchema(entity);
      } catch (error) {
        logger.error('add', error);
        throw error;
      }
      if (!(await repo.findById(entity._id))) {
        await addIndex(entity._id);
      }

      await redis.hSetObject(entity._id, config.collection, '', {
        ...entity,
        _id: undefined,
      });
      return entity;
    },

    async setMany(entities) {
      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i];
        await repo.set(entity);
      }
      return entities;
    },

    async deleteById(id) {
      const result = await redis.client.hGetAll(`${config.collection}:${id}`);
      if (JSON.stringify(result) === '{}') {
        return;
      }
      await removeIndex(id);
      const keys = Object.keys(result);
      await redis.client.hDel(`${config.collection}:${id}`, keys);
    },

    async deleteAllById(ids) {
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        await repo.deleteById(id);
      }
    },

    async count() {
      return await redis.client.lLen(indexesCollection);
    },
  };

  return repo;
}
