import fs from 'graceful-fs';

const writeToFile = (filename, content) => {
  return new Promise((resolve, reject) => {
    fs.writeFile(filename, content, (err) => {
      if (err) {
        return reject(err);
      }
      resolve();
    });
  });
};


const writeCssModuleToFileAndResolveFilename = (filename, fileContent) => {
  return writeToFile(filename, fileContent).then(() => {
    return filename;
  });
};

export default writeCssModuleToFileAndResolveFilename;
