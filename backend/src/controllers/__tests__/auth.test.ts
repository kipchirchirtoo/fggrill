import request from 'supertest';
import { app } from '../../server';
import User, { UserRole } from '../../models/User';
import { getTestUserWithToken } from '../../test/helpers';
import { mockEmailService } from '../../test/mocks/services';

jest.mock('../../services/email.service', () => ({
  emailService: mockEmailService
}));

describe('Auth Controller', () => {
  describe('POST /api/auth/register', () => {
    const registerData = {
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      password: 'password123',
      role: UserRole.EMPLOYEE
    };

    it('should register a new user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(registerData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();

      // Verify user was created
      const user = await User.findOne({ email: registerData.email });
      expect(user).toBeDefined();
      expect(user?.firstName).toBe(registerData.firstName);
      expect(user?.lastName).toBe(registerData.lastName);
      expect(user?.role).toBe(registerData.role);

      // Verify welcome email was sent
      expect(mockEmailService.sendWelcomeEmail).toHaveBeenCalledWith(
        registerData.firstName,
        registerData.email
      );
    });

    it('should not register a user with existing email', async () => {
      // Create a user first
      await User.create(registerData);

      // Try to register with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send(registerData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    const loginData = {
      email: 'test@example.com',
      password: 'password123'
    };

    beforeEach(async () => {
      // Create a test user
      await User.create({
        firstName: 'Test',
        lastName: 'User',
        email: loginData.email,
        password: loginData.password,
        role: UserRole.EMPLOYEE
      });
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
    });

    it('should not login with invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: loginData.email,
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should not login with non-existent email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: loginData.password
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid credentials');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const { token } = await getTestUserWithToken();

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logged out successfully');
    });

    it('should not logout without auth token', async () => {
      const response = await request(app)
        .post('/api/auth/logout');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Not authorized to access this route');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should get current user profile', async () => {
      const { user, token } = await getTestUserWithToken();

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(user.email);
      expect(response.body.data.firstName).toBe(user.firstName);
      expect(response.body.data.lastName).toBe(user.lastName);
      expect(response.body.data.role).toBe(user.role);
    });

    it('should not get profile without auth token', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Not authorized to access this route');
    });
  });

  describe('PUT /api/auth/updatedetails', () => {
    it('should update user details', async () => {
      const { user, token } = await getTestUserWithToken();

      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
        email: 'updated@example.com'
      };

      const response = await request(app)
        .put('/api/auth/updatedetails')
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.firstName).toBe(updateData.firstName);
      expect(response.body.data.lastName).toBe(updateData.lastName);
      expect(response.body.data.email).toBe(updateData.email);

      // Verify changes in database
      const updatedUser = await User.findById(user.id);
      expect(updatedUser?.firstName).toBe(updateData.firstName);
      expect(updatedUser?.lastName).toBe(updateData.lastName);
      expect(updatedUser?.email).toBe(updateData.email);
    });

    it('should not update without auth token', async () => {
      const response = await request(app)
        .put('/api/auth/updatedetails')
        .send({
          firstName: 'Updated',
          lastName: 'Name'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Not authorized to access this route');
    });
  });

  describe('PUT /api/auth/updatepassword', () => {
    it('should update password with valid current password', async () => {
      const { user, token } = await getTestUserWithToken();

      const response = await request(app)
        .put('/api/auth/updatepassword')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'password123',
          newPassword: 'newpassword123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();

      // Verify new password works
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: user.email,
          password: 'newpassword123'
        });

      expect(loginResponse.status).toBe(200);
    });

    it('should not update with incorrect current password', async () => {
      const { token } = await getTestUserWithToken();

      const response = await request(app)
        .put('/api/auth/updatepassword')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'newpassword123'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Password is incorrect');
    });
  });

  describe('POST /api/auth/forgotpassword', () => {
    it('should send reset token email for existing user', async () => {
      const user = await User.create({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'password123',
        role: UserRole.EMPLOYEE
      });

      const response = await request(app)
        .post('/api/auth/forgotpassword')
        .send({ email: user.email });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password reset email sent');

      // Verify reset email was sent
      expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        user.email,
        expect.any(String)
      );
    });

    it('should not send reset token for non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/forgotpassword')
        .send({ email: 'nonexistent@example.com' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('No user found with that email');
    });
  });
});
