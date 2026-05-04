export { indexChange, getChange, getAllChanges, getChangesByDomain, getChangesByStatus, getChangesAffectingEntity, getRelatedChanges } from "./change.js";
export { indexDecision, getDecision, getAllDecisions, getDecisionsByStatus, getDecisionsAffectingCR } from "./decision.js";
export { indexConstraint, getConstraint, getAllConstraints, getConstraintsBySeverity } from "./constraint.js";
export { indexDomain, getDomain, getAllDomains, getDomainByContext } from "./domain.js";
export {
  createChangeFilesTable,
  createChangeApisTable,
  indexChangeFiles,
  indexChangeApis,
  getChangesAffectingFile,
  getChangesAffectingApi
} from "./change-affects.js";
