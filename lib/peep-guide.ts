// What Peep, as your campaign manager, says on each page: a hello the first
// time you arrive, and a nudge toward the next step if you drift off.

import type { PeepLine } from "./peep-events";

type Guide = { hello: PeepLine; idle: PeepLine };

const UPLOAD = { label: "Upload a PDF", href: "/import" };
const START = { label: "Start a campaign", href: "/find" };

export function guideFor(path: string): Guide {
  if (path === "/") {
    return {
      hello: { text: "Hi! I'm Peep, your campaign manager. Drop in your pitch PDF and I'll build your campaign.", cta: UPLOAD },
      idle: { text: "Psst! Start here: upload your pitch PDF and I'll do the heavy lifting.", cta: UPLOAD },
    };
  }
  if (path === "/import") {
    return {
      hello: { text: "Drop your PDF in the box. I'll read every page and flag anything that's missing." },
      idle: { text: "Still with me? Drag your pitch PDF onto the box, or try my sample deck." },
    };
  }
  if (path === "/find") {
    return {
      hello: { text: "Let's build it together. Five quick steps, and I'll check each one with you." },
      idle: { text: "Stuck? Fill in the basics first. Already have a deck? I can read it instead.", cta: UPLOAD },
    };
  }
  if (path === "/opportunities") {
    return {
      hello: { text: "Every one of these started as a pitch. Yours could be next." },
      idle: { text: "Ready to post your own? I can build it from your PDF in a minute.", cta: UPLOAD },
    };
  }
  if (path.startsWith("/opportunities/")) {
    return {
      hello: { text: "This is what a campaign looks like on Peep. Every pledge shows up right here." },
      idle: { text: "Want sponsors like these? Post your campaign free.", cta: START },
    };
  }
  if (path === "/give") {
    return {
      hello: { text: "Set your giving budget and pick what matters to you. I'll handle the matches, the transfer and the tax receipt." },
      idle: { text: "Psst! Pick a few causes and a budget, and I'll find campaigns that fit." },
    };
  }
  if (path.startsWith("/sponsors")) {
    return {
      hello: { text: "These brands and donors have funds ready to give." },
      idle: { text: "Have a campaign? I'll match it with them.", cta: UPLOAD },
    };
  }
  if (path === "/intros") {
    return {
      hello: { text: "Intros only happen when both sides say yes. I keep track of every one." },
      idle: { text: "Need more intros? Post a campaign and I'll find the fits.", cta: START },
    };
  }
  return {
    hello: { text: "I'm here if you need me." },
    idle: { text: "Psst! Your next step: post your campaign free.", cta: UPLOAD },
  };
}
