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
    router.get("/histories", [OrderController,"getCustomerOrderHistories"])
    router.get("/orders/:orderId", [OrderController,"getOrder"])
    router.group(() => {
      router.post("/order/eval", [OrderController, "merchantEvaluateOrder"])
      router.post("/order/accept", [OrderController, "merchantAcceptCommand"])
    }).prefix("merchants")
  }).use([
    middleware.auth(),
    middleware.deviceCheck({ authicationCheck: true })
  ])
})
  .prefix("api")
  .use([
    middleware.deviceCheck({ authicationCheck: false })
  ])
