const mongoose = require("mongoose");
const dayjs = require("dayjs");
const Encounter = require("./models/Encounter");
const Patient = require("./models/Patient");
const Clinic = require("./models/Clinic");
const Staff = require("./models/Staff");
const Sales = require("./models/Sales");
const Invoice = require("./models/Invoice");
const PlanItem = require("./models/planitem");
const MergeProgress = require("./models/Progress");

async function processSalesCollection() {
  try {
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
    staffs["0"] = "688a31c7eb3170724f80478f";

    const lastProcessed = await MergeProgress.findOne({
      collectionName: "sales",
    }).lean();

    let batchSize = 500;
    for (let page = 1; page < 50000; page++) {
      const salesDocs = await Sales.aggregate([
        { $sort: { _id: 1 } },
        {
          $match: lastProcessed
            ? { _id: { $gt: lastProcessed.lastProcessedId } }
            : {},
        },
        { $skip: (page - 1) * batchSize },
        { $limit: batchSize },
        {
          $project: {
            m_clinicId: 1,
            m_encounterId: 1,
            m_invoiceId: 1,
            m_patientId: 1,
            m_planitemId: 1,
            m_staffId: 1,
          },
        },
      ]);

      if (salesDocs.length === 0) {
        break; // Exit the loop if no more documents are found
      }

      let encounters = [],
        patients = [],
        invoices = [],
        planitems = [];
      salesDocs.forEach((v) => {
        encounters.push(v.m_encounterId);
        patients.push(v.m_patientId);
        invoices.push(v.m_invoiceId);
        planitems.push(v.m_planitemId);
      });

      // plan items
      let pItem = await PlanItem.find(
        { f_id: { $in: planitems } },
        { _id: 1, f_id: 1 }
      ).then((res) => {
        let data = res.reduce((acc, curr) => {
          return { ...acc, [curr.f_id]: curr._id };
        }, {});
        return data;
      });

      // patients and clients
      let patient = await Patient.find(
        { f_id: { $in: patients } },
        { _id: 1, f_id: 1, clientId: 1 }
      ).then((res) => {
        let data = res.reduce((acc, curr) => {
          return { ...acc, [curr.f_id]: curr };
        }, {});
        return data;
      });

      // encounters
      let enc = await Encounter.find(
        { f_encounterid: { $in: encounters } },
        { _id: 1, f_encounterid: 1 }
      ).then((res) => {
        let data = res.reduce((acc, curr) => {
          return { ...acc, [curr.f_encounterid]: curr._id };
        }, {});
        return data;
      });

      // invoices
      let inv = await Invoice.find(
        { f_id: { $in: invoices } },
        { _id: 1, f_id: 1 }
      ).then((res) => {
        let data = res.reduce((acc, curr) => {
          return { ...acc, [curr.f_id]: curr._id };
        }, {});
        return data;
      });

      let bulkArr = [];
      let lastProcessedId;
      for (let doc of salesDocs) {
        lastProcessedId = doc._id;

        let create = {
          invoiceId: inv[doc.m_invoiceId] ?? null,
          encounterId: enc[doc.m_encounterId] ?? null,
          clientId: patient[doc.m_patientId]?.clientId ?? null,
          patientId: patient[doc.m_patientId]?._id ?? null,
          planitemId: pItem[doc.m_planitemId] ?? null,
          staffId: staffs[doc.m_staffId] ?? null,
          clinicId: clinics[doc.m_clinicId] ?? null,
        };

        bulkArr.push({
          updateOne: {
            filter: { _id: doc._id },
            update: {
              $set: create,
            },
          },
        });
      }
      await Sales.bulkWrite(bulkArr);

      await MergeProgress.updateOne(
        { collectionName: "sales" },
        { $set: { lastProcessedId }, $inc: { totalProcessed: bulkArr.length } },
        { upsert: true }
      );

      console.log(`Page ${page} processed`);
      console.log(`${page * batchSize} docs processed`);
    }
    console.log(`Sales processing completed`);
  } catch (err) {
    console.log(err);
  }
}

module.exports = processSalesCollection;
