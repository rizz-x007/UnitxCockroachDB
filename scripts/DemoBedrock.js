require("dotenv").config();

const {
  BedrockRuntimeClient,
  ConverseCommand,
} = require("@aws-sdk/client-bedrock-runtime");

async function main() {
  const client = new BedrockRuntimeClient({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  console.log("Using model:", process.env.BEDROCK_MODEL_ID);

  const response = await client.send(
    new ConverseCommand({
      modelId: process.env.BEDROCK_MODEL_ID,
      messages: [
        {
          role: "user",
          content: [
            {
              text: "Hello! Reply with exactly one sentence.",
            },
          ],
        },
      ],
      inferenceConfig: {
        maxTokens: 50,
        temperature: 0.7,
      },
    })
  );

  console.log("\nResponse:");
  console.log(response.output.message.content[0].text);
}

main().catch((err) => {
  console.error("\n=== ERROR ===");
  console.error(err);
  console.error("\nJSON:");
  console.error(JSON.stringify(err, null, 2));
});