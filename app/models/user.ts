import { DateTime } from 'luxon'
import { BaseModel, column, computed, hasOne } from '@adonisjs/lucid/orm'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import env from '#start/env'
import { type HasOne } from '@adonisjs/lucid/types/relations'
import Merchant from './merchant.js'


export default class User extends BaseModel {

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare lastname: string | null

  @column()
  declare firstname: string | null

  @column()
  declare role: "CLIENT" | "CLEANER" | "ADMIN"

  @column()
  declare email: string | null

  @column()
  declare otpHash: string | null

  @column()
  declare phone: string | null

  @column()
  declare lastDevice: string | null

  @column()
  declare imageUrl: string


  @column()
  declare merchantId?: number

  @hasOne(() => Merchant, {
    foreignKey: "id",
    localKey: "merchantId"
  })
  declare merchant: HasOne<typeof Merchant>

  @computed()
  get imageFullUrl() {
    return this.imageUrl.startsWith("http") ? this.imageUrl : env.get("DOMAINE") + this.imageUrl
  }

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  static accessTokens = DbAccessTokensProvider.forModel(User)
}