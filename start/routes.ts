/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from './kernel.js'
const AuthController = () => import("#controllers/auth_controller")
const SubscriptionController = () => import("#controllers/subscriptions_controller")
const PackagesController = () => import("#controllers/packages_controller")
const OrderController = () => import("#controllers/orders_controller")
const AdminController = () => import("#controllers/admin_controller")
const PaymentController = () => import("#controllers/payments_controller")
const MerchantsController =() => import("#controllers/merchants_controller")
router.group(() => {
  router.post("/auth/access/verify", [AuthController, "otpVerificationPhone"])
  router.post("/auth/access/confirm", [AuthController, "otpConfirmCode"])
  router.post("/auth/create", [AuthController, "createUserAccount"])
  router.group(() => {
    router.post("/address", [SubscriptionController, "saveAdress"])
    router.get("/address", [SubscriptionController, "getAdress"])
    router.get("/packages/addons", [PackagesController, "getServicesAddons"])
    router.post("/packages/subscribe", [SubscriptionController, "subscribe"])
    router.post("/packages/command", [SubscriptionController, "commandOrder"])
    router.post("/packages/command/pay/:orderId", [SubscriptionController, "checkCommandOrderPayment"])
    router.get("/packages/:type?", [PackagesController, "getPackages"])
    router.get("/subscription/payment/:commandId", [SubscriptionController, "checkPayment"])
    router.post("/subscription/cancel", [SubscriptionController, "cancelActiveSubscription"])
    router.get("/histories", [OrderController, "getOrderHistories"])
    router.get("/orders/:orderId", [OrderController, "getOrder"])
    router.post("/orders/:orderId/delivered", [OrderController, "customerConfirmOrderReception"])

    router.group(() => {
      router.post("/order/eval", [OrderController, "merchantEvaluateOrder"])
      router.post("/order/accept", [OrderController, "merchantAcceptCommand"])
      router.post("/order/submit", [OrderController, "merchantOrderAction"])
      router.get("/balance/me", [MerchantsController, "getBalanceMerchant"])
      router.post("/checkout/adresses", [PaymentController, "addOrEditUserPaymentMethod"])
      router.get("/checkout/adresses", [PaymentController, "getAddresses"])
      router.post("/payments/withdraw", [PaymentController, "createPayment"])
      router.get("/payments", [PaymentController, "getPayments"])
      router.get("/payments/methods", [PaymentController, "getPaymentMethods"])
      router.get("/payments/:paymentId", [PaymentController, "getPayment"])
      router.get("/statistics", [MerchantsController, "getMerchantStatistics"])
    })
      .prefix("merchants")
      .use([
        middleware.userIs("CLEANER")
      ])

  }).use([
    middleware.auth(),
    middleware.deviceCheck({ authicationCheck: true })
  ])
})
  .prefix("api")
  .use([
    middleware.deviceCheck({ authicationCheck: false })
  ])

// Admin Routes
router.group(() => {
  // Login routes (no auth required)
  router.get('/login', [AdminController, 'showLogin']).as('admin.login')
  router.post('/login', [AdminController, 'login']).as('admin.login.post')

  // Protected admin routes
  router.group(() => {
    router.get('/dashboard', [AdminController, 'dashboard']).as('admin.dashboard')
    router.post('/logout', [AdminController, 'logout']).as('admin.logout')

    // Admin management
    router.get('/admins', [AdminController, 'index']).as('admin.admins.index')
    router.get('/admins/create', [AdminController, 'create']).as('admin.admins.create')
    router.post('/admins', [AdminController, 'store']).as('admin.admins.store')
    router.get('/admins/:id/edit', [AdminController, 'edit']).as('admin.admins.edit')
    router.post('/admins/:id', [AdminController, 'update']).as('admin.admins.update')
    router.post('/admins/:id/delete', [AdminController, 'delete']).as('admin.admins.delete')

    // Packages management
    router.get('/packages', [AdminController, 'packagesIndex']).as('admin.packages.index')
    router.get('/packages/:id/edit', [AdminController, 'packagesEdit']).as('admin.packages.edit')
    router.post('/packages/:id', [AdminController, 'packagesUpdate']).as('admin.packages.update')

    // Configuration management
    router.get('/config', [AdminController, 'configIndex']).as('admin.config.index')
    router.post('/config/:id', [AdminController, 'configUpdate']).as('admin.config.update')

    // Subscriptions & Orders
    router.get('/subscriptions', [AdminController, 'subscriptions']).as('admin.subscriptions.index')
    router.get('/orders', [AdminController, 'orders']).as('admin.orders.index')
  }).use([middleware.admin()])
}).prefix('/admin')
