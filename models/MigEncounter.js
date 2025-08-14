const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const MigEncounter = new Schema(
  {},
  { timestamps: true, autoIndex: true, strict: false }
);
module.exports = MigEncounter;
