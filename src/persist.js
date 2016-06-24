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

export default writeToFile;
