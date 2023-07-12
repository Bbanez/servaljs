import type { Redis } from './main';

export type RedisIndexingHelperKeyType = 'normal' | 'set_sensitive';

export class RedisIndexingHelper {
  constructor(private collection: string, private redis: Redis) {}

  createKey(indexingKey: string): string {
    return `${this.collection}:query:${indexingKey}`;
  }

  async getQueryKeys(type?: RedisIndexingHelperKeyType): Promise<string[]> {
    return this.getIndexes(`____names_${type || 'normal'}`);
  }

  async addQueryKey(
    indexingKey: string,
    type?: RedisIndexingHelperKeyType,
  ): Promise<void> {
    await this.addIds(`____names_${type || 'normal'}`, indexingKey);
  }

  async removeQueryKey(
    indexingKey: string,
    type?: RedisIndexingHelperKeyType,
  ): Promise<void> {
    await this.removeId(`____names_${type || 'normal'}`, indexingKey);
  }

  async getQueryState(indexingKey: string): Promise<boolean> {
    const result = await this.redis.client.get(
      `${this.collection}:query:____s_${indexingKey}`,
    );
    return result === 't' ? true : false;
  }

  async setQueryState(indexingKey: string, state: boolean): Promise<void> {
    await this.redis.client.set(
      `${this.collection}:query:____s_${indexingKey}`,
      state ? 't' : 'f',
    );
  }

  async getIndexes(indexingKey: string): Promise<string[]> {
    const key = this.createKey(indexingKey);
    return await this.redis.client.lRange(
      key,
      0,
      await this.redis.client.lLen(key),
    );
  }

  async addIds(indexingKey: string, ids: string | string[]): Promise<void> {
    if (typeof ids === 'string' || (ids.length && ids.length > 0)) {
      const key = this.createKey(indexingKey);
      await this.redis.client.lPush(key, ids || []);
    }
  }

  async removeId(indexingKey: string, id: string): Promise<void> {
    const key = this.createKey(indexingKey);
    await this.redis.client.lRem(key, 0, id);
  }

  async removeAll(indexingKey: string): Promise<void> {
    const key = this.createKey(indexingKey);
    await this.redis.client.del(key);
  }
}
