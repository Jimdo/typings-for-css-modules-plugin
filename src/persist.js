import fs from 'graceful-fs';

const writeToFile = (filename, content) => {
    fs.writeFileSync(filename, content);
};

export default writeToFile;
