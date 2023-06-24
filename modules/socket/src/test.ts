import {
  createController,
  createControllerMethod,
  createServal,
} from 'servaljs';
import { createServalSocket } from './main';

createServal({
  server: {
    port: 1280,
  },
  modules: [
    createServalSocket({
      path: '/socket',
      eventHandlers: {
        test(data, conn) {
          console.log(data);
          conn.emit('test', { message: 'Yoo' });
        },
      },
    }),
  ],
  controllers: [
    createController({
      name: 'Test',
      path: '/',
      methods() {
        return {
          '/test': createControllerMethod({
            type: 'get',
            async handler() {
              return { root: true };
            },
          }),
        };
      },
    }),
  ],
});
