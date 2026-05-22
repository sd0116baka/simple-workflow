const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

export function createHttpJsonAdapter() {
  return {
    sendJson(response, status, payload) {
      response.writeHead(status, { "content-type": JSON_CONTENT_TYPE });
      response.end(JSON.stringify(payload));
    },

    async readJsonBody(request) {
      const body = await readRequestBody(request);
      if (!body.trim()) return {};
      return JSON.parse(body);
    },
  };
}
