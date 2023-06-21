const { createFS } = require('@banez/fs');
const { createConfig } = require('@banez/npm-tool');

const fs = createFS({
  base: process.cwd(),
});

module.exports = createConfig({
  bundle: {
    extend: [
      {
        title: 'Remove build info',
        task: async () => {
          await fs.deleteFile(['dist', 'tsconfig.tsbuildinfo']);
        },
      },
      {
        title: 'Remove tests',
        task: async () => {
          await fs.deleteDir(['dist', 'test']);
        },
      },
    ],
  },
});
