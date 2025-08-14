const mongoose = require("mongoose");
const dayjs = require("dayjs");
const Encounter = require("./models/Encounter");
const Patient = require("./models/Patient");
const Clinic = require("./models/Clinic");
const Staff = require("./models/Staff");
const MigEncounterSchema = require("./models/MigEncounter");
const FailedEncounter = require("./models/FailedEncounter");
const MergeProgress = require("./models/Progress");

const BATCH_SIZE = 1;

async function processCollection(collectionName) {
  const source = mongoose.model(
    collectionName,
    MigEncounterSchema,
    collectionName
  );

  const clinics = await Clinic.find({}, { f_clinic: 1 }).then((res) => {
    let data = res.reduce((acc, curr) => {
      return { ...acc, [curr.f_clinic]: curr._id };
    }, {});
    return data;
  });
  const staffs = await Staff.find({}, { f_staff: 1 }).then((res) => {
    let data = res.reduce((acc, curr) => {
      return { ...acc, [curr.f_staff]: curr._id };
    }, {});
    return data;
  });

  const progress =
    (await MergeProgress.findOne({ collectionName })) ||
    new MergeProgress({ collectionName });

  const query = progress.lastProcessedId
    ? { _id: { $gt: progress.lastProcessedId } }
    : {};

  let hasMore = true;

  while (hasMore) {
    const docs = await source
      .aggregate([
        { $sort: { _id: 1 } },
        { $match: query },
        { $limit: BATCH_SIZE },
        {
          $unwind: {
            path: "$record",
          },
        },
      ])
      .allowDiskUse(true);

    if (docs.length === 0) {
      hasMore = false;
      break;
    }

    for (let doc of docs) {
      let item = doc.record;
      try {
        const patient = await Patient.findOne(
          { f_id: item.f_patientid },
          { _id: 1 }
        ).lean();

        if (!patient) {
          await FailedEncounter.create({
            ...item,
            mig_id: doc._id,
            code: 500,
            reason: "Patient not found",
          });
          continue;
        }

        let data = {
          name: item.masterproblem,
          f_patientid: item.f_patientid,
          f_clinicid: item.f_clinicid,
          f_encounterid: item.f_encounterid,
          assignedtowhom: item.assignedtowhom,
          encNo: item.f_encounterid * 1,
          des: item.masterproblem,
          clinicId: clinics[item.f_clinicid],
          provider: staffs[item.assignedtowhom],
          patientId: patient._id,
          status: item.status === "Open" ? 1 : 2,
          updatedAt: item.lastmodified
            ? dayjs(Number(item.lastmodified) * 1000).toDate()
            : dayjs(Number(item.pdatetime) * 1000).toDate(),
          createdAt: dayjs(Number(item.pdatetime) * 1000).toDate(),
          emr: [],
          xmlData: item.xmltext,
        };

        await Encounter.create(data);
      } catch (err) {
        await FailedEncounter.create({
          ...item,
          mig_id: doc._id,
          code: err?.code == 11000 ? 11000 : null,
          reason: err?.code == 11000 ? "Duplicates" : err.message,
        });
        console.error(
          `Duplicates or errors encountered from ${collectionName}:`,
          err.message
        );
      }
    }

    const lastId = docs[docs.length - 1]._id;
    await MergeProgress.updateOne(
      { collectionName },
      { $set: { lastProcessedId: lastId } },
      { upsert: true }
    );

    query._id = { $gt: lastId };
  }

  console.log(`Finished processing ${collectionName}`);
}

async function mergeAllCollections(collectionNames) {
  for (const name of collectionNames) {
    await processCollection(name);
  }
}
module.exports = mergeAllCollections;
