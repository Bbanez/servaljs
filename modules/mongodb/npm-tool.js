const { createFS } = require('@banez/fs');
const { createConfig } = require('@banez/npm-tool');
const { fileReplacer } = require('../../file-replacer');

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
          await fs.deleteDir(['dist', 'src']);
          const files = await fs.readdir(['dist', 'modules', 'mongodb', 'src']);
          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            await fs.move(
              ['dist', 'modules', 'mongodb', 'src', file],
              ['dist', file],
            );
          }
          await fs.deleteFile(['dist', 'test.js']);
          await fs.deleteFile(['dist', 'test.d.ts']);
          await fs.deleteDir(['dist', 'modules']);
        },
      },
      {
        title: 'Fix imports',
        task: async () => {
          await fileReplacer({
            basePath: '',
            dirPath: ['dist'],
            regex: [/@\//g],
            endsWith: ['.js', '.d.ts'],
          });
        },
      },
    ],
  },
});
