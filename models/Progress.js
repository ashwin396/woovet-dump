const mongoose = require("mongoose");

const progressSchema = new mongoose.Schema({
  collectionName: String,
  lastProcessedId: mongoose.Schema.Types.ObjectId,
  totalProcessed: {
    type: Number,
    default: 0,
  },
});

module.exports = mongoose.model("merge_progress", progressSchema);
