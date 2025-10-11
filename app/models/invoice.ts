import { DateTime } from 'luxon'
import { BaseModel, column, hasOne } from '@adonisjs/lucid/orm'
import User from './user.js'
import { type HasOne } from '@adonisjs/lucid/types/relations'

export default class Invoice extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare invoiceType: "SUBSCRIPTION_LAUNDRY" | "COMMAND_LAUNDRY" | "SUBSCRIPTION_OVERWEIGHT"

  @column()
  declare amount: string

  @column.dateTime()
  declare paidAt?:DateTime

  @column()
  declare paymentHash: string

  @column()
  declare status: "CREATED" | "PENDING" | "SUCCESS" | "FAILED"

  @column()
  declare userId: number

  @hasOne(() => User, {
    foreignKey: "id",
    localKey: "userId"
  })
  declare user: HasOne<typeof User>


  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}