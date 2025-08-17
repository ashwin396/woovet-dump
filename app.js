const express = require("express");
const mongoose = require("mongoose");
// const mergeAllCollections = require("./merge");
// const processSalesCollection = require("./sales");
const migrateEncounter = require("./encounter");
require("dotenv").config();

const app = express();
const PORT = 3000;

const COLLECTIONS = [
  "mig_encounter",
  "mig_encounterOld",
  "mig_encounter_1577836800",
  "mig_encounter_1609459200",
  "mig_encounter_1625097600",
]; // change accordingly

mongoose.connect(
  "mongodb://woovet:woovet%232023@13.200.177.1:27017/brookvillerah?authSource=admin&readPreference=primary&ssl=false",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

mongoose.connection.once("open", async () => {
  console.log("Connected to MongoDB");

  try {
    await migrateEncounter();
    console.log("Data merge completed successfully.");
  } catch (err) {
    console.error("Merge process failed:", err);
    process.exit(1);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
