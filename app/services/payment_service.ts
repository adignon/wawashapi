import Invoice from "#models/invoice";
import logger from "@adonisjs/core/services/logger";
import { FedaPay } from "./gateways/fedapay_service.js";
import { DateTime } from "luxon";

export class PaymentService {
  static async payInvoice(invoice: Invoice) {
    try {

      const fedapay = new FedaPay();

      switch (invoice.status) {
        case "PENDING":
          return (await fedapay.initiateTrasaction(invoice.paymentHash)).transactionUrl;

        case "CREATED":
        case "FAILED":
          //const result = await fedapay.createTransaction(invoice);
          invoice.paymentHash = "JjJrVT0RTIc0DQqoyHlnV41G5JeKGTdc67QtF20"//result.transactionId;
          invoice.status = "PENDING";
          await invoice.save();
          //return result.transactionUrl;
          return "https://process.fedapay.com/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEwNjc3MTk0NCwiZXhwIjoxNzU5OTIxODAwfQ.Xu__JjJrVT0RTIc0DQqoyHlnV41G5JeKGTdc67QtF20"

        case "SUCCESS":
          throw new Error("Transaction already paid");

        default:
          throw new Error("Unknown transaction status");
      }

    } catch (error) {
      logger.error('Error creating transaction: %s', error)
      throw error;
    }
  }

  static async verifyInvoice(invoice: Invoice) {
    try {
      if (invoice.status === "PENDING") {
        const fedapay = new FedaPay();
        const status = await fedapay.getTransactionStatus(invoice.paymentHash);
        if (status === "FAILED" || status === "SUCCESS") {
          invoice.status = status;
          invoice.paidAt = DateTime.now()
          await invoice.save();
        }
      }
      return invoice
    } catch (error) {
      logger.error('Validating creating transaction: %s', error)
      throw error;
    }
  }
}