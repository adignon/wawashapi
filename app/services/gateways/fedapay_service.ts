import axios from "axios"
import logger from '@adonisjs/core/services/logger'
import Invoice from "#models/invoice";
import env from "#start/env";


interface IFedapayTransaction {
  "id": string,
  "reference": string,
  "amount": number,
  "description": string,
  "callback_url": string,
  "status": string,
  "customer_id": number,
  "currency_id": number,
  "mode": string,
  "metadata": object,
  "commission": number,
  "fees": number,
  "fixed_commission": number,
  "amount_transferred": number,
  "created_at": string,
  "updated_at": string,
  "approved_at": string,
  "canceled_at": string,
  "declined_at": string,
  "refunded_at": string,
  "transferred_at": string,
  "deleted_at": string,
  "last_error_code": string,
  "custom_metadata": object,
  "amount_debited": string,
  "receipt_url": string,
  "payment_method_id": string,
  "sub_accounts_commissions": any[],
  "transaction_key": string,
  "merchant_reference": string,
  "account_id": string,
  "balance_id": string
}


export class FedaPay {

  apiKey: string
  pbKey: string
  baseUrl: string
  env: string
  version: string

  constructor() {
    this.apiKey = env.get("FEDAPAY_SK")!;
    this.pbKey =  env.get("FEDAPAY_PK")!;
    this.env = "live"
    this.version = "v1"
    this.baseUrl = this.env == "live" ? 'https://api.fedapay.com/' + this.version : 'https://sandbox-api.fedapay.com/' + this.version;
  }

  async createTransaction(invoice: Invoice) {
    try {
      const { data } = await axios.post(`${this.baseUrl}/transactions`, {
        amount:"1000", //invoice.amount,
        currency: {
          iso: "XOF"
        },
        description: "Service payment",
        metadata: {
          invoiceId: invoice.id,
        },

      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      const transaction = Object.values(data)[0] as IFedapayTransaction
      return await this.initiateTrasaction(transaction.id)
    } catch (error) {
      logger.error('Error creating transaction: %s', error)
      throw error;
    }
  }

  async initiateTrasaction(transactionId: string) {

    const { data: tokenResult } = await axios.post(`${this.baseUrl}/transactions/${transactionId}/token`, {}, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    return {
      transactionUrl: tokenResult.url as string,
      transactionId,
    }
  }

  async getTransactionStatus(transactionId: string): Promise<"SUCCESS" | "FAILED" | "PENDING"> {
    return "SUCCESS"
    const { data } = await axios.get(`${this.baseUrl}/transactions/${transactionId}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    const transaction = Object.values(data)[0] as IFedapayTransaction
    
    if (transaction.status === "approved") {
      return "SUCCESS"
    } else if (transaction.status === "pending") {
      return "PENDING";
    } else {
      return "FAILED"
    }

  }

}


