import User from '#models/user'
import { HttpContext } from '@adonisjs/core/http'
import hash from '@adonisjs/core/services/hash'
import vine from '@vinejs/vine'

export default class AdminController {
  // Show login page
  async showLogin({ view, auth, response }: HttpContext) {
    await auth.use('web').check()

    if (auth.use('web').isAuthenticated) {
      const user = auth.use('web').user
      if (user && user.role === 'ADMIN') {
        return response.redirect().toRoute('admin.dashboard')
      }
    }

    return view.render('admin/login')
  }

  // Handle login
  async login({ request, auth, response, session }: HttpContext) {
    const validator = vine.compile(
      vine.object({
        email: vine.string().email(),
        password: vine.string().minLength(6),
      })
    )

    try {
      const data = await request.validateUsing(validator)

      // Find admin user
      const user = await User.query()
        .where('email', data.email)
        .where('role', 'ADMIN')
        .first()

      if (!user) {
        session.flash('error', 'Invalid credentials')
        return response.redirect().toRoute('admin.login')
      }

      // Verify password
      if (!user.otpHash) {
        session.flash('error', 'Invalid credentials')
        return response.redirect().toRoute('admin.login')
      }

      const isValidPassword = await hash.verify(user.otpHash, data.password)

      if (!isValidPassword) {
        session.flash('error', 'Invalid credentials')
        return response.redirect().toRoute('admin.login')
      }

      // Login user
      await auth.use('web').login(user)

      session.flash('success', 'Welcome back!')
      return response.redirect().toRoute('admin.dashboard')
    } catch (error) {
      session.flash('error', 'Invalid credentials')
      return response.redirect().toRoute('admin.login')
    }
  }

  // Logout
  async logout({ auth, response, session }: HttpContext) {
    await auth.use('web').logout()
    session.flash('success', 'Logged out successfully')
    return response.redirect().toRoute('admin.login')
  }

  // Dashboard
  async dashboard({ view, auth, response }: HttpContext) {
    return view.render('admin/dashboard')
  }

  // List all admins
  async index({ view }: HttpContext) {
    const admins = await User.query().where('role', 'ADMIN').orderBy('created_at', 'desc')

    return view.render('admin/admins/index', { admins })
  }

  // Show create admin form
  async create({ view }: HttpContext) {
    return view.render('admin/admins/create')
  }

  // Store new admin
  async store({ request, response, session }: HttpContext) {
    const validator = vine.compile(
      vine.object({
        firstname: vine.string().minLength(3),
        lastname: vine.string().minLength(3),
        email: vine.string().email().unique(async (db, value) => {
          const user = await db.from('users').where('email', value).first()
          return !user
        }),
        phone: vine
          .string()
          .regex(/^\+22901[0-9]{8}$/)
          .unique(async (db, value) => {
            const user = await db.from('users').where('phone', value).first()
            return !user
          }),
        password: vine.string().minLength(8),
      })
    )

    try {
      const data = await request.validateUsing(validator)

      // Hash password
      const hashedPassword = await hash.make(data.password)

      // Create admin user
      await User.create({
        firstname: data.firstname,
        lastname: data.lastname,
        email: data.email,
        phone: data.phone,
        otpHash: hashedPassword, // Temporarily using otpHash for password
        role: 'ADMIN',
        imageUrl: `https://ui-avatars.com/api/?name=${data.firstname}+${data.lastname}&background=random`,
      })

      session.flash('success', 'Admin created successfully')
      return response.redirect().toRoute('admin.admins.index')
    } catch (error) {
      session.flash('error', 'Failed to create admin. Please check your inputs.')
      return response.redirect().back()
    }
  }

  // Show edit admin form
  async edit({ params, view, response, session }: HttpContext) {
    const admin = await User.query().where('id', params.id).where('role', 'ADMIN').first()

    if (!admin) {
      session.flash('error', 'Admin not found')
      return response.redirect().toRoute('admin.admins.index')
    }

    return view.render('admin/admins/edit', { admin })
  }

