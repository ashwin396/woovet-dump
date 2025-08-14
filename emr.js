const xml2js = require("xml2js");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const customParseFormat = require("dayjs/plugin/customParseFormat");
const timez = require("dayjs/plugin/timezone");
dayjs.extend(customParseFormat);
dayjs.extend(utc);
dayjs.extend(timez);

// MODELS
const Patient = require("../models/Patient.js");
const Staff = require("../models/Staff.js");
const Clinic = require("../models/Clinic.js");
const Encounter = require("../models/Encounter.js");
const MigEncounter = require("../models/MigEncounter.js");
const PlanType = require("../models/plantype.js");
const PlanItem = require("../models/planitem.js");
const PlanCost = require("../models/plancost.js");
const Cart = require("../models/Cart.js");
const CartAction = require("../models/CartAction.js");
const GroupPlanItem = require("../models/GroupPlanitem.js");
const Progress = require("../models/Progress.js");
const Attach = require("../models/Attach.js");
const AttachmentType = require("../models/AttachmentType.js");

// CLASSES
const EMR = require("../classes/EMR/Emr.js");

// Convert date string to Date object format = "Thu,07 Aug 2025 10:55:31";
function formatDate(dateString) {
  const formattedDate = dateString.replace(",", ", ");
  return dayjs(formattedDate, "ddd, DD MMM YYYY HH:mm:ss").toDate();
}

/* eslint-disable */
// Remove escape characters from XML text
// This function is used to clean up the XML text by removing or replacing certain escape characters.;
function removeEscapeCharacters(text) {
  let processedXml = text.replace(
    /&nbsp;|&quot;|&bull;|&apos;|&amp;|Weight(kg)|&lt;|&gt;|&#160;|&amp;nbsp;/g,
    function (match) {
      switch (match) {
        case "&nbsp;":
          return " ";
        case "&quot;":
          return '"';
        case "&bull;":
          return "•";
        case "&apos;":
          return "'";
        case "&amp;":
          return "&";
        case "&gt;":
          return ">";
        case "&lt;":
          return "<";
        case "&#160;":
          return " ";
        case "&amp;nbsp;":
          return " ";
        default:
          return match;
      }
    }
  );
  return processedXml;
}

