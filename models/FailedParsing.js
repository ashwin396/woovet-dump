const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const FailedEncounter = new Schema(
  {},
  { timestamps: true, autoIndex: true, strict: false }
);
module.exports = mongoose.model(
  "failed_encounter_parsing",
  FailedEncounter,
  "failed_encounter_parsing"
);
