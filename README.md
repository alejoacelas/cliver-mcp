# cliver-mcp

LLMs can be faster and more comprehensive than humans at searching and processing information. Our first prototype of AI for DNA synthesis customer screening is just Claude with a long prompt and access a few APIs. The output is a table report for human review, reporting any customer flags and summarizing online findings.

The implementation consists of:

- SCREENING_GUIDANCE.txt: The guiding prompt, and our attempt at applying the HHS Screening Guidance to [IBBIS New Customer Form](https://ibbis.bio/our-work/customer-screening/#:~:text=a%20synthesis%20provider.-,New%20Customer%20Form,-The%20information%20on) responses.
- api.ts: A simple call to the Anthropic API, with web search and MCPs enabled.
- mcp/: Connections to the ORCID, EuropePMC, NIH, and the Consolidated Screening List, exposed as functions to Claude through an MCP connection.

While a fair deal of iteration will be needed to codify the practical knowledge of customer screening into a prompt, it wouldn't surprise us if something like this (a prompt + some APIs) were enough to cut the average time it takes to screen DNA synthesis customers by a double-digit percentage. That's already the case for many [financial applications](https://www.greenlite.ai/).

## Try it out

For a ready-made interface, try: https://tool-cliver.replit.app/

To play around with the prompt and API tools, you can set up the prototype on your own [claude.ai](claude.ai) account in 3 steps:

1. Connect to our MCP: Go to [Claude's MCP settings](https://claude.ai/settings/connectors?modal=add-custom-connector) and paste this MCP link: https://cf-template.alejoacelas.workers.dev/sse with a name like 'Screening Tools' or similar
2. Input the guiding prompt: Paste the prompt at SCREENING_GUIDANCE.txt or click here to open a Claude chat with the prompt filled in.
3. Paste in the customer's information: Anything from a name and an email should work, but you can add the person's ORCID or lab address to perform additional checks.
