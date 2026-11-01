
const { randomBytes } = require('node:crypto');

const value = randomBytes(16).toString('hex');
console.log(value); // 32 characters
