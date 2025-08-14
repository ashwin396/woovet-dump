const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const attachtype = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    desc: {
      type: String,
      trim: true,
    },
    status: {
      type: Number,
      default: 1, // 1 is for active and 2 is for Inactive
    },
  },
  {
    timestamps: true,
    autoIndex: true,
    strict: false,
  }
);

// index for case insensitive unique
attachtype.index(
  { name: 1 },
  {
    collation: { locale: "en", strength: 2 },
    unique: true,
  }
);

module.exports = mongoose.model("attch_type", attachtype);
