const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const FailedEncounter = new Schema(
  {},
  { timestamps: true, autoIndex: true, strict: false }
);
module.exports = mongoose.model(
  "failed_encounter",
  FailedEncounter,
  "failed_encounter"
);
