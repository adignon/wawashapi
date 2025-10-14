import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.raw(`
      CREATE TRIGGER update_merchant_balance_on_delivery
      AFTER UPDATE ON orders
      FOR EACH ROW
      BEGIN
        IF NEW.status = 'DELIVERED' AND OLD.status = 'READY' AND NEW.merchant_id IS NOT NULL AND NEW.merchant_total_cost IS NOT NULL THEN
          UPDATE merchants
          SET balance = balance + NEW.merchant_total_cost,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = NEW.merchant_id;
        END IF;
      END
    `)
  }

  async down() {
    this.schema.raw('DROP TRIGGER IF EXISTS update_merchant_balance_on_delivery')
  }
}
