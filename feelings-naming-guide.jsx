import { useState, useRef } from "react";

// ─── COMBINED TAXONOMY ───────────────────────────────────────────────
// NVC Feelings Wheel (Rosenberg/Bret Stein) provides the 6/6 balanced core structure
// Willcox Feelings Wheel provides additional tier-2 families and tier-3 specifics
// Where both wheels contain the same feeling, it appears once
// Willcox "Bad" category integrated across relevant cores + kept as its own

const TAXONOMY = {

  // ═══════════════════════════════════════════════════════════════════
  // NEEDS BEING MET
  // ═══════════════════════════════════════════════════════════════════

  Joyful: {
    color: "#d4a843",
    families: {
      Happy: {
        feelings: {
          Ecstatic:      "Beyond happy. Almost too much joy to contain. A peak.",
          Elated:        "High. Everything feels lifted. Often comes in a rush.",
          Delighted:     "A bright, surprised pleasure. More buoyant than pleased.",
          Pleased:       "Mild, genuine satisfaction. Not ecstatic — just glad.",
          Cheerful:      "Bright and light. An upward energy that's social and easy.",
          Thrilled:      "High-energy joy. Something good is happening or about to happen.",
          Blissful:      "Deep, undisturbed happiness. Rare and complete.",
        }
      },
      Excited: {
        feelings: {
          Enthusiastic:  "Active, forward-leaning excitement. You want to engage and contribute.",
          Exhilarated:   "A rush. Often physical — your heart rate is up, and it feels good.",
          Alive:         "Fully present and vibrating. The opposite of numb.",
          Passionate:    "Burning interest or desire. Focused and consuming.",
          Eager:         "Ready and leaning forward. Anticipation with energy behind it.",
        }
      },
      Grateful: {
        feelings: {
          Thankful:      "Recognising what someone gave you, and feeling lighter for it.",
          Appreciative:  "Noticing what's good and feeling actively glad for it.",
          Touched:       "Something reached you in a way you didn't expect. Moved without being overwhelmed.",
          Blessed:       "A sense of unearned good fortune. Humbling in a positive way.",
          Relieved:      "The tension dropped. Something you feared didn't happen, or something hard ended.",
        }
      },
      Playful: {
        feelings: {
          Aroused:       "An energised alertness with an edge of excitement. More charged than simply interested.",
          Cheeky:        "A lighthearted boldness. You're pushing a boundary, but with a grin.",
          Free:          "Unbound. No weight on you right now. Different from peaceful — this has movement in it.",
          Energetic:     "A buzzing readiness. More physical than emotional. You want to move.",
          Amused:        "Something landed as funny or entertaining. Light pleasure without depth.",
          Frisky:        "Playful energy with a physical edge. Light, teasing, alive.",
        }
      },
      Content: {
        feelings: {
          Fulfilled:     "A deep sense of completeness. What you needed has been met.",
          Satisfied:     "Enough. Not craving more. A quiet completion.",
          Joyful:        "A warm, full happiness. Quieter than ecstatic, deeper than pleased.",
          Glad:          "Simple and clean. Something went well and you feel good about it.",
        }
      },
    }
  },

  Proud: {
    color: "#c94040",
    families: {
      Confident: {
        feelings: {
          "Self-assured":  "Settled trust in yourself. Not proving anything. Just knowing.",
          Poised:          "Calm under attention. Composed without effort.",
          Brave:           "Willing to face what's difficult. The fear is there — you're moving anyway.",
          Courageous:      "Acting despite fear, and knowing it. The fear is still there. You moved anyway.",
          Bold:            "Stepping forward without waiting for permission. Decisive energy.",
        }
      },
      Successful: {
        feelings: {
          Accomplished:    "Something meaningful is complete. You did it, and you know it.",
          Effective:       "Your actions are producing results. Competence in motion.",
          Empowered:       "Agency unlocked. You can influence what happens next.",
          Capable:         "Quiet certainty that you can handle what's in front of you.",
          Powerful:        "A sense of agency. Not dominance — capability with reach.",
        }
      },
      Valued: {
        feelings: {
          Respected:       "Feeling seen and valued by others. A need for recognition being met.",
          Fulfilled:       "What you gave mattered. The effort connected.",
          Encouraged:      "Someone or something reinforced your direction. Wind at your back.",
          Worthwhile:      "Knowing your presence and contribution count for something.",
          "Self-confident": "Trust in your own capacity that comes from within, not from others.",
        }
      },
    }
  },

  Interested: {
    color: "#b07cc3",
    families: {
      Curious: {
        feelings: {
          Inquisitive:   "Actively looking for answers. More deliberate than curious.",
          Fascinated:    "Deeply pulled in. More intense than curious — you can't look away.",
          Absorbed:      "Lost in something. Time disappears. Focus without effort.",
          Engrossed:     "Completely taken by something. The world outside it faded.",
          Captivated:    "Held by something beautiful or compelling. Willingly caught.",
        }
      },
      Engaged: {
        feelings: {
          Intrigued:     "Something caught your attention and you want to know more.",
          Interested:    "Open and pulled toward. Not yet deep — but the hook is in.",
          Stimulated:    "Mentally activated. Ideas are moving. The brain is enjoying itself.",
          Inspired:      "Something sparked a new possibility in you. Energy to create or act.",
          Creative:      "Something wants to come out. The internal pressure to make or express.",
        }
      },
      Attentive: {
        feelings: {
          Entranced:     "Drawn in completely. A trance-like focus — not forced, just absorbed.",
          Mesmerised:    "Can't look away. Beauty or complexity has you held.",
          Animated:      "Lit up. Your energy is visibly higher. Expressive and alive.",
          Refreshed:     "Renewed. Whatever was depleted has been replenished.",
          Alert:         "Tuned in. Your senses are sharper. Awake and aware.",
        }
      },
    }
  },

  Peaceful: {
    color: "#5a8a5a",
    families: {
      Calm: {
        feelings: {
          Serene:        "Deep stillness. Nothing pulling at you. Smooth and undisturbed.",
          Tranquil:      "Quiet. A landscape without weather. Peaceful and spacious.",
          Quiet:         "The noise stopped. Not silence — just enough stillness to breathe.",
          Centred:       "Balanced. Grounded in your own axis. Not swayed easily.",
          Balanced:      "Everything in proportion. No part of your life is screaming for attention.",
        }
      },
      Relaxed: {
        feelings: {
          Comfortable:   "At ease in your environment. Nothing needs adjusting.",
          "At ease":     "Settled. The vigilance has dropped. You can breathe.",
          Rested:        "Recovered. Your reserves have been restored.",
          Mellow:        "Soft, warm, low-key. Not much edge. Pleasantly flattened.",
          Harmonious:    "Everything feels aligned. Internal and external match.",
        }
      },
      Content: {
        feelings: {
          Satisfied:     "Enough. Not craving more. A quiet completion.",
          Grounded:      "Rooted. Connected to what's real and solid beneath you.",
          Settled:       "The restlessness stopped. You've landed somewhere that fits.",
          Congruent:     "Your inside matches your outside. No performance required.",
        }
      },
    }
  },

  Trusting: {
    color: "#4a90b8",
    families: {
      Secure: {
        feelings: {
          Safe:          "No threat detected. Your nervous system has stood down.",
          Assured:       "Confident that things will be okay. Evidence-based calm.",
          Certain:       "No doubt. You know where you stand and it feels solid.",
          Comforted:     "Something or someone eased the distress. You feel held.",
          Protected:     "Someone or something is watching out for you. You can relax the vigilance.",
        }
      },
      Hopeful: {
        feelings: {
          Optimistic:    "Leaning toward the future with some confidence it'll work.",
          Expectant:     "Waiting for something good. The anticipation is positive.",
          Positive:      "A general lean toward the good. Not naive — just tilted toward possibility.",
          Encouraged:    "Something reinforced your direction. Momentum confirmed.",
          Relieved:      "The weight lifted. What you feared didn't materialise.",
        }
      },
      Confident: {
        feelings: {
          Convinced:     "No remaining doubt. You've landed on something solid.",
          Friendly:      "Open and warm toward others. No defensiveness. Easy connection.",
          Faithful:      "Steady belief in someone or something, even without proof.",
          Open:          "Available. Willing to receive. Not guarded.",
        }
      },
    }
  },

  Loving: {
    color: "#c97a8a",
    families: {
      Affectionate: {
        feelings: {
          Warm:          "A soft, general kindness. Not intense — just open and generous.",
          Tender:        "Soft and exposed. Easily moved. Not weak — open.",
          Fond:          "A settled, gentle liking. Not passionate — steady.",
          Adoring:       "Looking at someone or something with deep, uncomplicated love.",
          Caring:        "Attentive to someone else's needs. Love expressed through action.",
        }
      },
      Connected: {
        feelings: {
          Close:         "Emotional distance has collapsed. You feel together, not just near.",
          Intimate:      "Walls down. More than warmth — there's vulnerability here, and it feels safe.",
          Compassionate: "Feeling someone else's pain and wanting to ease it. Tender, not pitying.",
          Devoted:       "Committed. Your attention and loyalty are given freely.",
          Belonging:     "You're part of something. The group has a place for you in it.",
        }
      },
      Admiring: {
        feelings: {
          Reverent:      "Deep respect shading into awe. You're looking up, not across.",
          Appreciative:  "Actively noticing and valuing what someone is or does.",
          Fondness:      "A gentle, sustained warmth toward someone. Affection with history.",
          Sensitive:     "Open and permeable. You're feeling everything a little more. Receptivity, not weakness.",
        }
      },
    }
  },

  // ═══════════════════════════════════════════════════════════════════
  // NEEDS NOT BEING MET
  // ═══════════════════════════════════════════════════════════════════

  Angry: {
    color: "#c0473a",
    families: {
      "Let down": {
        feelings: {
          Betrayed:      "Someone broke an agreement you were counting on. The pain is in the trust that was spent.",
          Resentful:     "Old anger that didn't get resolved. It's compounding quietly.",
          Disrespected:  "Your dignity wasn't honoured. The anger is about how you were treated.",
          Ridiculed:     "Mocked. The cruelty is in the audience — real or imagined.",
          Indignant:     "Anger on principle. Something unfair happened, and it offends your sense of right.",
          Violated:      "A boundary was crossed. The anger is protective.",
        }
      },
      Humiliated: {
        feelings: {
          Bitter:        "Anger that has aged into something harder. Often comes from repeated disappointment.",
          Mad:           "Straightforward, hot anger. Less complex than resentful. More immediate.",
          Furious:       "Intense, consuming anger. Hard to think clearly through it.",
          Jealous:       "Someone has what you want, and it burns. Comparison plus desire plus threat.",
          Enraged:       "Beyond furious. Rational thought has left the building.",
        }
      },
      Aggressive: {
        feelings: {
          Provoked:      "Someone did something that lit the fuse. The anger feels justified and directed.",
          Hostile:       "A stance against. You're not just angry — you're oppositional.",
          Infuriated:    "Like furious but with a sharper edge. Something specific set this off.",
          Frustrated:    "Blocked. You're trying and it's not working. The anger is in the obstruction.",
          Irritated:     "Low-heat friction. Not explosive — just wearing on you.",
          Agitated:      "Restless anger. Can't sit still with it. Needs to go somewhere.",
        }
      },
      Critical: {
        feelings: {
          Distant:       "Pulled back. The anger has gone cold and you've withdrawn.",
          Annoyed:       "Low-grade, persistent irritation. Not explosive — grinding.",
          Withdrawn:     "You've removed yourself. Not peaceful distance — protective retreat.",
          Sceptical:     "You don't buy it. Trust has been damaged and you're watching carefully.",
          Dismissive:    "You've written something or someone off. The anger became a verdict.",
          Numb:          "The feeling shut down. Often a sign that too much came too fast.",
          Contemptuous:  "Looking down on someone. Anger mixed with superiority. Corrosive.",
        }
      },
    }
  },

  Afraid: {
    color: "#cc7a3a",
    families: {
      Scared: {
        feelings: {
          Frightened:    "Immediate, visceral fear. Something specific is threatening.",
          Terrified:     "Fear at full volume. Paralysing, consuming. Hard to think past it.",
          Panicked:      "Fear plus urgency. Fight-or-flight has kicked in and you're reacting, not choosing.",
          Helpless:      "You can't see a move to make. Not lazy — genuinely stuck.",
          Overwhelmed:   "Too many threats or demands at once. The fear is in the volume.",
        }
      },
      Anxious: {
        feelings: {
          Worried:       "Fear projected forward. Something bad might happen. Not yet — but maybe.",
          Nervous:       "Anticipatory anxiety. Something is coming and you're not sure you're ready.",
          Insecure:      "Uncertain about your standing or safety. The ground doesn't feel solid.",
          Apprehensive:  "A quiet dread. You sense something coming but can't name it clearly.",
          Uneasy:        "Something is off. You can't point to it, but your body knows.",
          Concerned:     "Worried but with care behind it. Not panicked — attentive and unsettled.",
        }
      },
      Vulnerable: {
        feelings: {
          Exposed:       "Feeling seen in a way you didn't choose. Vulnerable without consent.",
          Fragile:       "Close to breaking. You can feel how thin the margin is.",
          Susceptible:   "Open to being hurt. Your defences are down, and not by choice.",
          Threatened:    "Something is aimed at you. Not paranoia — a real or perceived targeting.",
          Inadequate:    "The task feels bigger than your ability. A gap between what's needed and what you have.",
          Insignificant: "Feeling too small to matter. Different from inadequate — this is about relevance, not ability.",
          Worthless:     "A deep sense of having nothing to offer. Painful and often disconnected from evidence.",
        }
      },
    }
  },

  Sad: {
    color: "#5a7fa0",
    families: {
      Lonely: {
        feelings: {
          Isolated:      "Cut off. The aloneness isn't chosen. Different from solitude.",
          Abandoned:     "Left behind by someone who was supposed to stay. The pain is in the leaving.",
          Neglected:     "Overlooked. Not attacked — just forgotten. The wound is in the absence.",
          Excluded:      "Kept out. Others are together and you are not. The door was closed.",
          Homesick:      "Missing a place or a version of life that felt like home. Ache plus longing.",
        }
      },
      Hurt: {
        feelings: {
          Heartbroken:   "Something you loved broke or left. The pain is central and consuming.",
          Disappointed:  "What happened didn't meet what you expected. The gap hurts.",
          "Let down":    "Someone didn't show up the way you needed. The sadness is relational.",
          Wounded:       "Something hit you and the mark is still fresh.",
          Empty:         "Nothing there. Not calm — hollow. The absence itself is distressing.",
          Sorrowful:     "A deep, quiet sadness. Not sharp — heavy. It settles in.",
          Inferior:      "Measuring yourself against others and falling short. The pain is comparative.",
        }
      },
      Depressed: {
        feelings: {
          Hopeless:      "The future holds nothing. Different from sad — this is the absence of possibility.",
          Despairing:    "Active suffering with no exit visible. Heavier than hopeless — there's anguish in it.",
          Miserable:     "Sustained unhappiness. Not a spike — a state.",
          Powerless:     "No leverage. The situation is bigger than your ability to change it.",
          Devastated:    "Flattened by loss or shock. The ground gave way.",
          Grief:         "Loss that hasn't finished moving through you. It has its own timeline.",
        }
      },
    }
  },

  Disgusted: {
    color: "#6b7a5a",
    families: {
      Disapproving: {
        feelings: {
          Judgemental:   "You've assessed and found it lacking. The disapproval has a moral dimension.",
          Appalled:      "Deep moral shock. What you're seeing feels fundamentally wrong.",
          Revolted:      "Visceral rejection. Beyond disagreement — this repels you.",
          Horrified:     "Disgust plus shock. You can't believe what you're witnessing.",
          Nauseated:     "Disgust felt in the body. Something is deeply off.",
          Detestable:    "Active hatred of what you're encountering. Strong and sustained.",
        }
      },
      Disappointed: {
        feelings: {
          Repelled:      "Pushed away by something. Not anger — aversion.",
          Awful:         "A broad, heavy unpleasantness. Diffuse but real.",
          Loathing:      "Deep, settled hatred. Quieter than rage. More permanent.",
          Averse:        "You don't want to go near it. A pulling-away impulse.",
          Disillusioned: "What you believed turned out to be less. The gap between expectation and reality hurts.",
        }
      },
      Contemptuous: {
        feelings: {
          Scornful:      "Dismissal with an edge. You think less of it or them.",
          Disdainful:    "A cool, elevated rejection. Not hot — cold and final.",
          Condescending: "Looking down from a position of assumed superiority. Often unconscious.",
          Repulsive:     "Deeply off-putting. Something in it triggers rejection.",
        }
      },
    }
  },

  Ashamed: {
    color: "#7a6a8a",
    families: {
      Guilty: {
        feelings: {
          Remorseful:    "Wishing you could undo something. The regret has weight.",
          Regretful:     "Looking back and wishing you'd chosen differently. Quieter than remorse.",
          "Self-conscious": "Aware of being watched or judged. The spotlight is uncomfortable.",
          Uncomfortable: "Something doesn't fit. You're not at ease, but can't always name why.",
          Awkward:       "The social situation doesn't flow. You feel out of step.",
        }
      },
      Embarrassed: {
        feelings: {
          Humiliated:    "Publicly reduced. The shame has an audience.",
          Mortified:     "So embarrassed you want to disappear. Extreme self-consciousness.",
          Flustered:     "Thrown off balance. Your composure broke and you felt it.",
          Chagrined:     "Annoyed at yourself for a mistake. Self-directed irritation.",
          Sheepish:      "Caught out. Mildly ashamed but not devastated. A bit of a wince.",
        }
      },
      Worthless: {
        feelings: {
          Inadequate:    "Not enough for what's being asked. The gap is painful.",
          Inferior:      "Measuring yourself against others and coming up short.",
          "Self-loathing": "Turned against yourself. The harshest inner critic.",
          Disgraced:     "Your standing has been damaged. The shame is social and lasting.",
          Pathetic:      "Seeing yourself as pitiable. Self-contempt with a layer of sadness.",
        }
      },
    }
  },

  Bad: {
    color: "#7a6a5a",
    families: {
      Bored: {
        feelings: {
          Indifferent:   "Nothing here has your attention. Not hostile — just absent of investment.",
          Apathetic:     "Deeper than bored. You've stopped caring, and that itself might be a signal.",
          Listless:      "Low energy, no direction. Not sad exactly — just flat.",
          Uninterested:  "The thing in front of you doesn't pull you. No animosity — just no draw.",
        }
      },
      Stressed: {
        feelings: {
          Tired:         "Depleted. Could be physical, emotional, or both. You need recovery.",
          Unfocused:     "Your attention won't land. Not confusion — more like mental fog.",
          "Burned out":  "Past tired. The reserves are gone and the motivation went with them.",
          Drained:       "Emptied out. Different from tired — this implies something took the energy from you.",
          Tense:         "Tight. Held. Your body is bracing even if your mind hasn't name why.",
          Restless:      "Can't settle. Energy without direction. Your body wants to move but doesn't know where.",
        }
      },
      Pressured: {
        feelings: {
          Rushed:        "Not enough time, and you feel it in your body. Speed without choice.",
          Overwhelmed:   "Too much, coming too fast. The system is at capacity.",
          "Out of control": "You've lost your grip on the pace or the direction. Alarming, not just stressful.",
          Frantic:       "Busy tipped into panic. Moving fast but losing accuracy.",
        }
      },
      Confused: {
        feelings: {
          Bewildered:    "Lost in the information. Too many inputs, no clear frame.",
          Puzzled:       "Mildly stuck. Something doesn't add up, and you're turning it over.",
          Disoriented:   "The map doesn't match the territory. You've lost your bearings.",
          Unsettled:     "Not alarmed, but something is off. A low hum of unease.",
          Perplexed:     "You can't make it make sense yet. Not distressed — just stuck at a puzzle.",
          Hesitant:      "Holding back because something doesn't feel right. Caution, not laziness.",
        }
      },
    }
  },
};

