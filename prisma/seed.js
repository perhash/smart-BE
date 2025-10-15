import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  try {
    // Check if admin user already exists
    const existingAdmin = await prisma.user.findFirst({
      where: {
        role: 'ADMIN',
        email: 'admin@smartsupply.com'
      }
    });

    if (existingAdmin) {
      console.log('✅ Admin user already exists, skipping creation');
      return;
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash('admin123', 12);

    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@smartsupply.com',
        phone: '+91 98765 43210',
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true
      }
    });

    console.log('✅ Admin user created:', adminUser.id);

    // Create admin profile
    const adminProfile = await prisma.adminProfile.create({
      data: {
        userId: adminUser.id,
        name: 'Smart Supply Admin',
        company: 'Smart Supply Water Delivery'
      }
    });

    console.log('✅ Admin profile created:', adminProfile.id);
    console.log('🎉 Database seeding completed successfully!');
    console.log('📧 Admin Email: admin@smartsupply.com');
    console.log('🔑 Admin Password: admin123');

  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
