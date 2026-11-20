import { defineEveryApp } from "@every-app/sdk";

export default defineEveryApp({
  id: "math-tutor",
  name: "Math Tutor",
  description:
    "Solves math and science problems step by step, makes practice tests and plots graphs.",
  icon: "/icon.svg",
  access: "everyone",
  resources: {
    d1: ["DB"],
    r2: ["uploads"],
  },
  ai: {
    chat: {
      why: "Writes the worked solutions and the practice tests.",
    },
  },
});
