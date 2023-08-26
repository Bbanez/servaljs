import type { ObjectSchema } from '@banez/object-utility/types';
import { ObjectId } from 'mongodb';
import {
  createServal,
  HttpStatus,
  createController,
  createControllerMethod,
} from 'servaljs';
import {
  createMongoDB,
  createMongoDBRepository,
  MongoDBEntry,
  MongoDBEntrySchema,
} from 'servaljs-mongodb';

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
  collection: 'Todos',
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
              const body = request.body as { desc: string };
              return {
                item: await repo.add({
                  _id: `${new ObjectId()}`,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                  desc: body.desc,
                  done: false,
                }),
              };
            },
          }),

          update: createControllerMethod<void, { item: Todo }>({
            type: 'put',
            async handler({ request, errorHandler }) {
              const body = request.body as {
                _id: string;
                desc?: string;
                done?: boolean;
              };
              let todo = await repo.findById(body._id);
              if (!todo) {
                throw errorHandler(
                  HttpStatus.NotFound,
                  `Todo "${body._id}" does not exist.`,
                );
              }
              let changes = false;
              if (body.desc && body.desc !== todo.desc) {
                changes = true;
                todo.desc = body.desc;
              }
              if (typeof body.done === 'boolean') {
                changes = true;
                todo.done = body.done;
              }
              if (changes) {
                todo = await repo.update(todo);
              }
              return { item: todo };
            },
          }),
        };
      },
    }),
  ],
});
