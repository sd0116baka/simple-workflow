function sendEvent(response, event) {
  response.write(`event: ${event.type}\n`);
  response.write(`data: ${JSON.stringify(event)}\n\n`);
}

export function createHttpEventStreamAdapter() {
  return {
    serveEvents(request, response, workflowService) {
      response.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });
      response.write(": connected\n\n");

      const unsubscribe = workflowService.onEvent((event) => {
        sendEvent(response, event);
      });

      request.on("close", unsubscribe);
    },
  };
}
