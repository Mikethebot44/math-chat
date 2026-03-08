import "../../scripts/load-env";
import { defaultBuildLogger, Template } from "e2b";
import { chatAgentTemplate, chatAgentTemplateName } from "./template";

function getTemplateName(): string {
  return (
    process.argv[2] ||
    process.env.E2B_CHAT_TEMPLATE_ID ||
    chatAgentTemplateName
  );
}

async function main() {
  if (!process.env.E2B_API_KEY) {
    throw new Error(
      "E2B_API_KEY is required to build the chat-agent E2B template"
    );
  }

  const name = getTemplateName();
  const buildInfo = await Template.build(chatAgentTemplate, name, {
    cpuCount: 2,
    memoryMB: 4096,
    onBuildLogs: defaultBuildLogger(),
  });

  console.log(
    `Built E2B template '${buildInfo.name}' (templateId: ${buildInfo.templateId}, buildId: ${buildInfo.buildId})`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
