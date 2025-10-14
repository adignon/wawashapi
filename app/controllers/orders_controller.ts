import Command from '#models/command';
import Order from '#models/order';
import db from '@adonisjs/lucid/services/db';
import { TransactionClientContract } from '@adonisjs/lucid/types/database';
import { addHours } from 'date-fns';
import { DateTime } from 'luxon';
import { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine';
import { Decimal } from 'decimal.js';
import env from '#start/env';
import Invoice from '#models/invoice';
import { createHash } from 'crypto';

export default class OrdersController {

    async getOrder({ request, auth, response, i18n }: HttpContext) {
        const order = await Order.query()
            .where("id", request.param("orderId"))
            .if(auth.user?.role == "CLEANER", q => {
                q.where("merchantId", auth.user!.id)
            })
            .if(auth.user?.role == "CLIENT", q => {
                q.where("userId", auth.user!.id)
            })
            .first()
        if (order?.invoiceId) {
            await order.load("invoice")
        }
        return order
    }

    static getOrderId(id: number) {
        const salt = env.get("APP_KEY");
        const input = salt + id;
        const hash = createHash("sha256").update(input).digest("base64url");
        return hash.substring(0, 6).toUpperCase(); // 6-char uppercase code
    }

    async getOrderHistories({ request, auth, response, i18n }: HttpContext) {
        const orders = await Order.query()
            .if(auth.user?.role == "CLEANER", q => {
                q.where("merchantId", auth.user!.id)
            })
            .if(auth.user?.role == "CLIENT", q => {
                q.where("userId", auth.user!.id)
            })
            .preload("package");
        const ordersData = []
        for (let order of orders) {
            let orderData = order.toJSON()
            if (order.invoiceId) {
                orderData.invoice = await Invoice.find(order.invoiceId)
            }
            ordersData.push(orderData)
        }
        return ordersData
    }

    async createNextOrder(command: Command, { executionDate, pickingHours, commandExecutionIndex, orderExecutionIndex }: {
        executionDate: Date, pickingHours: [string, string], commandExecutionIndex: number, orderExecutionIndex: number
    }, tx: TransactionClientContract) {
        if (!executionDate || !pickingHours) {
            throw new Error("Date et horaire d'exécution de la commande inexistante ou invalide. Veuillez contacter le client pour mettre à jour les informations.")
        }
        //Default values
        var orderShippingDuration: number | null = null
        var orderShippingType: string | null = null
        var deliveryCost = command.deliveryPerDayCost
        var addonsKgCost = 0
        var merchantCosts: any = {}
        command.addons.forEach((addon) => {
            switch (addon.key) {
                case "SHIPPING": {
                    orderShippingDuration = Number(addon.value.timeDurationApprox)
                    orderShippingType = addon.code
                    addonsKgCost += Number(addon.price)
                    merchantCosts["SHIPPING"] = {
                        unitCost: addon.value.merchantCost,
                        totalCost: 0
                    }

                    break;
                }
                case "REPASSAGE": {
                    addonsKgCost += Number(addon.price)
                    merchantCosts["REPASSAGE"] = {
                        unitCost: addon.value.merchantCost,
                        totalCost: 0
                    }
                    break;
                }

            }
        })
        if (!(orderShippingDuration && orderShippingType && deliveryCost)) {
            throw new Error("Données non valide")
        }
        // Set user defined max delivery hours
        const pickingEndAt = new Date(executionDate.toString())
        const [_, endTime] = pickingHours
        const [h, m] = endTime.split(":").map(Number)
        pickingEndAt.setHours(Number(h))
        pickingEndAt.setMinutes(Number(m))
        const maxDeliveryDateTime = addHours(pickingEndAt, orderShippingDuration)

        // Date d'exécution de la command
        // Heure tranche de prise de la command
        // Heure de livraison espérée de la command
        // Type de livraison choisie de la command
        // Prix d'exécution de la commande
        // Niveau d'exécution actuelle de l'ordre
        // status
        const customerKgPrice = Decimal(command.package.amount).add(addonsKgCost).toNumber()
        const customerOrderInitialPrice = Decimal(customerKgPrice).mul(command.package.kg).toNumber()
        if (!Decimal(customerOrderInitialPrice).eq(command.orderMinPrice)) {
            throw Error("Le prix unitaire par commande est différent. Prix unitaire de l'ordre initial:" + command.orderMinPrice + ", Prix unitaire de l'ordre pendant execution: " + customerOrderInitialPrice)
        }
        const order = await Order.create({
            commandId: command.id,
            executionDuration: orderShippingDuration,
            executionDate: DateTime.fromJSDate(executionDate),
            pickingHours: JSON.stringify(pickingHours),
            deliveryDate: DateTime.fromJSDate(maxDeliveryDateTime),
            deliveryType: orderShippingType,
            capacityKg: Number(command.package.kg),
            orderTitle: command.commandDescription,
            commandExecutionIndex: commandExecutionIndex,
            orderExecutionIndex,
            customerOrderFinalPrice: 0,
            status: "CREATED",
            orderType: command.commandType,
            userId: command.userId,
            packageId: command.packageId,
            addons: JSON.stringify(merchantCosts) as any,

            // Costs
            deliveryCost,
            merchantKgCost: command.merchantKgUnitCost,

            // Customer
            customerOrderKgPrice: customerKgPrice,
            customerOrderInitialPrice,



        }, {
            client: tx
        })
        order.orderId = OrdersController.getOrderId(order.id)
        await order.useTransaction(tx).save()
        return order
    }

    async merchantEvaluateOrder({ request, i18n, response }: HttpContext) {
        let order: Order | null
        const validator = vine.compile(vine.object({
            orderId: vine.string().exists(async (_, value) => {
                console.log(value)
                order = await Order.findBy({ "orderId": value.replace("#", "") })
                return !!order
            }),
            kg: vine.number(),
        }))
        const data = await request.validateUsing(validator)

        if (!order!) {
            return response.status(422).json({
                message: i18n.t("Commande non trouvée")
            })
        }
        const tx = await db.transaction()
        try {
            order.userKg = data.kg
            order.merchantTotalCost = Decimal(order.merchantKgCost!).mul(data.kg).toNumber()
            order.customerOrderFinalPrice = Decimal(order.customerOrderKgPrice!).mul(data.kg).add(order.deliveryCost).toNumber()
            order.customerFeesToPay = Decimal(order.customerOrderFinalPrice).minus(order.customerOrderInitialPrice).toNumber()
            order.totalCost = Decimal(order.deliveryCost).add(order.merchantTotalCost).toNumber()
            order.margin = Decimal(order.customerOrderFinalPrice).minus(order.totalCost).toNumber()
            for (let addon in order.addons) {
                order.addons[addon].totalCost = Decimal(order.addons[addon].unitCost).mul(data.kg).toNumber()
            }
            let iitials = order.addons!
            if (order.addons) {
                order.addons = JSON.stringify(iitials) as any
            }

            if (order.customerFeesToPay > 0) {
                const invoice = await Invoice.create({
                    amount: order.customerFeesToPay.toString(),
                    invoiceType: order.commandId ? "SUBSCRIPTION_OVERWEIGHT" : "COMMAND_LAUNDRY",
                    status: "CREATED",
                    userId: order.userId,
                }, {
                    client: tx
                })
                order.invoiceId = invoice.id
            }
            await order.useTransaction(tx).save()
            await tx.commit()
            await order.load("package")
            order.addons = iitials
            return order!
        } catch (e) {
            console.log(e)
            return response.status(400).json({
                message: i18n.t("Une erreur est survenue lors de la sélection de la commandes. Veuillez réssager")
            })
        }
    }

    async merchantAcceptCommand({ request, auth, i18n, response }: HttpContext) {

        const validator = vine.compile(vine.object({
            orderId: vine.number().exists(async (_, value) => {
                let order = await Order.findBy({ "id": value, status: "CREATED" })
                return !!order
            }),
        }))

        const data = await request.validateUsing(validator)
        let order = await Order.query()
            .where("id", data.orderId)
            .andWhereIn("status", ["CREATED"])
            .first()
        if (!order!) {
            return response.status(422).json({
                message: i18n.t("Commande non trouvée")
            })
        }
        try {
            order.merchantId = auth.user!.merchantId!
            order.status = "WASHING"
            order.merchantPaymentStatus = "PENDING";
            await order.save()
            return order!
        } catch (e) {
            return response.status(400).json({
                message: i18n.t("Une erreur est survenue lors de la validation de la commande. Veuillez réssager")
            })
        }
    }

    async merchantOrderAction({ request, auth, i18n, response }: HttpContext) {
        const data = await request.validateUsing(vine.compile(vine.object({
            action: vine.string().in(["WASHED", "REJECTED"]),
            orderId: vine.number().exists(async (_, value) => {
                let order = await Order.findBy({ "id": value, status: "WASHING" })
                return !!order
            }),
        })))
        let order = await Order.query()
            .where("id", data.orderId)
            .andWhere("status", "WASHING")
            .andWhere("merchantId", auth.user!.merchantId!)
            .first()
        if (!order) {
            return response.status(422).json({
                message: i18n.t("Commande non trouvée")
            })
        }
        try {
            order.status = data.action == "WASHED" ? "READY" : "CREATED"
            order.merchantId = data.action == "WASHED" ? order.merchantId : null

            await order.save()
        } catch (e) {
            return response.status(400).json({
                message: i18n.t("Une erreur est survenue lors de la mise à jour de la commande. Veuillez réssager")
            })
        }
    }

    async customerConfirmOrderReception({ request, auth, i18n, response }: HttpContext) {
        const validator = vine.compile(vine.object({
            orderId: vine.number().exists(async (_, value) => {
                let order = await Order.findBy({ "id": value, status: "READY", userId:auth.user!.id })
                return !!order
            }),
        }))

        const data = await request.validateUsing(validator)
        let order = await Order.query()
            .where("id", data.orderId)
            .andWhere("status", "READY")
            .andWhere("userId", auth.user!.id)
            .first()
        if (!order!) {
            return response.status(422).json({
                message: i18n.t("Commande non trouvée")
            })
        }
        try {
            order.status = "DELIVERED"
            await order.save()
            return order!
        } catch (e) {
            console.log(e)
            return response.status(400).json({
                message: i18n.t("Une erreur est survenue lors de la validation de la commande. Veuillez réssager")
            })
        }
    }

    async processNextCommandOrders(command: Command, dtx?: any) {
        if (command.totalExecution >= 4) {
            return
        }
        await command.load("addons")
        await command.load("package")
        await command.load("invoice")
        const tx = dtx ?? await db.transaction()
        try {
            const startDate = command.commandStartAt
            const nextWeekPickups = this.getPickupsDates(startDate!.plus({ days: command.totalExecution * 7 })!.toJSDate(), command.pickingDaysTimes, true)
            let i = 0
            const commandExecutionIndex = command.totalExecution + 1
            for (let pickup of nextWeekPickups) {
                i++
                await this.createNextOrder(command, {
                    commandExecutionIndex: commandExecutionIndex,
                    executionDate: pickup[0] as Date,
                    orderExecutionIndex: i,
                    pickingHours: pickup[2] as [string, string]
                }, tx)
            }
            command.totalExecution = commandExecutionIndex
            if (!dtx) await tx.commit()
        } catch (e) {
            console.log(e)
            if (!dtx) await tx.rollback()
        }

    }

    getSubscriptionValidityPeriod(paymentDate: Date, pickupDays: [number, [string, string]][], deliveryDelayHours = 48) {

        const nextPickupDates: Date[] = this.getPickupsDates(paymentDate, pickupDays, true).map(d => d[0]) as any
        const firstPickup = nextPickupDates.sort((a, b) => a.getTime() - b.getTime())[0];
        // Début d’abonnement = date du premier ramassage
        const startDate = new Date(firstPickup);
        // Fin d’abonnement = début + 4 semaines
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 28); // 4 semaines
        // Ajout du délai de livraison final (par défaut 48h)
        endDate.setHours(endDate.getHours() + deliveryDelayHours);

        return { startDate, endDate };
    }

    getPickupsDates(initialDate: Date, pickupDays: [number, [string, string]][], includeToday = true) {
        const today = initialDate.getDay();

        const pickups = pickupDays//.map(d=>d[0] == 7?0:d[0])
        // Trouver le premier jour de ramassage après la date de paiement
        console.log(pickups)
        return pickups.map(([dayIndex, hours]) => {
            let day = dayIndex == 7 ? 0 : dayIndex
            let daysToAdd = day - today;
            if (includeToday) {
                if (daysToAdd < 0) daysToAdd += 7;
            } else {
                if (daysToAdd <= 0) daysToAdd += 7;
            }
            // prochaine semaine
            const nextDate = new Date(initialDate);
            nextDate.setDate(initialDate.getDate() + daysToAdd);
            nextDate.setHours(0, 0, 0, 0);
            console.log(initialDate, today, nextDate)
            return [nextDate, dayIndex, hours];
        });
    }

    



}