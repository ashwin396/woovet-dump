const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const SalesSchema = new Schema(
  {
    invoiceId: {
      type: Schema.Types.ObjectId,
      // ref:  Invoice.modelName,
      default: null,
      // index: true,
    },
    referralId: {
      type: Schema.Types.ObjectId,
      // ref:  Staff.modelName,
      default: null,
    },
    encounterId: {
      type: Schema.Types.ObjectId,
      // ref:  Encounter.modelName,
      default: null,
    },
    planitemId: {
      type: Schema.Types.ObjectId,
      // ref:  PlanItem.modelName,
      default: null,
    },
    clinicId: {
      type: Schema.Types.ObjectId,
      // ref:  Clinic.modelName,
      default: null,
    },
    staffId: {
      type: Schema.Types.ObjectId,
      // ref:  Staff.modelName,
      default: null,
    },
    discountId: {
      type: Schema.Types.ObjectId,
      // ref:  Discount.modelName,
      default: null,
    },
    patientId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    clientId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    quantity: {
      type: Number,
      default: 0,
    },
    clinicCost: {
      type: Number,
      default: 0,
    },
    tax: {
      type: Number,
      default: 0,
    },
    discount: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      default: 0,
    },
    decline: {
      type: Boolean,
      default: false,
    },
    commission: {
      type: Number,
      default: 0,
    },
    serviceFee: {
      type: Number,
      default: 0,
    },
    calc_format: {
      type: Number,
      default: 0,
    },
    minCost: {
      type: Number,
      default: 0,
    },
    maxCost: {
      type: Number,
      default: 0,
    },
    isReturn: {
      type: Boolean,
      default: false,
    },
    wellItemId: {
      type: Schema.Types.ObjectId,
    },
    equineBilling: {
      type: Boolean,
      default: false,
    },
  },
  { strict: false }
);

module.exports = mongoose.model("sales", SalesSchema);
