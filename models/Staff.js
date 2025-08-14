const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const staff = new Schema(
  {
    clinic: {
      type: Schema.Types.ObjectId,
      // ref:  Clinic.modelName,
      required: true,
      index: 1,
    },
    locationId: {
      type: Schema.Types.ObjectId,
      // ref:  McLocation.modelName,
      default: null,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
    },
    address1: {
      type: String,
      trim: true,
      required: true,
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
      trim: true,
      required: true,
    },
    zipcode: {
      type: String,
      trim: true,
      required: true,
    },
    personalPhone: {
      _id: false,
      phoneType: {
        type: Schema.Types.ObjectId,
        // ref:  PhoneType.modelName,
      },
    },
    alternatePhone: {
      _id: false,
      phoneType: {
        type: Schema.Types.ObjectId,
        // ref:  PhoneType.modelName,
      },
    },
    dob: {
      type: Date,
    },
    designationId: {
      type: Schema.Types.ObjectId,
      // ref:  StaffDesignation.modelName,
      default: null,
    },
    status: {
      type: Number,
      default: 1,
    },
    isProvider: {
      type: Number,
      default: 15,
      //14
    },
    isPrescProvider: {
      type: Number,
      default: 15,
    },
    emailSent: {
      type: Number,
      default: 15,
    },
    specialization: {
      type: Schema.Types.ObjectId,
      // ref:  Specialization.modelName,
      default: null,
    },
    language: {
      type: String,
      trim: true,
      default: "english",
    },
    staffLog: {
      type: String,
      default: null,
    },
    sigValue: {
      type: String,
      default: null,
      trim: true,
    },
    staffNo: { type: Number },
  },
  {
    timestamps: true,
    autoIndex: true,
    strict: false,
  }
);

// Change start_seq to have different starting count
// staff.plugin(AutoIncrement, {
//   inc_field: "staffNo",
//   start_seq: 1,
// });

module.exports = mongoose.model("staff", staff);
