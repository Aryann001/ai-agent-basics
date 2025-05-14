import { config } from "dotenv";
import { ChatGroq } from "@langchain/groq";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

config();

const addTwoNumberAndThenMultiplyBy5 = tool(
  async ({ num1, num2 }) => {
    return (num1 + num2) * 5;
  },
  {
    name: "addTwoNumberAndThenMultiplyBy5",
    description: "Add two numbers and then multiply it with 5",
    schema: z.object({
      num1: z.number().describe("First number"),
      num2: z.number().describe("Second number"),
    }),
  }
);

const addANumberToTheTemperture = tool(
  async ({ number, temperature }) => {
    return number + temperature;
  },
  {
    name: "addANumberToTheTemperture",
    description: "Add a number to the temperature",
    schema: z.object({
      number: z.number().describe("A Number"),
      temperature: z.number().describe("temperature"),
    }),
  }
);

const tempInCelsius = tool(
  async ({ fahrenheit }) => {
    return ((fahrenheit - 32) * 5.0) / 9.0;
  },
  {
    name: "tempInCelsius",
    description: "Convert fahrenheit into celsius",
    schema: z.object({
      fahrenheit: z.number().describe("Temperature in fahrenheit"),
    }),
  }
);

// Define the tools for the agent to use
const tools = [
  new TavilySearchResults({ maxResults: 3 }),
  addTwoNumberAndThenMultiplyBy5,
  addANumberToTheTemperture,
  tempInCelsius,
];
const toolNode = new ToolNode(tools);

const model = new ChatGroq({
  model: "meta-llama/llama-4-maverick-17b-128e-instruct",
  temperature: 0,
}).bindTools(tools);

// Define the function that determines whether to continue or not
function shouldContinue({ messages }) {
  const lastMessage = messages[messages.length - 1];

  // If the LLM makes a tool call, then we route to the "tools" node
  if (lastMessage.tool_calls?.length) {
    console.log("tool_calls -------------- ", lastMessage.tool_calls);
    return "tools";
  }
  // Otherwise, we stop (reply to the user) using the special "__end__" node
  return "__end__";
}

// Define the function that calls the model
async function callModel(state) {
  const response = await model.invoke(state.messages);

  // We return a list, because this will get added to the existing list
  return { messages: [response] };
}

// Define a new graph
const workflow = new StateGraph(MessagesAnnotation)
  .addNode("agent", callModel)
  .addEdge("__start__", "agent") // __start__ is a special name for the entrypoint
  .addNode("tools", toolNode)
  .addEdge("tools", "agent")
  .addConditionalEdges("agent", shouldContinue);

// Finally, we compile it into a LangChain Runnable.
const app = workflow.compile();

// Use the agent
// const finalState = await app.invoke({
//   messages: [new HumanMessage("what is the weather in sf")],
// });
// console.log(finalState.messages[finalState.messages.length - 1].content);

// console.log(
//   "-----------------------------------------------------------------"
// );

// const nextState = await app.invoke({
//   // Including the messages from the previous run gives the LLM context.
//   // This way it knows we're asking about the weather in NY
//   messages: [...finalState.messages, new HumanMessage("what about ny")],
// });
// console.log(nextState.messages[nextState.messages.length - 1].content);

console.log(
  "-----------------------------------------------------------------"
);

const nextState2 = await app.invoke({
  // Including the messages from the previous run gives the LLM context.
  // This way it knows we're asking about the weather in NY
  messages: [
    // ...nextState.messages,
    new HumanMessage(
      "what is 5 times adding 100 and 2 and then adding it with weather temperature of ny in celsius"
    ),
  ],
});
console.log(nextState2.messages[nextState2.messages.length - 1].content);
