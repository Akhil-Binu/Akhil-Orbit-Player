// This code is currently generating this mock directory tree!
const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, 'mock_course');

function createFolder(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('Created directory:', dir);
  }
}