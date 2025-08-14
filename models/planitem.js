const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const planitem = new Schema(
  {
    pricingStrategy: {
      type: Number,
      default: 31,
    },
    planItem: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: Schema.Types.ObjectId,
      // ref:  Plancategory.modelName,
    },
    subCategory: {
      type: Schema.Types.ObjectId,
      // ref:  PlanSubCategory.modelName,
    },
    unit: {
      type: String,
      required: true,
    },
    lower: {
      type: Number,
      required: true,
    },
    upper: {
      type: Number,
      required: true,
    },
    species: {
      type: Schema.Types.ObjectId,
      // ref:  Species.modelName,
      default: null,
    },
    breed: {
      type: Schema.Types.ObjectId,
      // ref:  Breed.modelName,
      default: null,
    },
    // Status => 1: Active, 2: Inactive
    status: {
      type: Number,
      default: 1,
    },
    upperAgeDays: {
      type: Number,
      default: 0,
    },
    lowerAgeDays: {
      type: Number,
      default: 0,
    },
    remGrpId: {
      type: Schema.Types.ObjectId,
      // ref:  ReminderGrp.modelName,
      default: null,
    },
    template_id: {
      type: Schema.Types.ObjectId,
      // ref:  Template.modelName,
      default: null,
    },
    note: {
      type: String,
      default: null,
    },
    reportcard: {
      type: String,
      trim: true,
      default: null,
    },
    is_vetrocket: {
      type: Number,
      default: 15, //14=true,15=false
    },
    znlabs_planid: {
      type: Schema.Types.ObjectId,
      // ref:  Zrlplan.modelName,
      default: null,
    },
    vscan_planid: {
      type: Schema.Types.ObjectId,
      // ref:  Vscanplan.modelName,
      default: null,
    },
    idexxin_planid: {
      type: Schema.Types.ObjectId,
      // ref:  Idexxinplan.modelName,
      default: null,
    },
    idexx_planid: {
      type: Schema.Types.ObjectId,
      // ref:  Idexxplan.modelName,
      default: null,
    },
    antech_planid: {
      type: Schema.Types.ObjectId,
      // ref:  AntechItem.modelName,
      default: null,
    },
    planitemLog: {
      type: String,
      default: null,
    },
    svs_planid: {
      type: Schema.Types.ObjectId,
      // ref:  SvsItems.modelName,
      default: null,
    },
    type: String, // For boarding item type = boarding
    planitemNo: { type: Number },
  },
  { autoIndex: true, strict: false }
);

// index for case insensitive unique
planitem.index(
  { planItem: 1 },
  {
    collation: { locale: "en", strength: 2 },
    unique: true,
  }
);
// Change start_seq to have different starting count
// planitem.plugin(AutoIncrement, {
//   id: "planitemNo",
//   inc_field: "planitemNo",
//   start_seq: 1,
// });

module.exports = mongoose.model("planitems", planitem);
