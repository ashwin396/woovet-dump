// PAKCAGES
const dayjs = require("dayjs");

// PLUGINS
const utc = require("dayjs/plugin/utc");
const timez = require("dayjs/plugin/timezone");
dayjs.extend(utc);
dayjs.extend(timez);

function EMR(body) {
  var formatter = dayjs(body.date).format("msSSS");
  var parentNodeId = dayjs(body.date).format("SSSsm");
  this.emrData = body;
  this.dateTime = dayjs(body.date).$d;
  this.createdOn = dayjs(body.date).$d;
  this.currentDate = dayjs(body.date)
    .tz("America/Detroit")
    .format("DD/MM/YYYY");
  this.type = body.type;
  this.node_id = body.node_id ?? parseInt(formatter);
  this.parent_nodeId = body.node_id ?? parseInt(parentNodeId);
  this.uniquedraftId = body.draft ? `draft_${formatter}` : null;
  this.encounter_session = body.encounterId;
}

EMR.prototype.nodeHeaderDetails = function (emrHeaderDetails) {
  const { emrType, ntype, authorDetails, generalDetails } = emrHeaderDetails;
  switch (emrType) {
    case "test":
      return "Object can be contructed upon emrtype body object";
    default:
      return {
        id: this.node_id,
        ntype: ntype,
        time: this.createdOn,
        nodeType: emrType,
        uniquedraftId: this.uniquedraftId ?? null,
        nodeInfo: {
          nodeType: {
            type: emrType,
            // dateTime: this.dateTime,
            createdOn: this.createdOn,
            isEdit: generalDetails.isEdit,
            isEmail: generalDetails.isEmail,
            isPrint: generalDetails.isPrint,
            isDelete: generalDetails.isDelete,
            convertToActivePlan: generalDetails.convertToActivePlan ?? false,
            finalize: generalDetails.finalize ?? false,
          },
          authorDetails: {
            clinician: authorDetails.clinician,
            authorId: authorDetails.authorId ?? null,
            author: authorDetails.author,
            clinic: authorDetails.clinic,
            isCopyHistoryForm: generalDetails.copyHistoryForm ?? false,
            isCopyExamForm: generalDetails.copyExamForm ?? false,
            copyAsActivePlan: generalDetails.copyAsActivePlan ?? false,
          },
        },
        nodeDetails: [],
      };
  }
};

