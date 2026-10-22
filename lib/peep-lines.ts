// Peep's voice: sassy, warm, a little extra, with Miami in her bones. She
// says "literally" a lot, "mmmwhat?" when you surprise her, and pluralizes
// things because it's cuter that way (yous, good mornings, thank yous).

import type { PeepLine } from "./peep-events";

export const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)];

/** "Good mornings", "Good afternoons" or "Good evenings". */
export function goodTime(d = new Date()): string {
  const h = d.getHours();
  return h >= 5 && h < 12 ? "Good mornings" : h >= 12 && h < 18 ? "Good afternoons" : "Good evenings";
}

const UPLOAD = { label: "Upload a PDF", href: "/import" };

export const LINES = {
  poke: ["Mmmwhat?", "Literally why.", "Excuse me? I'm working.", "Hehe. Again. No, wait.", "Ay, gentle!", "That's my good side, thank yous.", "Boop received. Rude, but received."],
  pokeSpam: ["Okay, I'm literally gonna bite. 😤", "Touch me one more times. I dare yous. 😤", "That's it. I'm telling my abuela. 😤"],
  tickle: ["Hehehe stop. No, don't stop.", "Literally the best day of my lifes.", "Ooh, right behind the ears.", "Okay, I love yous. Don't tell anyone."],
  exit: ["Mmmwhat? You're leaving? We were literally so close. 😤", "Excuse me?? Where yous going?", "Oh, so we're just leaving? Okay. Wow. 😤"],
  back: ["You came back! I knew yous would.", "Missed me? Don't answer. I know.", "Welcome backs! I kept your seat warm."],
  waiting: ["Ok, well... I'll just be here...", "Don't mind me. Just a gremlin. With a lantern. Waiting.", "Take your times. I have nowhere to be. Literally."],
  sleep: ["I goes to sleeps now. Zzz…", "Okay, nap times. Poke me when you're ready. Zzz…"],
  wake: ["Huh? I'm up! I was resting my eyes.", "I wasn't sleeping. I was thinking. With my eyes closed."],
  pickup: ["Wait for me!", "Hold on, my lantern!", "Okay, okay, we're moving."],
  night: ["Ooh, spooky. Good thing I brought my lantern.", "Night mode? Literally my aesthetic.", "Lights off, lantern on. Let's go."],
  day: ["My eyes! Okay, okay, it's daytime.", "Good mornings, I guess!", "So bright. Who approved this?"],
  grabbed: ["Mmmwhat are you doing?!", "Put me down! …Actually, this is fun.", "Careful, I bruise like a mango."],
  dropped: ["Thank yous. I'll walk from here.", "Smooth. Very smooth.", "Okay, that was kind of fun."],
  thrown: ["Wheeee— RUDE!", "Byeeee! I'll remember this!", "I'm telling everyones!"],
  peek: ["Ok, well... I'll just be here...", "Psst. Still mad at me?", "I'm not looking. (I'm looking.)", "Can I come back now? I'll be good. Mostly."],
  comeback: ["Ha! Missed me? Of course you did.", "I'm back! Literally never leaving again.", "Did yous miss me? I missed yous."],
  sneakBack: ["Ok, I'm back. I couldn't stay mad at yous."],
  peekaboo: ["Peekaboo!", "Boo! Hehe."],
} as const;

type Guide = { hello: PeepLine; idle: PeepLine };

/** What Peep says when you land on a page, and her nudge if you drift off. */
export function guideFor(path: string): Guide {
  if (path === "/") {
    return {
      hello: { text: `${goodTime()}! I'm Peep, your campaign manager. Literally just drop in your pitch PDF and I'll make it gorgeous.`, cta: UPLOAD },
      idle: { text: "Hello? I'm talking to yous. Upload your pitch PDF and let me cook.", cta: UPLOAD },
    };
  }
  if (path === "/import") {
    return {
      hello: { text: "Drop your PDF in the box. I read every page. Every. Single. One." },
      idle: { text: "Mmmwhat? Still no PDF? Drag it onto the box, or try my sample deck." },
    };
  }
  if (path === "/find") {
    return {
      hello: { text: "From scratch? I love that for yous. Five quick steps, and I check each one." },
      idle: { text: "Stuck? Do the basics first. Got a deck already? Let me read it instead.", cta: UPLOAD },
    };
  }
  if (path === "/opportunities") {
    return {
      hello: { text: "Every one of these started as a pitch. Yours could be next, I'm just saying." },
      idle: { text: "Okay, window shopping is fun, but where's YOUR campaign?", cta: UPLOAD },
    };
  }
  if (path.startsWith("/opportunities/")) {
    return {
      hello: { text: "This is what a campaign looks like on Peep. Cute, right? I did that." },
      idle: { text: "Want sponsors like these? Post yours free. Free!", cta: { label: "Start a campaign", href: "/find" } },
    };
  }
  if (path === "/give") {
    return {
      hello: { text: "Set your giving budget and pick what you love. I do the matches, the transfer and the tax receipts. You're welcome." },
      idle: { text: "Psst. Pick a few causes and a budget. I'll find the good ones. I have taste." },
    };
  }
  if (path.startsWith("/sponsors")) {
    return {
      hello: { text: "These brands have funds ready to give. Verified. I checked. Twice." },
      idle: { text: "Got a campaign? I'll introduce yous.", cta: UPLOAD },
    };
  }
  if (path === "/intros") {
    return {
      hello: { text: "Intros only happen when both sides say yes. I keep track of every ones." },
      idle: { text: "Need more intros? Post a campaign and I'll find the fits.", cta: { label: "Start a campaign", href: "/find" } },
    };
  }
  return {
    hello: { text: "I'm here if yous need me." },
    idle: { text: "Psst! Your next step: post your campaign free.", cta: UPLOAD },
  };
}