const CORE_MET = ["Joyful", "Proud", "Interested", "Peaceful", "Trusting", "Loving"];
const CORE_NOT_MET = ["Angry", "Afraid", "Sad", "Disgusted", "Ashamed", "Bad"];

const CLOSER_TEXT = "Now that it's named honestly, you have something real to work with. Clear language gives you traction — with yourself, and with the people around you. You can get specific about what's driving it, and what you actually want and need.";

const NOT_FEELINGS = [
  "Abandoned", "Attacked", "Betrayed", "Blamed", "Bullied",
  "Cheated", "Coerced", "Criticized", "Dismissed", "Disrespected",
  "Excluded", "Ignored", "Insulted", "Intimidated", "Let down",
  "Manipulated", "Misunderstood", "Neglected", "Put down",
  "Rejected", "Unappreciated", "Unheard", "Unloved", "Unwanted",
  "Used", "Violated", "Wronged"
];

// ─── MAIN ────────────────────────────────────────────────────────────
export default function FeelingsNamingGuide() {
  const [started, setStarted] = useState(false);
  const [core, setCore] = useState(null);
  const [family, setFamily] = useState(null);
  const [feeling, setFeeling] = useState(null);
  const [showNote, setShowNote] = useState(false);

  const tier2Ref = useRef(null);
  const tier3Ref = useRef(null);
  const resultRef = useRef(null);

  const color = core ? TAXONOMY[core].color : null;
  const coreData = core ? TAXONOMY[core] : null;
  const familyData = coreData && family ? coreData.families[family] : null;
  const caption = familyData && feeling ? familyData.feelings[feeling] : null;

  const scrollTo = (ref) => {
    setTimeout(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
  };

  const selectCore = (n) => { setCore(n); setFamily(null); setFeeling(null); scrollTo(tier2Ref); };
  const selectFamily = (n) => { setFamily(n); setFeeling(null); scrollTo(tier3Ref); };
  const selectFeeling = (n) => { setFeeling(n); scrollTo(resultRef); };
  const reset = () => { setCore(null); setFamily(null); setFeeling(null); };

  return (
    <div style={S.wrap}>
      <div style={S.hdr}>
        <div style={S.hdrLabel}><span style={S.hdrLine} />Growth Zone</div>
        <h1 style={S.hdrTitle}>Feelings Naming Guide</h1>
      </div>
      <div style={S.main}>
        {!started ? (
          <Intro onBegin={() => setStarted(true)} showNote={showNote} setShowNote={setShowNote} />
        ) : (
          <div style={S.flowWrap}>
            <div style={S.tierBlock}>
              <p style={S.tierLabel}>What are you feeling?</p>
              <div style={S.divRow}><span style={S.divText}>needs being met</span><div style={S.divLine}/></div>
              <div style={S.chipRow}>
                {CORE_MET.map(n => <Chip key={n} label={n} color={TAXONOMY[n].color} selected={core===n} faded={core&&core!==n} onClick={()=>selectCore(n)} />)}
              </div>
              <div style={S.divRow}><span style={S.divText}>needs not being met</span><div style={S.divLine}/></div>
              <div style={S.chipRow}>
                {CORE_NOT_MET.map(n => <Chip key={n} label={n} color={TAXONOMY[n].color} selected={core===n} faded={core&&core!==n} onClick={()=>selectCore(n)} />)}
              </div>
            </div>

            {core && <>
              <Connector color={color} />
              <div ref={tier2Ref} style={S.tierBlock}>
                <p style={{...S.tierLabel, color}}>What kind of {core.toLowerCase()}?</p>
                <div style={S.chipRow}>
                  {Object.keys(coreData.families).map(n =>
                    <Chip key={n} label={n} color={color} selected={family===n} faded={family&&family!==n} onClick={()=>selectFamily(n)} />
                  )}
                </div>
              </div>
            </>}

            {family && <>
              <Connector color={color} />
              <div ref={tier3Ref} style={S.tierBlock}>
                <p style={{...S.tierLabel, color}}>Get specific.</p>
                <div style={S.chipRow}>
                  {Object.keys(familyData.feelings).map(n =>
                    <Chip key={n} label={n} color={color} selected={feeling===n} faded={feeling&&feeling!==n} onClick={()=>selectFeeling(n)} />
                  )}
                </div>
              </div>
            </>}

            {feeling && <>
              <Connector color={color} />
              <div ref={resultRef} style={{...S.resCard, borderColor: `${color}25`}}>
                <div style={{...S.resBar, background: color}} />
                <h2 style={{...S.resWord, color}}>{feeling}</h2>
                <p style={S.resCap}>{caption}</p>
                <div style={{height:"2rem"}} />
                <p style={S.resSit}>You named it.</p>
                <div style={S.resDiv} />
                <p style={S.resCloser}>{CLOSER_TEXT}</p>
              </div>
              <div style={S.resetRow}>
                <button onClick={reset} style={S.resetBtn}
                  onMouseEnter={e=>{e.currentTarget.style.background="rgba(45,134,196,0.08)";}}
                  onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                  Start over
                </button>
              </div>
            </>}
          </div>
        )}
      </div>
      <div style={S.ftr}>
        <p style={S.ftrText}>
          Inspired by the Feelings Wheel (Dr. Gloria Willcox) and the Feelings & Needs inventory from Nonviolent Communication (Marshall Rosenberg, Ph.D.). Adapted for self-coaching use.
        </p>
      </div>
    </div>
  );
}

function Connector({ color }) {
  return <div style={S.connWrap}><div style={{...S.connLine, background: color}} /></div>;
}

function Chip({ label, color, selected, faded, onClick }) {
  const [hov, setHov] = useState(false);
  const active = selected || hov;
  return (
    <button onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{...S.chip,
        borderColor: active ? color : `${color}40`,
        background: selected ? color : hov ? `${color}15` : "transparent",
        color: selected ? "#f5f3ef" : faded ? "#3d4a58" : "#c8d4de",
        opacity: faded ? 0.45 : 1,
        transform: selected ? "scale(1.02)" : "scale(1)",
      }}>
      {label}
    </button>
  );
}

