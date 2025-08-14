const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const attach = new Schema(
  {},
  { timestamps: true, strict: false, autoIndex: true }
);

module.exports = mongoose.model("attach", attach, "attach");
