import { HttpStatus } from '@/http-error';
import { createServal } from '@/main';
import { createController, createControllerMethod } from '@/rest';

async function main() {
  createServal({
    server: {
      port: 1280,
    },
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
