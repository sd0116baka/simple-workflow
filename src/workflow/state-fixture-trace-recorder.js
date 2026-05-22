export function artifactRecord(artifactId, body, appendedAt) {
  return {
    artifactId,
    body,
    appendedAt,
  };
}

function appendRequestRecord(artifactId, appendRequest, appendedAt) {
  return artifactRecord(artifactId, appendRequest.artifact, appendedAt);
}

function appendRequestAgentRun(appendRequest, outputArtifactRefs) {
  return {
    ...appendRequest.agentRun,
    outputArtifactRefs,
  };
}

export function createStateFixtureTraceRecorder(taskPackage) {
  function addArtifact(artifactType, record) {
    taskPackage.artifacts[artifactType] = record;
    taskPackage.timeline.push({
      artifactType,
      artifactId: record.artifactId,
      agentRunId: null,
      appendedAt: record.appendedAt,
    });
  }

  function addMultiArtifact(artifactType, record) {
    taskPackage.artifacts[artifactType] = [
      ...(taskPackage.artifacts[artifactType] ?? []),
      record,
    ];
    taskPackage.timeline.push({
      artifactType,
      artifactId: record.artifactId,
      agentRunId: null,
      appendedAt: record.appendedAt,
    });
  }

  function addAgentRun(agentRun) {
    taskPackage.agentRuns.push(agentRun);
    taskPackage.timeline.push({
      artifactType: null,
      artifactId: null,
      agentRunId: agentRun.runId,
      appendedAt: agentRun.finishedAt,
    });
  }

  return {
    addArtifact,

    addRequestArtifact(artifactType, artifactId, appendRequest, appendedAt) {
      addArtifact(artifactType, appendRequestRecord(artifactId, appendRequest, appendedAt));
    },

    addMultiArtifact,

    addRequestMultiArtifact(artifactType, artifactId, appendRequest, appendedAt) {
      addMultiArtifact(artifactType, appendRequestRecord(artifactId, appendRequest, appendedAt));
    },

    addAgentRun,

    addRequestAgentRun(appendRequest, outputArtifactRefs) {
      addAgentRun(appendRequestAgentRun(appendRequest, outputArtifactRefs));
    },

    addRequestMultiArtifactWithAgentRun(artifactType, artifactId, appendRequest, appendedAt) {
      addMultiArtifact(artifactType, appendRequestRecord(artifactId, appendRequest, appendedAt));
      addAgentRun(appendRequestAgentRun(appendRequest, [artifactId]));
    },

    reset() {
      taskPackage.artifacts = {};
      taskPackage.agentRuns = [];
      taskPackage.timeline = [];
    },
  };
}
