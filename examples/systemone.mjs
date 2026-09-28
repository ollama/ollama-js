import { Ollama } from 'ollama'

const ollama = new Ollama({ host: process.env.OLLAMA_HOST })

// Requires Ollama v0.35.0 or later and the local nimble model.
const response = await ollama.systemone({
  "model": "nimble",
  "state": {
    "ticket": "I was charged twice. Please refund the extra payment."
  },
  "questions": {
    "team": {
      "type": "choice",
      "instructions": "Which team should handle this ticket?",
      "criteria": {
        "billing": "Payments and refunds",
        "technical": "Bugs and integrations",
        "other": "None of the above"
      }
    },
    "refund": {
      "type": "noul",
      "instructions": "Does the customer explicitly ask for a refund?"
    },
    "urgency": {
      "type": "score",
      "instructions": "How urgent is this ticket?",
      "criteria": [
        "Routine",
        "Soon",
        "Urgent"
      ]
    }
  }
})
console.log(response)
