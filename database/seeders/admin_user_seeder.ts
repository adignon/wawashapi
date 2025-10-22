import { BaseSeeder } from '@adonisjs/lucid/seeders'
import User from '#models/user'
import hash from '@adonisjs/core/services/hash'

export default class extends BaseSeeder {
  async run() {
    // Create default admin user
    // This will only create the admin if the email doesn't already exist
    await User.updateOrCreate(
      { email: 'admin@gowash.com' },
      {
        firstname: 'Admin',
        lastname: 'GoWash',
        email: 'admin@gowash.com',
        phone: '+22901000000',
        role: 'ADMIN',
        otpHash: await hash.make('admin123'), // Default password: admin123
        imageUrl: 'https://ui-avatars.com/api/?name=Admin+GoWash&background=667eea&color=ffffff',
      }
    )

    console.log('✅ Admin user created successfully!')
    console.log('📧 Email: admin@gowash.com')
    console.log('🔑 Password: admin123')
    console.log('⚠️  Please change this password after first login!')
  }
}
