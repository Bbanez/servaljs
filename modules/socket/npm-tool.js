const { createFS } = require('@banez/fs');
const { createConfig } = require('@banez/npm-tool');

const fs = createFS({
  base: process.cwd(),
});

/**
 *
 * @param {{
 *  dirPath: string;
 *  basePath: string;
 *  endsWith?: string[];
 *  regex: RegExp[];
 * }} config
 * @returns {Promise<void>}
 */
async function fileReplacer(config) {
  const filePaths = await fs.fileTree(config.dirPath, '');
  for (let i = 0; i < filePaths.length; i++) {
    const filePath = filePaths[i];
    if (
      config.endsWith &&
      !!config.endsWith.find((e) => filePath.path.abs.endsWith(e))
    ) {
      let replacer = config.basePath;
      if (filePath.dir !== '') {
        const depth = filePath.dir.split('/').length;
        replacer =
          new Array(depth).fill('..').join('/') + '/' + config.basePath;
      }
      const file = await fs.readString(filePath.path.abs);
      let fileFixed = file + '';
      for (let j = 0; j < config.regex.length; j++) {
        const regex = config.regex[j];
        fileFixed = fileFixed.replace(regex, replacer);
      }
      if (file !== fileFixed) {
        await fs.save(filePath.path.abs, fileFixed);
      }
    }
  }
}

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
