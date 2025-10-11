import Config from '#models/config'
import Merchant from '#models/merchant'
import Package from '#models/package'
import ServiceAddon from '#models/service_addons'
import { BaseSeeder } from '@adonisjs/lucid/seeders'

export default class extends BaseSeeder {
  async run() {
    //Configs
    Config.createMany([
      // {
      //   key: "COST_PER_KG",
      //   value: "600"
      // },
      {
        key: "SERVICE_MERCHANT_COST_PER_KG",
        value: "300"
      },
      {
        key: "SERVICE_DELIVERY_COST",
        value: "500"
      }
    ])
    // Package seeder
    const packages = [
      {
        name: "Lessive unique",
        code: "LESSIVE_UNIQUE",
        kg: 1,
        amount:600,
        isSubscriptable: false,
        meta: {
          nombreDeJoursDeVetementMin: 5,
          nombreDeJoursDeVetementMax: 6
        }
      },
      // Total: 10000
      // Cout lessive : 6000
      // Cout livraison : 2000
      // Marge nette : 2000 
      {
        name: "Plan célibatire",
        code: "LESSIVE_CELIBATAIRE",
        kg: 5,
        amount:2500,
        isSubscriptable: true,
        meta: {
          nombreDeJoursDeVetementMin: 5,
          nombreDeJoursDeVetementMax: 6
        }
      },
      {
        name: "Plan couple",
        code: "LESSIVE_COUPLE",
        kg: 10,
        amount:5500,
        isSubscriptable: true,
        
        meta: {
          nombreDeJoursDeVetementMin: 5,
          nombreDeJoursDeVetementMax: 6,
          nombreDePersonnesMin: 2
        }
      },
      {
        name: "Plan famille",
        code: "LESSIVE_FAMILLE",
        kg: 30,
        amount:14500,
        isSubscriptable: true,
        paidMultiplePickMin:2,
        meta: {
          nombreDeJoursDeVetementMin: 5,
          nombreDeJoursDeVetementMax: 6,
          nombreDePersonnesMin: 5,
          nombreDePersonnesMax: 6
        }
      }
    ]
    await Package.createMany(packages)


    await ServiceAddon.createMany([
      {
        key: "PICKING_MULTIPLE",
        code: "PICKING_MULTIPLE",
        name: "Collecte",
        price: 500,
        value: {
          merchantCost: 0
        }
      },
      {
        key: "SHIPPING",
        code: "SHIPPING_DEFAULT",
        name: "Standard",
        price: 0,
        value: {
          timeDurationApprox: 48,
          merchantCost: 0
        }
      },
      {
        key: "SHIPPING",
        code: "SHIPPING_FAST",
        name: "Standard",
        price: 100,
        value: {
          timeDurationApprox: 24,
          merchantCost: 50
        }
      },
      {

        key: "REPASSAGE",
        code: "REPASSAGE",
        name: "Repassage",
        price: 100,
        value: {
          merchantCost: 50
        }
      },
      // {
      //   key: "SHIPPING",
      //   code: "SHIPPING_PRIORITIZED",
      //   name: "Standard",
      //   price: '2000',
      //   value: {
      //     timeDurationApprox: "6"
      //   }
      // },
    ])

    await Merchant.createMany([
      {
        name:'Ets Cleaner',
        phones:["+2290191919191"],
      }
    ])


  }
}