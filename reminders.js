window.ReminderBrain = (() => {
  const pick = (items) => items[Math.floor(Math.random() * items.length)];

  const lowerFirst = (text = "") => {
    const clean = text.trim();
    return clean ? clean.charAt(0).toLowerCase() + clean.slice(1) : "do the thing";
  };

  const yesterdayKey = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  function timingLine(offset, human) {
    const mins = Math.abs(offset);

    if (offset === 0) {
      return pick([
        "It is time.",
        "Showtime.",
        "Your scheduled time is now."
      ]);
    }

    if (offset < 0) {
      return pick([
        `${human(mins)} until your commitment.`,
        `${human(mins)} until it is time.`,
        `You have ${human(mins)} left before your commitment starts.`
      ]);
    }

    return pick([
      `You are ${human(mins)} late.`,
      `${human(mins)} past your scheduled time.`,
      `Your commitment started ${human(mins)} ago.`
    ]);
  }

  function progressLine(goal, entries, money, clean) {
    if (!goal) return "";

    const completed = entries.filter((entry) => entry.status === "completed");
    const total = completed.reduce((sum, entry) => sum + Number(entry.progress_amount || 0), 0);

    if (!goal.target_value || total <= 0) return "";

    const remaining = Math.max(0, Number(goal.target_value) - total);

    if (goal.target_unit === "dollars") {
      return pick([
        `${money(total)} logged. ${money(remaining)} still waiting.`,
        `You have already moved ${money(total)} toward the goal.`,
        `${money(remaining)} remains. Today's action still matters.`
      ]);
    }

    return pick([
      `${clean(total)} ${goal.target_unit || "units"} logged so far.`,
      `${clean(remaining)} ${goal.target_unit || "units"} remain.`,
      `You have already made real progress. Keep moving.`
    ]);
  }

  function streakLine(currentStreak, yesterdayStatus) {
    if (currentStreak >= 30) {
      return pick([
        `${currentStreak} promises kept. This is identity now.`,
        `${currentStreak} days. Do not hand that streak away.`,
        `You built a ${currentStreak}-day streak one decision at a time.`
      ]);
    }

    if (currentStreak >= 10) {
      return pick([
        `${currentStreak} promises kept. Do not quit here.`,
        `${currentStreak} days strong. Protect it.`,
        `You are on Day ${currentStreak + 1}. Show up again.`
      ]);
    }

    if (currentStreak >= 3) {
      return pick([
        `${currentStreak} promises kept. Keep the chain alive.`,
        `You have momentum now. Do not drop it.`,
        `Day ${currentStreak + 1} is waiting.`
      ]);
    }

    if (yesterdayStatus === "skipped") {
      return pick([
        "You already missed yesterday. Do not make it two.",
        "Yesterday was a skip. Today does not have to be.",
        "One missed day is data. Two starts a pattern."
      ]);
    }

    if (yesterdayStatus === "completed") {
      return pick([
        "You kept your promise yesterday. Do it again.",
        "Yesterday counts. Repeat it.",
        "You showed up yesterday. Keep proving it."
      ]);
    }

    return pick([
      "Today can be the first promise kept.",
      "You do not need momentum to begin.",
      "Start before your brain opens negotiations."
    ]);
  }

  function categoryLine(category, goalName) {
    const map = {
      debt: [
        "Debt does not shrink while you avoid the work.",
        "Every dollar needs a job. Go earn today's piece.",
        "Freedom is built one paid-down dollar at a time."
      ],
      savings: [
        "Your future purchase is funded by today's discipline.",
        "Savings grow when excuses stop spending the day.",
        "Today's action buys Future You more options."
      ],
      business: [
        "Businesses are built by ordinary days handled well.",
        "Ideas do not pay. Repeated action does.",
        "Revenue starts after you begin."
      ],
      health: [
        "Your body remembers what you repeat.",
        "A small healthy action still counts.",
        "Consistency beats one dramatic perfect day."
      ],
      learning: [
        "Skill comes from repetitions nobody applauds.",
        "You only need to learn the next piece.",
        "Knowledge compounds when you return."
      ],
      habit: [
        "Habits are votes. Cast today's vote.",
        "Small actions become identity when repeated.",
        "Do the simple thing again."
      ],
      custom: [
        `${goalName || "Your goal"} still matters today.`,
        "The finish line did not move. You still can.",
        "Progress only needs one next action."
      ]
    };

    return pick(map[category] || map.custom);
  }

  function whyLine(whyText) {
    if (!whyText) return "";

    return pick([
      `You said: “${whyText}”`,
      `Remember why: “${whyText}”`,
      `This matters because: “${whyText}”`
    ]);
  }

  function voiceLine(voice, name, commitment, offset) {
    const action = lowerFirst(commitment);
    const late = offset > 0;

    const groups = {
      encouraging: [
        `${name}, you only need to begin.`,
        `${name}, a smaller version still counts.`,
        `${name}, Future You will be glad you showed up.`,
        `${name}, start gently. Just start.`
      ],
      direct: [
        `${name}, stop negotiating and ${action}.`,
        `${name}, your commitment is still waiting.`,
        `${name}, begin before you talk yourself out of it.`,
        `${name}, do the thing you said mattered.`
      ],
      funny: [
        `${name}, it has regrettably not completed itself.`,
        `${name}, this is the notification you specifically asked to annoy you.`,
        `${name}, the goal remains stubbornly unfinished.`,
        `${name}, please report to your own ambition immediately.`
      ],
      relentless: [
        `${name}, get up and ${action}.`,
        `${name}, stop making the same excuse prettier.`,
        `${name}, your feelings do not get to cancel the plan.`,
        `${name}, start now. Not after one more scroll.`
      ],
      unfiltered: [
        `${name}, you better fucking ${action}.`,
        `${name}, get up and do the fucking thing.`,
        `${name}, your goal is not going to handle its own shit.`,
        `${name}, quit fucking negotiating with yourself.`,
        `${name}, ${late ? "you are already late, so move." : "it is almost time. Get your ass ready."}`
      ]
    };

    return pick(groups[voice] || groups.direct);
  }

  function buildMessage(context) {
    const {
      offset = 0,
      name = "You",
      goal,
      entries = [],
      streak = 0,
      money = (n) => `$${n}`,
      clean = (n) => String(n),
      human = (n) => `${n} minutes`
    } = context;

    if (!goal) return "Your commitment is waiting.";

    const yesterday = entries.find((entry) => entry.check_date === yesterdayKey());
    const pieces = [
      timingLine(offset, human),
      voiceLine(goal.voice, name, goal.commitment, offset),
      streakLine(streak, yesterday?.status),
      categoryLine(goal.category, goal.name)
    ];

    if (goal.why_text && (offset >= 0 || Math.random() > 0.45)) {
      pieces.push(whyLine(goal.why_text));
    }

    if (goal.target_value && Math.random() > 0.45) {
      const progress = progressLine(goal, entries, money, clean);
      if (progress) pieces.push(progress);
    }

    return pieces.filter(Boolean).slice(0, 4).join(" ");
  }

  return {
    generate: buildMessage
  };
})();