  // Update admin
  async update({ params, request, response, session }: HttpContext) {
    const admin = await User.query().where('id', params.id).where('role', 'ADMIN').first()

    if (!admin) {
      session.flash('error', 'Admin not found')
      return response.redirect().toRoute('admin.admins.index')
    }

    const validator = vine.compile(
      vine.object({
        firstname: vine.string().minLength(3),
        lastname: vine.string().minLength(3),
        email: vine.string().email(),
        phone: vine.string().regex(/^\+22901[0-9]{8}$/),
        password: vine.string().minLength(8).optional(),
      })
    )

    try {
      const data = await request.validateUsing(validator)

      admin.firstname = data.firstname
      admin.lastname = data.lastname
      admin.email = data.email
      admin.phone = data.phone

      if (data.password) {
        admin.otpHash = await hash.make(data.password)
      }

      await admin.save()

      session.flash('success', 'Admin updated successfully')
      return response.redirect().toRoute('admin.admins.index')
    } catch (error) {
      session.flash('error', 'Failed to update admin')
      return response.redirect().back()
    }
  }

  // Delete admin
  async delete({ params, response, session, auth }: HttpContext) {
    const admin = await User.query().where('id', params.id).where('role', 'ADMIN').first()

    if (!admin) {
      session.flash('error', 'Admin not found')
      return response.redirect().toRoute('admin.admins.index')
    }

    // Prevent deleting self
    if (admin.id === auth.use('web').user?.id) {
      session.flash('error', 'You cannot delete your own account')
      return response.redirect().toRoute('admin.admins.index')
    }

    await admin.delete()

    session.flash('success', 'Admin deleted successfully')
    return response.redirect().toRoute('admin.admins.index')
  }

  // Packages Management
  async packagesIndex({ view }: HttpContext) {
    const Package = (await import('#models/package')).default
    const packages = await Package.query().orderBy('id', 'asc')
    return view.render('admin/packages/index', { packages })
  }

  async packagesEdit({ params, view, response, session }: HttpContext) {
    const Package = (await import('#models/package')).default
    const pkg = await Package.find(params.id)

    if (!pkg) {
      session.flash('error', 'Package not found')
      return response.redirect().toRoute('admin.packages.index')
    }

    return view.render('admin/packages/edit', { package: pkg })
  }

  async packagesUpdate({ params, request, response, session }: HttpContext) {
    const Package = (await import('#models/package')).default
    const pkg = await Package.find(params.id)

    if (!pkg) {
      session.flash('error', 'Package not found')
      return response.redirect().toRoute('admin.packages.index')
    }

    const validator = vine.compile(
      vine.object({
        amount: vine.number().min(0),
        kg: vine.number().min(0),
        paidMultiplePickMin: vine.number().min(0).optional(),
        nombreDeJoursDeVetementMin: vine.number().min(0),
        nombreDeJoursDeVetementMax: vine.number().min(0),
        nombreDePersonnesMin: vine.number().min(0).optional(),
        nombreDePersonnesMax: vine.number().min(0).optional(),
      })
    )

    try {
      const data = await request.validateUsing(validator)
      pkg.amount = data.amount
      pkg.kg = data.kg
      if (data.paidMultiplePickMin !== undefined) {
        pkg.paidMultiplePickMin = data.paidMultiplePickMin
      }

      // Update meta fields
      const meta: any = {
        nombreDeJoursDeVetementMin: data.nombreDeJoursDeVetementMin,
        nombreDeJoursDeVetementMax: data.nombreDeJoursDeVetementMax,
      }

      // Add optional fields if provided
      if (data.nombreDePersonnesMin !== undefined && data.nombreDePersonnesMin > 0) {
        meta.nombreDePersonnesMin = data.nombreDePersonnesMin
      }
      if (data.nombreDePersonnesMax !== undefined && data.nombreDePersonnesMax > 0) {
        meta.nombreDePersonnesMax = data.nombreDePersonnesMax
      }

      pkg.meta = meta
      await pkg.save()

      session.flash('success', 'Package updated successfully')
      return response.redirect().toRoute('admin.packages.index')
    } catch (error) {
      session.flash('error', 'Failed to update package')
      return response.redirect().back()
    }
  }

  // Configuration Management
  async configIndex({ view }: HttpContext) {
    const Config = (await import('#models/config')).default
    const configs = await Config.query().orderBy('key', 'asc')
    return view.render('admin/config/index', { configs })
  }

