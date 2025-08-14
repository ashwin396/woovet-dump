const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const phoneSchema = new Schema(
  {
    _id: false,
    phoneType: {
      type: Schema.Types.ObjectId,
      // ref:  PhoneType.modelName,
      required: true,
    },
    pnumber: {
      type: String,
      required: true,
      trim: true,
    },
    isDefault: {
      type: Number,
      default: 0,
    },
  },
  { strict: true }
);

const clinic = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    emailVerified: {
      type: Boolean,
      // required: true,
    },
    bricknMortar: {
      type: Number,
      default: 15,
    },
    referral: {
      type: Number,
      default: 15,
    },
    equine: {
      type: Number,
      default: 15,
    },
    mobile: {
      type: Number,
      default: 15,
    },
    locationId: [
      {
        type: Schema.Types.ObjectId,
        // ref:  McLocation.modelName,
      },
    ],
    address1: {
      type: String,
      required: true,
      trim: true,
    },
    country: {
      type: Schema.Types.ObjectId,
      // ref:  Country.modelName,
      required: true,
    },
    state: {
      type: Schema.Types.ObjectId,
      // ref:  State.modelName,
      required: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    zipcode: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
    },
    timezone: {
      type: Schema.Types.ObjectId,
      // ref:  Timezone.modelName,
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    phone: [phoneSchema],
    status: {
      type: Number,
      default: 1,
    },
    gstNumber: {
      type: String,
      trim: true,
    },
    trnNumber: {
      type: String,
      trim: true,
    },
    clinicLog: {
      type: String,
      default: null,
    },
    clinicNo: { type: Number },
    facilities: [
      {
        facilityId: Schema.Types.ObjectId,
        facilityName: String,
        _id: false,
      },
    ],
  },
  {
    timestamps: true,
    autoIndex: true,
    strict: false,
  }
);

// Change start_seq to have different starting count
// clinic.plugin(AutoIncrement, {
//   inc_field: "clinicNo",
//   start_seq: 1,
// });

module.exports = mongoose.model("clinic", clinic);
