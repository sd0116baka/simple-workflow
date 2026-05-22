const BASE_URL = process.env.SIMPLE_WORKFLOW_SMOKE_URL ?? "http://localhost:5173";

const FIXTURE_KEYS = [
  "task-pool",
  "task-recommender",
  "execution-admission",
  "isolated-workspace",
  "main-agent",
  "execution-agent",
  "review-agent",
  "convergence",
  "convergence-success",
  "convergence-failure",
  "human-guided-execution",
  "auto-merge-planning",
  "auto-merge-execution",
  "merged",
  "closed",
  "cancelled",
];

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} failed: ${response.status} ${payload.error ?? ""}`.trim());
  }
  return payload;
}

async function seedFixture(fixtureKey) {
  return requestJson("/api/test-fixtures/state-stubs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fixtureKey }),
  });
}

function findSeededPackage(taskPool) {
  return taskPool?.taskContextPackages?.find((taskPackage) =>
    taskPackage.source?.path?.startsWith("tasks/stub-"));
}

async function assertFixtureVisible(fixtureKey) {
  const seedResult = await seedFixture(fixtureKey);
  const seededTask = seedResult.tasks?.[0];
  if (!seededTask) {
    throw new Error(`${fixtureKey}: seed response did not include a task`);
  }

  const { taskPool } = await requestJson("/api/task-pool");
  const observedPackage = findSeededPackage(taskPool);
  if (!observedPackage) {
    throw new Error(`${fixtureKey}: task pool did not expose a seeded package`);
  }

  if (observedPackage.currentWorkStage !== seededTask.currentWorkStage) {
    throw new Error(
      `${fixtureKey}: expected ${seededTask.currentWorkStage}, observed ${observedPackage.currentWorkStage}`,
    );
  }

  return {
    fixtureKey,
    packageId: observedPackage.packageId,
    stage: observedPackage.currentWorkStage,
  };
}

async function assertServerReady() {
  const response = await fetch(BASE_URL);
  if (!response.ok) {
    throw new Error(`GET / failed: ${response.status}`);
  }
}

async function cleanupFixtures() {
  await requestJson("/api/test-fixtures/state-stubs", { method: "DELETE" });
  const { taskPool } = await requestJson("/api/task-pool");
  const remainingSeededPackage = findSeededPackage(taskPool);
  if (remainingSeededPackage) {
    throw new Error(`cleanup left seeded package: ${remainingSeededPackage.packageId}`);
  }
}

async function main() {
  await assertServerReady();
  const results = [];
  for (const fixtureKey of FIXTURE_KEYS) {
    results.push(await assertFixtureVisible(fixtureKey));
  }
  await cleanupFixtures();

  console.table(results.map(({ fixtureKey, stage }) => ({
    fixture: fixtureKey,
    stage,
  })));
  console.log(`Smoke test passed for ${results.length} fixtures at ${BASE_URL}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
