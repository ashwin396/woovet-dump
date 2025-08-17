const xml2js = require("xml2js");
const axios = require("axios");
const FormData = require("form-data");
const AWS = require("aws-sdk");
require("dotenv").config();

// MODELS
const Encounter = require("./models/Encounter.js");
const Attach = require("./models/Attach.js");
const MergeProgress = require("./models/Progress");
const FailedParsing = require("./models/FailedParsing");

// Configure AWS SDK (set your credentials and region)
// const s3 = new AWS.S3({
//   accessKeyId: process.env.ACCESS_KEY, // set in your .env
//   secretAccessKey: process.env.SECRET_ACCESS_KEY, // set in your .env
//   region: process.env.REGION,
// });

async function uploadAttachments(data) {
  const bucket = "brookvillerah-woovetbucket";
  // Check if file exists in S3
  try {
    const doc = await Attach.findOne({ recordno: data.recordno }).lean();

    console.log("test");
    await s3
      .headObject({
        Bucket: bucket,
        Key: doc.file.file_content.split("amazonaws.com/")[1],
      })
      .promise();
    console.log("exists");
    // File exists, return its info
    return {
      exists: true,
    };
  } catch (err) {
    if (err.code !== "NotFound") throw err;
    // File does not exist, proceed to upload
    console.log(err);
    const form = new FormData();
    form.append("tablename", data.tablename);
    form.append("recordno", data.recordno);
    form.append(
      "path",
      `emr~${data.clinic}~${data.client}~${data.patient}~${data.encounter}~`
    );
    form.append("tenantid", "brookvillerah");

    const res = await axios.post(
      "https://brookvillerah.vetport.com/woovet_attachment.html",
      form,
      {
        headers: {
          ...form.getHeaders(),
          Cookie: "re-mind54842=28-3899336014-97375451",
        },
      }
    );

    console.log(res.data);

    let file = {
      file_content: `https://${bucket}.s3.ap-south-1.amazonaws.com/emr/${data.clinic}/${data.client}/${data.patient}/${data.encounter}/${res.data}`,
      file_name: res.data.split(".")[0],
      file_ext: res.data.split(".")[1],
      exists: false,
    };

    return file;
  }
}

async function migrateEncounter() {
  const parser = new xml2js.Parser(/* options */);

  const batchSize = 20;
  for (let page = 1; page <= 1000000; page++) {
    const lastProcessed = await MergeProgress.findOne({
      collectionName: "encs",
    }).lean();

    const encounters = await Encounter.aggregate([
      { $sort: { _id: 1 } },
      {
        $match: lastProcessed
          ? { _id: { $gt: lastProcessed.lastProcessedId } }
          : {},
      },
      { $limit: batchSize },
      {
        $lookup: {
          from: "patients",
          localField: "patientId",
          foreignField: "_id",
          as: "patient",
        },
      },
      {
        $project: {
          xmlData: 1,
          patient: "$patientId",
          client: { $arrayElemAt: ["$patient.clientId", 0] },
          clinic: "$clinicId",
        },
      },
    ]);

    if (encounters.length <= 0) {
      break;
    }

    let lastProcessedId,
      bulkArr = [];
    console.log(`Processing record ${page}`);
    for (let item of encounters) {
      console.log(`Processing encounter ${item._id}`);

      lastProcessedId = item._id;
      if (item.xmlData) {
        let result;
        try {
          let processedXml = item.xmlData.replace(/Weight\(kg\)/gi, "Weight");
          result = await parser.parseStringPromise(processedXml);
        } catch (error) {
          await FailedParsing.create({ encounterId: item._id });
          console.error(
            `Error parsing XML for encounter ${item.f_encounterid}:`,
            error
          );
          continue;
        }
        if (
          result?.MedicalRecord?.MasterProblemList &&
          result.MedicalRecord.MasterProblemList.length > 0
        ) {
          let MasterProblemList = result.MedicalRecord.MasterProblemList;
          for (let v of MasterProblemList) {
            if (
              !v.MasterProblemStartTimeStamp ||
              !v.MasterProblemStartTimeStamp.length
            )
              continue;

            for (let mod of v.MasterProblemStartTimeStamp) {
              if (!mod.TimeStamp || !mod.TimeStamp.length) continue;

              for (let node of mod.TimeStamp) {
                if (node?.$?.Form) {
                  // Switch based on Form type
                  switch (node.$.Form) {
                    case "AttachedFile": {
                      // Condition for plan performed
                      if (node?.Type?.[0]?.Uploaded?.length) {
                        console.log(`attachment processing`);

                        let attachIds = node.Type[0].Uploaded[0]?.$
                          .AttachmentsID
                          ? node.Type[0].Uploaded[0]?.$.AttachmentsID.split(
                              ","
                            ).filter((v) => v.trim() !== "")
                          : [];
                        for (let i of attachIds) {
                          let file = await uploadAttachments({
                            client: item.client,
                            patient: item.patient,
                            encounter: item._id,
                            clinic: item.clinic,
                            recordno: i,
                            tablename: "diagnosisimage",
                          });

                          if (!file.exists) {
                            bulkArr.push({
                              updateOne: {
                                filter: { recordno: i },
                                update: {
                                  file: file,
                                  tablename: "diagnosisimage",
                                  recordno: i,
                                  encounterId: item._id,
                                },
                                upsert: true,
                              },
                            });
                          }
                        }
                      }
                      break;
                    }

                    default: {
                      break;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    try {
      await Attach.bulkWrite(bulkArr);
    } catch (err) {
      console.error(err);
    }

    const doc = await MergeProgress.updateOne(
      { collectionName: "encs" },
      {
        $set: { lastProcessedId },
        $inc: { totalProcessed: encounters.length },
      },
      { upsert: true, new: true }
    );

    console.log(`Page ${page} processed`);
    console.log(`${doc.totalProcessed} docs processed`);
  }
  console.log("done processing");
}

module.exports = migrateEncounter;
