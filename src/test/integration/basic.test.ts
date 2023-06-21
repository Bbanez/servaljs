import { HttpStatus } from '@/http-error';
import { createLogger } from '@/index';
import { createServal } from '@/main';
import {
  createController,
  createControllerMethod,
  createMiddleware,
} from '@/rest';

async function main() {
  createServal({
    server: {
      port: 1280,
    },
    modules: [
      createLogger({
        saveToFile: {
          interval: 1000,
          output: 'logs',
        },
      }),
    ],
    middleware: [
      createMiddleware({
        name: 'Mid',
        path: '/test',
        handler() {
          return (_req, res) => {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.write(JSON.stringify({ test: true }));
            res.end();
          };
        },
      }),
    ],
    controllers: [
      createController({
        name: 'Test',
        path: '/hello',
        methods() {
          return {
            '/world': createControllerMethod<
              { test: string },
              { test: string; data: string }
            >({
              type: 'get',
              options: {
                schema: {
                  querystring: {
                    name: {
                      type: 'string',
                      required: true,
                    },
                  },
                },
              },
              preRequestHandler: async () => {
                return {
                  test: 'Test',
                };
              },
              async handler({ errorHandler }) {
                throw errorHandler(
                  HttpStatus.InternalServerError,
                  'Ovo je error',
                );
                // return {
                //   data: 'Data',
                //   test,
                // };
              },
            }),
          };
        },
      }),
    ],
  });
}
main().catch((err) => {
  console.error(err);
  process.exit(2);
});
