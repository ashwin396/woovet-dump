const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const encounter = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    patientId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    clinicId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    encounterLog: {
      type: String,
      default: null,
    },
    des: {
      type: String,
      required: true,
      trim: true,
    },
    provider: {
      type: Schema.Types.ObjectId,
      // ref:  Staff.modelName,
      default: null,
    },
    status: {
      type: Number,
      default: 1,
    },
    blocked: {
      type: Boolean,
      default: false,
    },
    emr: {
      type: Array,
      default: [],
    },
    encNo: { type: Number },
  },
  {
    timestamps: true,
    autoIndex: true,
    strict: false,
  }
);

encounter.index({ patientId: 1 });

// index for case insensitive unique
encounter.index(
  { name: 1, patientId: 1 },
  {
    collation: { locale: "en", strength: 2 },
    unique: true,
  }
);

module.exports = mongoose.model("encounter", encounter);
