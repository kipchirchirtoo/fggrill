import jwt from 'jsonwebtoken';
import 'dotenv/config';

const secret = process.env.JWT_SECRET || 'your-secret-key';
const token = jwt.sign({ id: 'test-user-id', role: 'admin' }, secret, { expiresIn: '1h' });
console.log('Token:', token);
