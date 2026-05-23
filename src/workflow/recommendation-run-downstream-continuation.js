import { latestArtifactRecord } from "./task-package-artifacts.js";
import {
  isUsableExecutionReport,
  isUsableReviewReport,
} from "./reviewed-execution-artifacts.js";
import { isWorkflowStageEnabled } from "./workflow-stage-switches.js";

const MAIN_AGENT_INITIALIZATION_RUN_ID = "main-agent:initialization";

function hasMainAgentInitialization(taskContextPackage) {
  return taskContextPackage?.agentRuns?.some((agentRun) =>
    agentRun.runId === MAIN_AGENT_INITIALIZATION_RUN_ID
      && agentRun.status === "succeeded") === true;
}

function nextContinuationStage(run) {
  const taskContextPackage = run?.taskContextPackage;
  if (!taskContextPackage) return "executionAdmission";
  if (!taskContextPackage.artifacts?.executionAuthorization) return "executionAdmission";
  if (!taskContextPackage.artifacts?.isolatedWorkspace) return "isolatedWorkspace";
  if (!hasMainAgentInitialization(taskContextPackage)) return "mainAgent";
  const executionReport = latestArtifactRecord(taskContextPackage, "executionReport");
  if (!executionReport) return "executionAgent";
  if (!isUsableExecutionReport(taskContextPackage, executionReport)) return null;
  const reviewReport = latestArtifactRecord(taskContextPackage, "reviewReport");
  if (!reviewReport) return "reviewAgent";
  if (!isUsableReviewReport(taskContextPackage, reviewReport)) return null;
  if (!latestArtifactRecord(taskContextPackage, "convergenceAdvice")
    && !taskContextPackage.artifacts?.convergenceSuccess
    && !latestArtifactRecord(taskContextPackage, "convergenceFailure")) {
    return "convergence";
  }
  return null;
}

export function canContinueRecommendationRunDownstream(run) {
  const nextStage = nextContinuationStage(run);
  return run?.status === "succeeded"
    && run.exitCode === 0
    && !run.error
    && Boolean(run.executionIntentAppendRequest)
    && !run.successHumanDecisionRequest
    && !run.failureHumanDecisionRequest
    && !run.taskCloseout
    && Boolean(nextStage)
    && isWorkflowStageEnabled(run.stageSwitches, nextStage);
}
