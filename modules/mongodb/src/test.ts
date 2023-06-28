import type { ObjectSchema } from '@banez/object-utility/types';
import { ObjectId } from 'mongodb';
import { createServal } from 'servaljs/main';
import {
  createController,
  createControllerMethod,
} from 'servaljs/rest/controller';
import { MongoDBEntry, MongoDBEntrySchema } from './entry';
import { createMongoDB } from './main';
import { createMongoDBRepository } from './repository';

interface Todo extends MongoDBEntry {
  desc: string;
  done: boolean;
}

interface TodoMethods {
  findAllByDone(done: boolean): Promise<Todo[]>;
}

const TodoSchema: ObjectSchema = {
  ...MongoDBEntrySchema,
  desc: {
    __type: 'string',
    __required: true,
  },
  done: {
    __type: 'boolean',
    __required: true,
  },
};

const repo = createMongoDBRepository<Todo, TodoMethods>({
  collection: 'todos',
  name: 'Todo repo',
  schema: TodoSchema,
  methods({ mdb }) {
    return {
      async findAllByDone(done) {
        return await mdb.find({ done }).toArray();
      },
    };
  },
});

createServal({
  server: {
    port: 1280,
  },
  modules: [
    createMongoDB({
      forceClose: true,
      url: 'mongodb://test:test1234@localhost:27017/admin',
    }),
    repo.init(),
  ],
  controllers: [
    createController({
      name: 'Todo',
      path: '/todo',
      methods() {
        return {
          getAll: createControllerMethod({
            type: 'get',
            path: '/all',
            async handler() {
              return { items: await repo.findAll() };
            },
          }),

          create: createControllerMethod<void, { item: Todo }>({
            type: 'post',
            async handler({ request }) {
              console.log(request.body)
              return {
                item: await repo.add({
                  _id: `${new ObjectId()}`,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                  desc: (request.body as any).desc,
                  done: false,
                }),
              };
            },
          }),
        };
      },
    }),
  ],
});