exports.migrateEncounter = async (_, res) => {
  try {
    res.status(200).json("Migration started");
    const parser = new xml2js.Parser(/* options */);

    const staffs = await Staff.find({}, { name: 1 }).then((res) => {
      let data = res.reduce((acc, curr) => {
        return { ...acc, [curr.name]: curr._id };
      }, {});
      return data;
    });

    const attachTypes = await AttachmentType.find({}, { code: 1,name: 1 }).then(
      (res) => {
        let data = res.reduce((acc, curr) => {
          return { ...acc, [curr.code]: {
            _id: curr._id.toString(),
          name: curr.name} };
        }, {});
        return data;
      }
    );

    // await Encounter.updateMany({ emr: { $ne: [] } }, { $set: { emr: [] } });
    const lastProcessed = await Progress.findOne({
      collectionName: "encounter",
    }).lean();

    let batchsize = 50;
    for (let page = 1; page <= 100000; page++) {
      const encounters = await Encounter.aggregate([
        // { $match: { _id: new ObjectId("6895960dbd6edc1f90038c09") } },
        {
          $match: {
            emr: [],
            ...(lastProcessed
              ? { _id: { $gt: lastProcessed.lastProcessedId } }
              : {}),
          },
        },
        { $sort: { _id: 1 } },
        { $skip: (page - 1) * batchsize },
        { $limit: 1 * batchsize },
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
            _id: 1,
            xmlData: 1,
            patient: "$patientId",
            client: { $arrayElemAt: ["$patient.clientId", 0] },
            clinic: "$clinicId",
            encounter: "$_id",
          },
        },
      ]);

      if (encounters.length <= 0) {
        break;
      }

      let lastProcessedId;
      console.log(`Processing record ${page}`);
      for (let item of encounters) {
        lastProcessedId = item.encounter;
        if (item.xmlData) {
          let result;
          try {
            let processedXml = item.xmlData.replace(/Weight\(kg\)/gi, "Weight");
            result = await parser.parseStringPromise(processedXml);
          } catch (error) {
            console.error(
              `Error parsing XML for encounter ${item.f_encounterid}:`,
              error
            );
            continue;
          }
          let xmlJson = [];
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
                    const date = formatDate(node.$.Time);

                    let clinician = MasterProblemList?.[0]?.Clinician?.[0]
                      ? MasterProblemList[0]?.Clinician[0].replace(
                          /&nbsp;/g,
                          " "
                        )
                      : "";

                    // Switch based on Form type
                    switch (node.$.Form) {
                      case "Subjective": {
                        let author = node?.Subjective?.[0]?.Author
                          ? node.Subjective[0]?.Author[0].replace(
                              /&nbsp;/g,
                              " "
                            )
                          : MasterProblemList?.[0]?.Author?.[0]
                            ? MasterProblemList[0]?.Author[0].replace(
                                /&nbsp;/g,
                                " "
                              )
                            : "";
                        let clinic = node.Subjective?.[0]?.Clinic
                          ? node.Subjective[0]?.Clinic[0].replace(
                              /&nbsp;/g,
                              " "
                            )
                          : MasterProblemList?.[0]?.Clinic?.[0]
                            ? MasterProblemList[0]?.Clinic[0].replace(
                                /&nbsp;/g,
                                " "
                              )
                            : "Brookville Road Animal Hospital";
                        let authorId;
                        if (author == "siteadmin") {
                          authorId = "688a31c7eb3170724f80478f";
                        } else {
                          const staff = staffs[author];
                          authorId = staff ? staff._id.toString() : null;
                        }

                        // Condition for Complaint ( REASON FOR VISIT )
                        if (
                          node.Subjective?.[0]?.complaints &&
                          node.Subjective[0]?.complaints?.length
                        ) {
                          let complaint =
                            node.Subjective[0].complaints[0]?.complaint?.[0]._;
                          let reportCard =
                            node.Subjective[0].complaints[0]?.PetReport?.[0]._;
                          let emr = new EMR({
                            date,
                            type: "complaint",
                            encounterId: item.encounter,
                            content: { reasonForVisit: complaint, reportCard },
                          });

                          const emrNode = emr.create_node({
                            ntype: "final",
                            authorDetails: {
                              clinician,
                              authorId: authorId,
                              author,
                              clinic,
                            },
                          });

                          emr.add_node({ node: emrNode, xmlJson });
                        } else if (
                          node.Subjective?.[0]?.SOAPNotes &&
                          node.Subjective[0]?.complaints?.length
                        ) {
                          let complaint =
                            node.Subjective[0].complaints[0]?.complaint?.[0]._;
                          let reportCard =
                            node.Subjective[0].complaints[0]?.PetReport?.[0]._;
                          let emr = new EMR({
                            date,
                            type: "complaint",
                            encounterId: item.encounter,
                            content: { reasonForVisit: complaint, reportCard },
                          });

                          const emrNode = emr.create_node({
                            ntype: "final",
                            authorDetails: {
                              clinician,
                              authorId: authorId,
                              author,
                              clinic,
                            },
                          });

                          emr.add_node({ node: emrNode, xmlJson });
                        }
                        break;
                      }
                      case "SOAPNotes": {
                        let author = node.Type?.[0]?.Author
                          ? node.Type?.[0]?.Author[0].replace(/&nbsp;/g, " ")
                          : MasterProblemList?.[0]?.Author?.[0]
                            ? MasterProblemList[0]?.Author[0].replace(
                                /&nbsp;/g,
                                " "
                              )
                            : "";
                        let clinic = node.Type?.[0]?.Clinic
                          ? node.Type?.[0]?.Clinic[0].replace(/&nbsp;/g, " ")
                          : MasterProblemList?.[0]?.Clinic?.[0]
                            ? MasterProblemList[0]?.Clinic[0].replace(
                                /&nbsp;/g,
                                " "
                              )
                            : "Brookville Road Animal Hospital";
                        let authorId;
                        if (author == "siteadmin") {
                          authorId = "688a31c7eb3170724f80478f";
                        } else {
                          const staff = staffs[author];
                          authorId = staff ? staff._id.toString() : null;
                        }

                        let subjective = node.Type?.[0].Subjective?.[0] ?? "";
                        let objective = node.Type?.[0].Objective?.[0] ?? "";
                        let plan = node.Type?.[0].Plan?.[0] ?? "";
                        let assessment = node.Type?.[0].Assessment?.[0] ?? "";
                        let emr = new EMR({
                          date,
                          type: "soap_note",
                          encounterId: item.encounter,
                          content: {
                            soap: { subjective, objective, plan, assessment },
                          },
                        });

                        const emrNode = emr.create_node({
                          ntype: "final",
                          authorDetails: {
                            clinician,
                            authorId: authorId,
                            author,
                            clinic,
                          },
                        });

                        emr.add_node({ node: emrNode, xmlJson });
                        break;
                      }
                      case "Communication": {
                        let author = node.Type?.[0]?.Author
                          ? node.Type?.[0]?.Author[0].replace(/&nbsp;/g, " ")
                          : MasterProblemList?.[0]?.Author?.[0]
                            ? MasterProblemList[0]?.Author[0].replace(
                                /&nbsp;/g,
                                " "
                              )
                            : "";
                        let clinic = node.Type?.[0]?.Clinic
                          ? node.Type?.[0]?.Clinic[0].replace(/&nbsp;/g, " ")
                          : MasterProblemList?.[0]?.Clinic?.[0]
                            ? MasterProblemList[0]?.Clinic[0].replace(
                                /&nbsp;/g,
                                " "
                              )
                            : "Brookville Road Animal Hospital";
                        let authorId;
                        if (author == "siteadmin") {
                          authorId = "688a31c7eb3170724f80478f";
                        } else {
                          const staff = staffs[author];
                          authorId = staff ? staff._id.toString() : null;
                        }

                        let message = node.Plan?.[0].Message?.[0]._ ?? "";
                        let memoType;
                        if (node.$.Type === "Notes") {
                          let emr = new EMR({
                            date,
                            type: "followup",
                            encounterId: item.encounter,
                            content: {
                              summary: message,
                            },
                          });

                          const emrNode = emr.create_node({
                            ntype: "final",
                            authorDetails: {
                              clinician,
                              authorId: authorId,
                              author,
                              clinic,
                            },
                          });

                          emr.add_node({ node: emrNode, xmlJson });
                        } else {
                          if (node.$.Type === "Record Memo") {
                            memoType = "record_memo";
                          } else if (node.$.Type === "Person to Person") {
                            memoType = "person_to_person";
                          } else if (node.$.Type === "Telephone") {
                            memoType = "telephone";
                          } else if (node.$.Type === "3rd Party") {
                            memoType = "3rd_party";
                          } else if (node.$.Type === "Electronic") {
                            memoType = "electronic";
                          } else if (
                            node.$.Type === "MsgBoard" &&
                            node.Plan?.[0].Pimages
                          ) {
                            memoType = "message";
                          } else if (
                            node.$.Type === "MsgBoard" &&
                            !node.Plan[0].Pimages
                          ) {
                            memoType = "client_communication";
                          }

                          let emr = new EMR({
                            date,
                            type: "memo",
                            encounterId: item.encounter,
                            content: {
                              [memoType]: message,
                            },
                          });

                          const emrNode = emr.create_node({
                            ntype: "final",
                            authorDetails: {
                              clinician,
                              authorId: authorId,
                              author,
                              clinic,
                            },
                          });

                          emr.add_node({ node: emrNode, xmlJson });
                        }
                        break;
                      }
                      case "Objective": {
                        let author = node.Objective?.[0]?.Author
                          ? node.Objective?.[0]?.Author[0].replace(
                              /&nbsp;/g,
                              " "
                            )
                          : MasterProblemList?.[0]?.Author?.[0]
                            ? MasterProblemList[0]?.Author[0].replace(
                                /&nbsp;/g,
                                " "
                              )
                            : "";
                        let clinic = node.Objective?.[0]?.Clinic
                          ? node.Objective?.[0]?.Clinic[0].replace(
                              /&nbsp;/g,
                              " "
                            )
                          : MasterProblemList?.[0]?.Clinic?.[0]
                            ? MasterProblemList[0]?.Clinic[0].replace(
                                /&nbsp;/g,
                                " "
                              )
                            : "Brookville Road Animal Hospital";
                        let authorId;
                        if (author == "siteadmin") {
                          authorId = "688a31c7eb3170724f80478f";
                        } else {
                          const staff = staffs[author];
                          authorId = staff ? staff._id.toString() : null;
                        }

                        // Condition for Objective ( VITALS )
                        if (
                          node.Objective?.[0].FormType?.[0] === "Vital From" ||
                          node.Objective?.[0].Vitals?.length
                        ) {
                          let vitals = node.Objective?.[0].Vitals?.[0] ?? {};
                          let emrVitalData = {};

                          if (vitals?.Weight?.length) {
                            let wtUnit = {
                              Kg: "kg",
                              Lb: "lb",
                              G: "gm",
                              Oz: "oz",
                            }; // Assuming these are the only units
                            emrVitalData.wt =
                              vitals.Weight?.[0].Reading?.[0] ?? null;
                            emrVitalData.wtUnit = vitals.Weight[0].Scale?.[0]
                              ? wtUnit[vitals.Weight[0].Scale[0]]
                              : "kg";
                          }
                          if (vitals?.Temperature?.length) {
                            emrVitalData.temp =
                              vitals.Temperature[0].Reading?.[0] ?? null;
                            emrVitalData.tempUnit =
                              vitals.Temperature[0].Scale?.[0] === "C"
                                ? "cl"
                                : "fa";
                          }
                          if (vitals?.HeartRespiratoryRate?.length) {
                            emrVitalData.hrate =
                              vitals.HeartRespiratoryRate[0].Reading?.[0] ??
                              null;
                          }
                          if (vitals?.RespiratoryRate?.length) {
                            emrVitalData.hresp =
                              vitals.RespiratoryRate[0].Reading?.[0] ?? null;
                          }
                          if (vitals?.CRT?.length) {
                            emrVitalData.capillary =
                              vitals.CRT[0].Reading?.[0] ?? null;
                          }
                          if (vitals?.MM?.length) {
                            emrVitalData.mem =
                              vitals.MM[0].Reading?.[0] ?? null;
                          }
                          if (vitals?.BloodPressure?.length) {
                            let bps =
                              vitals.BloodPressure[0].Reading?.[0].split(
                                "/"
                              )[0];
                            let bpd =
                              vitals.BloodPressure[0].Reading?.[0].split(
                                "/"
                              )[1];
                            emrVitalData.bps = bps !== "" ? bps : null;
                            emrVitalData.bpd = bpd !== "" ? bpd : null;
                          }

                          let emr = new EMR({
                            date,
                            type: "vital",
                            encounterId: item.encounter,
                            content: {
                              "vital details": emrVitalData,
                            },
                          });

                          const emrNode = emr.create_node({
                            ntype: "final",
                            authorDetails: {
                              clinician,
                              authorId: authorId,
                              author,
                              clinic,
                            },
                          });
                          emr.add_node({ node: emrNode, xmlJson });
                        }
                        break;
                      }
                      case "Plan": {
                        let author = node.Plan?.[0]?.Author
                          ? node.Plan?.[0]?.Author[0].replace(/&nbsp;/g, " ")
                          : MasterProblemList?.[0]?.Author?.[0]
                            ? MasterProblemList[0]?.Author[0].replace(
                                /&nbsp;/g,
                                " "
                              )
                            : "";
                        let clinic = node.Plan?.[0]?.Clinic
                          ? node.Plan?.[0]?.Clinic[0].replace(/&nbsp;/g, " ")
                          : MasterProblemList?.[0]?.Clinic?.[0]
                            ? MasterProblemList[0]?.Clinic[0].replace(
                                /&nbsp;/g,
                                " "
                              )
                            : "Brookville Road Animal Hospital";
                        let authorId;
                        if (author == "siteadmin") {
                          authorId = "688a31c7eb3170724f80478f";
                        } else {
                          const staff = staffs[author];
                          authorId = staff ? staff._id.toString() : null;
                        }

                        const planTypes = await PlanType.find(
                          {},
                          { name: 1 }
                        ).then((res) => {
                          let data = res.reduce((acc, curr) => {
                            return { ...acc, [curr.name]: curr._id };
                          }, {});
                          return data;
                        });

                        // Caluclation of total based on calc format
                        const formulaMap = {
                          14: {
                            calculate: ({ quantity, unitPrice, serviceFee }) =>
                              quantity * unitPrice + serviceFee,
                          },
                          15: {
                            calculate: ({ quantity, unitPrice, serviceFee }) =>
                              quantity * (unitPrice + serviceFee),
                          },
                        };

                        // Condition for Plan ( Plan Active)
                        if (node.Plan?.[0].$?.Status === "New") {
                          // console.log(node);
                          console.log("Here is the Active plan node");
                          if (!node.Plan?.[0].PlanType?.length) break;

                          let planNode = [];
                          // console.log("Plan Type: ", node.Plan[0].PlanType);
                          let planType = node.Plan[0].PlanType;

                          for (let ptype of planType) {
                            let pnode = {
                              id: ptype.$.value
                                ? planTypes[ptype.$.value]
                                : null,
                              name: ptype.$.value ? ptype.$.value : null,
                              planitems: [],
                            };

                            if (!ptype.PlanElement?.length) continue;

                            let typewisePlan = [];
                            for (let planElement of ptype.PlanElement) {
                              let pitems = planElement?.PlanItem.map((p) => {
                                return {
                                  ...p.$,
                                  note: p.Note?.length
                                    ? p.Note[0].replace(/&nbsp;/g, " ")
                                    : null,
                                  ...(p?.ItemInfo?.length
                                    ? { itmeInfo: p?.ItemInfo[0] }
                                    : {}),
                                };
                              });
                              typewisePlan.push(...pitems);
                            }

                            for (let t of typewisePlan) {
                              let planDoc = await PlanItem.findOne(
                                { f_id: t.RecNo },
                                { _id: 1, planItem: 1 }
                              ).lean();
                              let clinicDoc = await Clinic.findOne(
                                { f_clinic: t.clinicid },
                                { _id: 1 }
                              ).lean();
                              let staffDoc = t.clinicianid
                                ? await Staff.findOne(
                                    { f_staff: t.clinicianid },
                                    { _id: 1, name: 1 }
                                  ).lean()
                                : null;
                              let PlanCostDoc = await PlanCost.findOne({
                                m_clinicId: t.clinicid,
                                planItemId: planDoc._id,
                              }).lean();
                              let grpPlanDoc = await GroupPlanItem.findOne(
                                {
                                  f_id: t.GroupWellnessId,
                                },
                                { _id: 1 }
                              ).lean();

                              // console.log(t);
                              let updatedAt;
                              if (
                                t.LastEditedOn &&
                                dayjs(
                                  formatDate(t.LastEditedOn),
                                  "ddd, DD MMM YYYY HH:mm:ss",
                                  true
                                ).isValid()
                              ) {
                                updatedAt = formatDate(t.LastEditedOn);
                              } else {
                                updatedAt = formatDate(t.PlanItemtime);
                              }

                              const createdAt = formatDate(t.PlanItemtime);

                              // Cart item creation
                              let cartItem = {
                                createdAt,
                                updatedAt,
                                encounterId: item.encounter,
                                clinicId: clinicDoc ? clinicDoc._id : null,
                                clientId: item.client,
                                patientId: item.patient,
                                planItemId: planDoc ? planDoc._id : null,
                                planCostId: PlanCostDoc
                                  ? PlanCostDoc._id
                                  : null,
                                staffId: staffDoc
                                  ? staffDoc._id
                                  : "688a31c7eb3170724f80478f",
                                status: 1,
                                unitPrice: t.ItemCost ? t.ItemCost * 1 : 0,
                                serviceFee: t.ServiceCost
                                  ? t.ServiceCost * 1
                                  : 0,
                                discount: 0,
                                discountId: null,
                                quantity: t.Number ? t.Number * 1 : 0,
                                calc_format: PlanCostDoc
                                  ? PlanCostDoc.calc_format
                                  : 14,
                                decline: t.Status == "Decline" ? true : false,
                                isGroupPlan: t.GroupWellnessId
                                  ? grpPlanDoc?._id
                                    ? 1
                                    : 0
                                  : 0,
                                grp_plan_id: t.GroupWellnessId
                                  ? (grpPlanDoc?._id ?? null)
                                  : null,
                                planType: pnode.name,
                                minCost: t.MinimumCost ? t.MinimumCost * 1 : 0,
                                maxCost: planDoc ? planDoc.maxCost : 0,
                                min_qty: 0,
                                mand_plan: 0,
                                clinicCost: planDoc ? planDoc.clinicCost : 0,
                                cart_payout_flag: 2,
                              };

                              let total =
                                formulaMap[cartItem.calc_format]?.calculate({
                                  quantity: cartItem.quantity,
                                  unitPrice: cartItem.unitPrice,
                                  serviceFee: cartItem.serviceFee,
                                }) || 0;
                              cartItem.total = total;

                              const cart = await Cart.create(cartItem);
                              const cartAction = await CartAction.create({
                                cartId: cart._id,
                                createdAt,
                                updatedAt,
                                planactions: [],
                                note: t.note ?? null,
                              });

                              // Plan node creation
                              pnode.planitems.push({
                                name: t.value ? t.value : planDoc.planItem,
                                planid: cart.planItemId.toString(),
                                dateTime: cart.createdAt,
                                decline: cart.decline,
                                provider: staffDoc
                                  ? staffDoc.name
                                  : "siteadmin",
                                staffId: cart._id.toString(),
                                cartId: cart._id.toString(),
                                quantity: cartItem.quantity,
                                note: cartAction.note,
                                reportcard: null,
                                actions: {},
                              });
                            }
                            planNode.push(pnode);
                          }
                          // Plan node creation
                          let emr = new EMR({
                            date,
                            type: "active_plan",
                            encounterId: item.encounter,
                            content: planNode,
                          });

                          const emrNode = emr.create_node({
                            ntype: "final",
                            authorDetails: {
                              clinician,
                              authorId: authorId,
                              author,
                              clinic,
                            },
                          });
                          emr.add_node({ node: emrNode, xmlJson });
                        } else if (node.Plan?.[0].$?.Status === "Performed") {
                          // Condition for Plan ( Plan In cart )
                          // console.log(node);
                          console.log("Here is the Plan in cart node");
                          if (!node.Plan?.[0].PlanType?.length) break;

                          let planNode = [];
                          // console.log("Plan Type: ", node.Plan[0].PlanType);
                          let planType = node.Plan[0].PlanType;

                          for (let ptype of planType) {
                            let pnode = {
                              id: ptype.$.value
                                ? planTypes[ptype.$.value]
                                : null,
                              name: ptype.$.value ? ptype.$.value : null,
                              planitems: [],
                            };

                            if (!ptype.PlanElement?.length) continue;

                            let typewisePlan = [];
                            for (let planElement of ptype.PlanElement) {
                              let pitems = planElement?.PlanItem.map((p) => {
                                return {
                                  ...p.$,
                                  // note: p.Note?.length
                                  //   ? p.Note[0].replace(/&nbsp;/g, " ")
                                  //   : null,
                                  // ...(p?.ItemInfo?.length
                                  //   ? { itmeInfo: p?.ItemInfo[0] }
                                  //   : {}),
                                };
                              });
                              typewisePlan.push(...pitems);
                            }

                            for (let t of typewisePlan) {
                              let planDoc = await PlanItem.findOne(
                                { f_id: t.RecNo },
                                { _id: 1, planItem: 1 }
                              ).lean();
                              let clinicDoc = await Clinic.findOne(
                                { f_clinic: t.clinicid },
                                { _id: 1 }
                              ).lean();
                              let staffDoc = t.clinicianid
                                ? await Staff.findOne(
                                    { f_staff: t.clinicianid },
                                    { _id: 1, name: 1 }
                                  ).lean()
                                : null;
                              let PlanCostDoc = await PlanCost.findOne({
                                m_clinicId: t.clinicid,
                                planItemId: planDoc._id,
                              }).lean();
                              let grpPlanDoc = await GroupPlanItem.findOne(
                                {
                                  f_id: t.GroupWellnessId,
                                },
                                { _id: 1 }
                              ).lean();

                              // console.log(t);
                              let updatedAt;
                              if (
                                t.PerformedOn &&
                                dayjs(
                                  formatDate(t.PerformedOn),
                                  "ddd, DD MMM YYYY HH:mm:ss",
                                  true
                                ).isValid()
                              ) {
                                updatedAt = formatDate(t.PerformedOn);
                              } else if (
                                t.LastEditedOn &&
                                dayjs(
                                  formatDate(t.LastEditedOn),
                                  "ddd, DD MMM YYYY HH:mm:ss",
                                  true
                                ).isValid()
                              ) {
                                updatedAt = formatDate(t.LastEditedOn);
                              } else {
                                updatedAt = formatDate(t.PlanItemtime);
                              }

                              const createdAt = formatDate(t.PlanItemtime);

                              // Cart item creation
                              let cartItem = {
                                createdAt,
                                updatedAt,
                                encounterId: item.encounter,
                                clinicId: clinicDoc ? clinicDoc._id : null,
                                clientId: item.client,
                                patientId: item.patient,
                                planItemId: planDoc ? planDoc._id : null,
                                planCostId: PlanCostDoc
                                  ? PlanCostDoc._id
                                  : null,
                                staffId: staffDoc
                                  ? staffDoc._id
                                  : "688a31c7eb3170724f80478f",
                                status: 22,
                                unitPrice: t.ItemCost ? t.ItemCost * 1 : 0,
                                serviceFee: t.ServiceCost
                                  ? t.ServiceCost * 1
                                  : 0,
                                discount: 0,
                                discountId: null,
                                quantity: t.Number ? t.Number * 1 : 0,
                                calc_format: PlanCostDoc
                                  ? PlanCostDoc.calc_format
                                  : 14,
                                decline: t.Status == "Decline" ? true : false,
                                isGroupPlan: t.GroupWellnessId
                                  ? grpPlanDoc?._id
                                    ? 1
                                    : 0
                                  : 0,
                                grp_plan_id: t.GroupWellnessId
                                  ? (grpPlanDoc?._id ?? null)
                                  : null,
                                planType: pnode.name,
                                minCost: t.MinimumCost ? t.MinimumCost * 1 : 0,
                                maxCost: planDoc ? planDoc.maxCost : 0,
                                min_qty: 0,
                                mand_plan: 0,
                                clinicCost: planDoc ? planDoc.clinicCost : 0,
                                cart_payout_flag: 2,
                              };

                              let total =
                                formulaMap[cartItem.calc_format]?.calculate({
                                  quantity: cartItem.quantity,
                                  unitPrice: cartItem.unitPrice,
                                  serviceFee: cartItem.serviceFee,
                                }) || 0;
                              cartItem.total = total;

                              const cart = await Cart.create(cartItem);
                              const cartAction = await CartAction.create({
                                cartId: cart._id,
                                createdAt,
                                updatedAt,
                                planactions: [],
                                note: t.note ?? null,
                              });

                              // Plan node creation
                              pnode.planitems.push({
                                name: t.value ? t.value : planDoc.planItem,
                                planid: cart.planItemId.toString(),
                                dateTime: cart.createdAt,
                                decline: cart.decline,
                                provider: staffDoc
                                  ? staffDoc.name
                                  : "siteadmin",
                                staffId: cart._id.toString(),
                                cartId: cart._id.toString(),
                                quantity: cartItem.quantity,
                                note: cartAction.note,
                                reportcard: null,
                                actions: {},
                              });
                            }
                            planNode.push(pnode);
                          }
                          // Plan node creation
                          let emr = new EMR({
                            date,
                            type: "plan_in_cart",
                            encounterId: item.encounter,
                            content: planNode,
                          });

                          const emrNode = emr.create_node({
                            ntype: "final",
                            authorDetails: {
                              clinician,
                              authorId: authorId,
                              author,
                              clinic,
                            },
                          });
                          emr.add_node({ node: emrNode, xmlJson });
                        }
                        // else if (node.Plan?.[0].$?.Status === "Invoiced") {
                        //   let planNode = [];

                        //   for (let ptype of node.Plan[0].PlanType) {
                        //     let pnode = {
                        //       id: ptype.$.value ? planTypes[ptype.$.value] : null,
                        //       name: ptype.$.value ? ptype.$.value : null,
                        //       planitems: [],
                        //     };

                        //     let typewisePlan = [];
                        //     for (let planElement of ptype.PlanElement) {
                        //       let pitems = planElement?.PlanItem.map((p) => {
                        //         return {
                        //           ...p.$,
                        //           note: p.Note?.length
                        //             ? p.Note[0].replace(/&nbsp;/g, " ")
                        //             : null,
                        //           ...(p?.ItemInfo?.length
                        //             ? { itmeInfo: p?.ItemInfo[0] }
                        //             : {}),
                        //         };
                        //       });
                        //       typewisePlan.push(...pitems);
                        //     }

                        //     for (let t of typewisePlan) {
                        //       let planItemObj = {};
                        //       let planDoc = await PlanItem.findOne(
                        //         { f_id: t.RecNo },
                        //         { _id: 1, planItem: 1 }
                        //       ).lean();
                        //       let staffDoc = t.clinicianid
                        //         ? await Staff.findOne(
                        //             { f_staff: t.clinicianid },
                        //             { _id: 1, name: 1 }
                        //           ).lean()
                        //         : null;
                        //       let salesDoc = await Sales.findOne({
                        //         f_id: t.Salesid,
                        //       }).lean();
                        //       let returnDoc = await Return.find({
                        //         m_salesId: t.Salesid,
                        //       }).lean();
                        //       let createdAt = formatDate(t.PlanItemtime);
                        //       planItemObj = {
                        //         name: t.value ? t.value : planDoc.planItem,
                        //         planid: planDoc ? planDoc._id : null,
                        //         dateTime: createdAt,
                        //         decline: false,
                        //         provider: staffDoc ? staffDoc.name : "siteadmin",
                        //         staffId: staffDoc
                        //           ? staffDoc._id.toString()
                        //           : null,
                        //         quantity: t.Number ? t.Number * 1 : 0,
                        //         salesId: salesDoc
                        //           ? salesDoc._id.toString()
                        //           : null,
                        //         note: t.note ?? null,
                        //         reportcard: t.reportcard ?? null,
                        //         actions: {},
                        //       };
                        //       if (returnDoc.length > 0) {
                        //         planItemObj.returns = returnDoc.map((v) => {
                        //           return {
                        //             returnRsn: v.desc,
                        //             returnQty: v.quantity,
                        //             returnDate: v.returnedOn.toString(),
                        //             returnedBy: v.m_loginuser,
                        //           };
                        //         });
                        //       }
                        //       pnode.planitems.push(planItemObj);
                        //     }
                        //     planNode.push(pnode);
                        //   }
                        //   let emr = new EMR({
                        //     date,
                        //     type: "plan_performed",
                        //     encounterId: item.encounter,
                        //     content: planNode,
                        //   });
                        //   const emrNode = emr.create_node({
                        //     ntype: "final",
                        //     authorDetails: {
                        //       clinician,
                        //       authorId,
                        //       author,
                        //       clinic,
                        //     },
                        //   });
                        //   emr.add_node({ node: emrNode, xmlJson });
                        // }
                        else if (
                          node.Plan?.[0].$?.Status === "Pending" &&
                          node.Plan?.[0].$?.EstimateID
                        ) {
                          // Condition for Plan ( Plan Estimate )
                          // console.log(node);
                          console.log(
                            `Here is the Estimate node ${item.encounter}`
                          );
                          if (!node.Plan?.[0].PlanType?.length) break;

                          let planNode = [];
                          // console.log("Plan Type: ", node.Plan[0].PlanType);
                          let planType = node.Plan[0].PlanType;

                          for (let ptype of planType) {
                            let pnode = {
                              id: ptype.$.value
                                ? planTypes[ptype.$.value]
                                : null,
                              name: ptype.$.value ? ptype.$.value : null,
                              planitems: [],
                            };

                            if (!ptype.PlanElement?.length) continue;

                            let typewisePlan = [];
                            for (let planElement of ptype.PlanElement) {
                              let pitems = planElement?.PlanItem.map((p) => {
                                return {
                                  ...p.$,
                                  // note: p.Note?.length
                                  //   ? p.Note[0].replace(/&nbsp;/g, " ")
                                  //   : null,
                                  // ...(p?.ItemInfo?.length
                                  //   ? { itmeInfo: p?.ItemInfo[0] }
                                  //   : {}),
                                };
                              });
                              typewisePlan.push(...pitems);
                            }

                            for (let t of typewisePlan) {
                              let planDoc = await PlanItem.findOne(
                                { f_id: t.RecNo },
                                { _id: 1, planItem: 1 }
                              ).lean();
                              let clinicDoc = await Clinic.findOne(
                                { f_clinic: t.clinicid },
                                { _id: 1 }
                              ).lean();
                              let staffDoc = t.clinicianid
                                ? await Staff.findOne(
                                    { f_staff: t.clinicianid },
                                    { _id: 1, name: 1 }
                                  ).lean()
                                : null;
                              let PlanCostDoc = await PlanCost.findOne({
                                m_clinicId: t.clinicid,
                                planItemId: planDoc._id,
                              }).lean();
                              let grpPlanDoc = await GroupPlanItem.findOne(
                                {
                                  f_id: t.GroupWellnessId,
                                },
                                { _id: 1 }
                              ).lean();

                              // console.log(t);
                              let updatedAt;
                              if (
                                t.PerformedOn &&
                                dayjs(
                                  formatDate(t.PerformedOn),
                                  "ddd, DD MMM YYYY HH:mm:ss",
                                  true
                                ).isValid()
                              ) {
                                updatedAt = formatDate(t.PerformedOn);
                              } else if (
                                t.LastEditedOn &&
                                dayjs(
                                  formatDate(t.LastEditedOn),
                                  "ddd, DD MMM YYYY HH:mm:ss",
                                  true
                                ).isValid()
                              ) {
                                updatedAt = formatDate(t.LastEditedOn);
                              } else {
                                updatedAt = formatDate(t.PlanItemtime);
                              }

                              const createdAt = formatDate(t.PlanItemtime);

                              // Cart item creation
                              let cartItem = {
                                createdAt,
                                updatedAt,
                                encounterId: item.encounter,
                                clinicId: clinicDoc ? clinicDoc._id : null,
                                clientId: item.client,
                                patientId: item.patient,
                                planItemId: planDoc ? planDoc._id : null,
                                planCostId: PlanCostDoc
                                  ? PlanCostDoc._id
                                  : null,
                                staffId: staffDoc
                                  ? staffDoc._id
                                  : "688a31c7eb3170724f80478f",
                                status: 54,
                                unitPrice: t.ItemCost ? t.ItemCost * 1 : 0,
                                serviceFee: t.ServiceCost
                                  ? t.ServiceCost * 1
                                  : 0,
                                discount: 0,
                                discountId: null,
                                quantity: t.Number ? t.Number * 1 : 0,
                                calc_format: PlanCostDoc
                                  ? PlanCostDoc.calc_format
                                  : 14,
                                decline: t.Status == "Decline" ? true : false,
                                isGroupPlan: t.GroupWellnessId
                                  ? grpPlanDoc?._id
                                    ? 1
                                    : 0
                                  : 0,
                                grp_plan_id: t.GroupWellnessId
                                  ? (grpPlanDoc?._id ?? null)
                                  : null,
                                planType: pnode.name,
                                minCost: t.MinimumCost ? t.MinimumCost * 1 : 0,
                                maxCost: planDoc ? planDoc.maxCost : 0,
                                min_qty: 0,
                                mand_plan: 0,
                                clinicCost: planDoc ? planDoc.clinicCost : 0,
                                cart_payout_flag: 2,
                              };

                              // "LowQty": "1.00",
                              // 			"LowUnitCost": "80.00",
                              // 			"LowServiceFee": "80.00",
                              // 			"LowTotal": "160",
                              // 			"HighQty": "1.00",
                              // 			"HighUnitCost": "80.00",
                              // 			"HighServiceFee": "80.00",
                              // 			"HighTotal": "160",
                              // 			"HighLowSelection": "high",
                              // 			"TotalCost": "160"

                              let total =
                                formulaMap[cartItem.calc_format]?.calculate({
                                  quantity: cartItem.quantity,
                                  unitPrice: cartItem.unitPrice,
                                  serviceFee: cartItem.serviceFee,
                                }) || 0;
                              cartItem.total = total;

                              const cart = await Cart.create(cartItem);
                              const cartAction = await CartAction.create({
                                cartId: cart._id,
                                createdAt,
                                updatedAt,
                                planactions: [],
                                note: t.note ?? null,
                              });

                              // Plan node creation
                              pnode.planitems.push({
                                name: t.value ? t.value : planDoc.planItem,
                                planid: cart.planItemId.toString(),
                                dateTime: cart.createdAt,
                                decline: cart.decline,
                                provider: staffDoc
                                  ? staffDoc.name
                                  : "siteadmin",
                                staffId: cart._id.toString(),
                                cartId: cart._id.toString(),
                                quantity: cartItem.quantity,
                                note: cartAction.note,
                                reportcard: null,
                                actions: {},
                              });
                            }
                            planNode.push(pnode);
                          }
                          // Plan node creation
                          let emr = new EMR({
                            date,
                            type: "estimate",
                            encounterId: item.encounter,
                            content: planNode,
                          });

                          const emrNode = emr.create_node({
                            ntype: "final",
                            authorDetails: {
                              clinician,
                              authorId: authorId,
                              author,
                              clinic,
                            },
                          });
                          emr.add_node({ node: emrNode, xmlJson });
                        }

                        break;
                      }
                      case "AttachedFile": {
                        console.log(`Past nodes ${item.encounter}`);
                        // Old migrated nodes
                        let author = node.Type?.[0]?.Author
                          ? node.Type[0]?.Author[0].replace(/&nbsp;/g, " ")
                          : MasterProblemList?.[0]?.Author?.[0]
                            ? MasterProblemList[0]?.Author[0].replace(
                                /&nbsp;/g,
                                " "
                              )
                            : "";
                        let clinic = node.Type?.[0]?.Clinic
                          ? node.Type[0]?.Clinic[0].replace(/&nbsp;/g, " ")
                          : MasterProblemList?.[0]?.Clinic?.[0]
                            ? MasterProblemList[0]?.Clinic[0].replace(
                                /&nbsp;/g,
                                " "
                              )
                            : "Brookville Road Animal Hospital";

                        let node_clinician = node.Type?.[0]?.Clinician
                          ? node.Type[0]?.Clinician[0].replace(/&nbsp;/g, " ")
                          : clinician;

                        let authorId;
                        if (author == "siteadmin") {
                          authorId = "688a31c7eb3170724f80478f";
                        } else {
                          const staff = staffs[author];
                          authorId = staff ? staff._id.toString() : null;
                        }

                        // Condition for plan performed
                        if (node.Type?.[0]?.$?.value === "PlanPerformed") {
                          console.log(`Past plan nodes`);
                          let plan_node = node.Type[0]?.AdditionalComment
                            ?.length
                            ? removeEscapeCharacters(
                                node.Type[0]?.AdditionalComment[0]
                              )
                            : null;

                          if (!plan_node) {
                            break;
                          }

                          let emr = new EMR({
                            date,
                            type: "soap_note",
                            encounterId: item.encounter,
                            content: { soap: { plan: plan_node } },
                          });

                          const emrNode = emr.create_node({
                            ntype: "final",
                            authorDetails: {
                              clinician: node_clinician,
                              authorId: authorId,
                              author,
                              clinic,
                            },
                          });

                          emr.add_node({ node: emrNode, xmlJson });
                        } else if (
                          node.Type?.[0]?.$?.value === "MedicalNotes"
                        ) {
                          console.log(`Past medical nodes`);
                          let plan_node = node.Type[0]?.AdditionalComment
                            ?.length
                            ? removeEscapeCharacters(
                                node.Type[0]?.AdditionalComment[0]
                              )
                            : null;

                          if (!plan_node) {
                            break;
                          }

                          let emr = new EMR({
                            date,
                            type: "soap_note",
                            encounterId: item.encounter,
                            content: { soap: { subjective: plan_node } },
                          });

                          const emrNode = emr.create_node({
                            ntype: "final",
                            authorDetails: {
                              clinician: node_clinician,
                              authorId: authorId,
                              author,
                              clinic,
                            },
                          });

                          emr.add_node({ node: emrNode, xmlJson });
                        } else if (node?.Type?.[0]?.Uploaded?.length) {
                          console.log(`Past not handled nodes`);
                          // let plan_node = node.Type[0]?.AdditionalComment?.length
                          //   ? removeEscapeCharacters(
                          //       node.Type[0]?.AdditionalComment[0]
                          //     )
                          //   : null;
                          //   let attachIds = node.Type[0].Uploaded[0]?.$.AttachmentsID ? node.Type[0].Uploaded[0]?.$.AttachmentsID.split(",")
                          //   let attachs = []
                          //   for (let i of attachIds ) {
                          //     let file = await uploadAttachments({
                          //     client: item.client,
                          //     patient: item.patient,
                          //     encounter: item.encounter,
                          //     clinic: item.clinic,
                          //     recordno:i,
                          //     tablename: "diagnosisimage"
                          //   })

                          //   attachs.push()

                          //   }

                          // let emr = new EMR({
                          //   date,
                          //   type: "attachment",
                          //   encounterId: item.encounter,
                          //   content: { soap: { subjective: plan_node } },
                          // });

                          // const emrNode = emr.create_node({
                          //   ntype: "final",
                          //   authorDetails: {
                          //     clinician: node_clinician,
                          //     authorId: authorId,
                          //     author,
                          //     clinic,
                          //   },
                          // });

                          // emr.add_node({ node: emrNode, xmlJson });
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

          if (xmlJson.length > 0) {
            await Encounter.updateOne(
              { _id: item.encounter },
              { $set: { emr: xmlJson } }
            );
          }
        }
      }

      const doc = await Progress.updateOne(
        { collectionName: "encounter" },
        {
          $set: { lastProcessedId },
          $inc: { totalProcessed: encounters.length },
        },
        { upsert: true, new: true }
      );
    }
    res.status(200).json("Done");
  } catch (error) {
    console.error(error);
    res.status(500).json(error);
  }
};