function Intro({ onBegin, showNote, setShowNote }) {
  const [hov, setHov] = useState(false);
  return (
    <div style={S.scr}>
      <p style={S.body}>People often stop at "good" or "bad" or "mad." But vague labels keep emotions in control. When you name what you're feeling with precision, the feeling loses some of its grip. You stop being <em>in</em> it and start being able to <em>work with</em> it.</p>
      <p style={S.body}>Precise emotional vocabulary also changes how you communicate. Telling someone "I feel frustrated" lands differently than "I feel bad." It gives the other person something real to respond to.</p>
      <p style={S.body}>This guide walks you through three levels of specificity: a core emotion, a family within it, and the precise word that fits.</p>
      <button onClick={onBegin} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
        style={{...S.beginBtn, background: hov ? "#2d86c4" : "transparent"}}>Begin</button>
      <div style={S.noteBox}>
        <button onClick={()=>setShowNote(!showNote)} style={S.noteTog}>
          <span style={S.noteIco}>{showNote?"−":"+"}</span>A note on real feelings vs. evaluations
        </button>
        {showNote && <div style={S.noteInner}>
          <p style={S.noteP}>Not everything we call a "feeling" is actually one. Words that follow "I feel like..." or "I feel that..." are usually <strong>evaluations</strong> of what someone else did, not descriptions of our internal state. They describe what we think happened <em>to</em> us, not what's happening <em>inside</em> us.</p>
          <p style={S.noteP}>For example: "I feel <em>betrayed</em>" is really a judgement about someone else's behaviour. The actual feeling underneath might be <em>hurt</em>, <em>scared</em>, or <em>angry</em>. Getting to the real feeling is what makes it useful.</p>
          <p style={{...S.noteP, marginBottom:"0.8rem"}}>Words that are evaluations, not feelings:</p>
          <div style={S.evalWrap}>{NOT_FEELINGS.map(w=><span key={w} style={S.evalChip}>{w}</span>)}</div>
          <p style={{...S.noteP, marginTop:"1rem", fontStyle:"italic", color:"#7a8fa3"}}>If you notice one of these, ask: "What am I actually feeling underneath that?"</p>
        </div>}
      </div>
    </div>
  );
}

