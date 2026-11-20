# Math Tutor

A homework helper for your team: ask a math, physics, chemistry or accounting problem (typed, photographed or in a PDF) and get a worked, step-by-step solution, make scored practice tests on any topic, and plot functions.

Inspired by https://math-gpt.org

Built with [oss.new](https://oss.new) for [EveryApp](https://github.com/every-app/every-app).

## Features

- Ask a problem in a subject and get numbered steps, formatted math and a final answer, then ask follow-ups in the same chat.
- Attach a photo (PNG, JPEG, WebP) or PDF up to 10 MB and have the problem in it solved.
- Make a 3 to 10 question multiple-choice test on a topic, check each answer once, reveal the steps and keep a running score.
- Plot several expressions in x together, set the ranges, and save, reopen, edit or delete graphs.

Left out: accounts and sign-in, which your Gateway handles; plans and billing; video explanations; the lecture summarizer, grader and exam hub; the calculator catalogue and blog; translated interfaces; mobile apps.

## Setup

- Install and test: `pnpm install`, then `pnpm test`. `pnpm dev` runs it locally; put an AI provider key such as `OPENROUTER_API_KEY` in `.dev.vars` to get answers there.
- Deploy: `pnpm run deploy`. The deploy creates the D1 database and the R2 bucket for uploads.
- AI: answers and tests come from your Gateway's default AI model. Set one with `everyapp provider add openrouter` (or another provider) and `everyapp ai default`. Until then, the app shows how to set it up in place of answers.
- There are no secrets or settings to fill in.

## Limitations

- Chats, tests and graphs are private to the member who made them; there is no sharing.
- Scanned PDFs without a text layer can't be read; attach a photo of the page instead.
- Answer quality depends on the model your Gateway uses. Images need a model that accepts them.
- The real Gateway, AI providers and deployment weren't exercised by the local checks, which use a stand-in model.
