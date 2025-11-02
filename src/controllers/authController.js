import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// Login user
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        adminProfile: true,
        riderProfile: true
      }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const JWT_SECRET = process.env.JWT_SECRET || 'smart-supply-secret-key-2024';
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Prepare user data (exclude password)
    const userData = {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      profile: user.adminProfile || user.riderProfile
    };

    res.json({
      success: true,
      data: {
        token,
        user: userData
      },
      message: 'Login successful'
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
};

// Verify token
export const verifyToken = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const JWT_SECRET = process.env.JWT_SECRET || 'smart-supply-secret-key-2024';
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Get fresh user data
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        adminProfile: true,
        riderProfile: true
      }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    const userData = {
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      profile: user.adminProfile || user.riderProfile
    };

    res.json({
      success: true,
      data: { user: userData }
    });

  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

// Update password
export const updatePassword = async (req, res) => {
  try {

    const { currentPassword, newPassword } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Validate required fields
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    // Validate new password length
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword }
    });

    res.json({
      success: true,
      message: 'Password updated successfully'
    });

  } catch (error) {
    console.error('Password update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update password',
      error: error.message
    });
  }
};

// Check if admin user exists
export const checkAdminExists = async (req, res) => {
  try {
    const adminCount = await prisma.user.count({
      where: {
        role: 'ADMIN'
      }
    });

    res.json({
      success: true,
      data: {
        hasAdmin: adminCount > 0
      }
    });
  } catch (error) {
    console.error('Error checking admin existence:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check admin existence',
      error: error.message
    });
  }
};

// Complete onboarding (create company setup + bottle categories + first admin)
export const completeOnboarding = async (req, res) => {
  try {
    const { companySetup, bottleCategories, adminUser } = req.body;

    // Validate required fields
    if (!companySetup || !adminUser) {
      return res.status(400).json({
        success: false,
        message: 'Company setup and admin user details are required'
      });
    }

    // Check if admin already exists
    const adminExists = await prisma.user.findFirst({
      where: { role: 'ADMIN' }
    });

    if (adminExists) {
      return res.status(400).json({
        success: false,
        message: 'Admin user already exists. Onboarding cannot be completed.'
      });
    }

    // Check if company setup already exists
    const companyExists = await prisma.companySetup.findFirst();
    if (companyExists) {
      return res.status(400).json({
        success: false,
        message: 'Company setup already exists.'
      });
    }

    // Hash admin password
    const hashedPassword = await bcrypt.hash(adminUser.password, 12);

    // Perform all operations in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create company setup
      const createdCompanySetup = await tx.companySetup.create({
        data: {
          agencyName: companySetup.agencyName,
          agencyAddress: companySetup.agencyAddress,
          agencyPhoneNumber: companySetup.agencyPhoneNumber,
          agencyLogo: companySetup.agencyLogo,
          areasOperated: companySetup.areasOperated || []
        }
      });

      // 2. Create bottle categories if provided
      let createdBottleCategories = [];
      if (bottleCategories && Array.isArray(bottleCategories) && bottleCategories.length > 0) {
        createdBottleCategories = await Promise.all(
          bottleCategories.map(category =>
            tx.bottleCategory.create({
              data: {
                categoryName: category.categoryName,
                price: parseFloat(category.price),
                companySetupId: createdCompanySetup.id
              }
            })
          )
        );
      }

      // 3. Create admin user
      const createdAdminUser = await tx.user.create({
        data: {
          email: adminUser.email,
          phone: adminUser.phone,
          password: hashedPassword,
          role: 'ADMIN',
          isActive: true
        }
      });

      // 4. Create admin profile
      const createdAdminProfile = await tx.adminProfile.create({
        data: {
          userId: createdAdminUser.id,
          name: adminUser.name,
          company: companySetup.agencyName
        }
      });

      return {
        companySetup: createdCompanySetup,
        bottleCategories: createdBottleCategories,
        adminUser: {
          id: createdAdminUser.id,
          email: createdAdminUser.email,
          phone: createdAdminUser.phone,
          role: createdAdminUser.role,
          profile: createdAdminProfile
        }
      };
    });

    // Generate JWT token for the new admin
    const JWT_SECRET = process.env.JWT_SECRET || 'smart-supply-secret-key-2024';
    const token = jwt.sign(
      { 
        userId: result.adminUser.id, 
        email: result.adminUser.email, 
        role: result.adminUser.role 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      data: {
        ...result,
        token
      },
      message: 'Onboarding completed successfully'
    });

  } catch (error) {
    console.error('Onboarding error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete onboarding',
      error: error.message
    });
  }
};