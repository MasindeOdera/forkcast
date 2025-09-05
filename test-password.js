const bcrypt = require('bcryptjs');

const password = 'password123';
const hash = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeblUcYbhyL4K5Qhm';

console.log('Testing password:', password);
console.log('Against hash:', hash);

const isValid = bcrypt.compareSync(password, hash);
console.log('Password valid:', isValid);

// Generate a new hash for comparison
const newHash = bcrypt.hashSync(password, 12);
console.log('New hash generated:', newHash);

const newIsValid = bcrypt.compareSync(password, newHash);
console.log('New hash valid:', newIsValid);