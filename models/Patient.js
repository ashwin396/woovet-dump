const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const refSchema = new Schema(
  {
    _id: false,
    clinic: {
      type: Schema.Types.ObjectId,
      // ref:  Clinic.modelName,
    },
    provider: {
      type: Schema.Types.ObjectId,
      // ref:  Staff.modelName,
    },
    // 0 => undefined, 1 => active
    isDefault: {
      type: Number,
      default: 0,
    },
  },
  { strict: true }
);

const patientregistration = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    patientLog: {
      type: String,
      default: null,
    },
    clientId: {
      type: Schema.Types.ObjectId,
      // ref:  Client.modelName,
      required: true,
    },
    species: {
      type: Schema.Types.ObjectId,
      // ref:  Species.modelName,
      // required: true,
    },
    breed: {
      type: Schema.Types.ObjectId,
      // ref:  Breed.modelName,
    },
    sex: {
      type: Schema.Types.ObjectId,
      // ref:  Sex.modelName,
      default: null,
    },
    color: {
      type: Schema.Types.ObjectId,
      // ref:  Color.modelName,
    },
    preferredProvider: {
      type: Schema.Types.ObjectId,
      // ref:  Staff.modelName,
    },
    patient_cat: {
      type: Schema.Types.ObjectId,
    },
    referrals: [refSchema],
    currentWeight: {
      type: Schema.Types.ObjectId,
      // ref:  Weight.modelName,
    },

    patientWeight: {
      type: Number,
      default: 0,
    },
    // 7 => yes, 8 => no
    isTaxable: {
      type: Number,
      default: 0,
    },
    // 7 => yes, 8 => no
    isDiscount: {
      type: Number,
      default: 0,
    },
    discount: [
      {
        type: Schema.Types.ObjectId,
        // ref:  Discount.modelName,
      },
    ],
    dob: {
      type: Date,
      default: null,
    },
    m_date: {
      type: Date,
      default: null,
    },
    // 1 => active, 2 => inactive, 3 => deceased
    status: {
      type: Number,
      default: 1,
    },
    // dummy field will be added for only dummy patients else it wont be added..
    // dummy: {
    //   type: Number,
    //   default: 0,
    // },
    patientInfo: {
      type: String,
      default: "",
      trim: true,
    },
    deceasedDate: {
      type: Date,
    },
    alert: {
      type: String,
      trim: true,
    },
    microchipId: {
      type: String,
      trim: true,
    },
    rabiestagId: {
      type: String,
      trim: true,
    },
    remarks: {
      type: String,
      trim: true,
    },
    cityLicense: {
      type: String,
      trim: true,
    },
    identity: {
      type: String,
      trim: true,
    },
    rtid: {
      type: String,
      trim: true,
    },
    ttid: {
      type: String,
      trim: true,
    },
    tags: [
      {
        type: Schema.Types.ObjectId,
        // ref:  Tag.modelName,
      },
    ],
    patientNo: { type: Number },
  },
  {
    // timestamps: true,
    autoIndex: true,
    strict: false,
  }
);
patientregistration.index({ clientId: 1 });
patientregistration.index({ patientInfo: "text" });

// Change start_seq to have different starting count
// patientregistration.plugin(AutoIncrement, {
//   inc_field: "patientNo",
//   start_seq: 1,
// });

module.exports = mongoose.model("patient", patientregistration);