const S = {
  wrap: { minHeight:"100vh", background:"#0e0f10", color:"#f5f3ef", fontFamily:"'Libre Baskerville',Georgia,serif", display:"flex", flexDirection:"column" },
  hdr: { padding:"2.5rem 2rem 1.5rem", borderBottom:"1px solid rgba(255,255,255,0.06)", background:"#1c2330" },
  hdrLabel: { fontFamily:"'Jost',sans-serif", fontWeight:400, fontSize:"0.68rem", letterSpacing:"0.3em", textTransform:"uppercase", color:"#2d86c4", marginBottom:"1rem", display:"flex", alignItems:"center", gap:"0.8rem" },
  hdrLine: { display:"block", width:"28px", height:"1px", background:"#2d86c4" },
  hdrTitle: { fontFamily:"'Cormorant Garamond',Georgia,serif", fontWeight:300, fontSize:"clamp(1.8rem,4vw,2.6rem)", lineHeight:1.1, margin:0 },
  main: { flex:1, padding:"2rem", maxWidth:"720px", margin:"0 auto", width:"100%" },
  scr: { display:"flex", flexDirection:"column", gap:"1.5rem" },
  body: { fontSize:"0.92rem", lineHeight:1.8, color:"#c8d4de", marginBottom:"1rem" },
  beginBtn: { alignSelf:"flex-start", border:"1px solid rgba(45,134,196,0.4)", borderRadius:"2px", padding:"0.85rem 2.4rem", cursor:"pointer", fontFamily:"'Jost',sans-serif", fontWeight:400, fontSize:"0.78rem", letterSpacing:"0.18em", textTransform:"uppercase", color:"#f5f3ef", transition:"background 0.25s" },
  noteBox: { border:"1px solid rgba(200,212,222,0.08)", borderRadius:"2px", overflow:"hidden" },
  noteTog: { width:"100%", background:"rgba(28,35,48,0.5)", border:"none", padding:"1rem 1.2rem", cursor:"pointer", display:"flex", alignItems:"center", gap:"0.7rem", fontFamily:"'Jost',sans-serif", fontWeight:300, fontSize:"0.78rem", letterSpacing:"0.08em", color:"#7a8fa3", textAlign:"left" },
  noteIco: { fontFamily:"monospace", fontSize:"1rem", color:"#3d4a58", width:"1rem", textAlign:"center" },
  noteInner: { padding:"1.2rem", background:"rgba(28,35,48,0.3)", borderTop:"1px solid rgba(200,212,222,0.06)" },
  noteP: { fontSize:"0.85rem", lineHeight:1.75, color:"#c8d4de", marginBottom:"0.8rem" },
  evalWrap: { display:"flex", flexWrap:"wrap", gap:"0.4rem" },
  evalChip: { fontFamily:"'Jost',sans-serif", fontWeight:300, fontSize:"0.72rem", letterSpacing:"0.06em", color:"#7a8fa3", border:"1px solid rgba(122,143,163,0.2)", borderRadius:"1px", padding:"0.25rem 0.6rem", display:"inline-block" },
  flowWrap: { display:"flex", flexDirection:"column", alignItems:"center" },
  tierBlock: { width:"100%", display:"flex", flexDirection:"column", gap:"0.6rem" },
  tierLabel: { fontFamily:"'Jost',sans-serif", fontWeight:300, fontSize:"0.82rem", color:"#7a8fa3", letterSpacing:"0.04em", textAlign:"center", margin:"0 0 0.2rem" },
  divRow: { display:"flex", alignItems:"center", gap:"0.8rem", margin:"0.3rem 0 0.1rem" },
  divText: { fontFamily:"'Jost',sans-serif", fontWeight:300, fontSize:"0.62rem", letterSpacing:"0.18em", textTransform:"uppercase", color:"#3d4a58", whiteSpace:"nowrap" },
  divLine: { flex:1, height:"1px", borderTop:"1px dashed rgba(200,212,222,0.1)" },
  chipRow: { display:"flex", flexWrap:"wrap", gap:"0.45rem", justifyContent:"center" },
  chip: { border:"1px solid", borderRadius:"2px", padding:"0.55rem 1rem", cursor:"pointer", fontFamily:"'Jost',sans-serif", fontWeight:300, fontSize:"0.8rem", letterSpacing:"0.04em", transition:"all 0.2s", whiteSpace:"nowrap" },
  connWrap: { display:"flex", justifyContent:"center", padding:"0.6rem 0" },
  connLine: { width:"2px", height:"28px", borderRadius:"1px", opacity:0.5 },
  resCard: { width:"100%", background:"#1c2330", border:"1px solid", borderRadius:"2px", padding:"2.5rem 2rem", textAlign:"center", position:"relative", overflow:"hidden" },
  resBar: { position:"absolute", top:0, left:0, right:0, height:"3px" },
  resWord: { fontFamily:"'Cormorant Garamond',Georgia,serif", fontWeight:300, fontSize:"2.6rem", lineHeight:1.1, margin:"0 0 1.2rem" },
  resCap: { fontFamily:"'Libre Baskerville',Georgia,serif", fontSize:"0.88rem", lineHeight:1.75, color:"#c8d4de", maxWidth:"480px", margin:"0 auto" },
  resSit: { fontFamily:"'Jost',sans-serif", fontWeight:300, fontSize:"0.78rem", letterSpacing:"0.15em", textTransform:"uppercase", color:"#3d4a58", marginBottom:"1.5rem" },
  resDiv: { width:"40px", height:"1px", background:"rgba(255,255,255,0.08)", margin:"0 auto 1.5rem" },
  resCloser: { fontFamily:"'Libre Baskerville',Georgia,serif", fontStyle:"italic", fontSize:"0.85rem", lineHeight:1.75, color:"#7a8fa3", maxWidth:"460px", margin:"0 auto" },
  resetRow: { display:"flex", justifyContent:"center", marginTop:"1.2rem" },
  resetBtn: { background:"transparent", border:"1px solid rgba(45,134,196,0.3)", borderRadius:"2px", padding:"0.7rem 1.8rem", cursor:"pointer", fontFamily:"'Jost',sans-serif", fontWeight:400, fontSize:"0.75rem", letterSpacing:"0.12em", color:"#2d86c4", transition:"background 0.2s" },
  ftr: { padding:"1.5rem 2rem", borderTop:"1px solid rgba(255,255,255,0.04)", background:"#0e0f10", marginTop:"3rem" },
  ftrText: { fontFamily:"'Jost',sans-serif", fontWeight:300, fontSize:"0.68rem", color:"#3d4a58", letterSpacing:"0.04em", lineHeight:1.6, maxWidth:"720px", margin:"0 auto", textAlign:"center" },
};