  async configUpdate({ params, request, response, session }: HttpContext) {
    const Config = (await import('#models/config')).default
    const config = await Config.find(params.id)

    if (!config) {
      session.flash('error', 'Configuration not found')
      return response.redirect().toRoute('admin.config.index')
    }

    const validator = vine.compile(
      vine.object({
        value: vine.string(),
      })
    )

    try {
      const data = await request.validateUsing(validator)
      config.value = data.value
      await config.save()

      session.flash('success', 'Configuration updated successfully')
      return response.redirect().toRoute('admin.config.index')
    } catch (error) {
      session.flash('error', 'Failed to update configuration')
      return response.redirect().back()
    }
  }

  // Subscriptions & Orders
  async subscriptions({ view, request }: HttpContext) {
    const Command = (await import('#models/command')).default
    const Order = (await import('#models/order')).default
    const Merchant = (await import('#models/merchant')).default

    // Get search query
    const search = request.input('search', '').trim()

    // Fetch active subscriptions
    let subscriptionsQuery = Command.query()
      .where('commandType', 'SUBSCRIPTION')
      .where('status', 'ACTIVE')
      .preload('user')
      .preload('package')
      .orderBy('createdAt', 'desc')

    // Apply search filter if provided
    if (search) {
      subscriptionsQuery = subscriptionsQuery.whereHas('user', (userQuery) => {
        userQuery
          .whereILike('firstname', `%${search}%`)
          .orWhereILike('lastname', `%${search}%`)
          .orWhereILike('phone', `%${search}%`)
      })
    }

    const subscriptions = await subscriptionsQuery

    // Fetch planned orders for each subscription
    const now = new Date()
    const subscriptionsWithOrders = await Promise.all(
      subscriptions.map(async (subscription) => {
        const orders = await Order.query()
          .where('commandId', subscription.id)
          .where('orderType', 'SUBSCRIPTION')
          .whereIn('status', ['CREATED', 'STARTED', 'PICKED', 'WASHING', 'READY'])
          .orderBy('executionDate', 'asc')

        // Manually load merchant for orders that have merchantId and parse hours
        const ordersWithMerchant = await Promise.all(
          orders.map(async (order) => {
            const orderJson = order.toJSON()
            if (order.merchantId) {
              const merchant = await Merchant.find(order.merchantId)
              orderJson.merchant = merchant ? merchant.toJSON() : null
            } else {
              orderJson.merchant = null
            }
 
            if (orderJson.pickingHours) {
              try {
                const pickingHoursArray = orderJson.pickingHours
                if (Array.isArray(pickingHoursArray) && pickingHoursArray.length === 2) {
                  orderJson.pickingHoursFormatted = `${pickingHoursArray[0]} - ${pickingHoursArray[1]}`
                } else {
                  orderJson.pickingHoursFormatted = 'N/A'
                }
              } catch (e) {
                orderJson.pickingHoursFormatted = 'N/A'
              }
            } else {
              orderJson.pickingHoursFormatted = 'N/A'
            }

            return orderJson
          })
        )

        // Calculate subscription status
        const subJson = subscription.toJSON()
        let subscriptionStatus = 'PENDING'
        if (subJson.endAt) {
          const endDate = new Date(subJson.endAt)
          if (endDate >= now) {
            subscriptionStatus = 'ACTIVE'
          } else {
            subscriptionStatus = 'EXPIRED'
          }
        }

        return {
          ...subJson,
          orders: ordersWithMerchant,
          subscriptionStatus: subscriptionStatus
        }
      })
    )

    // Calculate statistics
    let activeCount = 0
    let expiredCount = 0
    let totalOrders = 0

    subscriptionsWithOrders.forEach((sub: any) => {
      totalOrders += sub.orders.length
      if (sub.endAt) {
        const endDate = new Date(sub.endAt)
        if (endDate >= now) {
          activeCount++
        } else {
          expiredCount++
        }
      }
    })

    return view.render('admin/subscriptions/index', {
      subscriptions: subscriptionsWithOrders,
      stats: {
        total: subscriptionsWithOrders.length,
        active: activeCount,
        expired: expiredCount,
        totalOrders: totalOrders
      },
      search: search
    })
  }

  async orders({ view }: HttpContext) {
    const Order = (await import('#models/order')).default
    const orders = await Order.query()
      .whereIn('status', ['CREATED', 'WASHING', 'READY'])
      .preload('user')
      .preload('package')
      .preload('merchant')
      .orderBy('executionDate', 'asc')

    return view.render('admin/orders/index', { orders })
  }
}