EMR.prototype.create_node = function ({ ntype, authorDetails }) {
  try {
    let emrObj = {};
    switch (this.emrData.type) {
      case "complaint": {
        let generalDetails = {
          isEdit: true,
          isEmail: false,
          isPrint: false,
          isDelete: true,
        };
        let complaintObj = this.nodeHeaderDetails({
          ntype,
          emrType: "complaint",
          authorDetails,
          generalDetails,
        });
        let _comobj = {};
        _comobj.id = "Reason For Visit";
        _comobj.dateTime = this.dateTime;
        _comobj.details = this.emrData.content.reasonForVisit;
        _comobj.reportCard = this.emrData.content.reportCard;
        complaintObj.nodeDetails.push(_comobj);
        emrObj = complaintObj;
        break;
      }
      case "soap_note": {
        let soaptypes = this.emrData.content;
        let ele = Object.keys(soaptypes);
        let generalDetails = {
          isEdit: true,
          isEmail: false,
          isPrint: false,
          isDelete: true,
        };
        let soapObj = this.nodeHeaderDetails({
          ntype,
          emrType: "soap_note",
          authorDetails,
          generalDetails,
        });
        let _sobj = {};
        if (ele == "soap") {
          _sobj.id = "Soap Notes";
          _sobj.dateTime = this.dateTime;
          _sobj.details = soaptypes[ele];
        }
        // if (ele == "prescription") {
        //   _sobj.id = "Soap Notes (Outside Prescription)";
        //   _sobj.dateTime = this.dateTime;
        //   _sobj.details = soaptypes[ele];
        //   _sobj.customFormat = this.emrData.customFormat;
        // }
        soapObj.nodeDetails.push(_sobj);
        emrObj = soapObj;
        break;
      }
      case "memo": {
        let memotypes = this.emrData.content;
        let ele = Object.keys(memotypes);
        let generalDetails = {
          isEdit: ele == "client_communication" ? false : true,
          isEmail: false,
          isPrint: false,
          isDelete: true,
        };
        let memoObj = this.nodeHeaderDetails({
          ntype,
          emrType: "memo",
          authorDetails,
          generalDetails,
        });
        let _mobj = {};
        if (ele == "record_memo") {
          _mobj.id = "record_memo";
          _mobj.dateTime = this.dateTime;
          _mobj.details = `${memotypes[ele]} `;
        } else if (ele == "person_to_person") {
          _mobj.id = "person_to_person";
          _mobj.dateTime = this.dateTime;
          _mobj.details = `${memotypes[ele]} `;
        } else if (ele == "telephone") {
          _mobj.id = "telephone";
          _mobj.dateTime = this.dateTime;
          _mobj.details = `${memotypes[ele]} `;
        } else if (ele == "3rd_party") {
          _mobj.id = "3rd_party";
          _mobj.dateTime = this.dateTime;
          _mobj.details = `${memotypes[ele]} `;
        } else if (ele == "electronic") {
          _mobj.id = "electronic";
          _mobj.dateTime = this.dateTime;
          _mobj.details = `${memotypes[ele]} `;
        } else if (ele == "referral_vet") {
          _mobj.id = "referral_vet";
          _mobj.dateTime = this.dateTime;
          _mobj.details = `${memotypes[ele]} `;
        } else if (ele == "client_communication") {
          _mobj.id = "client_communication";
          _mobj.dateTime = this.dateTime;
          _mobj.details = memotypes[ele];
        } else if (ele == "followup_reminder") {
          _mobj.id = "followup_reminder";
          _mobj.dateTime = this.dateTime;
          _mobj.details = `${memotypes[ele]} `;
        } else if (ele == "message") {
          _mobj.id = "message";
          _mobj.dateTime = this.dateTime;
          _mobj.details = `${memotypes[ele]} `;
        }
        memoObj.nodeDetails.push(_mobj);
        emrObj = memoObj;
        break;
      }
      case "followup": {
        let generalDetails = {
          isEdit: false,
          isEmail: false,
          isPrint: false,
          isDelete: true,
        };
        let followupObj = this.nodeHeaderDetails({
          ntype,
          emrType: "followup",
          authorDetails,
          generalDetails,
        });
        let _fupobj = {};
        _fupobj.id = "Follow Up By";
        _fupobj.dateTime = this.emrData.content.date;
        _fupobj.staff = authorDetails.author;
        _fupobj.details = this.emrData.content.summary;
        followupObj.nodeDetails.push(_fupobj);
        emrObj = followupObj;
        break;
      }
      case "vital": {
        let formtypes = this.emrData.content;
        let generalDetails = {
          isEdit: false,
          isEmail: false,
          isPrint: false,
          isDelete: true,
        };
        let vitalObj = this.nodeHeaderDetails({
          ntype,
          emrType: "vital",
          authorDetails,
          generalDetails,
        });
        let _vitalobj = {};
        for (let key in formtypes) {
          _vitalobj.id = key;
          _vitalobj.dateTime = this.dateTime;
          _vitalobj.details = this.emrData.content[key];
        }
        vitalObj.nodeDetails.push(_vitalobj);
        emrObj = vitalObj;
        break;
      }
      case "active_plan": {
        let generalDetails = {
          isEdit: true,
          isEmail: false,
          isPrint: false,
          isDelete: false,
        };
        let activePlanObj = this.nodeHeaderDetails({
          ntype,
          emrType: "active_plan",
          authorDetails,
          generalDetails,
        });
        activePlanObj.nodeDetails = this.emrData.content;
        emrObj = activePlanObj;
        break;
      }
      case "plan_in_cart": {
        let generalDetails = {
          isEdit: true,
          isEmail: false,
          isPrint: false,
          isDelete: false,
        };
        let activePlanObj = this.nodeHeaderDetails({
          ntype,
          emrType: "plan_in_cart",
          authorDetails,
          generalDetails,
        });
        activePlanObj.nodeDetails = this.emrData.content;
        emrObj = activePlanObj;
        break;
      }
      case "estimate": {
        let generalDetails = {
          isEdit: true,
          isEmail: false,
          isPrint: false,
          isDelete: false,
        };
        let activePlanObj = this.nodeHeaderDetails({
          ntype,
          emrType: "estimate",
          authorDetails,
          generalDetails,
        });
        activePlanObj.nodeDetails = this.emrData.content;
        emrObj = activePlanObj;
        break;
      }
      case "estimate_finalized": {
        let generalDetails = {
          isEdit: true,
          isEmail: false,
          isPrint: false,
          isDelete: false,
        };
        let activePlanObj = this.nodeHeaderDetails({
          ntype,
          emrType: "estimate_finalized",
          authorDetails,
          generalDetails,
        });
        activePlanObj.nodeDetails = this.emrData.content;
        emrObj = activePlanObj;
        break;
      }
      case "attachment": {
        let formtypes = this.emrData.content;
        let generalDetails = {
          isEdit: true,
          isEmail: false,
          isPrint: false,
          isDelete: true,
        };
        let attachObj = this.nodeHeaderDetails({
          ntype,
          emrType: "attachment",
          authorDetails,
          generalDetails,
        });
        let _attachobj = {};
        for (let key in formtypes) {
          _attachobj.id = key;
          _attachobj.dateTime = this.dateTime;
          _attachobj.details = this.emrData.content[key];
        }
        attachObj.nodeDetails.push(_attachobj);

        emrObj = attachObj;
        break;
      }
      // case "plan_in_cart": {
      //   break;
      // }
      // case "vaccineinfo": {
      //   break;
      // }
      // case "memo": {
      //   let memotypes = this.emrData.content;
      //   let ele = Object.keys(memotypes);
      //   let generalDetails = {
      //     isEdit: ele == "client_communication" ? false : true,
      //     isEmail: false,
      //     isPrint: false,
      //     isDelete: true,
      //   };
      //   let memoObj = this.nodeHeaderDetails({
      //     ntype,
      //     emrType: "memo",
      //     authorDetails,
      //     generalDetails,
      //   });
      //   let _mobj = {};
      //   if (ele == "record_memo") {
      //     _mobj.id = "record_memo";
      //     _mobj.dateTime = this.dateTime;
      //     _mobj.details = `${memotypes[ele]} `;
      //   } else if (ele == "person_to_person") {
      //     _mobj.id = "person_to_person";
      //     _mobj.dateTime = this.dateTime;
      //     _mobj.details = `${memotypes[ele]} `;
      //   } else if (ele == "telephone") {
      //     _mobj.id = "telephone";
      //     _mobj.dateTime = this.dateTime;
      //     _mobj.details = `${memotypes[ele]} `;
      //   } else if (ele == "3rd_party") {
      //     _mobj.id = "3rd_party";
      //     _mobj.dateTime = this.dateTime;
      //     _mobj.details = `${memotypes[ele]} `;
      //   } else if (ele == "electronic") {
      //     _mobj.id = "electronic";
      //     _mobj.dateTime = this.dateTime;
      //     _mobj.details = `${memotypes[ele]} `;
      //   } else if (ele == "referral_vet") {
      //     _mobj.id = "referral_vet";
      //     _mobj.dateTime = this.dateTime;
      //     _mobj.details = `${memotypes[ele]} `;
      //   } else if (ele == "client_communication") {
      //     _mobj.id = "client_communication";
      //     _mobj.dateTime = this.dateTime;
      //     _mobj.details = memotypes[ele];
      //   } else if (ele == "followup_reminder") {
      //     _mobj.id = "followup_reminder";
      //     _mobj.dateTime = this.dateTime;
      //     _mobj.details = `${memotypes[ele]} `;
      //   } else if (ele == "message") {
      //     _mobj.id = "message";
      //     _mobj.dateTime = this.dateTime;
      //     _mobj.details = `${memotypes[ele]} `;
      //   }
      //   memoObj.nodeDetails.push(_mobj);
      //   emrObj = memoObj;
      //   break;
      // }

      // case "attachment": {
      //   let formtypes = this.emrData.content;
      //   let generalDetails = {
      //     isEdit: true,
      //     isEmail: false,
      //     isPrint: false,
      //     isDelete: true,
      //   };
      //   let attachObj = this.nodeHeaderDetails({
      //     ntype,
      //     emrType: "attachment",
      //     authorDetails,
      //     generalDetails,
      //   });
      //   let _attachobj = {};
      //   for (let key in formtypes) {
      //     _attachobj.id = key;
      //     _attachobj.dateTime = this.dateTime;
      //     _attachobj.details = this.emrData.content[key];
      //   }
      //   attachObj.nodeDetails.push(_attachobj);
      //   emrObj = attachObj;
      //   break;
      // }

      // case "diagnostic": {
      //   let generalDetails = {
      //     isEdit: false,
      //     isEmail: true,
      //     isPrint: true,
      //     isDelete: true,
      //   };
      //   let diagObj = this.nodeHeaderDetails({
      //     ntype,
      //     emrType: "diagnostic",
      //     authorDetails,
      //     generalDetails,
      //   });
      //   let _diagobj = {
      //     reqid: this.emrData.reqid,
      //     reqno: this.emrData.reqno,
      //     planid: this.emrData.planid,
      //     name: this.emrData.name,
      //     dateTime: this.dateTime,
      //     details: this.emrData.details,
      //   };
      //   diagObj.nodeDetails.push(_diagobj);
      //   emrObj = diagObj;
      //   break;
      // }
      // case "subjective": {
      //   let generalDetails = {
      //     copyHistoryForm: true,
      //     isEdit: true,
      //     isEmail: false,
      //     isPrint: false,
      //     isDelete: true,
      //   };
      //   let subjObj = this.nodeHeaderDetails({
      //     ntype,
      //     emrType: "subjective",
      //     authorDetails,
      //     generalDetails,
      //   });
      //   let _subjObj = {
      //     formid: this.emrData.formid,
      //     formname: this.emrData.formname,
      //     dateTime: this.dateTime,
      //     details: this.emrData.details,
      //   };
      //   subjObj.nodeDetails.push(_subjObj);
      //   emrObj = subjObj;
      //   break;
      // }
      // case "objective": {
      //   let generalDetails = {
      //     copyExamForm: true,
      //     isEdit: true,
      //     isEmail: false,
      //     isPrint: false,
      //     isDelete: true,
      //   };
      //   let objectObj = this.nodeHeaderDetails({
      //     ntype,
      //     emrType: "objective",
      //     authorDetails,
      //     generalDetails,
      //   });
      //   let _objectObj = {
      //     formid: this.emrData.formid,
      //     formname: this.emrData.formname,
      //     dateTime: this.dateTime,
      //     details: this.emrData.details,
      //   };
      //   objectObj.nodeDetails.push(_objectObj);
      //   emrObj = objectObj;
      //   break;
      // }

      // case "assessment": {
      //   let formtypes = this.emrData.content;
      //   let generalDetails = {
      //     isEdit: true,
      //     isEmail: false,
      //     isPrint: false,
      //     isDelete: true,
      //   };
      //   let assessObj = this.nodeHeaderDetails({
      //     ntype,
      //     emrType: "assessment",
      //     authorDetails,
      //     generalDetails,
      //   });
      //   let _assessobj = {};
      //   for (let key in formtypes) {
      //     _assessobj.id = key;
      //     _assessobj.dateTime = this.dateTime;
      //     _assessobj.details = this.emrData.content[key];
      //   }
      //   assessObj.nodeDetails.push(_assessobj);
      //   emrObj = assessObj;
      //   break;
      // }
      // case "vital": {
      //   let formtypes = this.emrData.content;
      //   let generalDetails = {
      //     isEdit: false,
      //     isEmail: false,
      //     isPrint: false,
      //     isDelete: true,
      //   };
      //   let vitalObj = this.nodeHeaderDetails({
      //     ntype,
      //     emrType: "vital",
      //     authorDetails,
      //     generalDetails,
      //   });
      //   let _vitalobj = {};
      //   for (let key in formtypes) {
      //     _vitalobj.id = key;
      //     _vitalobj.dateTime = this.dateTime;
      //     _vitalobj.details = this.emrData.content[key];
      //   }
      //   vitalObj.nodeDetails.push(_vitalobj);
      //   emrObj = vitalObj;
      //   break;
      // }
      // case "followup": {
      //   let generalDetails = {
      //     isEdit: false,
      //     isEmail: false,
      //     isPrint: false,
      //     isDelete: true,
      //   };
      //   let followupObj = this.nodeHeaderDetails({
      //     ntype,
      //     emrType: "followup",
      //     authorDetails,
      //     generalDetails,
      //   });
      //   let _fupobj = {};
      //   _fupobj.id = "Follow Up By";
      //   _fupobj.dateTime = this.emrData.content.date;
      //   _fupobj.staff = authorDetails.author;
      //   _fupobj.details = this.emrData.content.summary;
      //   followupObj.nodeDetails.push(_fupobj);
      //   emrObj = followupObj;
      //   break;
      // }
    }
    return emrObj;
  } catch (err) {
    throw new Error(err);
  }
};

EMR.prototype.add_node = function ({ node, xmlJson }) {
  try {
    const currDateIndex = xmlJson.findIndex(
      (v) => v.timelineDate === this.currentDate
    );
    if (currDateIndex !== -1) {
      // Update the object at that index, for example, add a new node
      let currDateObj = xmlJson[currDateIndex];
      if (currDateObj?.nodes && Array.isArray(currDateObj.nodes)) {
        currDateObj.nodes.push(node);
      } else {
        currDateObj.nodes = [node]; // Initialize if it doesn't exist
      }

      xmlJson[currDateIndex] = currDateObj;
    } else {
      let currDateObj = {
        id: this.parent_nodeId,
        timelineDate: this.currentDate,
        createdAt: this.dateTime,
        nodes: [node],
      };
      xmlJson.push(currDateObj);
    }

    return xmlJson;
  } catch (err) {
    throw new Error(err);
  }
};

module.exports = EMR;
