import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class AdminMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    // Check if user is authenticated with web guard
    await ctx.auth.use('web').check()
    if (!ctx.auth.use('web').isAuthenticated) {
      ctx.session.flash('error', 'Please login to continue')
      return ctx.response.redirect().toRoute('admin.login')
    }

    const user = ctx.auth.use('web').user

    // Check if user has admin role
    if (!user || user.role !== 'ADMIN') {
      ctx.session.flash('error', 'Access denied. Admin privileges required.')
      return ctx.response.redirect().toRoute('admin.login')
    }

    // Share user with views via view.share
    ctx.view.share({ auth: { user } })

    const output = await next()
    return output
  }
}
